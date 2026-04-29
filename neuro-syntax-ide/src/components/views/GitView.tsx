import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Github,
  RefreshCw,
  X,
  AlertTriangle,
  Loader2,
  FileText,
  ArrowUpRight,
  CheckCircle2,
  GitBranch,
  GitCommitHorizontal,
  Tag,
  Clock,
  History,
  Eye,
  ChevronDown,
  ChevronRight,
  Box,
  Network,
  PlusCircle,
  MinusCircle,
  Layers,
  Trash2,
  PanelRightClose,
  PanelRightOpen,
  BarChart3,
  TrendingUp,
  TrendingDown,
  FilePlus,
  FileMinus,
  FileQuestion,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { useGitStatus } from '../../lib/useGitStatus';
import { useGitDetail } from '../../lib/useGitDetail';
import type { GitModalTab, CommitGraphResult, FileDiffInfo, FileDiffResult, DiffLine, CommitDetailResult } from '../../types';

// ---------------------------------------------------------------------------
// CommitGraphTab — git-log style vertical timeline visualization
// ---------------------------------------------------------------------------

interface CommitGraphTabProps {
  graphData: CommitGraphResult;
  hoveredCommit: string | null;
  onHoverCommit: (hash: string | null) => void;
}

const ROW_HEIGHT = 28;
const LANE_WIDTH = 20;
const DOT_RADIUS = 4;
const PAD_LEFT = 48;
const PAD_TOP = 40;
const MSG_X_OFFSET = 14;

const LANE_COLORS = [
  '#58a6ff', '#a78bfa', '#34d399', '#f97316',
  '#f472b6', '#fbbf24', '#6ee7b7', '#67e8f9',
];

function laneX(lane: number): number { return PAD_LEFT + lane * LANE_WIDTH + LANE_WIDTH / 2; }
function rowY(row: number): number { return PAD_TOP + row * ROW_HEIGHT + ROW_HEIGHT / 2; }

