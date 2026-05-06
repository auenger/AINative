import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Plus,
  MoreHorizontal,
  CheckCircle2,
  Layout,
  ChevronDown,
  ChevronRight,
  Link2,
  User,
  Clock,
  Tag,
  Briefcase,
  Code2,
  X,
  GitBranch,
  ArrowRight,
  RefreshCw,
  Zap,
  Loader2,
  AlertTriangle,
  FileText,
  ListChecks,
  ClipboardCheck,
  Bot,
  Send,
  AlertCircle,
  Network,
  RotateCcw,
  Sparkles,
  PlayCircle,
  Search,
  ArrowUpDown,
  Timer,
  CalendarClock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { useQueueData, FeatureNode } from '../../lib/useQueueData';
import { useAgentRuntimes } from '../../lib/useAgentRuntimes';
import { useSessionStore } from '../../lib/SessionStore';
import type { AgentActionType, TaskExecutionOverlay, GhostCard, QueueName, AgentRuntimeInfo, TaskSchedule } from '../../types';
import { useTaskScheduler } from '../../lib/useTaskScheduler';
import { SchedulePickerModal } from './SchedulePickerModal';
import { SkillInitPrompt } from '../SkillInitPrompt';
import { invoke } from '@tauri-apps/api/core';
import type { ReadinessReport } from '../../types';

