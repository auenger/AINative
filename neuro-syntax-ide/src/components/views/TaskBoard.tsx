import React, { useState, useCallback, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { useQueueData, FeatureNode, QueueName } from '../../lib/useQueueData';
import { useAgentRuntimes } from '../../lib/useAgentRuntimes';
import type { AgentActionType } from '../../types';

/** 智能时间格式化：返回相对时间与绝对时间 */
function formatUpdatedTime(date: Date): { relative: string; absolute: string } {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  // 绝对时间格式（用于 tooltip）
  const pad = (n: number) => String(n).padStart(2, '0');
  const absolute = `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

  // 60 秒内：刚刚
  if (diffSec < 60) {
    return { relative: '刚刚', absolute };
  }

  // 60 分钟内：X 分钟前
  if (diffMin < 60) {
    return { relative: `${diffMin} 分钟前`, absolute };
  }

  // 判断是否今天 / 昨天
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const dateDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  if (dateDayStart.getTime() === todayStart.getTime()) {
    return { relative: `今天 ${timeStr}`, absolute };
  }

  if (dateDayStart.getTime() === yesterdayStart.getTime()) {
    return { relative: `昨天 ${timeStr}`, absolute };
  }

  // 今年内：MM/DD HH:mm
  if (date.getFullYear() === now.getFullYear()) {
    const monthDay = `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${timeStr}`;
    return { relative: monthDay, absolute };
  }

  // 往年：YYYY/MM/DD HH:mm
  return { relative: absolute.replace(/:\d{2}$/, ''), absolute };
}
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { NewTaskModal } from './NewTaskModal';

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
    key: 'active',
    label: 'Active',
    sublabel: 'Currently in progress',
    icon: Zap,
    colorClass: 'border-primary/30',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
  },
  {
    key: 'pending',
    label: 'Pending',
    sublabel: 'Waiting to start',
    icon: Clock,
    colorClass: 'border-secondary/30',
    iconBg: 'bg-secondary/10',
    iconColor: 'text-secondary',
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
    case 'S': return 'bg-tertiary/20 text-tertiary';
    case 'M': return 'bg-secondary/20 text-secondary';
    case 'L': return 'bg-primary/20 text-primary';
    case 'XL': return 'bg-[#ffb4ab]/20 text-[#ffb4ab]';
    default: return 'bg-surface-container-highest text-on-surface-variant';
  }
}

function getPriorityIndicator(priority: number) {
  if (priority >= 80) return 'bg-primary';
  if (priority >= 50) return 'bg-secondary';
  if (priority >= 30) return 'bg-tertiary';
  return 'bg-outline';
}

// ---------------------------------------------------------------------------
// Feature Card (draggable)
// ---------------------------------------------------------------------------

interface FeatureCardProps {
  feature: FeatureNode;
  allFeatures: FeatureNode[];
  onClick: (f: FeatureNode) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ feature, allFeatures, onClick, onDragStart }) => {
  const [expanded, setExpanded] = useState(false);
  const hasDeps = feature.dependencies.length > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      draggable
      onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, feature.id)}
      className={cn(
        "p-4 rounded-xl border border-outline-variant/10 bg-surface-container-low",
        "hover:border-outline-variant/40 transition-all group cursor-grab active:cursor-grabbing",
        "hover:shadow-lg hover:shadow-primary/5"
      )}
      onClick={() => onClick(feature)}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full", getPriorityIndicator(feature.priority))} />
            <span className="text-[9px] font-bold text-outline uppercase tracking-tighter">
              {feature.id}
            </span>
            <span className={cn(
              "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded",
              getSizeBadge(feature.size)
            )}>
              {feature.size}
            </span>
          </div>
          <h3 className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors leading-tight">
            {feature.name || feature.id}
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

      {/* Tags row: priority + deps + status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[9px] bg-surface-container-highest px-1.5 py-0.5 rounded text-on-surface-variant font-medium">
            P{feature.priority}
          </span>
          {feature.tag && (
            <span className="text-[9px] bg-tertiary/10 px-1.5 py-0.5 rounded text-tertiary font-medium">
              {feature.tag}
            </span>
          )}
        </div>

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
// TaskBoard Component
// ---------------------------------------------------------------------------

export const TaskBoard: React.FC = () => {
  const { t } = useTranslation();
  const { queueState, loading, error, refresh, moveTask, readDetail } = useQueueData();

  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<FeatureNode | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<Record<string, string> | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [detailTab, setDetailTab] = useState<'spec' | 'tasks' | 'checklist' | 'agent'>('spec');

  // Agent tab state
  const { runtimes, scanning, scan: scanRuntimes } = useAgentRuntimes();
  const [agentAction, setAgentAction] = useState<AgentActionType>('review');
  const [agentInput, setAgentInput] = useState('');
  const [agentSending, setAgentSending] = useState(false);
  const [agentOutput, setAgentOutput] = useState('');
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentDone, setAgentDone] = useState(false);
  const agentStreamingRef = useRef<string>('');

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

  // Close modal helper: resets modal position
  const closeModal = useCallback(() => {
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
  }, []);

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
  }, [moveTask]);

  // Feature click => open detail modal
  const handleFeatureClick = useCallback(async (feature: FeatureNode) => {
    setSelectedFeature(feature);
    const detail = await readDetail(feature.id);
    setSelectedDetail(detail);
  }, [readDetail]);

  // All features flat for dependency lookups
  const allFeatures: FeatureNode[] = queueState
    ? [...queueState.active, ...queueState.pending, ...queueState.blocked, ...queueState.completed]
    : [];

  // Agent tab: send handler
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

    try {
      const featureId = selectedFeature.id;
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
        setAgentOutput('Connecting to Claude Code...\n');
        await new Promise(resolve => setTimeout(resolve, 1000));
        setAgentOutput(prev => prev + `Executing ${skill}...\n`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        const mockResult = agentAction === 'review'
          ? 'Spec review complete. The feature spec looks well-structured. Consider adding more edge cases to the acceptance criteria.'
          : agentAction === 'modify'
          ? `Feature ${featureId} has been modified according to your instructions.`
          : `Development started for feature ${featureId}.`;
        setAgentOutput(prev => prev + '\n' + mockResult);
        setAgentDone(true);
        setAgentSending(false);
        // Auto-refresh detail after completion
        const detail = await readDetail(featureId);
        if (detail) setSelectedDetail(detail);
        await refresh();
        return;
      }

      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      // Listen for streaming output from external runtime
      const unlisten = await listen<{ text: string; is_done: boolean; error?: string }>(
        'runtime_dispatch_chunk',
        (event) => {
          const chunk = event.payload;
          if (chunk.error) {
            setAgentError(chunk.error);
            return;
          }
          if (chunk.text) {
            agentStreamingRef.current += chunk.text;
            setAgentOutput(agentStreamingRef.current);
          }
          if (chunk.is_done) {
            unlisten();
            setAgentDone(true);
            // Auto-refresh detail after completion
            readDetail(featureId).then(detail => {
              if (detail) setSelectedDetail(detail);
            });
            refresh();
          }
        }
      );

      if (agentAction === 'develop') {
        await invoke('dispatch_to_runtime', {
          runtimeId: 'claude-code',
          skill,
          args: { feature: featureId },
        });
      } else {
        await invoke('dispatch_to_runtime', {
          runtimeId: 'claude-code',
          skill,
          args: { prompt },
        });
      }
    } catch (e: any) {
      setAgentError(e?.toString() ?? 'An unexpected error occurred during agent execution');
    } finally {
      setAgentSending(false);
    }
  }, [selectedFeature, selectedDetail, agentAction, agentInput, runtimes, readDetail, refresh]);

  // ---- Render helpers ----

  const renderBoardView = () => (
    <div className="flex-1 flex gap-4 overflow-x-auto">
      {COLUMNS.map(col => {
        const items = queueState?.[col.key] ?? [];
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
                : "border-outline-variant/10 bg-surface-container-lowest/50"
            )}
          >
            {/* Column header */}
            <div className="p-4 border-b border-outline-variant/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", col.iconBg)}>
                  <Icon size={16} className={col.iconColor} />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface">{col.label}</h3>
                  <p className="text-[9px] text-outline uppercase tracking-tighter">{col.sublabel}</p>
                </div>
                <div className="ml-auto bg-surface-container-high px-2 py-0.5 rounded text-[10px] font-bold text-outline">
                  {items.length}
                </div>
              </div>
            </div>

            {/* Column body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scroll-hide">
              <AnimatePresence mode="popLayout">
                {items.map(feature => (
                  <FeatureCard
                    key={feature.id}
                    feature={feature}
                    allFeatures={allFeatures}
                    onClick={handleFeatureClick}
                    onDragStart={handleDragStart}
                  />
                ))}
              </AnimatePresence>

              {items.length === 0 && (
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
              return queueState[status].map(f => (
                <tr
                  key={f.id}
                  className="border-b border-outline-variant/5 hover:bg-surface-container-high/20 transition-colors cursor-pointer"
                  onClick={() => handleFeatureClick(f)}
                >
                  <td className="p-3">
                    <span className="text-[10px] font-bold text-outline uppercase tracking-tighter font-mono">{f.id}</span>
                  </td>
                  <td className="p-3">
                    <span className="text-xs font-medium text-on-surface">{f.name}</span>
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
          </div>
          {queueState && queueState.meta.last_updated && (() => {
            const { relative, absolute } = formatUpdatedTime(new Date(queueState.meta.last_updated));
            return (
              <span className="text-[9px] text-outline cursor-default" title={absolute}>
                队列更新于 {relative}
              </span>
            );
          })()}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            disabled={loading}
            className="p-2 hover:bg-surface-container-high rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
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

      {/* Loading state */}
      {loading && !queueState && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={24} className="text-primary animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Loading queue data...</span>
          </div>
        </div>
      )}

      {/* Content */}
      {!loading || queueState ? (
        <div className="flex-1 flex overflow-hidden p-6 gap-4">
          {viewMode === 'board' ? renderBoardView() : renderListView()}
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
              onClick={closeModal}
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
                  onClick={closeModal}
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
                      const isRuntimeAvailable = claudeRuntime && claudeRuntime.status !== 'not-installed';
                      const isSendDisabled = agentSending || !isRuntimeAvailable || (agentAction === 'modify' && !agentInput.trim());

                      return (
                        <div className="space-y-4">
                          {/* Runtime status */}
                          {!isRuntimeAvailable ? (
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

              {/* Modal footer */}
              <div className="p-6 bg-surface-container-high/30 border-t border-outline-variant/10 flex justify-end gap-3 shrink-0">
                <button
                  onClick={closeModal}
                  className="px-6 py-2 bg-surface-container-highest text-on-surface rounded-lg text-xs font-bold hover:bg-surface-variant transition-all border border-outline-variant/10"
                >
                  Close
                </button>
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
          />
        )}
      </AnimatePresence>
    </div>
  );
};