const CommitGraphTab: React.FC<CommitGraphTabProps> = ({ graphData, hoveredCommit, onHoverCommit }) => {
  const { commits, connectors, lane_count } = graphData;

  if (commits.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-xs text-on-surface-variant opacity-60">
        No commit history available
      </div>
    );
  }

  const graphAreaWidth = PAD_LEFT + lane_count * LANE_WIDTH + MSG_X_OFFSET;
  const totalHeight = PAD_TOP + commits.length * ROW_HEIGHT;

  // Group connectors by row
  const connectorsByRow = new Map<number, typeof connectors>();
  for (const c of connectors) {
    if (!connectorsByRow.has(c.row)) connectorsByRow.set(c.row, []);
    connectorsByRow.get(c.row)!.push(c);
  }

  // Collect active lanes per row for pass-through lines
  const activeLanesPerRow: Set<number>[] = [];
  for (let r = 0; r < commits.length; r++) {
    const active = new Set<number>();
    active.add(commits[r].lane);
    for (const c of (connectorsByRow.get(r) ?? [])) {
      active.add(c.from_lane);
      active.add(c.to_lane);
    }
    activeLanesPerRow.push(active);
  }

  return (
    <div className="relative w-full h-full overflow-auto pl-2 pt-1">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Commit Graph</span>
        <span className="text-[10px] text-on-surface-variant">{commits.length} commits</span>
      </div>

      <svg
        width={graphAreaWidth + 500}
        height={totalHeight}
        viewBox={`0 0 ${graphAreaWidth + 500} ${totalHeight}`}
        className="font-mono"
      >
        {commits.map((commit, rowIdx) => {
          const isHovered = hoveredCommit === commit.hash;
          const laneColor = LANE_COLORS[commit.lane % LANE_COLORS.length];
          const cx = laneX(commit.lane);
          const cy = rowY(rowIdx);
          const rowConnectors = connectorsByRow.get(rowIdx) ?? [];
          const dimmed = hoveredCommit !== null && !isHovered;

          return (
            <g
              key={commit.hash}
              onMouseEnter={() => onHoverCommit(commit.hash)}
              onMouseLeave={() => onHoverCommit(null)}
              className="cursor-pointer"
              opacity={dimmed ? 0.35 : 1}
            >
              {/* Vertical pass-through lines for other active lanes */}
              {Array.from(activeLanesPerRow[rowIdx] ?? []).filter(l => l !== commit.lane).map(lane => (
                <line key={`v-${lane}`} x1={laneX(lane)} y1={rowY(rowIdx) - ROW_HEIGHT / 2} x2={laneX(lane)} y2={rowY(rowIdx) + ROW_HEIGHT / 2} stroke={LANE_COLORS[lane % LANE_COLORS.length]} strokeWidth={1.5} opacity={0.5} />
              ))}

              {/* Commit's own lane pass-through */}
              {rowConnectors.length === 0 && (
                <line x1={cx} y1={cy - ROW_HEIGHT / 2} x2={cx} y2={cy + ROW_HEIGHT / 2} stroke={laneColor} strokeWidth={1.5} opacity={0.5} />
              )}

              {/* Connector curves */}
              {rowConnectors.map((conn, ci) => {
                const fromX = laneX(conn.from_lane);
                const toX = laneX(conn.to_lane);
                const y1 = rowY(rowIdx) - ROW_HEIGHT / 2;
                const y2 = rowY(rowIdx) + ROW_HEIGHT / 2;
                const midY = (y1 + y2) / 2;
                const fromColor = LANE_COLORS[conn.from_lane % LANE_COLORS.length];
                const toColor = LANE_COLORS[conn.to_lane % LANE_COLORS.length];

                if (conn.connector_type === 'straight') {
                  return <line key={`c-${ci}`} x1={fromX} y1={y1} x2={toX} y2={y2} stroke={fromColor} strokeWidth={1.5} opacity={0.5} />;
                }
                const d = `M ${fromX} ${y1} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${y2}`;
                return <path key={`c-${ci}`} d={d} fill="none" stroke={conn.connector_type === 'merge' ? toColor : fromColor} strokeWidth={1.5} opacity={0.6} />;
              })}

              {/* Commit dot */}
              <circle cx={cx} cy={cy} r={commit.is_merge ? DOT_RADIUS + 1.5 : DOT_RADIUS} fill={laneColor} stroke={isHovered ? '#fff' : laneColor} strokeWidth={isHovered ? 2 : 0} opacity={0.9} />
              {commit.is_merge && <circle cx={cx} cy={cy} r={DOT_RADIUS + 3} fill="none" stroke={laneColor} strokeWidth={1} opacity={0.4} />}

              {/* Branch labels */}
              {commit.branch_labels.map((label, li) => {
                const isRemote = label.includes('/');
                const shortLabel = label.length > 18 ? '…' + label.slice(-16) : label;
                const labelW = shortLabel.length * 5.5 + 8;
                const labelX = cx - labelW / 2;
                const labelY = cy - DOT_RADIUS - 10 - li * 14;
                return (
                  <g key={`bl-${li}`}>
                    <rect x={labelX} y={labelY} width={labelW} height={11} rx={3} fill={isRemote ? '#334155' : '#1e3a5f'} stroke={isRemote ? '#64748b' : '#3b82f6'} strokeWidth={0.5} />
                    <text x={cx} y={labelY + 5.5} textAnchor="middle" dominantBaseline="middle" fill={isRemote ? '#94a3b8' : '#93c5fd'} fontSize={7} fontWeight="bold">{shortLabel}</text>
                  </g>
                );
              })}

              {/* Tag labels */}
              {commit.tag_labels.map((tag, ti) => {
                const shortTag = tag.length > 20 ? '…' + tag.slice(-18) : tag;
                const tagW = shortTag.length * 5 + 10;
                const tagX = cx - tagW / 2;
                const tagY = cy - DOT_RADIUS - 10 - commit.branch_labels.length * 14 - ti * 14;
                return (
                  <g key={`tl-${ti}`}>
                    <rect x={tagX} y={tagY} width={tagW} height={11} rx={3} fill="#422006" stroke="#f59e0b" strokeWidth={0.5} />
                    <text x={cx} y={tagY + 5.5} textAnchor="middle" dominantBaseline="middle" fill="#fcd34d" fontSize={7} fontWeight="bold">{shortTag}</text>
                  </g>
                );
              })}

              {/* Message text */}
              <text x={graphAreaWidth + 4} y={cy + 1} dominantBaseline="middle" fill={isHovered ? '#f1f5f9' : '#94a3b8'} fontSize={10}>
                <tspan fill={laneColor} fontSize={9}>{commit.short_hash}</tspan>
                <tspan dx={6} fill={isHovered ? '#e2e8f0' : '#cbd5e1'} fontSize={9}>{commit.message.length > 45 ? commit.message.slice(0, 45) + '…' : commit.message}</tspan>
                <tspan dx={8} fill="#64748b" fontSize={8}>{commit.time_ago}</tspan>
              </text>

              {/* Hover tooltip */}
              {isHovered && (
                <g>
                  <rect x={graphAreaWidth + 4} y={cy + 10} width={480} height={40} rx={4} fill="#1e293b" stroke="#475569" strokeWidth={0.5} />
                  <text x={graphAreaWidth + 10} y={cy + 24} fill="#94a3b8" fontSize={7}>
                    <tspan fill="#64748b">{commit.hash.slice(0, 12)}</tspan>
                    <tspan dx={6} fill="#94a3b8">by {commit.author}</tspan>
                    <tspan dx={6} fill="#64748b">{new Date(commit.timestamp * 1000).toLocaleDateString()}</tspan>
                  </text>
                  <text x={graphAreaWidth + 10} y={cy + 40} fill="#cbd5e1" fontSize={8}>{commit.message.length > 70 ? commit.message.slice(0, 70) + '…' : commit.message}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------------------
// DiffPanel — Shows unified diff for a selected file
// ---------------------------------------------------------------------------

interface DiffPanelProps {
  diff: FileDiffResult | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onFileClick?: (path: string, staged: boolean) => void;
}

const DiffPanel: React.FC<DiffPanelProps> = ({ diff, loading, error, onClose }) => {
  if (loading) {
    return (
      <div className="flex flex-col h-full bg-surface-container-lowest rounded-lg border border-outline-variant/10">
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/10">
          <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Loading Diff...</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-container-high/30 transition-colors">
            <PanelRightClose size={14} className="text-on-surface-variant" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full bg-surface-container-lowest rounded-lg border border-outline-variant/10">
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/10">
          <span className="text-[10px] font-bold uppercase tracking-widest text-error">Error</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-container-high/30 transition-colors">
            <PanelRightClose size={14} className="text-on-surface-variant" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-error">{error}</p>
        </div>
      </div>
    );
  }

  if (!diff) {
    return (
      <div className="flex flex-col h-full bg-surface-container-lowest rounded-lg border border-outline-variant/10">
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/10">
          <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Diff Preview</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-container-high/30 transition-colors">
            <PanelRightClose size={14} className="text-on-surface-variant" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-on-surface-variant opacity-50">
          <FileText size={32} />
          <p className="text-xs">Click a file to preview changes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface-container-lowest rounded-lg border border-outline-variant/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/10 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={14} className="text-secondary shrink-0" />
          <span className="text-xs font-mono truncate text-on-surface">{diff.path}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <span className="text-emerald-400 flex items-center gap-0.5"><PlusCircle size={10} />+{diff.additions}</span>
            <span className="text-error flex items-center gap-0.5"><MinusCircle size={10} />-{diff.deletions}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-container-high/30 transition-colors">
            <PanelRightClose size={14} className="text-on-surface-variant" />
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto font-mono text-[11px] leading-5 scroll-hide">
        {diff.lines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-on-surface-variant text-xs opacity-60">
            No changes to display
          </div>
        ) : (
          diff.lines.map((line, idx) => (
            <DiffLineRow key={idx} line={line} />
          ))
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// DiffLineRow — Single line in a diff
// ---------------------------------------------------------------------------

const DiffLineRow: React.FC<{ line: DiffLine }> = ({ line }) => {
  const bgColor = line.type === 'add'
    ? 'bg-emerald-500/10'
    : line.type === 'remove'
    ? 'bg-red-500/10'
    : line.type === 'header'
    ? 'bg-primary/10'
    : 'transparent';
  const textColor = line.type === 'add'
    ? 'text-emerald-400'
    : line.type === 'remove'
    ? 'text-red-400'
    : line.type === 'header'
    ? 'text-primary'
    : 'text-on-surface-variant';
  const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';

  return (
    <div className={cn('flex whitespace-pre', bgColor)}>
      {/* Old line number */}
      <span className="w-10 shrink-0 text-right pr-2 text-outline-variant/60 select-none border-r border-outline-variant/10">
        {line.old_line_no ?? ''}
      </span>
      {/* New line number */}
      <span className="w-10 shrink-0 text-right pr-2 text-outline-variant/60 select-none border-r border-outline-variant/10">
        {line.new_line_no ?? ''}
      </span>
      {/* Prefix */}
      <span className={cn('w-4 shrink-0 text-center select-none', textColor)}>{line.type === 'header' ? '' : prefix}</span>
      {/* Content */}
      <span className={cn('pl-1', textColor)}>{line.content.replace(/\n$/, '')}</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// StatBarChart — Simple bar chart for commit frequency
// ---------------------------------------------------------------------------

interface BarData {
  label: string;
  value: number;
}

interface StatBarChartProps {
  data: BarData[];
  maxValue: number;
  color?: string;
}

const StatBarChart: React.FC<StatBarChartProps> = ({ data, maxValue, color = 'bg-secondary' }) => {
  const max = Math.max(maxValue, 1);
  return (
    <div className="flex items-end gap-1.5 h-20">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center flex-1 gap-1">
          <span className="text-[8px] text-on-surface-variant font-mono">{d.value || ''}</span>
          <div
            className={cn('w-full rounded-t-sm transition-all min-h-[2px]', color)}
            style={{ height: `${Math.max((d.value / max) * 60, 2)}px` }}
          />
          <span className="text-[8px] text-outline truncate">{d.label}</span>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// FileRow — Single file row with selection & drag support
// ---------------------------------------------------------------------------

interface FileRowProps {
  file: FileDiffInfo;
  isSelected: boolean;
  isDragging: boolean;
  stagingPath: string | null;
  group: 'staged' | 'unstaged' | 'untracked';
  onSelect: (file: FileDiffInfo, e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent, file: FileDiffInfo) => void;
  onDragEnd: () => void;
  onStage: (path: string) => void;
  onUnstage: (path: string) => void;
}

const FileRow: React.FC<FileRowProps> = ({
  file,
  isSelected,
  isDragging,
  stagingPath,
  group,
  onSelect,
  onDragStart,
  onDragEnd,
  onStage,
  onUnstage,
}) => {
  const fileName = file.path.split('/').pop() || file.path;
  const iconColor = group === 'staged' ? 'text-tertiary' : group === 'unstaged' ? 'text-primary' : 'text-warning';

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2.5 cursor-pointer select-none transition-all",
        isSelected && "bg-secondary/15 ring-1 ring-inset ring-secondary/30",
        isDragging && "opacity-40",
        !isSelected && "hover:bg-surface-container-high/20",
      )}
      onClick={(e) => onSelect(file, e)}
      draggable
      onDragStart={(e) => onDragStart(e, file)}
      onDragEnd={onDragEnd}
    >
      <FileText size={14} className={cn("shrink-0", iconColor)} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold truncate">{fileName}</p>
        <p className="text-[10px] text-outline truncate">{file.path}</p>
      </div>
      {(file.additions > 0 || file.deletions > 0) && (
        <div className="flex items-center gap-1 text-[10px] font-mono shrink-0">
          {file.additions > 0 && <span className="text-emerald-400">+{file.additions}</span>}
          {file.deletions > 0 && <span className="text-error">-{file.deletions}</span>}
        </div>
      )}
      {group === 'staged' ? (
        <button
          onClick={(e) => { e.stopPropagation(); onUnstage(file.path); }}
          disabled={stagingPath === file.path}
          className="p-1 rounded-md text-warning hover:bg-warning/10 transition-colors disabled:opacity-50"
          title="Unstage"
        >
          {stagingPath === file.path ? <Loader2 size={12} className="animate-spin" /> : <MinusCircle size={12} />}
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onStage(file.path); }}
          disabled={stagingPath === file.path}
          className="p-1 rounded-md text-tertiary hover:bg-tertiary/10 transition-colors disabled:opacity-50"
          title="Stage"
        >
          {stagingPath === file.path ? <Loader2 size={12} className="animate-spin" /> : <PlusCircle size={12} />}
        </button>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// BatchActionBar — Fixed bottom bar for batch operations
// ---------------------------------------------------------------------------

interface BatchActionBarProps {
  selectedCount: number;
  selectedStagedCount: number;
  selectedUnstagedCount: number;
  onStageSelected: () => void;
  onUnstageSelected: () => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onClearSelection: () => void;
  isBatchLoading: boolean;
  hasStagedFiles: boolean;
  hasUnstagedFiles: boolean;
}

const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedCount,
  selectedStagedCount,
  selectedUnstagedCount,
  onStageSelected,
  onUnstageSelected,
  onStageAll,
  onUnstageAll,
  onClearSelection,
  isBatchLoading,
  hasStagedFiles,
  hasUnstagedFiles,
}) => {
  if (selectedCount === 0 && !hasStagedFiles && !hasUnstagedFiles) return null;

  return (
    <div className="shrink-0 bg-surface-container-low border-t border-outline-variant/10 px-4 py-2">
      <div className="flex items-center gap-2">
        {/* Selection badge */}
        {selectedCount > 0 && (
          <>
            <span className="text-[10px] font-bold bg-secondary/15 text-secondary px-2 py-0.5 rounded-full">
              {selectedCount} selected
            </span>
            <button
              onClick={onClearSelection}
              className="p-1 rounded text-on-surface-variant hover:bg-surface-container-high/30 transition-colors"
              title="Clear selection (Esc)"
            >
              <X size={12} />
            </button>
            <div className="w-px h-4 bg-outline-variant/20 mx-1" />
          </>
        )}

        {/* Batch actions */}
        {isBatchLoading ? (
          <div className="flex items-center gap-2 text-[10px] text-on-surface-variant">
            <Loader2 size={12} className="animate-spin" />
            Processing...
          </div>
        ) : (
          <>
            {selectedCount > 0 && selectedUnstagedCount > 0 && (
              <button
                onClick={onStageSelected}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-tertiary/15 text-tertiary hover:bg-tertiary/25 transition-colors"
              >
                <PlusCircle size={11} />
                Stage Selected ({selectedUnstagedCount})
              </button>
            )}
            {selectedCount > 0 && selectedStagedCount > 0 && (
              <button
                onClick={onUnstageSelected}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-warning/15 text-warning hover:bg-warning/25 transition-colors"
              >
                <MinusCircle size={11} />
                Unstage Selected ({selectedStagedCount})
              </button>
            )}
            {/* Always show Stage All / Unstage All */}
            {hasUnstagedFiles && selectedCount === 0 && (
              <button
                onClick={onStageAll}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-tertiary/15 text-tertiary hover:bg-tertiary/25 transition-colors"
              >
                <Layers size={11} />
                Stage All
              </button>
            )}
            {hasStagedFiles && selectedCount === 0 && (
              <button
                onClick={onUnstageAll}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-warning/15 text-warning hover:bg-warning/25 transition-colors"
              >
                <Layers size={11} />
                Unstage All
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// GitView — Full-screen Git Tab Page
// ---------------------------------------------------------------------------

interface GitViewProps {
  workspacePath: string;
}

export const GitView: React.FC<GitViewProps> = ({ workspacePath }) => {
  const { t } = useTranslation();

  // Git hooks
  const gitStatus = useGitStatus(workspacePath);
  const gitDetail = useGitDetail();

  // Tab state
  const [activeTab, setActiveTab] = useState<GitModalTab>('overview');

  // Git operation state
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [stagingPath, setStagingPath] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    staged: false,
    unstaged: false,
    untracked: true,
  });
  const [hoveredGraphNode, setHoveredGraphNode] = useState<string | null>(null);

  // ── Multi-selection state ──
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number>(-1);
  const [draggingPaths, setDraggingPaths] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  // Drag-over state per group
  const [dragOverGroup, setDragOverGroup] = useState<'staged' | 'unstaged' | 'untracked' | null>(null);

  // Diff preview state (feat-git-display-enhance)
  const [selectedDiffFile, setSelectedDiffFile] = useState<FileDiffInfo | null>(null);
  const [diffResult, setDiffResult] = useState<FileDiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [showDiffPanel, setShowDiffPanel] = useState(false);

  // Ref for the changes panel for keyboard shortcuts
  const changesPanelRef = useRef<HTMLDivElement>(null);

  // Refresh data on mount
  useEffect(() => {
    if (workspacePath) {
      gitStatus.refresh();
      gitDetail.refreshAll();
    }
  }, [workspacePath]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helper: get grouped files ──
  const getGroupedFiles = useCallback(() => {
    if (!gitStatus.data) return { staged: [], unstaged: [], untracked: [] };
    return {
      staged: gitStatus.data.files.filter(f => f.status === 'staged'),
      unstaged: gitStatus.data.files.filter(f => f.status === 'unstaged'),
      untracked: gitStatus.data.files.filter(f => f.status === 'untracked'),
    };
  }, [gitStatus.data]);

  // ── Diff preview loading (feat-git-display-enhance) ──
  const loadDiff = useCallback(async (file: FileDiffInfo) => {
    setSelectedDiffFile(file);
    setShowDiffPanel(true);
    setDiffLoading(true);
    setDiffError(null);
    setDiffResult(null);

    try {
      const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
      if (!isTauri) {
        // Mock diff for dev mode
        await new Promise(r => setTimeout(r, 300));
        const mockDiff: FileDiffResult = {
          path: file.path,
          additions: file.additions || 3,
          deletions: file.deletions || 1,
          lines: [
            { type: 'header', old_line_no: null, new_line_no: null, content: '@@ -1,5 +1,8 @@' },
            { type: 'context', old_line_no: 1, new_line_no: 1, content: 'import React from "react";' },
            { type: 'context', old_line_no: 2, new_line_no: 2, content: '' },
            { type: 'remove', old_line_no: 3, new_line_no: null, content: '// Old import' },
            { type: 'add', old_line_no: null, new_line_no: 3, content: '// New import with changes' },
            { type: 'add', old_line_no: null, new_line_no: 4, content: 'import { useState } from "react";' },
            { type: 'context', old_line_no: 4, new_line_no: 5, content: '' },
            { type: 'context', old_line_no: 5, new_line_no: 6, content: 'export const Component = () => {' },
            { type: 'add', old_line_no: null, new_line_no: 7, content: '  const [count, setCount] = useState(0);' },
            { type: 'context', old_line_no: 6, new_line_no: 8, content: '  return <div>Hello</div>;' },
            { type: 'context', old_line_no: 7, new_line_no: 9, content: '};' },
          ],
        };
        setDiffResult(mockDiff);
        return;
      }
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<FileDiffResult>('git_file_diff', {
        path: file.path,
        staged: file.status === 'staged',
      });
      setDiffResult(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setDiffError(msg);
    } finally {
      setDiffLoading(false);
    }
  }, []);

  // ── Multi-selection handler ──
  const handleFileSelect = useCallback((file: FileDiffInfo, e: React.MouseEvent) => {
    const { staged, unstaged, untracked } = getGroupedFiles();

    // Build a flat list matching render order
    const allFiles = [...staged, ...unstaged, ...untracked];
    const clickedIndex = allFiles.findIndex(f => f.path === file.path);

    setSelectedFiles(prev => {
      const next = new Set(prev);
      const isMeta = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;

      if (isShift && lastClickedIndex >= 0) {
        // Range select
        const from = Math.min(lastClickedIndex, clickedIndex);
        const to = Math.max(lastClickedIndex, clickedIndex);
        for (let i = from; i <= to; i++) {
          next.add(allFiles[i].path);
        }
      } else if (isMeta) {
        // Toggle individual
        if (next.has(file.path)) {
          next.delete(file.path);
        } else {
          next.add(file.path);
        }
      } else {
        // Single click: select only this file
        next.clear();
        next.add(file.path);
      }

      return next;
    });

    setLastClickedIndex(clickedIndex);

    // Load diff preview on single click (no modifier keys)
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && file.status !== 'untracked') {
      loadDiff(file);
    }
  }, [getGroupedFiles, lastClickedIndex, loadDiff]);

  // ── Clear selection ──
  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set());
    setLastClickedIndex(-1);
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when Changes tab is active
      if (activeTab !== 'changes') return;

      // Ctrl/Cmd+A — select all files in current groups
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        const { staged, unstaged, untracked } = getGroupedFiles();
        const allPaths = [...staged, ...unstaged, ...untracked].map(f => f.path);
        setSelectedFiles(new Set(allPaths));
        return;
      }

      // Escape — clear selection
      if (e.key === 'Escape') {
        clearSelection();
        return;
      }

      // Enter — stage selected unstaged/untracked files
      if (e.key === 'Enter' && selectedFiles.size > 0) {
        const { unstaged, untracked } = getGroupedFiles();
        const unstagedPaths = [...unstaged, ...untracked]
          .filter(f => selectedFiles.has(f.path))
          .map(f => f.path);
        if (unstagedPaths.length > 0) {
          handleBatchStage(unstagedPaths);
        }
        return;
      }

      // Delete/Backspace — discard selected unstaged changes (with confirmation)
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFiles.size > 0) {
        // For now, we just unstage the selected staged files
        const { staged } = getGroupedFiles();
        const stagedPaths = staged
          .filter(f => selectedFiles.has(f.path))
          .map(f => f.path);
        if (stagedPaths.length > 0) {
          handleBatchUnstage(stagedPaths);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, selectedFiles, getGroupedFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag & Drop handlers ──
  const handleDragStart = useCallback((e: React.DragEvent, file: FileDiffInfo) => {
    const pathsToDrag = selectedFiles.has(file.path) ? Array.from(selectedFiles) : [file.path];
    e.dataTransfer.setData('text/plain', JSON.stringify(pathsToDrag));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingPaths(new Set(pathsToDrag));
  }, [selectedFiles]);

  const handleDragEnd = useCallback(() => {
    setDraggingPaths(new Set());
    setDragOverGroup(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, group: 'staged' | 'unstaged') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverGroup(group);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverGroup(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetGroup: 'staged' | 'unstaged') => {
    e.preventDefault();
    setDragOverGroup(null);

    try {
      const raw = e.dataTransfer.getData('text/plain');
      const paths: string[] = JSON.parse(raw);

      if (targetGroup === 'staged') {
        // Stage the dropped files
        await handleBatchStage(paths);
      } else {
        // Unstage the dropped files
        await handleBatchUnstage(paths);
      }
    } catch {
      // ignore invalid drag data
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Batch operations ──
  const handleBatchStage = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return;
    setBatchLoading(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      if (paths.length === 1) {
        await invoke('git_stage_file', { path: paths[0] });
      } else {
        await invoke('git_batch_stage_files', { paths });
      }
      clearSelection();
      await gitStatus.refresh();
    } catch (err) {
      console.error('Batch stage failed:', err);
    } finally {
      setBatchLoading(false);
    }
  }, [gitStatus, clearSelection]);

  const handleBatchUnstage = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return;
    setBatchLoading(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      if (paths.length === 1) {
        await invoke('git_unstage_file', { path: paths[0] });
      } else {
        await invoke('git_batch_unstage_files', { paths });
      }
      clearSelection();
      await gitStatus.refresh();
    } catch (err) {
      console.error('Batch unstage failed:', err);
    } finally {
      setBatchLoading(false);
    }
  }, [gitStatus, clearSelection]);

  const handleStageAll = useCallback(async () => {
    setBatchLoading(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('git_stage_all');
      clearSelection();
      await gitStatus.refresh();
    } catch (err) {
      console.error('Stage all failed:', err);
    } finally {
      setBatchLoading(false);
    }
  }, [gitStatus, clearSelection]);

  const handleUnstageAll = useCallback(async () => {
    setBatchLoading(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('git_unstage_all');
      clearSelection();
      await gitStatus.refresh();
    } catch (err) {
      console.error('Unstage all failed:', err);
    } finally {
      setBatchLoading(false);
    }
  }, [gitStatus, clearSelection]);

  // --- Single-file Git operations ---
  const handlePush = async () => {
    setIsPushing(true);
    setSyncMessage(null);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<{ success: boolean; message: string }>('git_push');
      setSyncMessage({ text: result.message, type: result.success ? 'success' : 'error' });
      await gitStatus.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSyncMessage({ text: msg, type: 'error' });
    } finally {
      setIsPushing(false);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  const handlePull = async () => {
    setIsPulling(true);
    setSyncMessage(null);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<{ success: boolean; message: string }>('git_pull');
      setSyncMessage({ text: result.message, type: result.success ? 'success' : 'error' });
      await gitStatus.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSyncMessage({ text: msg, type: 'error' });
    } finally {
      setIsPulling(false);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  const handleStageFile = async (filePath: string) => {
    setStagingPath(filePath);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('git_stage_file', { path: filePath });
      await gitStatus.refresh();
    } catch (e) {
      console.error('Failed to stage file:', e);
    } finally {
      setStagingPath(null);
    }
  };

  const handleUnstageFile = async (filePath: string) => {
    setStagingPath(filePath);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('git_unstage_file', { path: filePath });
      await gitStatus.refresh();
    } catch (e) {
      console.error('Failed to unstage file:', e);
    } finally {
      setStagingPath(null);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim() || isCommitting) return;
    setIsCommitting(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('git_commit', { message: commitMessage });
      setCommitMessage('');
      await gitStatus.refresh();
    } catch (e) {
      console.error('Failed to commit:', e);
    } finally {
      setIsCommitting(false);
    }
  };

  // ── Compute selected counts for batch action bar ──
  const selectedStagedCount = gitStatus.data
    ? gitStatus.data.files.filter(f => f.status === 'staged' && selectedFiles.has(f.path)).length
    : 0;
  const selectedUnstagedCount = gitStatus.data
    ? gitStatus.data.files.filter(f => (f.status === 'unstaged' || f.status === 'untracked') && selectedFiles.has(f.path)).length
    : 0;

  // ── Render a file group section with drop zone ──
  const renderFileGroup = (
    groupKey: 'staged' | 'unstaged' | 'untracked',
    files: FileDiffInfo[],
    label: string,
    labelColor: string,
    iconName: 'tertiary' | 'primary' | 'warning',
    isDropTarget?: boolean,
  ) => {
    if (files.length === 0) return null;
    const collapsed = collapsedGroups[groupKey] ?? (groupKey === 'untracked');
    const ChevronIcon = collapsed ? ChevronRight : ChevronDown;
    const colorMap = { tertiary: 'text-tertiary', primary: 'text-primary', warning: 'text-warning' };

    const isDragOver = dragOverGroup === groupKey && isDropTarget;

    return (
      <div className="space-y-1">
        <button
          onClick={() => setCollapsedGroups(prev => ({ ...prev, [groupKey]: !collapsed }))}
          className="flex items-center gap-2 w-full hover:bg-surface-container-high/30 rounded px-1 py-0.5 transition-colors"
        >
          <ChevronIcon size={12} className={cn("shrink-0", colorMap[iconName])} />
          <span className={cn("text-[9px] font-bold uppercase tracking-widest", colorMap[iconName])}>{label}</span>
          <span className={cn(
            "text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
            iconName === 'tertiary' && "text-tertiary/70 bg-tertiary/10",
            iconName === 'primary' && "text-primary/70 bg-primary/10",
            iconName === 'warning' && "text-warning/70 bg-warning/10",
          )}>
            {files.length}
          </span>
        </button>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className={cn(
                  "bg-surface-container-lowest rounded-lg border overflow-hidden divide-y divide-outline-variant/5 transition-all",
                  isDragOver
                    ? "border-secondary/50 bg-secondary/5 ring-2 ring-inset ring-secondary/30"
                    : "border-outline-variant/10",
                )}
                onDragOver={isDropTarget ? (e) => handleDragOver(e, groupKey as 'staged' | 'unstaged') : undefined}
                onDragEnter={isDropTarget ? (e) => { e.preventDefault(); setDragOverGroup(groupKey); } : undefined}
                onDragLeave={isDropTarget ? handleDragLeave : undefined}
                onDrop={isDropTarget ? (e) => handleDrop(e, groupKey as 'staged' | 'unstaged') : undefined}
              >
                {isDragOver && (
                  <div className="flex items-center justify-center py-3 text-[10px] font-bold text-secondary animate-pulse">
                    {groupKey === 'staged' ? 'Release to stage files' : 'Release to unstage files'}
                  </div>
                )}
                {files.map((file) => (
                  <FileRow
                    key={file.path}
                    file={file}
                    isSelected={selectedFiles.has(file.path)}
                    isDragging={draggingPaths.has(file.path)}
                    stagingPath={stagingPath}
                    group={groupKey}
                    onSelect={handleFileSelect}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onStage={handleStageFile}
                    onUnstage={handleUnstageFile}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // --- Tab definitions ---
  const tabs: { key: GitModalTab; icon: any; label: string }[] = [
    { key: 'overview', icon: Eye, label: 'Overview' },
    { key: 'branches', icon: GitBranch, label: 'Branches' },
    { key: 'tags', icon: Tag, label: 'Tags' },
    { key: 'history', icon: History, label: 'History' },
    { key: 'changes', icon: FileText, label: 'Changes' },
    { key: 'features', icon: Box, label: 'Features' },
    { key: 'graph', icon: Network, label: 'Graph' },
  ];

  const { staged: stagedFiles, unstaged: unstagedFiles, untracked: untrackedFiles } = getGroupedFiles();

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden relative">
      {/* ─── Header ─── */}
      <header className="h-14 bg-surface-container-low flex items-center justify-between px-6 border-b border-outline-variant/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-secondary/10 rounded-lg">
            <Github size={18} className="text-secondary" />
          </div>
          <div>
            <h1 className="font-headline text-lg font-bold tracking-tight text-on-surface">Git</h1>
            <p className="text-[10px] text-outline font-mono">
              {gitStatus.data?.remote_url || 'No remote configured'}
            </p>
          </div>
          {gitStatus.data && (
            <div className="flex items-center gap-2 ml-3">
              <span className="text-[10px] font-mono bg-secondary/10 text-secondary px-2 py-0.5 rounded">
                {gitStatus.data.current_branch}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { gitStatus.refresh(); gitDetail.refreshAll(); }}
            disabled={gitStatus.loading}
            className="p-2 bg-surface-container-high text-on-surface-variant rounded hover:text-secondary hover:bg-secondary/10 transition-all border border-outline-variant/10"
            title="Refresh"
          >
            <RefreshCw size={16} className={cn(gitStatus.loading && "animate-spin")} />
          </button>
        </div>
      </header>

      {/* ─── Tab Bar (responsive with horizontal scroll) ─── */}
      <div className="flex overflow-x-auto border-b border-outline-variant/10 bg-surface-container-low shrink-0 scroll-hide">
        {tabs.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); if (key !== 'changes') clearSelection(); }}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 whitespace-nowrap',
              activeTab === key
                ? 'text-secondary border-secondary bg-surface-container-lowest'
                : 'text-on-surface-variant border-transparent hover:text-on-surface hover:bg-surface-container-high/20'
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Content area */}
        <div className="flex-1 overflow-y-auto scroll-hide" ref={changesPanelRef}>
          {gitStatus.error ? (
            <div className="flex items-center gap-3 p-4 m-6 bg-error/10 rounded-lg border border-error/20">
              <AlertTriangle size={16} className="text-error shrink-0" />
              <div>
                <p className="text-xs font-bold text-error">{gitStatus.error}</p>
                <p className="text-[10px] text-on-surface-variant mt-1">Make sure the workspace is a Git repository.</p>
              </div>
            </div>
          ) : gitStatus.loading && !gitStatus.data ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : gitStatus.data ? (
            <>
              {/* ── Overview Tab (Enhanced) ── */}
              {activeTab === 'overview' && (
                <div className="space-y-6 max-w-5xl p-6">
                  {/* Branch + remote summary */}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Branch</span>
                    <span className="text-xs font-mono bg-secondary/10 text-secondary px-3 py-1 rounded">
                      {gitStatus.data.current_branch}
                    </span>
                  </div>

                  {/* Quick stats - glass card grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-surface-container-lowest/80 backdrop-blur rounded-xl border border-outline-variant/10 p-4 text-center">
                      <p className="text-2xl font-bold text-secondary">{gitDetail.branches.length || '—'}</p>
                      <p className="text-[10px] uppercase tracking-widest text-outline mt-1">Branches</p>
                    </div>
                    <div className="bg-surface-container-lowest/80 backdrop-blur rounded-xl border border-outline-variant/10 p-4 text-center">
                      <p className="text-2xl font-bold text-tertiary">{gitDetail.tags.length || '—'}</p>
                      <p className="text-[10px] uppercase tracking-widest text-outline mt-1">Tags</p>
                    </div>
                    <div className="bg-surface-container-lowest/80 backdrop-blur rounded-xl border border-outline-variant/10 p-4 text-center">
                      <p className="text-2xl font-bold text-primary">{gitStatus.data.files.length}</p>
                      <p className="text-[10px] uppercase tracking-widest text-outline mt-1">Changes</p>
                    </div>
                    <div className="bg-surface-container-lowest/80 backdrop-blur rounded-xl border border-outline-variant/10 p-4 text-center">
                      <p className="text-2xl font-bold text-on-surface">{gitDetail.commits.length}</p>
                      <p className="text-[10px] uppercase tracking-widest text-outline mt-1">Commits</p>
                    </div>
                  </div>

                  {/* Change statistics visualization */}
                  {(() => {
                    const staged = gitStatus.data.files.filter(f => f.status === 'staged');
                    const unstaged = gitStatus.data.files.filter(f => f.status === 'unstaged');
                    const untracked = gitStatus.data.files.filter(f => f.status === 'untracked');
                    const totalAdditions = gitStatus.data.files.reduce((s, f) => s + f.additions, 0);
                    const totalDeletions = gitStatus.data.files.reduce((s, f) => s + f.deletions, 0);

                    // Compute commit frequency for last 7 days
                    const now = Date.now() / 1000;
                    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    const bars: { label: string; value: number }[] = [];
                    for (let i = 6; i >= 0; i--) {
                      const dayStart = now - (i + 1) * 86400;
                      const dayEnd = now - i * 86400;
                      const count = gitDetail.commits.filter(c => c.timestamp >= dayStart && c.timestamp < dayEnd).length;
                      const date = new Date((now - i * 86400) * 1000);
                      bars.push({ label: dayNames[date.getDay()], value: count });
                    }
                    const maxBar = Math.max(...bars.map(b => b.value), 1);

                    return (
                      <>
                        {/* File change stats cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="flex items-center gap-3 bg-surface-container-lowest/80 backdrop-blur rounded-xl border border-outline-variant/10 p-4">
                            <div className="p-2 rounded-lg bg-tertiary/10">
                              <FilePlus size={16} className="text-tertiary" />
                            </div>
                            <div>
                              <p className="text-lg font-bold text-tertiary">{staged.length}</p>
                              <p className="text-[10px] text-outline uppercase tracking-wider">Staged</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 bg-surface-container-lowest/80 backdrop-blur rounded-xl border border-outline-variant/10 p-4">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <FileText size={16} className="text-primary" />
                            </div>
                            <div>
                              <p className="text-lg font-bold text-primary">{unstaged.length}</p>
                              <p className="text-[10px] text-outline uppercase tracking-wider">Modified</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 bg-surface-container-lowest/80 backdrop-blur rounded-xl border border-outline-variant/10 p-4">
                            <div className="p-2 rounded-lg bg-warning/10">
                              <FileQuestion size={16} className="text-warning" />
                            </div>
                            <div>
                              <p className="text-lg font-bold text-warning">{untracked.length}</p>
                              <p className="text-[10px] text-outline uppercase tracking-wider">Untracked</p>
                            </div>
                          </div>
                        </div>

                        {/* Additions/Deletions totals + Bar chart */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Line change stats */}
                          <div className="bg-surface-container-lowest/80 backdrop-blur rounded-xl border border-outline-variant/10 p-4 space-y-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Line Changes</span>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <TrendingUp size={16} className="text-emerald-400" />
                                <div>
                                  <p className="text-xl font-bold text-emerald-400">+{totalAdditions}</p>
                                  <p className="text-[9px] text-outline">Additions</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <TrendingDown size={16} className="text-error" />
                                <div>
                                  <p className="text-xl font-bold text-error">-{totalDeletions}</p>
                                  <p className="text-[9px] text-outline">Deletions</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          {/* Commit frequency bar chart */}
                          <div className="bg-surface-container-lowest/80 backdrop-blur rounded-xl border border-outline-variant/10 p-4 space-y-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Commits (7d)</span>
                            <StatBarChart data={bars} maxValue={maxBar} color="bg-secondary" />
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Recent commits */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Recent Commits</span>
                    {gitDetail.commits.slice(0, 8).map((c) => (
                      <div key={c.hash} className="flex items-center gap-3 p-3 bg-surface-container-lowest/50 rounded-xl border border-outline-variant/5 hover:bg-surface-container-low/30 transition-colors">
                        <div className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-surface-container-high/50">
                          <GitCommitHorizontal size={12} className="text-outline" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate font-medium">{c.message}</p>
                          <p className="text-[9px] text-outline font-mono">{c.short_hash} · {c.author}</p>
                        </div>
                        <span className="text-[9px] text-on-surface-variant shrink-0">{c.time_ago}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Branches Tab ── */}
              {activeTab === 'branches' && (
                <div className="space-y-2 max-w-4xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Local Branches</span>
                    <span className="text-[10px] text-on-surface-variant">{gitDetail.branches.length} branch{gitDetail.branches.length !== 1 ? 'es' : ''}</span>
                  </div>
                  {gitDetail.branches.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-xs text-on-surface-variant opacity-60">Loading...</div>
                  ) : gitDetail.branches.map((b) => (
                    <div key={b.name} className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                      b.is_current
                        ? "bg-secondary/10 border-secondary/20"
                        : "bg-surface-container-lowest/50 border-outline-variant/5 hover:bg-surface-container-high/20"
                    )}>
                      <GitBranch size={14} className={cn("shrink-0", b.is_current ? "text-secondary" : "text-outline")} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold truncate">{b.name}</p>
                          {b.is_current && (
                            <span className="text-[8px] bg-secondary/20 text-secondary px-1.5 py-0.5 rounded font-bold uppercase">Current</span>
                          )}
                        </div>
                        <p className="text-[9px] text-outline truncate font-mono mt-0.5">{b.latest_commit_hash} {b.latest_commit}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Tags Tab ── */}
              {activeTab === 'tags' && (
                <div className="space-y-2 max-w-4xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Git Tags</span>
                    <span className="text-[10px] text-on-surface-variant">{gitDetail.tags.length} tag{gitDetail.tags.length !== 1 ? 's' : ''}</span>
                  </div>
                  {gitDetail.tags.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-xs text-on-surface-variant opacity-60">No tags found</div>
                  ) : gitDetail.tags.map((tag) => {
                    const isFeatureTag = tag.name.startsWith('feat-') || tag.name.startsWith('fix-');
                    const dateStr = tag.date > 0 ? new Date(tag.date * 1000).toLocaleDateString() : '—';
                    const isExpanded = gitDetail.expandedTags.has(tag.name);
                    const isLoading = gitDetail.tagLoading.has(tag.name);
                    const detail = gitDetail.tagDetails.get(tag.name);
                    return (
                      <div key={tag.name} className="bg-surface-container-lowest/50 rounded-lg border border-outline-variant/5 overflow-hidden">
                        {/* Tag header row */}
                        <div
                          className="flex items-center gap-2 p-3 cursor-pointer hover:bg-surface-container-low/30 transition-colors"
                          onClick={() => gitDetail.toggleTagExpand(tag.name)}
                        >
                          <div className="shrink-0 text-outline">
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </div>
                          <Tag size={14} className={cn("shrink-0", isFeatureTag ? "text-tertiary" : "text-outline")} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold truncate font-mono">{tag.name}</p>
                              {isFeatureTag && (
                                <span className="text-[8px] bg-tertiary/10 text-tertiary px-1.5 py-0.5 rounded font-bold uppercase">Feature</span>
                              )}
                            </div>
                            <p className="text-[9px] text-outline truncate mt-0.5">{tag.message || tag.commit_hash.slice(0, 7)}</p>
                          </div>
                          <span className="text-[9px] text-on-surface-variant shrink-0">{dateStr}</span>
                        </div>

                        {/* Expanded detail area */}
                        {isExpanded && (
                          <div className="border-t border-outline-variant/10 px-3 pb-3 pt-2 space-y-3">
                            {isLoading && !detail && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div className="h-3 w-16 bg-outline-variant/10 rounded animate-pulse" />
                                  <div className="h-3 w-24 bg-outline-variant/10 rounded animate-pulse" />
                                </div>
                                {[1, 2, 3].map((i) => (
                                  <div key={i} className="flex items-center gap-2 py-1.5">
                                    <div className="h-2.5 w-8 bg-outline-variant/10 rounded animate-pulse" />
                                    <div className="h-2.5 flex-1 bg-outline-variant/10 rounded animate-pulse" />
                                    <div className="h-2.5 w-12 bg-outline-variant/10 rounded animate-pulse" />
                                  </div>
                                ))}
                              </div>
                            )}

                            {detail && (
                              <>
                                {detail.commits.length > 0 && (
                                  <div>
                                    <p className="text-[9px] font-bold uppercase tracking-wider text-outline mb-1.5">
                                      Commits ({detail.commits.length})
                                    </p>
                                    <div className="space-y-1 max-h-60 overflow-y-auto">
                                      {detail.commits.map((c) => (
                                        <div key={c.hash} className="flex items-center gap-2 py-1">
                                          <span className="text-[8px] font-mono text-on-surface-variant bg-surface-container-high/50 px-1 rounded shrink-0">{c.short_hash}</span>
                                          <span className="text-[10px] truncate flex-1">{c.message}</span>
                                          <span className="text-[8px] text-on-surface-variant shrink-0">{c.time_ago}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {detail.file_changes.length > 0 && (
                                  <div>
                                    <p className="text-[9px] font-bold uppercase tracking-wider text-outline mb-1.5">
                                      Files Changed ({detail.file_changes.length > 50 ? '50+' : detail.file_changes.length})
                                    </p>
                                    <div className="space-y-1 max-h-60 overflow-y-auto">
                                      {detail.file_changes.slice(0, 50).map((fc, idx) => (
                                        <div key={idx} className="flex items-center gap-2 py-0.5">
                                          <span className={cn(
                                            "text-[7px] font-bold uppercase px-1 py-0.5 rounded shrink-0 w-14 text-center",
                                            fc.status === 'added' && "bg-green-500/10 text-green-400",
                                            fc.status === 'modified' && "bg-blue-500/10 text-blue-400",
                                            fc.status === 'removed' && "bg-red-500/10 text-red-400",
                                            fc.status === 'renamed' && "bg-yellow-500/10 text-yellow-400",
                                          )}>
                                            {fc.status}
                                          </span>
                                          <span className="text-[9px] truncate flex-1 font-mono">{fc.path}</span>
                                          <span className="text-[8px] shrink-0 space-x-1.5">
                                            {fc.additions > 0 && <span className="text-green-400">+{fc.additions}</span>}
                                            {fc.deletions > 0 && <span className="text-red-400">-{fc.deletions}</span>}
                                          </span>
                                        </div>
                                      ))}
                                      {detail.file_changes.length > 50 && (
                                        <p className="text-[8px] text-on-surface-variant text-center py-1">
                                          +{detail.file_changes.length - 50} more files...
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {detail.commits.length === 0 && detail.file_changes.length === 0 && (
                                  <p className="text-[9px] text-on-surface-variant text-center py-2 opacity-60">
                                    No changes found for this tag
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── History Tab (Enhanced with expandable details) ── */}
              {activeTab === 'history' && (
                <div className="space-y-2 max-w-4xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Commit History</span>
                    <span className="text-[10px] text-on-surface-variant">{gitDetail.commits.length} commits</span>
                  </div>
                  {gitDetail.commits.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-xs text-on-surface-variant opacity-60">No commits</div>
                  ) : gitDetail.commits.map((c) => {
                    const isExpanded = gitDetail.expandedCommits.has(c.hash);
                    const isLoading = gitDetail.commitLoading.has(c.hash);
                    const detail = gitDetail.commitDetails.get(c.hash);
                    return (
                      <div key={c.hash} className="bg-surface-container-lowest/50 rounded-xl border border-outline-variant/5 overflow-hidden">
                        {/* Commit header row */}
                        <div
                          className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-container-low/30 transition-colors"
                          onClick={() => gitDetail.toggleCommitExpand(c.hash)}
                        >
                          <div className="shrink-0 text-outline">
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </div>
                          <div className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-surface-container-high/50">
                            <GitCommitHorizontal size={12} className="text-outline" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate font-medium">{c.message}</p>
                            <p className="text-[9px] text-outline font-mono">{c.short_hash} · {c.author}</p>
                          </div>
                          <span className="text-[9px] text-on-surface-variant shrink-0">{c.time_ago}</span>
                        </div>

                        {/* Expanded commit detail */}
                        {isExpanded && (
                          <div className="border-t border-outline-variant/10 px-3 pb-3 pt-2 space-y-3">
                            {isLoading && !detail && (
                              <div className="space-y-2 py-2">
                                {[1, 2, 3].map((i) => (
                                  <div key={i} className="flex items-center gap-2 py-1">
                                    <div className="h-2.5 w-8 bg-outline-variant/10 rounded animate-pulse" />
                                    <div className="h-2.5 flex-1 bg-outline-variant/10 rounded animate-pulse" />
                                    <div className="h-2.5 w-12 bg-outline-variant/10 rounded animate-pulse" />
                                  </div>
                                ))}
                              </div>
                            )}

                            {detail && (
                              <>
                                {/* Stats summary */}
                                <div className="flex items-center gap-3 text-[10px]">
                                  <span className="text-outline">{detail.file_changes.length} files changed</span>
                                  <span className="text-emerald-400 font-mono">+{detail.total_additions}</span>
                                  <span className="text-error font-mono">-{detail.total_deletions}</span>
                                </div>

                                {/* File change list */}
                                {detail.file_changes.length > 0 && (
                                  <div className="space-y-1 max-h-60 overflow-y-auto">
                                    {detail.file_changes.map((fc, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center gap-2 py-1 px-1 rounded hover:bg-surface-container-high/20 transition-colors cursor-pointer"
                                        onClick={async () => {
                                          // Switch to changes tab and load diff for this file
                                          try {
                                            const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
                                            if (isTauri) {
                                              const { invoke } = await import('@tauri-apps/api/core');
                                              const diff = await invoke<FileDiffResult>('git_file_diff', {
                                                path: fc.path,
                                                staged: false,
                                              });
                                              setDiffResult(diff);
                                              setSelectedDiffFile({ path: fc.path, status: 'unstaged', additions: fc.additions, deletions: fc.deletions });
                                              setShowDiffPanel(true);
                                            }
                                          } catch { /* ignore */ }
                                        }}
                                      >
                                        <span className={cn(
                                          "text-[7px] font-bold uppercase px-1 py-0.5 rounded shrink-0 w-14 text-center",
                                          fc.status === 'added' && "bg-green-500/10 text-green-400",
                                          fc.status === 'modified' && "bg-blue-500/10 text-blue-400",
                                          fc.status === 'removed' && "bg-red-500/10 text-red-400",
                                          fc.status === 'renamed' && "bg-yellow-500/10 text-yellow-400",
                                        )}>
                                          {fc.status}
                                        </span>
                                        <span className="text-[9px] truncate flex-1 font-mono">{fc.path}</span>
                                        <span className="text-[8px] shrink-0 space-x-1.5">
                                          {fc.additions > 0 && <span className="text-green-400">+{fc.additions}</span>}
                                          {fc.deletions > 0 && <span className="text-red-400">-{fc.deletions}</span>}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {detail.file_changes.length === 0 && (
                                  <p className="text-[9px] text-on-surface-variant text-center py-2 opacity-60">
                                    No file changes in this commit
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {gitDetail.commits.length >= 50 && (
                    <button
                      onClick={() => gitDetail.loadMoreCommits(gitDetail.commits.length)}
                      className="w-full py-2 text-xs text-primary font-bold hover:bg-primary/10 rounded-xl transition-colors"
                    >
                      Load more...
                    </button>
                  )}
                </div>
              )}

              {/* ── Changes Tab — Enhanced with Diff Preview ── */}
              {activeTab === 'changes' && (
                <div className="flex flex-col md:flex-row gap-4 h-full p-4 md:p-6">
                  {/* Left: File list with drop zones */}
                  <div className={cn(
                    "flex flex-col min-w-0 overflow-hidden",
                    showDiffPanel ? "flex-1" : "flex-1"
                  )}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-outline">{t('project.changesDetected', 'Changes Detected')}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-tertiary">
                          {gitStatus.data.files.length === 0
                            ? 'No changes'
                            : `${gitStatus.data.files.length} File${gitStatus.data.files.length > 1 ? 's' : ''} Changed`}
                        </span>
                        {!showDiffPanel && (
                          <button
                            onClick={() => setShowDiffPanel(true)}
                            className="p-1 rounded hover:bg-surface-container-high/30 transition-colors"
                            title="Open Diff Preview"
                          >
                            <PanelRightOpen size={14} className="text-on-surface-variant" />
                          </button>
                        )}
                      </div>
                    </div>
                    {gitStatus.data.files.length === 0 ? (
                      <div className="flex items-center justify-center py-8 text-xs text-on-surface-variant opacity-60">
                        No changes detected
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto space-y-3">
                        {/* Staged files — drop target for unstaging */}
                        {renderFileGroup('staged', stagedFiles, 'Staged', 'tertiary', 'tertiary', true)}
                        {/* Unstaged files — drop target for staging */}
                        {renderFileGroup('unstaged', unstagedFiles, 'Modified', 'primary', 'primary', true)}
                        {/* Untracked files */}
                        {renderFileGroup('untracked', untrackedFiles, 'Untracked', 'warning', 'warning')}
                      </div>
                    )}

                    {/* Batch action bar */}
                    <BatchActionBar
                      selectedCount={selectedFiles.size}
                      selectedStagedCount={selectedStagedCount}
                      selectedUnstagedCount={selectedUnstagedCount}
                      onStageSelected={() => {
                        const paths = [...unstagedFiles, ...untrackedFiles]
                          .filter(f => selectedFiles.has(f.path))
                          .map(f => f.path);
                        handleBatchStage(paths);
                      }}
                      onUnstageSelected={() => {
                        const paths = stagedFiles
                          .filter(f => selectedFiles.has(f.path))
                          .map(f => f.path);
                        handleBatchUnstage(paths);
                      }}
                      onStageAll={handleStageAll}
                      onUnstageAll={handleUnstageAll}
                      onClearSelection={clearSelection}
                      isBatchLoading={batchLoading}
                      hasStagedFiles={stagedFiles.length > 0}
                      hasUnstagedFiles={unstagedFiles.length > 0 || untrackedFiles.length > 0}
                    />
                  </div>

                  {/* Middle: Diff Preview Panel (toggleable) */}
                  {showDiffPanel && (
                    <div className="w-full md:w-[420px] lg:w-[480px] shrink-0 h-[300px] md:h-auto">
                      <DiffPanel
                        diff={diffResult}
                        loading={diffLoading}
                        error={diffError}
                        onClose={() => {
                          setShowDiffPanel(false);
                          setSelectedDiffFile(null);
                          setDiffResult(null);
                        }}
                      />
                    </div>
                  )}

                  {/* Right: Operation panel */}
                  <div className="w-full md:w-[320px] shrink-0 flex flex-col gap-3">
                    {/* Commit input */}
                    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 space-y-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Commit</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={commitMessage}
                          onChange={(e) => setCommitMessage(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleCommit()}
                          placeholder="Commit message..."
                          disabled={isCommitting}
                          className="flex-1 bg-surface-container border border-outline-variant/20 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/50 font-mono disabled:opacity-50"
                        />
                      </div>
                      <button
                        onClick={handleCommit}
                        disabled={isCommitting || !commitMessage.trim() || !gitStatus.data?.files.some(f => f.status === 'staged')}
                        className={cn(
                          "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                          commitMessage.trim() && gitStatus.data?.files.some(f => f.status === 'staged')
                            ? "bg-primary text-on-primary hover:brightness-110"
                            : "bg-surface-container-highest text-on-surface-variant border border-outline-variant/10"
                        )}
                      >
                        {isCommitting ? <Loader2 size={12} className="animate-spin" /> : <GitCommitHorizontal size={12} />}
                        Commit
                      </button>
                    </div>

                    {/* Sync feedback */}
                    {syncMessage && (
                      <div className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
                        syncMessage.type === 'success'
                          ? "bg-tertiary/10 text-tertiary border border-tertiary/20"
                          : "bg-error/10 text-error border border-error/20"
                      )}>
                        {syncMessage.type === 'success' ? <CheckCircle2 size={12} className="shrink-0" /> : <AlertTriangle size={12} className="shrink-0" />}
                        <span className="truncate">{syncMessage.text}</span>
                      </div>
                    )}

                    {/* Push / Pull */}
                    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 space-y-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Sync</span>
                      <div className="flex gap-2">
                        <button
                          onClick={handlePush}
                          disabled={isPushing || isPulling || !gitStatus.data?.remote_url}
                          className="flex-1 flex items-center justify-center gap-2 bg-primary text-on-primary py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50"
                        >
                          {isPushing ? <RefreshCw size={12} className="animate-spin" /> : <ArrowUpRight size={12} />}
                          {isPushing ? t('project.syncing', 'Syncing...') : t('project.pushChanges', 'Push')}
                        </button>
                        <button
                          onClick={handlePull}
                          disabled={isPushing || isPulling || !gitStatus.data?.remote_url}
                          className="flex-1 flex items-center justify-center gap-2 bg-surface-container-highest text-on-surface py-2 rounded-lg text-xs font-bold hover:bg-surface-variant transition-all border border-outline-variant/10 disabled:opacity-50"
                        >
                          {isPulling ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                          {isPulling ? t('project.syncing', 'Syncing...') : t('project.updateRemote', 'Pull')}
                        </button>
                      </div>
                    </div>

                    {/* Keyboard shortcuts hint */}
                    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Shortcuts</span>
                      <div className="space-y-1.5 text-[9px] text-on-surface-variant">
                        <div className="flex items-center justify-between">
                          <span>Select all</span>
                          <kbd className="bg-surface-container-high/50 px-1.5 py-0.5 rounded text-[8px] font-mono border border-outline-variant/10">
                            {navigator.platform?.includes('Mac') ? 'Cmd' : 'Ctrl'}+A
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Clear selection</span>
                          <kbd className="bg-surface-container-high/50 px-1.5 py-0.5 rounded text-[8px] font-mono border border-outline-variant/10">Esc</kbd>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Stage selected</span>
                          <kbd className="bg-surface-container-high/50 px-1.5 py-0.5 rounded text-[8px] font-mono border border-outline-variant/10">Enter</kbd>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Unstage selected</span>
                          <kbd className="bg-surface-container-high/50 px-1.5 py-0.5 rounded text-[8px] font-mono border border-outline-variant/10">Del</kbd>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Range select</span>
                          <kbd className="bg-surface-container-high/50 px-1.5 py-0.5 rounded text-[8px] font-mono border border-outline-variant/10">Shift+Click</kbd>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Toggle select</span>
                          <kbd className="bg-surface-container-high/50 px-1.5 py-0.5 rounded text-[8px] font-mono border border-outline-variant/10">
                            {navigator.platform?.includes('Mac') ? 'Cmd' : 'Ctrl'}+Click
                          </kbd>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Features Tab ── */}
              {activeTab === 'features' && (
                <div className="space-y-2 max-w-4xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Completed Features</span>
                  </div>
                  {(() => {
                    const featureTags = gitDetail.tags.filter(t => t.name.startsWith('feat-') || t.name.startsWith('fix-'));
                    if (featureTags.length === 0) {
                      return <div className="flex items-center justify-center py-8 text-xs text-on-surface-variant opacity-60">No feature tags found</div>;
                    }
                    return featureTags.map((tag) => {
                      const dateStr = tag.date > 0 ? new Date(tag.date * 1000).toLocaleDateString() : '—';
                      const nameMatch = tag.name.match(/^(feat|fix)-(.+)-\d{8}$/);
                      const featureName = nameMatch ? `${nameMatch[1]}-${nameMatch[2]}` : tag.name;
                      return (
                        <div key={tag.name} className="flex items-center gap-3 p-3 bg-surface-container-lowest/50 rounded-lg border border-outline-variant/5">
                          <div className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-tertiary/10">
                            <CheckCircle2 size={12} className="text-tertiary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate">{featureName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
                            <p className="text-[9px] text-outline truncate font-mono mt-0.5">{tag.name}</p>
                          </div>
                          <span className="text-[9px] text-on-surface-variant shrink-0">{dateStr}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {/* ── Graph Tab ── */}
              {activeTab === 'graph' && (
                <CommitGraphTab
                  graphData={gitDetail.commitGraph}
                  hoveredCommit={hoveredGraphNode}
                  onHoverCommit={setHoveredGraphNode}
                />
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