/** 智能时间格式化：返回相对时间与绝对时间 — 使用 i18n key */
function useFormatUpdatedTime() {
  const { t } = useTranslation();
  return useCallback((date: Date): { relative: string; absolute: string } => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    const pad = (n: number) => String(n).padStart(2, '0');
    const absolute = `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

    if (diffSec < 60) {
      return { relative: t('time.justNow'), absolute };
    }

    if (diffMin < 60) {
      return { relative: t('time.minutesAgo', { min: diffMin }), absolute };
    }

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const dateDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

    if (dateDayStart.getTime() === todayStart.getTime()) {
      return { relative: t('time.today', { time: timeStr }), absolute };
    }

    if (dateDayStart.getTime() === yesterdayStart.getTime()) {
      return { relative: t('time.yesterday', { time: timeStr }), absolute };
    }

    if (date.getFullYear() === now.getFullYear()) {
      const monthDay = `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${timeStr}`;
      return { relative: monthDay, absolute };
    }

    return { relative: absolute.replace(/:\d{2}$/, ''), absolute };
  }, [t]);
}
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { NewTaskModal } from './NewTaskModal';
import { TaskGraphView } from './TaskGraphView';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// ---------------------------------------------------------------------------
// Board column config
// ---------------------------------------------------------------------------

interface ColumnConfig {
  key: QueueName;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  colorClass: string;
  iconBg: string;
  iconColor: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    key: 'pending',
    label: 'Pending',
    sublabel: 'Waiting to start',
    icon: Clock,
    colorClass: 'border-blue-400/30',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
  },
  {
    key: 'active',
    label: 'Active',
    sublabel: 'Currently in progress',
    icon: Zap,
    colorClass: 'border-primary/30',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
  },
  {
    key: 'blocked',
    label: 'Blocked',
    sublabel: 'Waiting on dependencies',
    icon: AlertTriangle,
    colorClass: 'border-[#ffb4ab]/30',
    iconBg: 'bg-[#ffb4ab]/10',
    iconColor: 'text-[#ffb4ab]',
  },
  {
    key: 'completed',
    label: 'Completed',
    sublabel: 'Successfully delivered',
    icon: CheckCircle2,
    colorClass: 'border-tertiary/30',
    iconBg: 'bg-tertiary/10',
    iconColor: 'text-tertiary',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSizeBadge(size: string) {
  switch (size) {
    case 'S': return 'bg-tertiary/15 text-tertiary border border-tertiary/20';
    case 'M': return 'bg-secondary/15 text-secondary border border-secondary/20';
    case 'L': return 'bg-primary/15 text-primary border border-primary/20';
    case 'XL': return 'bg-[#ffb4ab]/15 text-[#ffb4ab] border border-[#ffb4ab]/20';
    default: return 'bg-surface-container-highest text-on-surface-variant';
  }
}

function getPriorityIndicator(priority: number) {
  if (priority >= 80) return 'bg-red-400 w-2.5 h-2.5';
  if (priority >= 50) return 'bg-amber-400 w-2 h-2';
  if (priority >= 30) return 'bg-tertiary w-1.5 h-1.5';
  return 'bg-outline w-1.5 h-1.5';
}

/** Overlay border color by status. */
function getOverlayBorderClass(status: TaskExecutionOverlay['status']) {
  switch (status) {
    case 'dispatching': return 'border-warning/50';
    case 'streaming': return 'border-primary/50';
    case 'writing': return 'border-secondary/50';
    case 'done': return 'border-tertiary/50';
    case 'error': return 'border-[#ffb4ab]/50';
    default: return '';
  }
}

/** Overlay status badge label. */
function getOverlayStatusLabel(status: TaskExecutionOverlay['status']) {
  switch (status) {
    case 'dispatching': return 'Dispatching';
    case 'streaming': return 'Streaming';
    case 'writing': return 'Syncing...';
    case 'done': return 'Done';
    case 'error': return 'Error';
    default: return status;
  }
}

/** Overlay status badge color. */
function getOverlayBadgeClass(status: TaskExecutionOverlay['status']) {
  switch (status) {
    case 'dispatching': return 'bg-warning/15 text-warning';
    case 'streaming': return 'bg-primary/15 text-primary';
    case 'writing': return 'bg-secondary/15 text-secondary';
    case 'done': return 'bg-tertiary/15 text-tertiary';
    case 'error': return 'bg-[#ffb4ab]/15 text-[#ffb4ab]';
    default: return 'bg-surface-container-highest text-on-surface-variant';
  }
}

// ---------------------------------------------------------------------------
// Feature Card (draggable, with overlay support)
// ---------------------------------------------------------------------------

interface FeatureCardProps {
  feature: FeatureNode;
  allFeatures: FeatureNode[];
  onClick: (f: FeatureNode) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  overlay?: TaskExecutionOverlay;
  /** Which queue column this card is in */
  queueColumn?: QueueName;
  /** Whether this feature is a split parent (has split: true + children in queue) */
  isSplitParent?: boolean;
  /** Callback when "Run" button is clicked */
  onExecClick?: (feature: FeatureNode) => void;
  /** Current search query for highlighting matches */
  searchQuery?: string;
  /** Highlight matching text callback */
  onHighlight?: (text: string, query: string) => React.ReactNode;
  /** Schedule for this feature, if any */
  schedule?: TaskSchedule;
  /** Callback when schedule clock button is clicked */
  onScheduleClick?: (feature: FeatureNode) => void;
  /** Callback to cancel a schedule */
  onScheduleCancel?: (scheduleId: string) => void;
  /** Callback to execute a missed schedule now */
  onScheduleExecuteNow?: (scheduleId: string) => void;
  /** Callback to delete a schedule */
  onScheduleDelete?: (scheduleId: string) => void;
  /** Format countdown text */
  formatCountdown?: (triggerAt: string) => string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ feature, allFeatures, onClick, onDragStart, overlay, queueColumn, isSplitParent, onExecClick, searchQuery, onHighlight, schedule, onScheduleClick, onScheduleCancel, onScheduleExecuteNow, onScheduleDelete, formatCountdown }) => {
  const [expanded, setExpanded] = useState(false);
  const hasDeps = feature.dependencies.length > 0;
  const isPending = queueColumn === 'pending';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      draggable
      onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, feature.id)}
      className={cn(
        "relative p-4 rounded-xl border bg-surface-container-low",
        "hover:border-outline-variant/40 transition-all group cursor-grab active:cursor-grabbing",
        "hover:shadow-lg hover:shadow-primary/5",
        feature.priority >= 80 && "border-l-2 border-l-red-400/40",
        // Overlay border override
        overlay
          ? cn(getOverlayBorderClass(overlay.status), overlay.status === 'streaming' && 'animate-pulse')
          : "border-outline-variant/10"
      )}
      onClick={() => onClick(feature)}
    >
      {/* Overlay visual layer (pointer-events-none to not block clicks) */}
      {overlay && (
        <div className="absolute inset-0 rounded-xl pointer-events-none">
          {/* Status badge in top-right */}
          <div className={cn(
            "absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
            getOverlayBadgeClass(overlay.status)
          )}>
            {overlay.status !== 'done' && overlay.status !== 'error' && (
              <Loader2 size={8} className="animate-spin" />
            )}
            {overlay.status === 'done' && <CheckCircle2 size={8} />}
            {overlay.status === 'error' && <AlertCircle size={8} />}
            {getOverlayStatusLabel(overlay.status)}
          </div>

          {/* Output preview at bottom (only during streaming) */}
          {overlay.status === 'streaming' && overlay.outputPreview && (
            <div className="absolute bottom-2 left-3 right-3">
              <p className="text-[8px] text-on-surface-variant opacity-60 truncate font-mono">
                {overlay.outputPreview}
              </p>
            </div>
          )}

          {/* Error preview */}
          {overlay.status === 'error' && (
            <div className="absolute bottom-2 left-3 right-3">
              <p className="text-[8px] text-[#ffb4ab] opacity-80 truncate">
                Execution failed
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className={cn("rounded-full", getPriorityIndicator(feature.priority))} />
            <span className="text-[9px] font-bold text-outline uppercase tracking-tighter">
              {searchQuery && onHighlight ? onHighlight(feature.id, searchQuery) : feature.id}
            </span>
            <span className={cn(
              "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded",
              getSizeBadge(feature.size)
            )}>
              {feature.size}
            </span>
          </div>
          <h3 className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors leading-tight">
            {searchQuery && onHighlight ? onHighlight(feature.name || feature.id, searchQuery) : (feature.name || feature.id)}
          </h3>
        </div>
        <button className="p-1 hover:bg-surface-container-high rounded transition-colors opacity-0 group-hover:opacity-100">
          <MoreHorizontal size={14} className="text-outline" />
        </button>
      </div>

      {/* Details indicator */}
      {feature.details?.description && (
        <p className="text-[10px] text-on-surface-variant opacity-70 mb-3 line-clamp-2 leading-relaxed">
          {feature.details.description}
        </p>
      )}

      {/* Dependency summary — always visible when deps exist */}
      {hasDeps && !expanded && (
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          {feature.dependencies.slice(0, 3).map(depId => {
            const dep = allFeatures.find(f => f.id === depId);
            const isResolved = !!dep;
            return (
              <span key={depId} className={cn(
                "inline-flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded",
                isResolved
                  ? "bg-tertiary/10 text-tertiary"
                  : "bg-[#ffb4ab]/10 text-[#ffb4ab]"
              )}>
                <Link2 size={8} />
                {depId}
              </span>
            );
          })}
          {feature.dependencies.length > 3 && (
            <span className="text-[8px] text-on-surface-variant font-medium">
              +{feature.dependencies.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Schedule badge (shown when feature has an active/missed schedule) */}
      {schedule && schedule.status !== 'cancelled' && (
        <div className="mb-2">
          {schedule.status === 'pending' && (
            <div className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-bold",
              "bg-secondary/10 text-secondary border border-secondary/20"
            )}>
              <CalendarClock size={9} />
              {formatCountdown ? formatCountdown(schedule.triggerAt) : new Date(schedule.triggerAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              <button
                onClick={(e) => { e.stopPropagation(); onScheduleCancel?.(schedule.id); }}
                className="ml-1 p-0.5 hover:bg-secondary/20 rounded-full transition-colors"
                title="Cancel schedule"
              >
                <X size={7} />
              </button>
            </div>
          )}
          {schedule.status === 'triggered' && (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20">
              <CheckCircle2 size={9} />
              Triggered
            </div>
          )}
          {schedule.status === 'missed' && (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-bold bg-warning/10 text-warning border border-warning/20">
              <AlertTriangle size={9} />
              Missed
              <button
                onClick={(e) => { e.stopPropagation(); onScheduleExecuteNow?.(schedule.id); }}
                className="ml-1 px-1 py-0 bg-warning/20 hover:bg-warning/30 rounded text-[7px] uppercase tracking-wider transition-colors"
              >
                Run Now
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onScheduleDelete?.(schedule.id); }}
                className="p-0.5 hover:bg-warning/20 rounded-full transition-colors"
                title="Delete schedule"
              >
                <X size={7} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tags row: priority + deps + status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-[9px] px-1.5 py-0.5 rounded font-bold",
            feature.priority >= 80
              ? "bg-red-400/15 text-red-400"
              : feature.priority >= 50
                ? "bg-amber-400/15 text-amber-400"
                : "bg-surface-container-highest text-on-surface-variant"
          )}>
            P{feature.priority}
          </span>
          {feature.tag && (
            <span className="text-[9px] bg-tertiary/10 px-1.5 py-0.5 rounded text-tertiary font-medium">
              {feature.tag}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Run Feature button — only on pending cards */}
          {isPending && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isSplitParent && onExecClick) {
                  onExecClick(feature);
                }
              }}
              disabled={isSplitParent}
              title={isSplitParent ? 'Split parent task, execute sub-features instead' : 'Run Feature'}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all",
                isSplitParent
                  ? "opacity-50 cursor-not-allowed text-on-surface-variant bg-surface-container-highest"
                  : "text-primary bg-primary/10 hover:bg-primary/20 hover:-translate-y-0.5 active:translate-y-0 border border-primary/20"
              )}
            >
              <PlayCircle size={11} />
              Run
            </button>
          )}

          {/* Schedule clock button — only on pending cards without active schedule */}
          {isPending && !schedule && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onScheduleClick?.(feature);
              }}
              title="Schedule trigger"
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all",
                "text-secondary bg-secondary/5 hover:bg-secondary/15 hover:-translate-y-0.5 active:translate-y-0 border border-secondary/15"
              )}
            >
              <Timer size={11} />
            </button>
          )}

          {hasDeps && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(prev => !prev);
              }}
              className="flex items-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 px-2 py-1 rounded transition-all"
            >
              <Link2 size={12} />
              {feature.dependencies.length}
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded dependencies */}
      <AnimatePresence>
        {expanded && hasDeps && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 pt-3 border-t border-outline-variant/10 space-y-2 overflow-hidden"
          >
            {feature.dependencies.map(depId => {
              const dep = allFeatures.find(f => f.id === depId);
              return (
                <div key={depId} className="flex flex-col gap-1 p-2 rounded bg-surface-container-high/50 border border-outline-variant/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="text-[9px] font-bold text-primary">{depId}</span>
                    </div>
                    <span className="text-[8px] font-bold uppercase px-1 rounded bg-surface-container-highest text-on-surface-variant">
                      {dep ? 'loaded' : 'unknown'}
                    </span>
                  </div>
                  <span className="text-[10px] text-on-surface-variant truncate font-medium">
                    {dep?.name || 'Unknown dependency'}
                  </span>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Ghost Feature Card (placeholder for new features being created)
// ---------------------------------------------------------------------------

interface GhostFeatureCardProps {
  ghost: GhostCard;
  onClick?: () => void;
}

const GhostFeatureCard: React.FC<GhostFeatureCardProps> = ({ ghost, onClick }) => {
  const isCreating = ghost.status === 'creating';
  const isSynced = ghost.status === 'created' || ghost.status === 'syncing';
  const isError = ghost.status === 'error';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "p-4 rounded-xl border bg-surface-container-low/60 transition-all",
        isCreating && "opacity-60 border-dashed border-primary/30 animate-pulse",
        isSynced && "opacity-80 border-primary/40",
        isError && "opacity-60 border-[#ffb4ab]/30",
        !isCreating && !isSynced && !isError && "border-dashed border-primary/30 opacity-60",
      )}
    >
      {/* Top status bar */}
      <div className="flex items-center gap-2 mb-2">
        {isCreating && (
          <>
            <Loader2 size={10} className="text-primary animate-spin" />
            <span className="text-[9px] font-bold text-primary uppercase tracking-wider">Creating...</span>
            <Sparkles size={10} className="text-primary ml-1" />
          </>
        )}
        {isSynced && (
          <>
            <CheckCircle2 size={10} className="text-tertiary" />
            <span className="text-[9px] font-bold text-tertiary uppercase tracking-wider">Synced</span>
          </>
        )}
        {isError && (
          <>
            <AlertCircle size={10} className="text-[#ffb4ab]" />
            <span className="text-[9px] font-bold text-[#ffb4ab] uppercase tracking-wider">Error</span>
          </>
        )}
      </div>

      {/* Feature name */}
      <h3 className="text-sm font-bold text-on-surface leading-tight truncate">
        {ghost.name}
      </h3>

      {/* Preview text */}
      {ghost.preview && (
        <p className="text-[9px] text-on-surface-variant opacity-60 mt-1 line-clamp-2 leading-relaxed">
          {ghost.preview}
        </p>
      )}

      {/* Ghost indicator */}
      <div className="flex items-center gap-1.5 mt-2">
        <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
        <span className="text-[8px] text-on-surface-variant font-medium">
          ghost-{ghost.tempId.slice(-6)}
        </span>
      </div>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Execution Dialog (Run Feature confirmation)
// ---------------------------------------------------------------------------

interface ExecutionDialogProps {
  feature: FeatureNode;
  runtimes: AgentRuntimeInfo[];
  selectedRuntimeId: string;
  onRuntimeChange: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  docCheck: { hasAllDocs: boolean; missingDocs: string[] } | null;
}

const ExecutionDialog: React.FC<ExecutionDialogProps> = ({
  feature,
  runtimes,
  selectedRuntimeId,
  onRuntimeChange,
  onConfirm,
  onCancel,
  docCheck,
}) => {
  const availableRuntimes = runtimes.filter(r => r.status === 'available' || r.status === 'busy');
  const canExecute = docCheck?.hasAllDocs;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-surface-container-low border border-outline-variant/20 rounded-xl shadow-2xl max-w-md w-full p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <PlayCircle size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-on-surface">Run Feature</h3>
            <p className="text-[10px] text-on-surface-variant">
              Start automated feature execution lifecycle
            </p>
          </div>
        </div>

        {/* Feature info */}
        <div className="mb-4 p-3 rounded-lg bg-surface-container-high/50 border border-outline-variant/5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-bold text-outline uppercase tracking-tighter">{feature.id}</span>
            <span className={cn(
              "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded",
              getSizeBadge(feature.size)
            )}>
              {feature.size}
            </span>
          </div>
          <p className="text-xs font-medium text-on-surface">{feature.name}</p>
        </div>

        {/* Missing docs warning */}
        {docCheck && !docCheck.hasAllDocs && (
          <div className="mb-4 rounded-lg bg-[#ffb4ab]/10 border border-[#ffb4ab]/20 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-[#ffb4ab] shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] text-[#ffb4ab] font-medium">
                  Missing required documents
                </p>
                <p className="text-[9px] text-on-surface-variant mt-1">
                  {docCheck.missingDocs.join(', ')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Runtime selector */}
        <div className="mb-5 space-y-2">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-outline">Runtime Agent</h4>
          <select
            value={selectedRuntimeId}
            onChange={(e) => onRuntimeChange(e.target.value)}
            className={cn(
              "w-full px-3 py-2 rounded-lg text-[11px] bg-surface-container-high text-on-surface",
              "border border-outline-variant/20 focus:border-primary/50 focus:ring-1 focus:ring-primary/30",
              "outline-none transition-all appearance-none cursor-pointer"
            )}
          >
            {availableRuntimes.length === 0 && (
              <option value="">No runtimes available</option>
            )}
            {availableRuntimes.map(r => (
              <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
            ))}
          </select>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-[11px] font-bold bg-surface-container-highest text-on-surface hover:bg-surface-variant transition-all border border-outline-variant/20"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canExecute}
            className={cn(
              'flex items-center gap-1.5 px-5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all',
              canExecute
                ? 'bg-primary text-on-primary hover:bg-primary/90'
                : 'bg-surface-container-highest text-outline cursor-not-allowed',
            )}
          >
            <PlayCircle size={12} />
            Confirm Execution
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TaskBoard Component
// ---------------------------------------------------------------------------

type SortMode = 'priority-desc' | 'priority-asc' | 'time-desc' | 'time-asc';

interface TaskBoardProps {
  activeView: string;
  workspacePath: string;
}

export const TaskBoard: React.FC<TaskBoardProps> = ({ activeView, workspacePath }) => {
  const { t } = useTranslation();
  const formatUpdatedTime = useFormatUpdatedTime();
  const {
    queueState, loading, error, refresh, moveTask, readDetail,
    // Overlay state
    overlayState, setOverlay, clearOverlay, setOverlayError,
    // Ghost card state
    ghostCards, addGhostCard, updateGhostCard, removeGhostCard,
  } = useQueueData();
  const sessionStore = useSessionStore();

  // ─── Skill readiness check ───
  const [skillReport, setSkillReport] = useState<ReadinessReport | null>(null);
  useEffect(() => {
    if (!workspacePath) return;
    invoke<ReadinessReport>('check_skill_readiness', { projectPath: workspacePath })
      .then(setSkillReport)
      .catch(() => {});
  }, [workspacePath]);

  // ─── Task Scheduler state ───
  const {
    schedules: allSchedules,
    pendingSchedules,
    getScheduleForFeature,
    createSchedule,
    cancelSchedule,
    triggerNow,
    deleteSchedule,
    setOnTrigger,
    formatCountdown,
  } = useTaskScheduler();

  // Schedule picker modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleTargetFeature, setScheduleTargetFeature] = useState<FeatureNode | null>(null);
  const [scheduleIsAllPending, setScheduleIsAllPending] = useState(false);

  // Handle schedule trigger: dispatch execution
  const handleScheduleTrigger = useCallback((schedule: TaskSchedule) => {
    if (!isTauri) {
      // Dev fallback: simulate execution
      console.log(`[Scheduler] Triggered: ${schedule.action} for ${schedule.featureId}`);
      return;
    }

    // Dispatch via Tauri runtime
    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        if (schedule.action === 'run-feature' && schedule.featureId !== 'all-pending') {
          await invoke('runtime_session_start', { runtimeId: 'claude-code' });
          await invoke('runtime_execute', {
            runtimeId: 'claude-code',
            message: `/run-feature ${schedule.featureId}`,
            sessionId: null,
            systemPrompt: null,
          });
        } else {
          await invoke('runtime_session_start', { runtimeId: 'claude-code' });
          await invoke('runtime_execute', {
            runtimeId: 'claude-code',
            message: '/dev-agent',
            sessionId: null,
            systemPrompt: null,
          });
        }
      } catch (e) {
        console.error('[Scheduler] Trigger failed:', e);
      }
    })();
  }, []);

  // Set trigger callback
  useEffect(() => {
    setOnTrigger(handleScheduleTrigger);
  }, [handleScheduleTrigger, setOnTrigger]);

  // Schedule click handler: open the schedule picker modal
  const handleScheduleClick = useCallback((feature: FeatureNode) => {
    setScheduleTargetFeature(feature);
    setScheduleIsAllPending(false);
    setShowScheduleModal(true);
  }, []);

  // Handle schedule confirmation
  const handleScheduleConfirm = useCallback((params: {
    featureId: string | 'all-pending';
    triggerAt: string;
    action: 'run-feature' | 'dev-agent';
  }) => {
    createSchedule(params);
    setShowScheduleModal(false);
    setScheduleTargetFeature(null);
  }, [createSchedule]);

  // Auto-refresh when workspace becomes available or when switching to tasks tab
  useEffect(() => {
    if (workspacePath && activeView === 'tasks') {
      refresh();
    }
  }, [workspacePath, activeView, refresh]);

  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<FeatureNode | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<Record<string, string> | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'graph'>('board');
  const [detailTab, setDetailTab] = useState<'spec' | 'tasks' | 'checklist' | 'agent'>('spec');

  // Search & Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('priority-desc');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Agent tab state
  const { runtimes, scanning, scan: scanRuntimes } = useAgentRuntimes();
  const [agentAction, setAgentAction] = useState<AgentActionType>('review');
  const [agentInput, setAgentInput] = useState('');
  const [agentSending, setAgentSending] = useState(false);
  const [agentOutput, setAgentOutput] = useState('');
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentDone, setAgentDone] = useState(false);
  const agentStreamingRef = useRef<string>('');

  // Session resume indicator state
  const [resumedSession, setResumedSession] = useState(false);
  const resumedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Safe-close confirmation state
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Execution dialog state (Run Feature button)
  const [showExecDialog, setShowExecDialog] = useState(false);
  const [execTargetFeature, setExecTargetFeature] = useState<FeatureNode | null>(null);
  const [selectedRuntimeId, setSelectedRuntimeId] = useState<string>('claude-code');
  const [execDocCheck, setExecDocCheck] = useState<{ hasAllDocs: boolean; missingDocs: string[] } | null>(null);

  // Drag state
  const draggedIdRef = useRef<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<QueueName | null>(null);

  // Modal drag state
  const [modalPos, setModalPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleModalHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    // Only respond to primary mouse button on the header area itself
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDraggingModal(true);
    dragOffsetRef.current = {
      x: e.clientX - modalPos.x,
      y: e.clientY - modalPos.y,
    };
  }, [modalPos]);

  useEffect(() => {
    if (!isDraggingModal) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffsetRef.current.x;
      const newY = e.clientY - dragOffsetRef.current.y;
      // Keep modal within viewport bounds
      const clampedX = Math.max(-window.innerWidth * 0.3, Math.min(window.innerWidth * 0.5, newX));
      const clampedY = Math.max(-window.innerHeight * 0.4, Math.min(window.innerHeight - 80, newY));
      setModalPos({ x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => {
      setIsDraggingModal(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingModal]);

  // Close modal helper: resets modal position, saves session before clearing
  const closeModal = useCallback(() => {
    // Save current agent state to SessionStore before clearing
    if (selectedFeature) {
      try {
        sessionStore.saveTaskSession({
          featureId: selectedFeature.id,
          agentOutput,
          agentAction,
          agentDone,
          agentError,
          lastActiveTab: detailTab,
          savedAt: 0, // will be overwritten by SessionStore
        });
      } catch {
        // Silently ignore save errors — session persistence is best-effort
      }
    }

    setSelectedFeature(null);
    setSelectedDetail(null);
    setDetailTab('spec');
    setModalPos({ x: 0, y: 0 });
    // Reset agent tab state
    setAgentAction('review');
    setAgentInput('');
    setAgentSending(false);
    setAgentOutput('');
    setAgentError(null);
    setAgentDone(false);
    agentStreamingRef.current = '';
    setResumedSession(false);
  }, [selectedFeature, agentOutput, agentAction, agentDone, agentError, detailTab, sessionStore]);

  // Whether the agent is currently active (streaming / sending)
  const isAgentActive = agentSending && !agentDone;

  // Safe-close request: check if agent is active before closing
  const requestCloseModal = useCallback(() => {
    if (isAgentActive) {
      setShowCloseConfirm(true);
    } else {
      closeModal();
    }
  }, [isAgentActive, closeModal]);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    draggedIdRef.current = id;
    e.dataTransfer.effectAllowed = 'move';
    // Set a transparent drag image
    const el = e.currentTarget as HTMLElement;
    e.dataTransfer.setDragImage(el, el.offsetWidth / 2, 20);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnKey: QueueName) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnKey);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetQueue: QueueName) => {
    e.preventDefault();
    setDragOverColumn(null);
    const id = draggedIdRef.current;
    if (!id) return;
    draggedIdRef.current = null;
    await moveTask(id, targetQueue);
    // Clear session when feature is moved to completed
    if (targetQueue === 'completed') {
      try { sessionStore.clearTaskSession(id); } catch { /* ignore */ }
    }
  }, [moveTask, sessionStore]);

  // Feature click => open detail modal, restore session if available
  const handleFeatureClick = useCallback(async (feature: FeatureNode) => {
    setSelectedFeature(feature);
    const detail = await readDetail(feature.id);
    setSelectedDetail(detail);

    // Try to restore session from SessionStore
    try {
      const session = sessionStore.loadTaskSession(feature.id);
      if (session) {
        setAgentOutput(session.agentOutput);
        setAgentAction(session.agentAction);
        setAgentDone(session.agentDone);
        setAgentError(session.agentError);
        setDetailTab(session.lastActiveTab);
        setResumedSession(true);
        // Auto-dismiss after 3 seconds
        if (resumedTimerRef.current) clearTimeout(resumedTimerRef.current);
        resumedTimerRef.current = setTimeout(() => setResumedSession(false), 3000);
      } else {
        setResumedSession(false);
      }
    } catch {
      // Stale/corrupted session: fallback to default state, clear silently
      sessionStore.clearTaskSession(feature.id);
      setResumedSession(false);
    }
  }, [readDetail, sessionStore]);

  // All features flat for dependency lookups
  const allFeatures: FeatureNode[] = queueState
    ? [...queueState.active, ...queueState.pending, ...queueState.blocked, ...queueState.completed]
    : [];

  // Graph data: features with their queue status
  const graphFeatures = useMemo(() => {
    if (!queueState) return [];
    const result: { feature: FeatureNode; queue: QueueName }[] = [];
    for (const q of ['active', 'pending', 'blocked', 'completed'] as QueueName[]) {
      for (const f of queueState[q]) {
        result.push({ feature: f, queue: q });
      }
    }
    return result;
  }, [queueState]);

  // Agent tab: send handler (with overlay integration)
  const handleAgentSend = useCallback(async () => {
    if (!selectedFeature) return;
    if (agentAction === 'modify' && !agentInput.trim()) return;

    const claudeRuntime = runtimes.find(r => r.id === 'claude-code');
    if (!claudeRuntime || claudeRuntime.status === 'not-installed') {
      setAgentError('Claude Code runtime is not available. Please install it first.');
      return;
    }

    setAgentSending(true);
    setAgentOutput('');
    setAgentError(null);
    setAgentDone(false);
    agentStreamingRef.current = '';

    const featureId = selectedFeature.id;

    // ─── Layer A: Set dispatching overlay immediately ───
    setOverlay(featureId, { status: 'dispatching', action: agentAction });

    try {
      const specContent = selectedDetail?.['spec.md'] ?? '';
      const taskContent = selectedDetail?.['task.md'] ?? '';

      let prompt = '';
      let skill = '/new-feature';

      if (agentAction === 'review') {
        prompt = `Review this feature spec for completeness and consistency:\n\n<spec>\n${specContent}\n</spec>\n\nUser notes: ${agentInput.trim() || '(none)'}`;
      } else if (agentAction === 'modify') {
        prompt = `Modify feature ${featureId}:\n\nUser modification request: ${agentInput.trim()}\n\nCurrent spec:\n<spec>\n${specContent}\n</spec>\n\nCurrent tasks:\n<tasks>\n${taskContent}\n</tasks>`;
      } else {
        // develop
        skill = '/dev-agent';
        prompt = featureId;
      }

      if (!isTauri) {
        // Dev fallback: simulate agent execution
        setOverlay(featureId, { status: 'streaming', action: agentAction, outputPreview: 'Connecting to Claude Code...' });
        setAgentOutput('Connecting to Claude Code...\n');
        await new Promise(resolve => setTimeout(resolve, 1000));
        setAgentOutput(prev => prev + `Executing ${skill}...\n`);
        setOverlay(featureId, { status: 'streaming', action: agentAction, outputPreview: `Executing ${skill}...` });
        await new Promise(resolve => setTimeout(resolve, 1500));
        const mockResult = agentAction === 'review'
          ? 'Spec review complete. The feature spec looks well-structured. Consider adding more edge cases to the acceptance criteria.'
          : agentAction === 'modify'
          ? `Feature ${featureId} has been modified according to your instructions.`
          : `Development started for feature ${featureId}.`;
        setAgentOutput(prev => prev + '\n' + mockResult);
        setAgentDone(true);
        setAgentSending(false);
        // Overlay: done state
        setOverlay(featureId, { status: 'done', action: agentAction });
        // Auto-refresh detail after completion
        const detail = await readDetail(featureId);
        if (detail) setSelectedDetail(detail);
        await refresh();
        return;
      }

      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      // Listen for streaming output via agent://chunk (with overlay updates)
      const unlisten = await listen<{ text: string; is_done: boolean; error?: string; type?: string }>(
        'agent://chunk',
        (event) => {
          const chunk = event.payload;
          // Handle error chunks (but not stderr — those are just diagnostics)
          if (chunk.error && chunk.type !== 'stderr') {
            setAgentError(chunk.error);
            setOverlayError(featureId);
            if (chunk.is_done) {
              unlisten();
            }
            return;
          }
          // Stream text from assistant / system / raw messages
          if (chunk.text && (chunk.type === 'assistant' || chunk.type === 'system' || chunk.type === 'raw' || !chunk.type)) {
            agentStreamingRef.current += chunk.text;
            setAgentOutput(agentStreamingRef.current);

            // Update overlay: streaming with last 2 lines as preview
            const lines = agentStreamingRef.current.split('\n').filter(Boolean);
            const lastLines = lines.slice(-2).join('\n');
            setOverlay(featureId, { status: 'streaming', action: agentAction, outputPreview: lastLines });
          }
          if (chunk.is_done) {
            unlisten();
            setAgentDone(true);
            // Overlay: writing (waiting for fs refresh)
            setOverlay(featureId, { status: 'writing', action: agentAction });
            // Auto-refresh detail after completion
            readDetail(featureId).then(detail => {
              if (detail) setSelectedDetail(detail);
            });
            refresh();
          }
        }
      );

      // Start runtime session
      await invoke('runtime_session_start', { runtimeId: 'claude-code' });

      // Send message via runtime_execute
      const message = agentAction === 'develop' ? `/dev-agent ${featureId}` : `${skill} ${prompt}`;
      await invoke('runtime_execute', {
        runtimeId: 'claude-code',
        message,
        sessionId: null,
        systemPrompt: null,
      });
    } catch (e: any) {
      setAgentError(e?.toString() ?? 'An unexpected error occurred during agent execution');
      setOverlayError(featureId);
    } finally {
      setAgentSending(false);
    }
  }, [selectedFeature, selectedDetail, agentAction, agentInput, runtimes, readDetail, refresh, setOverlay, setOverlayError]);

  // ─── Ghost card creation handler (passed to NewTaskModal) ───
  const handleGhostCardCreate = useCallback((ghost: Omit<GhostCard, 'startedAt'>) => {
    addGhostCard(ghost);
  }, [addGhostCard]);

  // ─── Build a set of split parent IDs from queue.yaml parents + pending entries with split:true ───
  const splitParentIds = useMemo(() => {
    const ids = new Set<string>();
    if (queueState) {
      // Check parents array for features with split:true
      for (const parent of queueState.parents) {
        ids.add(parent.id);
      }
      // Also check pending entries that have split field
      for (const f of queueState.pending) {
        if ((f as any).split) {
          ids.add(f.id);
        }
      }
    }
    return ids;
  }, [queueState]);

  // ─── Search & Sort Logic ───

  /** Fuzzy filter: multi-keyword AND match on id + name (case-insensitive) */
  const filterFeatures = useCallback((features: FeatureNode[], query: string): FeatureNode[] => {
    if (!query.trim()) return features;
    const keywords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (keywords.length === 0) return features;
    return features.filter(f => {
      const text = `${f.id} ${f.name}`.toLowerCase();
      return keywords.every(kw => text.includes(kw));
    });
  }, []);

  /** Sort features by current sortMode */
  const sortFeatures = useCallback((features: FeatureNode[], queueKey: QueueName): FeatureNode[] => {
    const sorted = [...features];
    sorted.sort((a, b) => {
      switch (sortMode) {
        case 'priority-desc': return b.priority - a.priority;
        case 'priority-asc': return a.priority - b.priority;
        case 'time-desc': {
          const timeA = queueKey === 'completed' ? a.completed_at : a.created_at;
          const timeB = queueKey === 'completed' ? b.completed_at : b.created_at;
          if (!timeA && !timeB) return 0;
          if (!timeA) return 1;
          if (!timeB) return -1;
          return new Date(timeB).getTime() - new Date(timeA).getTime();
        }
        case 'time-asc': {
          const timeA = queueKey === 'completed' ? a.completed_at : a.created_at;
          const timeB = queueKey === 'completed' ? b.completed_at : b.created_at;
          if (!timeA && !timeB) return 0;
          if (!timeA) return 1;
          if (!timeB) return -1;
          return new Date(timeA).getTime() - new Date(timeB).getTime();
        }
        default: return 0;
      }
    });
    return sorted;
  }, [sortMode]);

  /** Memoized filtered + sorted data per column */
  const filteredSortedData = useMemo(() => {
    if (!queueState) return { active: [], pending: [], blocked: [], completed: [] };
    const result: Record<QueueName, FeatureNode[]> = {
      active: [],
      pending: [],
      blocked: [],
      completed: [],
    };
    for (const key of ['active', 'pending', 'blocked', 'completed'] as QueueName[]) {
      const filtered = filterFeatures(queueState[key], searchQuery);
      result[key] = sortFeatures(filtered, key);
    }
    return result;
  }, [queueState, searchQuery, filterFeatures, sortFeatures]);

  /** Total matched count across all columns */
  const totalFilteredCount = useMemo(() => {
    return filteredSortedData.active.length + filteredSortedData.pending.length +
           filteredSortedData.blocked.length + filteredSortedData.completed.length;
  }, [filteredSortedData]);

  /** Highlight matching text in a string */
  const highlightMatch = useCallback((text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;
    const keywords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (keywords.length === 0) return text;

    // Find all match ranges
    const lower = text.toLowerCase();
    const ranges: [number, number][] = [];
    for (const kw of keywords) {
      let start = 0;
      while (true) {
        const idx = lower.indexOf(kw, start);
        if (idx === -1) break;
        ranges.push([idx, idx + kw.length]);
        start = idx + 1;
      }
    }
    if (ranges.length === 0) return text;

    // Sort ranges by start position
    ranges.sort((a, b) => a[0] - b[0]);

    // Merge overlapping ranges
    const merged: [number, number][] = [ranges[0]];
    for (let i = 1; i < ranges.length; i++) {
      const last = merged[merged.length - 1];
      if (ranges[i][0] <= last[1]) {
        last[1] = Math.max(last[1], ranges[i][1]);
      } else {
        merged.push(ranges[i]);
      }
    }

    // Build highlighted React nodes
    const parts: React.ReactNode[] = [];
    let prevEnd = 0;
    for (const [s, e] of merged) {
      if (s > prevEnd) parts.push(text.slice(prevEnd, s));
      parts.push(<mark key={s} className="bg-primary/30 text-on-surface rounded-sm px-0.5">{text.slice(s, e)}</mark>);
      prevEnd = e;
    }
    if (prevEnd < text.length) parts.push(text.slice(prevEnd));
    return parts;
  }, []);

  // Close sort dropdown on outside click
  useEffect(() => {
    if (!sortDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setSortDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sortDropdownOpen]);

  // ─── Run Feature exec button click handler ───
  const handleExecButtonClick = useCallback(async (feature: FeatureNode) => {
    // Check document completeness
    const detail = await readDetail(feature.id);
    const requiredDocs = ['spec.md', 'task.md', 'checklist.md'];
    const missingDocs: string[] = [];
    for (const doc of requiredDocs) {
      if (!detail || !detail[doc] || detail[doc].trim().length === 0) {
        missingDocs.push(doc);
      }
    }
    const hasAllDocs = missingDocs.length === 0;
    setExecDocCheck({ hasAllDocs, missingDocs });

    if (!hasAllDocs) {
      // Still open dialog but user can see the issue
      setExecTargetFeature(feature);
      setShowExecDialog(true);
      return;
    }

    setExecTargetFeature(feature);
    setSelectedRuntimeId('claude-code');
    setShowExecDialog(true);
  }, [readDetail]);

  // ─── Execute /run-feature dispatch ───
  const handleExecConfirm = useCallback(async () => {
    if (!execTargetFeature) return;

    const featureId = execTargetFeature.id;
    setShowExecDialog(false);

    // Set overlay to dispatching
    setOverlay(featureId, { status: 'dispatching', action: 'develop' });

    try {
      if (!isTauri) {
        // Dev fallback: simulate execution
        setOverlay(featureId, { status: 'streaming', action: 'develop', outputPreview: 'Starting /run-feature...' });
        await new Promise(resolve => setTimeout(resolve, 1500));
        setOverlay(featureId, { status: 'streaming', action: 'develop', outputPreview: `Executing /run-feature ${featureId}...` });
        await new Promise(resolve => setTimeout(resolve, 2000));
        setOverlay(featureId, { status: 'done', action: 'develop' });
        await refresh();
        return;
      }

      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      // Listen for streaming output
      const unlisten = await listen<{ text: string; is_done: boolean; error?: string; type?: string }>(
        'agent://chunk',
        (event) => {
          const chunk = event.payload;
          if (chunk.error && chunk.type !== 'stderr') {
            setOverlayError(featureId);
            if (chunk.is_done) unlisten();
            return;
          }
          if (chunk.text && (chunk.type === 'assistant' || chunk.type === 'system' || chunk.type === 'raw' || !chunk.type)) {
            const lines = chunk.text.split('\n').filter(Boolean);
            const lastLines = lines.slice(-2).join('\n');
            setOverlay(featureId, { status: 'streaming', action: 'develop', outputPreview: lastLines });
          }
          if (chunk.is_done) {
            unlisten();
            setOverlay(featureId, { status: 'writing', action: 'develop' });
            refresh();
          }
        }
      );

      // Start runtime session
      await invoke('runtime_session_start', { runtimeId: selectedRuntimeId });

      // Execute /run-feature
      await invoke('runtime_execute', {
        runtimeId: selectedRuntimeId,
        message: `/run-feature ${featureId}`,
        sessionId: null,
        systemPrompt: null,
      });
    } catch (e: any) {
      setOverlayError(featureId);
    }
  }, [execTargetFeature, selectedRuntimeId, setOverlay, setOverlayError, refresh]);

  // ---- Render helpers ----

  /** Compute merged column items: ghost cards prepended before real items. */
  const getColumnItems = useCallback((colKey: QueueName) => {
    const realItems = queueState?.[colKey] ?? [];
    const ghostsForColumn = ghostCards.filter(g => g.targetQueue === colKey);
    return { ghosts: ghostsForColumn, real: realItems };
  }, [queueState, ghostCards]);

  const renderBoardView = () => (
    <div className="flex-1 flex gap-4 overflow-x-auto">
      {COLUMNS.map(col => {
        const ghostsForColumn = ghostCards.filter(g => g.targetQueue === col.key);
        const real = filteredSortedData[col.key];
        const totalItems = ghostsForColumn.length + real.length;
        const Icon = col.icon;
        return (
          <div
            key={col.key}
            onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e as unknown as React.DragEvent, col.key)}
            className={cn(
              "flex-1 flex flex-col min-w-[300px] max-w-[400px] rounded-xl border transition-all",
              dragOverColumn === col.key
                ? "border-primary/50 bg-primary/5 ring-2 ring-primary/20"
                : col.key === 'pending'
                  ? "border-blue-400/20 bg-surface-container-lowest/50"
                  : "border-outline-variant/10 bg-surface-container-lowest/50"
            )}
          >
            {/* Column header */}
            <div className={cn(
              "p-4 border-b border-outline-variant/10 shrink-0",
              col.key === 'pending' && "bg-blue-500/[0.03]"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", col.iconBg)}>
                  <Icon size={16} className={col.iconColor} />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface">{col.label}</h3>
                  <p className="text-[9px] text-outline uppercase tracking-tighter">{col.sublabel}</p>
                </div>
                <div className={cn(
                  "ml-auto px-2.5 py-0.5 rounded-full text-[10px] font-bold min-w-[24px] text-center",
                  totalItems > 0
                    ? col.key === 'pending'
                      ? "bg-blue-500/20 text-blue-400"
                      : col.key === 'active'
                        ? "bg-primary/20 text-primary"
                        : col.key === 'blocked'
                          ? "bg-[#ffb4ab]/20 text-[#ffb4ab]"
                          : "bg-tertiary/20 text-tertiary"
                    : "bg-surface-container-high text-outline"
                )}>
                  {totalItems}
                </div>
              </div>
            </div>

            {/* Column body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scroll-hide">
              <AnimatePresence mode="popLayout">
                {/* Ghost cards first (top of column) */}
                {ghostsForColumn.map(ghost => (
                  <GhostFeatureCard key={ghost.tempId} ghost={ghost} />
                ))}

                {/* Real feature cards */}
                {real.map(feature => (
                  <FeatureCard
                    key={feature.id}
                    feature={feature}
                    allFeatures={allFeatures}
                    onClick={handleFeatureClick}
                    onDragStart={handleDragStart}
                    overlay={overlayState.get(feature.id)}
                    queueColumn={col.key}
                    isSplitParent={splitParentIds.has(feature.id)}
                    onExecClick={handleExecButtonClick}
                    searchQuery={searchQuery}
                    onHighlight={highlightMatch}
                    schedule={getScheduleForFeature(feature.id)}
                    onScheduleClick={handleScheduleClick}
                    onScheduleCancel={cancelSchedule}
                    onScheduleExecuteNow={triggerNow}
                    onScheduleDelete={deleteSchedule}
                    formatCountdown={formatCountdown}
                  />
                ))}
              </AnimatePresence>

              {totalItems === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-outline opacity-50">
                  <Icon size={24} className="mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Empty</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderListView = () => {
    if (!queueState) return null;

    return (
      <div className="flex-1 overflow-y-auto scroll-hide">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-surface-container-low">
            <tr className="border-b border-outline-variant/10">
              <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-outline">ID</th>
              <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-outline">Name</th>
              <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-outline">Status</th>
              <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-outline">Priority</th>
              <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-outline">Size</th>
              <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-outline">Dependencies</th>
            </tr>
          </thead>
          <tbody>
            {(['active', 'pending', 'blocked', 'completed'] as QueueName[]).flatMap(status => {
              const col = COLUMNS.find(c => c.key === status)!;
              return filteredSortedData[status].map(f => (
                <tr
                  key={f.id}
                  className="border-b border-outline-variant/5 hover:bg-surface-container-high/20 transition-colors cursor-pointer"
                  onClick={() => handleFeatureClick(f)}
                >
                  <td className="p-3">
                    <span className="text-[10px] font-bold text-outline uppercase tracking-tighter font-mono">
                      {searchQuery && highlightMatch ? highlightMatch(f.id, searchQuery) : f.id}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="text-xs font-medium text-on-surface">
                      {searchQuery && highlightMatch ? highlightMatch(f.name, searchQuery) : f.name}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={cn(
                      "text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border",
                      col.iconBg, col.iconColor, col.colorClass
                    )}>
                      {status}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-1.5 h-1.5 rounded-full", getPriorityIndicator(f.priority))} />
                      <span className="text-[10px] font-bold text-on-surface-variant">{f.priority}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded", getSizeBadge(f.size))}>
                      {f.size}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 flex-wrap">
                      {f.dependencies.map(dep => (
                        <span key={dep} className="text-[9px] bg-surface-container-highest px-1.5 py-0.5 rounded text-on-surface-variant font-medium">
                          {dep}
                        </span>
                      ))}
                      {f.dependencies.length === 0 && (
                        <span className="text-[9px] text-outline">--</span>
                      )}
                    </div>
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
      {/* Skill Init Prompt */}
      {workspacePath && skillReport && !skillReport.ready && (
        <SkillInitPrompt
          workspacePath={workspacePath}
          report={skillReport}
          onInstalled={() => {
            invoke<ReadinessReport>('check_skill_readiness', { projectPath: workspacePath })
              .then(setSkillReport)
              .catch(() => {});
          }}
        />
      )}
      {/* Header */}
      <header className="h-14 bg-surface-container-low flex items-center justify-between px-6 border-b border-outline-variant/10 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="font-headline text-lg font-bold tracking-tight text-on-surface">{t('tasks.title')}</h1>
          <div className="h-4 w-px bg-outline-variant/30" />
          <div className="flex items-center gap-2 bg-surface-container-lowest p-1 rounded-lg border border-outline-variant/10 shadow-inner">
            <button
              onClick={() => setViewMode('board')}
              className={cn(
                "px-4 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all",
                viewMode === 'board'
                  ? "bg-primary/20 text-primary shadow-sm"
                  : "text-outline hover:text-on-surface"
              )}
            >
              Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "px-4 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all",
                viewMode === 'list'
                  ? "bg-primary/20 text-primary shadow-sm"
                  : "text-outline hover:text-on-surface"
              )}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={cn(
                "flex items-center gap-1 px-4 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all",
                viewMode === 'graph'
                  ? "bg-primary/20 text-primary shadow-sm"
                  : "text-outline hover:text-on-surface"
              )}
            >
              <Network size={12} />
              Graph
            </button>
          </div>
          {queueState && queueState.meta.last_updated && (() => {
            const { relative, absolute } = formatUpdatedTime(new Date(queueState.meta.last_updated));
            return (
              <span className="text-[9px] text-outline cursor-default" title={absolute}>
                {t('time.queueUpdatedAt', { time: relative })}
              </span>
            );
          })()}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            disabled={loading}
            className="p-2 hover:bg-surface-container-high rounded-lg transition-colors disabled:opacity-50"
            title={t('editor.refreshTree')}
          >
            <RefreshCw size={14} className={cn("text-outline", loading && "animate-spin")} />
          </button>
          <button
            onClick={() => setShowNewTaskModal(true)}
            className="group relative flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 px-5 py-2 rounded-xl text-xs font-bold hover:bg-primary/20 hover:-translate-y-0.5 active:translate-y-0 transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:animate-shimmer" />
            <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
            <span className="relative z-10 uppercase tracking-widest">{t('tasks.newTask')}</span>
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="px-6 py-2 bg-[#ffb4ab]/10 border-b border-[#ffb4ab]/20 flex items-center gap-3">
          <AlertTriangle size={14} className="text-[#ffb4ab]" />
          <span className="text-xs text-[#ffb4ab] font-medium">{error}</span>
          <button onClick={refresh} className="ml-auto text-[10px] font-bold text-primary hover:underline">
            Retry
          </button>
        </div>
      )}

      {/* Schedule statistics bar */}
      {pendingSchedules.length > 0 && (
        <div className="px-6 py-2 bg-secondary/5 border-b border-secondary/10 flex items-center gap-3">
          <Timer size={14} className="text-secondary" />
          <span className="text-[11px] text-secondary font-medium">
            {t('scheduler.statsPending', { count: pendingSchedules.length, defaultValue: `${pendingSchedules.length} scheduled task(s)` })}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            {pendingSchedules.map(s => (
              <span key={s.id} className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-secondary/10 text-secondary font-bold">
                <CalendarClock size={9} />
                {s.featureId === 'all-pending' ? 'All' : s.featureId.replace(/^feat-/, '')}
                {formatCountdown(s.triggerAt) && ` (${formatCountdown(s.triggerAt)})`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missed schedule alert */}
      {allSchedules.filter(s => s.status === 'missed').length > 0 && (
        <div className="px-6 py-2 bg-warning/5 border-b border-warning/10 flex items-center gap-3">
          <AlertTriangle size={14} className="text-warning" />
          <span className="text-[11px] text-warning font-medium">
            {t('scheduler.missedAlert', { count: allSchedules.filter(s => s.status === 'missed').length, defaultValue: `${allSchedules.filter(s => s.status === 'missed').length} missed schedule(s)` })}
          </span>
        </div>
      )}

      {/* Loading state */}
      {loading && !queueState && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={24} className="text-primary animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Loading queue data...</span>
          </div>
        </div>
      )}

      {/* Search & Sort Toolbar — visible in Board and List views only */}
      {viewMode !== 'graph' && queueState && (
        <div className="px-6 py-3 border-b border-outline-variant/10 bg-surface-container-low/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            {/* Search input */}
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('tasks.searchPlaceholder')}
                className={cn(
                  "w-full pl-9 pr-8 py-1.5 rounded-lg text-[11px] bg-surface-container-high text-on-surface",
                  "border border-outline-variant/20 focus:border-primary/50 focus:ring-1 focus:ring-primary/30",
                  "placeholder:text-on-surface-variant/40 outline-none transition-all"
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-surface-container-highest rounded transition-colors"
                >
                  <X size={12} className="text-outline" />
                </button>
              )}
            </div>

            {/* Search result count */}
            {searchQuery && (
              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                {t('tasks.searchResults', { count: totalFilteredCount })}
              </span>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Sort dropdown */}
            <div className="relative" ref={sortDropdownRef}>
              <button
                onClick={() => setSortDropdownOpen(prev => !prev)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest",
                  "border border-outline-variant/20 bg-surface-container-high hover:bg-surface-container-highest transition-all",
                  sortDropdownOpen && "border-primary/50 ring-1 ring-primary/30"
                )}
              >
                <ArrowUpDown size={12} className="text-outline" />
                <span className="text-on-surface">
                  {t(({ 'priority-desc': 'tasks.sortPriorityDesc', 'priority-asc': 'tasks.sortPriorityAsc', 'time-desc': 'tasks.sortTimeDesc', 'time-asc': 'tasks.sortTimeAsc' } as Record<SortMode, string>)[sortMode])}
                </span>
                <ChevronDown size={12} className={cn("text-outline transition-transform", sortDropdownOpen && "rotate-180")} />
              </button>
              <AnimatePresence>
                {sortDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 mt-1 w-48 bg-surface-container-low border border-outline-variant/20 rounded-lg shadow-xl z-20 overflow-hidden"
                  >
                    {([
                      { mode: 'priority-desc' as SortMode, labelKey: 'tasks.sortPriorityDesc' },
                      { mode: 'priority-asc' as SortMode, labelKey: 'tasks.sortPriorityAsc' },
                      { mode: 'time-desc' as SortMode, labelKey: 'tasks.sortTimeDesc' },
                      { mode: 'time-asc' as SortMode, labelKey: 'tasks.sortTimeAsc' },
                    ]).map(opt => (
                      <button
                        key={opt.mode}
                        onClick={() => { setSortMode(opt.mode); setSortDropdownOpen(false); }}
                        className={cn(
                          "w-full px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider transition-all",
                          sortMode === opt.mode
                            ? "bg-primary/10 text-primary"
                            : "text-on-surface hover:bg-surface-container-high"
                        )}
                      >
                        {t(opt.labelKey)}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {!loading || queueState ? (
        <div className={cn("flex-1 flex overflow-hidden", viewMode === 'graph' ? '' : 'p-6 gap-4')}>
          {viewMode === 'board' && renderBoardView()}
          {viewMode === 'list' && renderListView()}
          {viewMode === 'graph' && (
            <TaskGraphView features={graphFeatures} onNodeClick={handleFeatureClick} />
          )}
        </div>
      ) : null}

      {/* Feature Detail Modal */}
      <AnimatePresence>
        {selectedFeature && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={requestCloseModal}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, x: 50 }}
              animate={{ scale: 1, opacity: 1, x: modalPos.x, y: modalPos.y }}
              exit={{ scale: 0.9, opacity: 0, x: 50 }}
              style={{
                position: 'relative',
                top: 0,
                left: 0,
                minWidth: 480,
                minHeight: 360,
                resize: 'both',
                overflow: 'hidden',
                maxHeight: '85vh',
              }}
              className={cn(
                "w-full max-w-[66.67vw] bg-surface-container-low border border-outline-variant/20 rounded-xl shadow-2xl flex flex-col",
                isDraggingModal && "select-none"
              )}
            >
              {/* Modal header - draggable area */}
              <div
                onMouseDown={handleModalHeaderMouseDown}
                className={cn(
                  "p-6 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-high/30 shrink-0",
                  isDraggingModal ? "cursor-grabbing" : "cursor-grab"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Code2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest">{selectedFeature.id}</h3>
                    <p className="text-[10px] text-outline uppercase tracking-tighter">
                      P{selectedFeature.priority} | {selectedFeature.size}
                    </p>
                  </div>
                </div>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={requestCloseModal}
                  className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-8 space-y-8 overflow-y-auto flex-1">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-on-surface leading-tight">
                    {selectedFeature.name}
                  </h2>
                  {selectedFeature.completed_at && (
                    <div className="flex items-center gap-4 text-xs text-on-surface-variant">
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} className="text-outline" />
                        <span>Completed: {new Date(selectedFeature.completed_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  )}
                </div>

                {selectedFeature.details?.description && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-outline">Description</h4>
                    <MarkdownRenderer content={selectedFeature.details.description} className="opacity-80" />
                  </div>
                )}

                {selectedFeature.details?.status && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-outline">Task Progress</h4>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/20 text-xs font-bold text-primary">
                      <div className="w-2 h-2 rounded-full bg-current" />
                      {selectedFeature.details.status}
                    </div>
                  </div>
                )}

                {/* Dependencies */}
                {selectedFeature.dependencies.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-outline">Dependencies</h4>
                    <div className="space-y-2">
                      {selectedFeature.dependencies.map(depId => {
                        const dep = allFeatures.find(f => f.id === depId);
                        return (
                          <div key={depId} className="p-3 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-between group cursor-pointer hover:bg-primary/10 transition-all">
                            <div className="flex items-center gap-3">
                              <div className="p-1.5 bg-primary/10 rounded text-primary">
                                <Link2 size={14} />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-primary uppercase tracking-tighter">{depId}</p>
                                <p className="text-xs font-medium text-on-surface">{dep?.name || 'Unknown'}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tag */}
                {selectedFeature.tag && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-outline">Release Tag</h4>
                    <div className="flex items-center gap-1.5">
                      <Tag size={12} className="text-tertiary opacity-50" />
                      <span className="text-xs font-medium text-tertiary">{selectedFeature.tag}</span>
                    </div>
                  </div>
                )}

                {/* Markdown detail tabs: Spec / Tasks / Checklist / Agent */}
                <div className="space-y-3">
                  {/* Tab bar */}
                  <div className="flex items-center gap-1 bg-surface-container-lowest p-1 rounded-lg border border-outline-variant/10">
                    {([
                      { key: 'spec' as const, label: 'Spec', icon: FileText, file: 'spec.md' },
                      { key: 'tasks' as const, label: 'Tasks', icon: ListChecks, file: 'task.md' },
                      { key: 'checklist' as const, label: 'Checklist', icon: ClipboardCheck, file: 'checklist.md' },
                      // Agent tab: only visible for non-completed features
                      ...(selectedFeature.completed_at ? [] : [{ key: 'agent' as const, label: 'Agent', icon: Bot, file: '' }]),
                    ]).map(tab => {
                      const hasContent = !!selectedDetail?.[tab.file];
                      const TabIcon = tab.icon;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setDetailTab(tab.key)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-all",
                            detailTab === tab.key
                              ? "bg-primary/20 text-primary shadow-sm"
                              : tab.key === 'agent'
                                ? "text-on-surface-variant hover:text-on-surface"
                                : hasContent
                                  ? "text-on-surface-variant hover:text-on-surface"
                                  : "text-outline/50 cursor-default"
                          )}
                        >
                          <TabIcon size={12} />
                          {tab.label}
                          {hasContent && (
                            <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Tab content */}
                  <div className="min-h-[120px] max-h-[50vh] overflow-y-auto scroll-hide rounded-lg bg-surface-container-highest/30 p-4 border border-outline-variant/5">
                    {detailTab === 'spec' && (
                      selectedDetail?.['spec.md'] ? (
                        <MarkdownRenderer content={selectedDetail['spec.md']} />
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-outline opacity-50">
                          <FileText size={24} className="mb-2" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">No spec available</span>
                        </div>
                      )
                    )}
                    {detailTab === 'tasks' && (
                      selectedDetail?.['task.md'] ? (
                        <MarkdownRenderer content={selectedDetail['task.md']} />
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-outline opacity-50">
                          <ListChecks size={24} className="mb-2" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">No tasks available</span>
                        </div>
                      )
                    )}
                    {detailTab === 'checklist' && (
                      selectedDetail?.['checklist.md'] ? (
                        <MarkdownRenderer content={selectedDetail['checklist.md']} />
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-outline opacity-50">
                          <ClipboardCheck size={24} className="mb-2" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">No checklist available</span>
                        </div>
                      )
                    )}
                    {detailTab === 'agent' && (() => {
                      const claudeRuntime = runtimes.find(r => r.id === 'claude-code');
                      const isRuntimeInstalled = claudeRuntime && claudeRuntime.status !== 'not-installed';
                      const isSendDisabled = agentSending || !isRuntimeInstalled || (agentAction === 'modify' && !agentInput.trim());

                      return (
                        <div className="space-y-4">
                          {/* Resumed session indicator */}
                          {resumedSession && (
                            <div
                              onClick={() => setResumedSession(false)}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/10 border border-secondary/20 cursor-pointer hover:bg-secondary/20 transition-all animate-in fade-in"
                            >
                              <RotateCcw size={11} className="text-secondary" />
                              <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">Resumed session</span>
                              <span className="text-[9px] text-on-surface-variant ml-auto">click to dismiss</span>
                            </div>
                          )}

                          {/* Runtime status */}
                          {!isRuntimeInstalled ? (
                            <div className="rounded-lg bg-[#ffb4ab]/10 border border-[#ffb4ab]/20 p-3">
                              <div className="flex items-start gap-2">
                                <AlertCircle size={14} className="text-[#ffb4ab] shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-[11px] text-[#ffb4ab] font-medium">
                                    Claude Code runtime is not available
                                  </p>
                                  {claudeRuntime?.install_hint && (
                                    <p className="text-[9px] text-on-surface-variant mt-1 font-mono">
                                      Install: {claudeRuntime.install_hint}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-tertiary" />
                              <span className="text-[10px] font-bold text-tertiary uppercase tracking-wider">Claude Code</span>
                              <span className="text-[9px] text-on-surface-variant">connected</span>
                            </div>
                          )}

                          {/* Action type radio */}
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-outline">Action Type</h4>
                            <div className="flex gap-2">
                              {([
                                { value: 'review' as const, label: 'Review', desc: 'Review spec completeness' },
                                { value: 'modify' as const, label: 'Modify', desc: 'Modify requirements' },
                                { value: 'develop' as const, label: 'Develop', desc: 'Start development' },
                              ]).map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={() => { setAgentAction(opt.value); setAgentError(null); }}
                                  className={cn(
                                    'flex-1 p-2.5 rounded-lg border-2 text-center transition-all',
                                    agentAction === opt.value
                                      ? 'border-primary bg-primary/5'
                                      : 'border-outline-variant/10 hover:border-primary/30',
                                  )}
                                >
                                  <span className={cn(
                                    "text-[10px] font-bold uppercase tracking-wider block",
                                    agentAction === opt.value ? 'text-primary' : 'text-on-surface-variant'
                                  )}>
                                    {opt.label}
                                  </span>
                                  <span className="text-[8px] text-on-surface-variant/60 block mt-0.5">{opt.desc}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Additional input textarea */}
                          <div className="space-y-1">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-outline">
                              Additional Notes
                              {agentAction === 'modify' && <span className="text-[#ffb4ab] ml-1">(required)</span>}
                            </h4>
                            <textarea
                              value={agentInput}
                              onChange={e => setAgentInput(e.target.value)}
                              placeholder={
                                agentAction === 'review' ? 'Optional: specific areas to review...'
                                : agentAction === 'modify' ? 'Describe your modifications...'
                                : 'Optional: additional context for development...'
                              }
                              className={cn(
                                'w-full h-20 px-3 py-2 rounded-lg text-[11px] bg-surface-container-high text-on-surface',
                                'border border-outline-variant/20 focus:border-primary/50 focus:ring-1 focus:ring-primary/30',
                                'placeholder:text-on-surface-variant/40 resize-none outline-none transition-all',
                                'font-body',
                              )}
                            />
                          </div>

                          {/* Send button */}
                          <button
                            onClick={handleAgentSend}
                            disabled={isSendDisabled}
                            className={cn(
                              'flex items-center gap-1.5 px-5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all',
                              !isSendDisabled
                                ? 'bg-primary text-on-primary hover:bg-primary/90'
                                : 'bg-surface-container-highest text-outline cursor-not-allowed',
                            )}
                          >
                            {agentSending ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Send size={12} />
                            )}
                            {agentSending ? 'Sending...' : 'Send to Claude Code'}
                          </button>

                          {/* Error display */}
                          {agentError && (
                            <div className="rounded-lg bg-error/10 border border-error/20 p-3">
                              <div className="flex items-start gap-2">
                                <AlertCircle size={14} className="text-error shrink-0 mt-0.5" />
                                <p className="text-[11px] text-error font-medium">{agentError}</p>
                              </div>
                            </div>
                          )}

                          {/* Streaming output */}
                          {agentOutput && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-outline">
                                <span>Execution Result</span>
                                {agentDone && <CheckCircle2 size={10} className="text-tertiary" />}
                              </div>
                              <div className="rounded-lg bg-surface-container-high border border-outline-variant/10 p-3 max-h-[240px] overflow-y-auto">
                                <pre className="text-[11px] text-on-surface-variant whitespace-pre-wrap font-mono leading-relaxed">
                                  {agentOutput}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Safe-close confirmation overlay */}
              <AnimatePresence>
                {showCloseConfirm && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        setShowCloseConfirm(false);
                      }
                    }}
                    tabIndex={-1}
                    ref={(el) => el?.focus()}
                  >
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="bg-surface-container-low border border-warning/30 rounded-xl p-6 shadow-2xl max-w-sm mx-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle size={18} className="text-warning" />
                        <h4 className="text-sm font-bold text-on-surface">AI is responding</h4>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed mb-5">
                        Close anyway? You can recover the conversation by reopening.
                      </p>
                      <div className="flex justify-end gap-2">
                        <button
                          autoFocus
                          onClick={() => setShowCloseConfirm(false)}
                          className="px-4 py-2 rounded-lg text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/20"
                        >
                          Continue Waiting
                        </button>
                        <button
                          onClick={() => {
                            setShowCloseConfirm(false);
                            closeModal();
                          }}
                          className="px-4 py-2 rounded-lg text-[11px] font-bold bg-surface-container-highest text-on-surface hover:bg-surface-variant transition-all border border-outline-variant/20"
                        >
                          Close
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Modal footer */}
              <div className="p-6 bg-surface-container-high/30 border-t border-outline-variant/10 flex justify-between gap-3 shrink-0">
                {/* Clear session button — only show if agent tab has output */}
                {agentOutput && (
                  <button
                    onClick={() => {
                      if (selectedFeature) {
                        sessionStore.clearTaskSession(selectedFeature.id);
                      }
                      setAgentOutput('');
                      setAgentDone(false);
                      setAgentError(null);
                      agentStreamingRef.current = '';
                      setResumedSession(false);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:text-error transition-colors"
                  >
                    <RotateCcw size={10} />
                    Clear Session
                  </button>
                )}
                <div className="ml-auto">
                  <button
                    onClick={requestCloseModal}
                    className="px-6 py-2 bg-surface-container-highest text-on-surface rounded-lg text-xs font-bold hover:bg-surface-variant transition-all border border-outline-variant/10"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Task Modal — Agent dispatch for feature creation */}
      <AnimatePresence>
        {showNewTaskModal && (
          <NewTaskModal
            open={showNewTaskModal}
            onClose={() => setShowNewTaskModal(false)}
            onFeatureCreated={refresh}
            onGhostCardCreate={handleGhostCardCreate}
          />
        )}
      </AnimatePresence>

      {/* Execution Dialog — Run Feature confirmation */}
      <AnimatePresence>
        {showExecDialog && execTargetFeature && (
          <ExecutionDialog
            feature={execTargetFeature}
            runtimes={runtimes}
            selectedRuntimeId={selectedRuntimeId}
            onRuntimeChange={setSelectedRuntimeId}
            onConfirm={handleExecConfirm}
            onCancel={() => { setShowExecDialog(false); setExecTargetFeature(null); }}
            docCheck={execDocCheck}
          />
        )}
      </AnimatePresence>

      {/* Schedule Picker Modal */}
      <AnimatePresence>
        {showScheduleModal && (
          <SchedulePickerModal
            feature={scheduleTargetFeature}
            isAllPending={scheduleIsAllPending}
            onConfirm={handleScheduleConfirm}
            onCancel={() => { setShowScheduleModal(false); setScheduleTargetFeature(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
