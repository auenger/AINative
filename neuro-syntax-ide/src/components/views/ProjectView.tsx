import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  FolderOpen,
  Github,
  FileText,
  Send,
  Bot,
  ArrowUpRight,
  RefreshCw,
  X,
  Sparkles,
  Layers,
  CheckCircle2,
  Folder,
  Key,
  AlertTriangle,
  Loader2,
  Plus,
  MessageSquarePlus,
  Square,
  Radio,
  WifiOff,
  PlusCircle,
  MinusCircle,
  GitCommitHorizontal,
  GitBranch,
  Tag,
  Clock,
  History,
  Eye,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Box,
  FileCheck,
  Network,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import ReactMarkdown from 'react-markdown';
import { useAgentStream } from '../../lib/useAgentStream';
import type { FeaturePlanOutput } from '../../lib/useAgentStream';
import { useGitStatus } from '../../lib/useGitStatus';
import { useGitDetail } from '../../lib/useGitDetail';
import { useSettings } from '../../lib/useSettings';
import type { GitModalTab, BranchGraphNode, BranchGraphEdge } from '../../types';

interface WorkspaceHook {
  workspacePath: string;
  loading: boolean;
  error: string | null;
  selectWorkspace: () => Promise<void>;
}

interface ProjectViewProps {
  workspace: WorkspaceHook;
}

// ---------------------------------------------------------------------------
// BranchGraphTab — SVG topology visualization (feat-git-branch-graph)
// ---------------------------------------------------------------------------

interface BranchGraphTabProps {
  nodes: BranchGraphNode[];
  edges: BranchGraphEdge[];
  branches: { name: string; is_current: boolean; latest_commit: string; latest_commit_hash: string }[];
  hoveredNode: string | null;
  onHoverNode: (id: string | null) => void;
}

/** Layout constants for the graph visualization. */
const GRAPH_NODE_RADIUS = 22;
const GRAPH_COL_GAP = 180;
const GRAPH_ROW_GAP = 90;
const GRAPH_PAD_X = 60;
const GRAPH_PAD_Y = 50;

/** Compute layout positions for branch graph nodes.
 *  - main goes to column 0, row 0
 *  - Other branches are placed left-to-right, top-to-bottom
 */
function computeLayout(nodes: BranchGraphNode[], edges: BranchGraphEdge[]): BranchGraphNode[] {
  if (nodes.length === 0) return [];

  // Build adjacency: for each node, which nodes point to it (from edges where it is "to")
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const e of edges) {
    if (!incoming.has(e.to)) incoming.set(e.to, []);
    incoming.get(e.to)!.push(e.from);
    if (!outgoing.has(e.from)) outgoing.set(e.from, []);
    outgoing.get(e.from)!.push(e.to);
  }

  // Find main node
  const mainIdx = nodes.findIndex(n => n.id === 'main');
  const mainNode = mainIdx >= 0 ? nodes[mainIdx] : nodes[0];

  // BFS from main to assign columns (distance from main)
  const colMap = new Map<string, number>();
  const queue: string[] = [mainNode.id];
  colMap.set(mainNode.id, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentCol = colMap.get(current) ?? 0;
    // Follow outgoing edges
    for (const target of (outgoing.get(current) ?? [])) {
      if (!colMap.has(target)) {
        colMap.set(target, currentCol + 1);
        queue.push(target);
      }
    }
    // Follow incoming edges (reverse)
    for (const source of (incoming.get(current) ?? [])) {
      if (!colMap.has(source)) {
        colMap.set(source, Math.max(0, currentCol - 1));
        queue.push(source);
      }
    }
  }

  // Assign any remaining nodes that weren't reached
  let maxCol = Math.max(0, ...Array.from(colMap.values()));
  for (const node of nodes) {
    if (!colMap.has(node.id)) {
      maxCol++;
      colMap.set(node.id, maxCol);
    }
  }

  // Group nodes by column and assign rows within each column
  const colGroups = new Map<number, BranchGraphNode[]>();
  for (const node of nodes) {
    const col = colMap.get(node.id) ?? 0;
    if (!colGroups.has(col)) colGroups.set(col, []);
    colGroups.get(col)!.push(node);
  }

  // Sort each column: current branch first, then alphabetical
  for (const [, group] of colGroups) {
    group.sort((a, b) => {
      const aCurrent = a.id === nodes.find(n => n.type === 'branch')?.id ? 0 : 1;
      // Actually use branches data from props for is_current check — but we don't have it here.
      // Just sort alphabetically, with main first
      if (a.id === 'main') return -1;
      if (b.id === 'main') return 1;
      return a.id.localeCompare(b.id);
    });
  }

  // Assign coordinates
  const positioned = nodes.map(node => {
    const col = colMap.get(node.id) ?? 0;
    const group = colGroups.get(col) ?? [];
    const row = group.indexOf(node);
    return {
      ...node,
      x: GRAPH_PAD_X + col * GRAPH_COL_GAP,
      y: GRAPH_PAD_Y + row * GRAPH_ROW_GAP,
    };
  });

  return positioned;
}

const BranchGraphTab: React.FC<BranchGraphTabProps> = ({ nodes, edges, branches, hoveredNode, onHoverNode }) => {
  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-xs text-on-surface-variant opacity-60">
        No branch data available
      </div>
    );
  }

  const layoutNodes = computeLayout(nodes, edges);

  // Build a quick lookup for branch current status
  const currentBranch = branches.find(b => b.is_current)?.name;

  // Compute SVG dimensions
  const maxX = Math.max(...layoutNodes.map(n => (n.x ?? 0) + GRAPH_NODE_RADIUS + GRAPH_PAD_X));
  const maxY = Math.max(...layoutNodes.map(n => (n.y ?? 0) + GRAPH_NODE_RADIUS + GRAPH_PAD_Y));
  const svgWidth = Math.max(400, maxX);
  const svgHeight = Math.max(300, maxY);

  // Build edge paths with bezier curves
  const edgePaths = edges.map((edge, idx) => {
    const fromNode = layoutNodes.find(n => n.id === edge.from);
    const toNode = layoutNodes.find(n => n.id === edge.to);
    if (!fromNode || !toNode || fromNode.x == null || fromNode.y == null || toNode.x == null || toNode.y == null) return null;

    const isHighlighted = hoveredNode === edge.from || hoveredNode === edge.to;
    const x1 = fromNode.x;
    const y1 = fromNode.y;
    const x2 = toNode.x;
    const y2 = toNode.y;

    // Bezier control points for smooth curves
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;

    // Create a nice curve
    let path: string;
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal-ish: curve with control points offset vertically
      const cx1 = x1 + dx * 0.4;
      const cy1 = y1;
      const cx2 = x1 + dx * 0.6;
      const cy2 = y2;
      path = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
    } else {
      // Vertical-ish: simple curve
      const cx1 = x1;
      const cy1 = y1 + dy * 0.4;
      const cx2 = x2;
      const cy2 = y1 + dy * 0.6;
      path = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
    }

    const color = edge.type === 'fork' ? '#a78bfa' : edge.type === 'merge' ? '#34d399' : '#64748b';

    return (
      <path
        key={`edge-${idx}`}
        d={path}
        fill="none"
        stroke={isHighlighted ? color : `${color}66`}
        strokeWidth={isHighlighted ? 2.5 : 1.5}
        strokeDasharray={edge.type === 'merge' ? '6 3' : undefined}
      />
    );
  });

  return (
    <div className="relative w-full h-full overflow-auto">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Branch Topology</span>
        <span className="text-[10px] text-on-surface-variant">{nodes.length} nodes, {edges.length} edges</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-[#64748b]"></div>
          <span className="text-[9px] text-on-surface-variant">Linear</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-[#a78bfa]"></div>
          <span className="text-[9px] text-on-surface-variant">Fork</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-[#34d399]" style={{ borderTop: '1px dashed #34d399' }}></div>
          <span className="text-[9px] text-on-surface-variant">Merge</span>
        </div>
      </div>

      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="bg-surface-container-lowest/30 rounded-lg border border-outline-variant/5"
      >
        {/* Edges */}
        {edgePaths}

        {/* Nodes */}
        {layoutNodes.map((node) => {
          const isCurrent = node.id === currentBranch;
          const isMain = node.id === 'main';
          const isHovered = hoveredNode === node.id;
          const hasFeature = !!node.feature_id;
          const x = node.x ?? 0;
          const y = node.y ?? 0;

          // Determine node color
          let fillColor = '#334155'; // slate-700
          let strokeColor = '#64748b'; // slate-500
          if (isMain) {
            fillColor = '#1e3a5f';
            strokeColor = '#3b82f6'; // blue
          } else if (isCurrent) {
            fillColor = '#1a3326';
            strokeColor = '#22c55e'; // green
          } else if (hasFeature) {
            fillColor = '#2d1a4e';
            strokeColor = '#a78bfa'; // purple
          }

          return (
            <g
              key={node.id}
              onMouseEnter={() => onHoverNode(node.id)}
              onMouseLeave={() => onHoverNode(null)}
              className="cursor-pointer"
            >
              {/* Glow effect for hovered/current */}
              {(isHovered || isCurrent) && (
                <circle
                  cx={x}
                  cy={y}
                  r={GRAPH_NODE_RADIUS + 6}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={1}
                  opacity={0.3}
                  filter="url(#glow)"
                />
              )}

              {/* Main node circle */}
              <circle
                cx={x}
                cy={y}
                r={GRAPH_NODE_RADIUS}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isHovered ? 2.5 : isCurrent ? 2 : 1.5}
              />

              {/* Branch name label (inside or below) */}
              <text
                x={x}
                y={y - 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#e2e8f0"
                fontSize={9}
                fontWeight="bold"
                fontFamily="monospace"
              >
                {node.id.length > 12
                  ? '...' + node.id.slice(-10)
                  : node.id}
              </text>

              {/* Commit hash below name */}
              <text
                x={x}
                y={y + 9}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#94a3b8"
                fontSize={7}
                fontFamily="monospace"
              >
                {node.latest_commit.slice(0, 7)}
              </text>

              {/* Feature label badge */}
              {hasFeature && (
                <>
                  <rect
                    x={x - 20}
                    y={y - GRAPH_NODE_RADIUS - 14}
                    width={40}
                    height={12}
                    rx={3}
                    fill="#7c3aed"
                    opacity={0.9}
                  />
                  <text
                    x={x}
                    y={y - GRAPH_NODE_RADIUS - 7}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={6}
                    fontWeight="bold"
                  >
                    feature
                  </text>
                </>
              )}

              {/* Hover tooltip */}
              {isHovered && (
                <g>
                  <rect
                    x={x + GRAPH_NODE_RADIUS + 8}
                    y={y - 30}
                    width={220}
                    height={60}
                    rx={6}
                    fill="#1e293b"
                    stroke="#334155"
                    strokeWidth={1}
                    opacity={0.95}
                  />
                  <text
                    x={x + GRAPH_NODE_RADIUS + 16}
                    y={y - 14}
                    fill="#e2e8f0"
                    fontSize={10}
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {node.id}
                  </text>
                  <text
                    x={x + GRAPH_NODE_RADIUS + 16}
                    y={y + 2}
                    fill="#94a3b8"
                    fontSize={8}
                  >
                    {node.latest_message.slice(0, 35)}{node.latest_message.length > 35 ? '...' : ''}
                  </text>
                  <text
                    x={x + GRAPH_NODE_RADIUS + 16}
                    y={y + 16}
                    fill="#64748b"
                    fontSize={7}
                    fontFamily="monospace"
                  >
                    {node.latest_commit}
                    {hasFeature ? ` | ${node.feature_id}` : ''}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* SVG filter definitions */}
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
    </div>
  );
};

export const ProjectView: React.FC<ProjectViewProps> = ({ workspace }) => {
  const { t } = useTranslation();
  const { workspacePath, loading: workspaceLoading, error: workspaceError, selectWorkspace } = workspace;

  // --- Settings & Provider management ---
  const { settings } = useSettings();
  const defaultProvider = settings.llm.provider || 'gemini-http';

  // Independent provider overrides per agent tab (null = use settings default)
  const [pmProviderOverride, setPmProviderOverride] = useState<string | null>(null);
  const [reqProviderOverride, setReqProviderOverride] = useState<string | null>(null);

  // Derived runtime IDs
  const pmRuntimeId = pmProviderOverride ?? defaultProvider;
  const reqRuntimeId = reqProviderOverride ?? 'claude-code';

  // Build provider list from settings (for dropdown)
  const providerList = useMemo(() => {
    return Object.keys(settings.providers || {});
  }, [settings.providers]);

  const pmAgent = useAgentStream({
    runtimeId: pmRuntimeId,
    systemPrompt: `You are the PM Agent for Neuro Syntax IDE, an AI-native desktop IDE. Your role is to help users define and manage their project context, plan features, and answer questions about software architecture.

When users ask you to create a feature, respond with a clear plan that includes:
1. Feature ID (feat- prefix, kebab-case)
2. Feature name
3. Priority and size estimate
4. Dependencies
5. Description
6. Key user value points
7. Task breakdown

Be concise, technical, and actionable. Use Markdown formatting for clarity.`,
    greetingMessage: "Hello! I'm your PM Agent. I'll help you define and maintain the project context. What are we building today?",
  });

  const reqAgent = useAgentStream({
    runtimeId: reqRuntimeId,
    greetingMessage: "你好！我是需求分析 Agent。我可以帮你分析和文档化软件需求。告诉我你想构建什么功能？",
    useSessions: true,
    persistMessages: true,
    storageKey: 'req_agent_messages',
  });

  // Sync runtimeId changes from provider override to agent hooks
  useEffect(() => {
    pmAgent.setRuntimeId(pmRuntimeId);
  }, [pmRuntimeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    reqAgent.setRuntimeId(reqRuntimeId);
  }, [reqRuntimeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Provider dropdown open state
  const [showPmProviderDropdown, setShowPmProviderDropdown] = useState(false);
  const [showReqProviderDropdown, setShowReqProviderDropdown] = useState(false);

  /** Check if a provider has an API key configured */
  const hasProviderApiKey = useCallback((providerId: string): boolean => {
    const provider = settings.providers?.[providerId];
    return !!provider?.api_key;
  }, [settings.providers]);

  /** Handle PM provider switch */
  const handlePmProviderSwitch = useCallback((providerId: string) => {
    setPmProviderOverride(providerId === defaultProvider ? null : providerId);
    setShowPmProviderDropdown(false);
  }, [defaultProvider]);

  /** Handle Req provider switch */
  const handleReqProviderSwitch = useCallback((providerId: string) => {
    setReqProviderOverride(providerId === 'claude-code' ? null : providerId);
    setShowReqProviderDropdown(false);
  }, []);

  const gitStatus = useGitStatus(workspacePath);
  const gitDetail = useGitDetail();

  const [chatInput, setChatInput] = useState('');
  const [reqChatInput, setReqChatInput] = useState('');
  const [activeChatTab, setActiveChatTab] = useState<'pm' | 'req'>('pm');
  const [showGitModal, setShowGitModal] = useState(false);
  const [gitModalTab, setGitModalTab] = useState<GitModalTab>('overview');
  const [gitModalPos, setGitModalPos] = useState({ x: 0, y: 0 });
  const [gitModalSize, setGitModalSize] = useState({ w: 900, h: 560 });
  const gitModalRef = useRef<HTMLDivElement>(null);
  const gitDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const gitResizeRef = useRef<{ startX: number; startY: number; originW: number; originH: number } | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);  const [isGenerating, setIsGenerating] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [stagingPath, setStagingPath] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    staged: false,
    unstaged: false,
    untracked: true,
  });
  const [hoveredGraphNode, setHoveredGraphNode] = useState<string | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<FeaturePlanOutput | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [projectContext] = useState(`
# Project Context: Neuro Syntax IDE

## Overview
A next-generation, AI-first IDE designed for rapid prototyping and development.

## Core Features
- **AI-Agent Orchestration**: Native support for Gemini and Claude.
- **Task-Driven Workflow**: Integrated task board and AI task generation.
- **Mission Control**: Real-time monitoring of system health and AI activity.

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Motion.
- **Backend**: Express (optional), Node.js.
- **AI**: Google Gemini API, Anthropic Claude API.

## Roadmap
1. [x] Basic IDE Layout
2. [x] Internationalization
3. [ ] Real-time Collaboration
4. [ ] Integrated Debugger
`);

  const handleSendMessage = () => {
    if (!chatInput.trim() || pmAgent.isStreaming) return;
    pmAgent.sendMessage(chatInput);
    setChatInput('');
  };

  // Close provider dropdowns when clicking outside
  useEffect(() => {
    if (!showPmProviderDropdown && !showReqProviderDropdown) return;
    const handleClick = () => {
      setShowPmProviderDropdown(false);
      setShowReqProviderDropdown(false);
    };
    // Use setTimeout to avoid closing on the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClick, { once: true });
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [showPmProviderDropdown, showReqProviderDropdown]);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [pmAgent.messages]);

  // Auto-scroll req agent chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [reqAgent.messages]);

  // Refresh git status when the Git modal opens
  useEffect(() => {
    if (showGitModal) {
      gitStatus.refresh();
      gitDetail.refreshAll();
      // Reset tab to overview when opening
      setGitModalTab('overview');
      // Center the modal
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setGitModalPos({ x: Math.max(0, (vw - 900) / 2), y: Math.max(0, (vh - 560) / 2) });
    }
  }, [showGitModal]);

  // --- Drag to move the Git modal ---
  const handleGitDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    gitDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: gitModalPos.x,
      originY: gitModalPos.y,
    };
    const handleMove = (ev: MouseEvent) => {
      if (!gitDragRef.current) return;
      const dx = ev.clientX - gitDragRef.current.startX;
      const dy = ev.clientY - gitDragRef.current.startY;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setGitModalPos({
        x: Math.max(0, Math.min(vw - 200, gitDragRef.current.originX + dx)),
        y: Math.max(0, Math.min(vh - 60, gitDragRef.current.originY + dy)),
      });
    };
    const handleUp = () => {
      gitDragRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [gitModalPos.x, gitModalPos.y]);

  // --- Drag to resize the Git modal ---
  const handleGitResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    gitResizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originW: gitModalSize.w,
      originH: gitModalSize.h,
    };
    const handleMove = (ev: MouseEvent) => {
      if (!gitResizeRef.current) return;
      const dw = ev.clientX - gitResizeRef.current.startX;
      const dh = ev.clientY - gitResizeRef.current.startY;
      setGitModalSize({
        w: Math.max(600, gitResizeRef.current.originW + dw),
        h: Math.max(400, gitResizeRef.current.originH + dh),
      });
    };
    const handleUp = () => {
      gitResizeRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [gitModalSize.w, gitModalSize.h]);

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
      // Auto-dismiss message after 4 seconds
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
      // Auto-dismiss message after 4 seconds
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

  const handleGenerateTasks = async () => {
    if (!pmAgent.apiKeyConfigured) {
      setShowApiKeyModal(true);
      return;
    }
    setIsGenerating(true);
    setGeneratedPlan(null);

    const plan = await pmAgent.generateFeaturePlan(
      'Analyze the current project and create a new feature plan based on the project context and recent discussion.'
    );

    if (plan) {
      setGeneratedPlan(plan);
    }
    setIsGenerating(false);
  };

  const handleCreateFeature = async () => {
    if (!generatedPlan) return;
    const featureId = await pmAgent.createFeature(
      'epic-neuro-syntax-ide-roadmap',
      generatedPlan
    );
    if (featureId) {
      setGeneratedPlan(null);
      setShowTaskModal(false);
    }
  };

  const handleStoreApiKey = () => {
    if (!apiKeyInput.trim()) return;
    pmAgent.configureApiKey(apiKeyInput);
    setApiKeyInput('');
    setShowApiKeyModal(false);
  };

  const handleReqAgentSend = () => {
    if (!reqChatInput.trim() || reqAgent.isStreaming) return;
    reqAgent.sendMessage(reqChatInput);
    setReqChatInput('');
  };

  const handleReqAgentStart = async () => {
    // Always start a fresh session — do not reuse old session IDs
    await reqAgent.startSession();
  };

  const handleReqAgentNewSession = async () => {
    await reqAgent.newSession();
  };

  const handleReqAgentStop = async () => {
    await reqAgent.stopSession();
  };

  const reqConnectionLabel = () => {
    switch (reqAgent.connectionState) {
      case 'connected': return t('project.reqAgentConnected');
      case 'connecting': return t('project.reqAgentConnecting');
      case 'error': return t('project.reqAgentError');
      default: return t('project.reqAgentDisconnected');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden relative">
      <header className="h-14 bg-surface-container-low flex items-center justify-between px-6 border-b border-outline-variant/10 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="font-headline text-lg font-bold tracking-tight text-on-surface">{t('project.title')}</h1>
          <div className="h-4 w-px bg-outline-variant/30"></div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface-container-high/50 px-2 py-1 rounded border border-outline-variant/10">
            <FolderOpen size={14} className="text-primary" />
            <span className="font-mono opacity-80">
              {workspacePath || t('project.noWorkspace')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={selectWorkspace}
            disabled={workspaceLoading}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-all border",
              workspacePath
                ? "bg-surface-container-high text-on-surface-variant border-outline-variant/10 hover:bg-surface-container-highest"
                : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
            )}
          >
            {workspaceLoading ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <FolderOpen size={14} />
            )}
            {workspacePath ? t('project.selectWorkspace') : t('project.openProject')}
          </button>
          <button
            onClick={() => setShowTaskModal(true)}
            className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded text-xs font-bold hover:bg-primary/20 transition-all border border-primary/20"
          >
            <Sparkles size={14} />
            {t('project.generateTask')}
          </button>
          <button
            onClick={() => setShowGitModal(true)}
            title={t('project.gitStatus')}
            className="p-2 bg-surface-container-high text-on-surface-variant rounded hover:text-secondary hover:bg-secondary/10 transition-all border border-outline-variant/10"
          >
            <Github size={16} />
          </button>
        </div>
      </header>

      {/* Workspace error banner */}
      <AnimatePresence>
        {workspaceError && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-6 py-2 bg-error/10 border-b border-error/20 text-xs text-error flex items-center gap-2">
              <X size={12} />
              {workspaceError}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Key prompt banner */}
      {workspacePath && pmAgent.apiKeyConfigured === false && !pmAgent.isStreaming && (
        <div className="px-6 py-2 bg-warning/10 border-b border-warning/20 text-xs text-warning flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key size={12} />
            Configure your API Key to enable AI features
          </div>
          <button onClick={() => setShowApiKeyModal(true)} className="text-primary underline text-[10px]">
            Set API Key
          </button>
        </div>
      )}

      {/* Agent error banner */}
      {workspacePath && pmAgent.error && (
        <div className="px-6 py-2 bg-error/10 border-b border-error/20 text-xs text-error flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={12} />
            {pmAgent.error}
          </div>
          <button onClick={() => setShowApiKeyModal(true)} className="text-primary underline text-[10px]">
            Configure API Key
          </button>
        </div>
      )}

      {/* No workspace prompt */}
      <AnimatePresence>
        {!workspacePath && !workspaceLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 flex items-center justify-center"
          >
            <div className="text-center space-y-6 max-w-md">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Folder size={36} className="text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-on-surface">{t('project.openProject')}</h2>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Select a project directory to get started. Your workspace files will be loaded automatically.
                </p>
              </div>
              <button
                onClick={selectWorkspace}
                className="w-full bg-primary text-on-primary py-3 rounded-lg text-sm font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                <FolderOpen size={18} />
                {t('project.openProject')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content: shown when workspace is loaded */}
      {workspacePath && (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Agent Chat Panel with Tab Switcher */}
          <div className="w-[400px] border-r border-outline-variant/10 flex flex-col bg-surface-container-lowest shrink-0">
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Tab Bar */}
              <div className="flex border-b border-outline-variant/10 bg-surface-container-low">
                <button
                  onClick={() => { setActiveChatTab('pm'); setShowPmProviderDropdown(false); setShowReqProviderDropdown(false); }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2",
                    activeChatTab === 'pm'
                      ? "text-secondary border-secondary bg-surface-container-lowest"
                      : "text-on-surface-variant border-transparent hover:text-on-surface"
                  )}
                >
                  <Bot size={14} />
                  {t('project.pmAgent')}
                </button>
                <button
                  onClick={() => { setActiveChatTab('req'); setShowPmProviderDropdown(false); setShowReqProviderDropdown(false); }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2",
                    activeChatTab === 'req'
                      ? "text-primary border-primary bg-surface-container-lowest"
                      : "text-on-surface-variant border-transparent hover:text-on-surface"
                  )}
                >
                  <Sparkles size={14} />
                  {t('project.reqAgent')}
                </button>
              </div>

              {/* PM Agent Chat */}
              {activeChatTab === 'pm' && (
                <>
                  <div className="p-3 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-secondary/10 rounded-lg">
                        <Bot size={16} className="text-secondary" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t('project.pmAgent')}</span>
                        <span className="text-[9px] text-outline uppercase font-medium tracking-tighter">Context Architect</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Provider selector dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => { setShowPmProviderDropdown(!showPmProviderDropdown); setShowReqProviderDropdown(false); }}
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter transition-all",
                            pmProviderOverride ? "bg-secondary/10 text-secondary" : "bg-outline-variant/10 text-on-surface-variant",
                            showPmProviderDropdown && "ring-1 ring-primary/30"
                          )}
                          title="Switch LLM Provider"
                        >
                          <span>{pmAgent.runtimeId}</span>
                          <ChevronDown size={8} className={cn("transition-transform", showPmProviderDropdown && "rotate-180")} />
                        </button>
                        {showPmProviderDropdown && (
                          <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-surface-container-high border border-outline-variant/20 rounded-lg shadow-xl py-1">
                            {providerList.map((pId) => {
                              const isSelected = pId === pmAgent.runtimeId;
                              const hasKey = hasProviderApiKey(pId);
                              return (
                                <button
                                  key={pId}
                                  onClick={() => handlePmProviderSwitch(pId)}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-3 py-1.5 text-[10px] transition-colors",
                                    isSelected ? "bg-primary/10 text-primary font-bold" : "text-on-surface-variant hover:bg-surface-container-highest/50"
                                  )}
                                >
                                  <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", hasKey ? "bg-tertiary" : "bg-warning")} />
                                  <span className="flex-1 text-left">{pId}</span>
                                  {!hasKey && (
                                    <AlertTriangle size={9} className="text-warning shrink-0" />
                                  )}
                                  {isSelected && (
                                    <CheckCircle2 size={9} className="text-primary shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                            {providerList.length === 0 && (
                              <div className="px-3 py-2 text-[9px] text-on-surface-variant opacity-60 text-center">No providers configured</div>
                            )}
                          </div>
                        )}
                      </div>
                      {/* API Key warning for current provider */}
                      {!hasProviderApiKey(pmAgent.runtimeId) && settings.providers?.[pmAgent.runtimeId] && (
                        <span className="text-[8px] text-warning bg-warning/10 px-1.5 py-0.5 rounded whitespace-nowrap">No Key</span>
                      )}
                      {/* Connection status */}
                      <div className={cn(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded-full",
                        pmAgent.apiKeyConfigured
                          ? "bg-tertiary/10"
                          : "bg-outline-variant/10"
                      )}>
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          pmAgent.apiKeyConfigured ? "bg-tertiary animate-pulse" : "bg-outline-variant"
                        )}></div>
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-tighter",
                          pmAgent.apiKeyConfigured ? "text-tertiary" : "text-outline"
                        )}>
                          {pmAgent.isStreaming ? 'Thinking...' : pmAgent.apiKeyConfigured ? 'Active' : 'No Key'}
                        </span>
                      </div>
                      <button
                        onClick={() => setShowApiKeyModal(true)}
                        className="p-1 text-on-surface-variant hover:text-primary transition-colors"
                        title="API Key Settings"
                      >
                        <Key size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-hide">
                    {pmAgent.messages.map((msg, idx) => (
                      <div key={idx} className={cn(
                        "flex flex-col gap-1 max-w-[85%]",
                        msg.role === 'user' ? "ml-auto items-end" : "items-start"
                      )}>
                        <div className={cn(
                          "p-3 rounded-lg text-xs leading-relaxed",
                          msg.role === 'user'
                            ? "bg-primary text-on-primary rounded-tr-none"
                            : "bg-surface-container-high text-on-surface rounded-tl-none border border-outline-variant/10"
                        )}>
                          {msg.role === 'assistant' ? (
                            <div className="prose prose-invert prose-xs [&_pre]:text-[10px] [&_p]:text-[10px] [&_pre]:p-2 [&_pre]:bg-surface-container-lowest [&_pre]:rounded [&_code]:text-[10px]">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                              {idx === pmAgent.messages.length - 1 && pmAgent.isStreaming && (
                                <span className="inline-block w-1.5 h-3 bg-primary/70 animate-pulse ml-0.5 align-middle"></span>
                              )}
                            </div>
                          ) : (
                            msg.content
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-4 border-t border-outline-variant/10 bg-surface">
                    <div className="relative">
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                        placeholder={t('project.chatPlaceholder')}
                        disabled={pmAgent.isStreaming}
                        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg p-3 pr-10 text-xs text-on-surface focus:outline-none focus:border-primary/50 resize-none h-20 scroll-hide disabled:opacity-50"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={pmAgent.isStreaming || !chatInput.trim()}
                        className={cn(
                          "absolute right-2 bottom-2 p-1.5 rounded-md transition-colors",
                          pmAgent.isStreaming || !chatInput.trim()
                            ? "text-outline-variant cursor-not-allowed"
                            : "text-primary hover:bg-primary/10"
                        )}
                      >
                        {pmAgent.isStreaming ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Send size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Req Agent Chat */}
              {activeChatTab === 'req' && (
                <>
                  <div className="p-3 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg">
                        <Sparkles size={16} className="text-primary" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t('project.reqAgent')}</span>
                        <span className="text-[9px] text-outline uppercase font-medium tracking-tighter">Requirements Analyst</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Provider selector dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => { setShowReqProviderDropdown(!showReqProviderDropdown); setShowPmProviderDropdown(false); }}
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter transition-all",
                            reqProviderOverride ? "bg-primary/15 text-primary" : "bg-outline-variant/10 text-on-surface-variant",
                            showReqProviderDropdown && "ring-1 ring-primary/30"
                          )}
                          title="Switch LLM Provider"
                        >
                          <span>{reqAgent.runtimeId}</span>
                          <ChevronDown size={8} className={cn("transition-transform", showReqProviderDropdown && "rotate-180")} />
                        </button>
                        {showReqProviderDropdown && (
                          <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-surface-container-high border border-outline-variant/20 rounded-lg shadow-xl py-1">
                            {/* Claude Code built-in option */}
                            <button
                              onClick={() => handleReqProviderSwitch('claude-code')}
                              className={cn(
                                "w-full flex items-center gap-2 px-3 py-1.5 text-[10px] transition-colors",
                                reqAgent.runtimeId === 'claude-code' ? "bg-primary/10 text-primary font-bold" : "text-on-surface-variant hover:bg-surface-container-highest/50"
                              )}
                            >
                              <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-tertiary" />
                              <span className="flex-1 text-left">claude-code</span>
                              {reqAgent.runtimeId === 'claude-code' && (
                                <CheckCircle2 size={9} className="text-primary shrink-0" />
                              )}
                            </button>
                            {/* Configured providers */}
                            {providerList.map((pId) => {
                              const isSelected = pId === reqAgent.runtimeId;
                              const hasKey = hasProviderApiKey(pId);
                              return (
                                <button
                                  key={pId}
                                  onClick={() => handleReqProviderSwitch(pId)}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-3 py-1.5 text-[10px] transition-colors",
                                    isSelected ? "bg-primary/10 text-primary font-bold" : "text-on-surface-variant hover:bg-surface-container-highest/50"
                                  )}
                                >
                                  <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", hasKey ? "bg-tertiary" : "bg-warning")} />
                                  <span className="flex-1 text-left">{pId}</span>
                                  {!hasKey && (
                                    <AlertTriangle size={9} className="text-warning shrink-0" />
                                  )}
                                  {isSelected && (
                                    <CheckCircle2 size={9} className="text-primary shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {/* API Key warning for current provider */}
                      {reqAgent.runtimeId !== 'claude-code' && !hasProviderApiKey(reqAgent.runtimeId) && settings.providers?.[reqAgent.runtimeId] && (
                        <span className="text-[8px] text-warning bg-warning/10 px-1.5 py-0.5 rounded whitespace-nowrap">No Key</span>
                      )}
                      {/* Connection status indicator */}
                      <div className={cn(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded-full",
                        reqAgent.connectionState === 'connected'
                          ? "bg-tertiary/10"
                          : reqAgent.connectionState === 'connecting'
                            ? "bg-warning/10"
                            : reqAgent.connectionState === 'error'
                              ? "bg-error/10"
                              : "bg-outline-variant/10"
                      )}>
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          reqAgent.connectionState === 'connected'
                            ? "bg-tertiary animate-pulse"
                            : reqAgent.connectionState === 'connecting'
                              ? "bg-warning animate-pulse"
                              : reqAgent.connectionState === 'error'
                                ? "bg-error"
                                : "bg-outline-variant"
                        )}></div>
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-tighter",
                          reqAgent.connectionState === 'connected'
                            ? "text-tertiary"
                            : reqAgent.connectionState === 'connecting'
                              ? "text-warning"
                              : reqAgent.connectionState === 'error'
                                ? "text-error"
                                : "text-outline"
                        )}>
                          {reqAgent.isStreaming ? 'Thinking...' : reqConnectionLabel()}
                        </span>
                      </div>
                      {/* Action buttons */}
                      {reqAgent.connectionState === 'disconnected' && (
                        <button
                          onClick={handleReqAgentStart}
                          className="p-1 text-on-surface-variant hover:text-primary transition-colors"
                          title={t('project.reqAgentConnect')}
                        >
                          <Radio size={12} />
                        </button>
                      )}
                      {reqAgent.connectionState === 'connected' && (
                        <>
                          <button
                            onClick={handleReqAgentNewSession}
                            className="p-1 text-on-surface-variant hover:text-primary transition-colors"
                            title={t('project.reqAgentNewSession')}
                          >
                            <MessageSquarePlus size={12} />
                          </button>
                          <button
                            onClick={handleReqAgentStop}
                            className="p-1 text-on-surface-variant hover:text-error transition-colors"
                            title={t('project.reqAgentStop')}
                          >
                            <Square size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Req Agent Error Banner */}
                  {reqAgent.error && reqAgent.connectionState === 'error' && (
                    <div className="px-4 py-2 bg-error/10 border-b border-error/20 text-[10px] text-error flex items-center gap-2">
                      <AlertTriangle size={10} />
                      <span className="flex-1">{reqAgent.error}</span>
                      <button
                        onClick={handleReqAgentStart}
                        className="text-primary underline text-[9px]"
                      >
                        {t('project.reqAgentRetry')}
                      </button>
                    </div>
                  )}

                  {/* Feature Created Notification Banner */}
                  {reqAgent.lastCreatedFeature && (
                    <div className="px-4 py-2 bg-tertiary/10 border-b border-tertiary/20 text-[10px] text-tertiary flex items-center gap-2">
                      <FileCheck size={10} />
                      <span className="flex-1">
                        {t('project.reqAgentFeatureCreated', { id: reqAgent.lastCreatedFeature.featureId })}
                      </span>
                      <button
                        onClick={() => {
                          setShowTaskModal(true);
                          reqAgent.clearFeatureNotification();
                        }}
                        className="flex items-center gap-1 text-primary underline text-[9px]"
                      >
                        <Eye size={9} />
                        {t('project.reqAgentViewFeature')}
                      </button>
                      <button
                        onClick={() => reqAgent.clearFeatureNotification()}
                        className="text-outline-variant hover:text-on-surface-variant ml-1"
                      >
                        <X size={9} />
                      </button>
                    </div>
                  )}

                  {/* Disconnected state with connect prompt */}
                  {reqAgent.connectionState === 'disconnected' && reqAgent.messages.length <= 1 && (
                    <div className="flex-1 flex items-center justify-center p-6">
                      <div className="text-center space-y-4 max-w-[240px]">
                        <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                          <WifiOff size={24} className="text-primary" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-on-surface">{t('project.reqAgentDisconnected')}</p>
                          <p className="text-[10px] text-on-surface-variant leading-relaxed">
                            {t('project.reqAgentConnectHint')}
                          </p>
                        </div>
                        <button
                          onClick={handleReqAgentStart}
                          className="w-full bg-primary text-on-primary py-2 rounded-lg text-[10px] font-bold hover:brightness-110 transition-all"
                        >
                          <div className="flex items-center justify-center gap-2">
                            <Radio size={12} />
                            {t('project.reqAgentConnect')}
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Chat messages (show when connected or has history) */}
                  {(reqAgent.connectionState !== 'disconnected' || reqAgent.messages.length > 1) && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-hide">
                      {reqAgent.messages.map((msg, idx) => (
                        <div key={idx} className={cn(
                          "flex flex-col gap-1 max-w-[85%]",
                          msg.role === 'user' ? "ml-auto items-end" : "items-start"
                        )}>
                          <div className={cn(
                            "p-3 rounded-lg text-xs leading-relaxed",
                            msg.role === 'user'
                              ? "bg-primary text-on-primary rounded-tr-none"
                              : "bg-surface-container-high text-on-surface rounded-tl-none border border-outline-variant/10"
                          )}>
                            {msg.role === 'assistant' ? (
                              <div className="prose prose-invert prose-xs [&_pre]:text-[10px] [&_p]:text-[10px] [&_pre]:p-2 [&_pre]:bg-surface-container-lowest [&_pre]:rounded [&_code]:text-[10px]">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                {idx === reqAgent.messages.length - 1 && reqAgent.isStreaming && (
                                  <span className="inline-block w-1.5 h-3 bg-primary/70 animate-pulse ml-0.5 align-middle"></span>
                                )}
                              </div>
                            ) : (
                              msg.content
                            )}
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  )}

                  {/* Input area */}
                  <div className="p-4 border-t border-outline-variant/10 bg-surface">
                    <div className="relative">
                      <textarea
                        value={reqChatInput}
                        onChange={(e) => setReqChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleReqAgentSend())}
                        placeholder={t('project.reqAgentPlaceholder')}
                        disabled={reqAgent.isStreaming || reqAgent.connectionState === 'connecting'}
                        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg p-3 pr-10 text-xs text-on-surface focus:outline-none focus:border-primary/50 resize-none h-20 scroll-hide disabled:opacity-50"
                      />
                      <button
                        onClick={handleReqAgentSend}
                        disabled={reqAgent.isStreaming || !reqChatInput.trim() || reqAgent.connectionState === 'connecting'}
                        className={cn(
                          "absolute right-2 bottom-2 p-1.5 rounded-md transition-colors",
                          reqAgent.isStreaming || !reqChatInput.trim() || reqAgent.connectionState === 'connecting'
                            ? "text-outline-variant cursor-not-allowed"
                            : "text-primary hover:bg-primary/10"
                        )}
                      >
                        {reqAgent.isStreaming ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Send size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: Project Context Markdown Rendering */}
          <div className="flex-1 flex flex-col bg-surface overflow-hidden">
            <div className="h-10 border-b border-outline-variant/10 flex items-center px-6 justify-between bg-surface-container-low">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  {t('project.projectContext')}
                </span>
              </div>
              <button className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest">
                {t('project.initProject')}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-10 scroll-hide">
              <div className="max-w-3xl mx-auto prose prose-invert prose-sm">
                <ReactMarkdown>{projectContext}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Git Status Modal — Enhanced (feat-git-modal-enhance) */}
      <AnimatePresence>
        {showGitModal && (
          <div className="fixed inset-0 z-[100]">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGitModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            {/* Modal panel — absolutely positioned for drag */}
            <motion.div
              ref={gitModalRef}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              style={{
                position: 'absolute',
                left: gitModalPos.x,
                top: gitModalPos.y,
                width: gitModalSize.w,
                height: gitModalSize.h,
              }}
              className="bg-surface-container-low border border-outline-variant/20 rounded-xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* ─── Title bar (draggable) ─── */}
              <div
                onMouseDown={handleGitDragStart}
                className="shrink-0 px-4 py-3 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-high/30 cursor-move select-none"
              >
                <div className="flex items-center gap-3">
                  <GripVertical size={14} className="text-outline" />
                  <div className="p-1.5 bg-secondary/10 rounded-lg">
                    <Github size={18} className="text-secondary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest">{t('project.gitStatus')}</h3>
                    <p className="text-[10px] text-outline font-mono">
                      {gitStatus.data?.remote_url || 'No remote configured'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { gitStatus.refresh(); gitDetail.refreshAll(); }}
                    disabled={gitStatus.loading}
                    className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw size={14} className={cn(gitStatus.loading && "animate-spin")} />
                  </button>
                  <button
                    onClick={() => setShowGitModal(false)}
                    className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* ─── Body: sidebar tabs + content ─── */}
              <div className="flex-1 flex overflow-hidden">
                {/* Sidebar navigation */}
                <nav className="shrink-0 w-[130px] bg-surface-container-lowest/50 border-r border-outline-variant/10 py-3 flex flex-col gap-0.5 px-2">
                  {([
                    { key: 'overview', icon: Eye, label: 'Overview' },
                    { key: 'branches', icon: GitBranch, label: 'Branches' },
                    { key: 'tags', icon: Tag, label: 'Tags' },
                    { key: 'history', icon: History, label: 'History' },
                    { key: 'changes', icon: FileText, label: 'Changes' },
                    { key: 'features', icon: Box, label: 'Features' },
                    { key: 'graph', icon: Network, label: 'Graph' },
                  ] as const).map(({ key, icon: Icon, label }) => (
                    <button
                      key={key}
                      onClick={() => setGitModalTab(key)}
                      className={cn(
                        'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[11px] font-bold transition-colors',
                        gitModalTab === key
                          ? 'bg-primary/15 text-primary'
                          : 'text-on-surface-variant hover:bg-surface-container-high/40'
                      )}
                    >
                      <Icon size={14} />
                      {label}
                    </button>
                  ))}
                </nav>

                {/* Content area */}
                <div className="flex-1 overflow-y-auto p-5 scroll-hide">
                  {gitStatus.error ? (
                    <div className="flex items-center gap-3 p-4 bg-error/10 rounded-lg border border-error/20">
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
                      {/* ── Overview Tab ── */}
                      {gitModalTab === 'overview' && (
                        <div className="space-y-5">
                          {/* Branch + remote summary */}
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Branch</span>
                            <span className="text-[10px] font-mono bg-secondary/10 text-secondary px-2 py-0.5 rounded">
                              {gitStatus.data.current_branch}
                            </span>
                          </div>
                          {/* Quick stats */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/5 p-3 text-center">
                              <p className="text-lg font-bold text-secondary">{gitDetail.branches.length || '—'}</p>
                              <p className="text-[9px] uppercase tracking-widest text-outline mt-1">Branches</p>
                            </div>
                            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/5 p-3 text-center">
                              <p className="text-lg font-bold text-tertiary">{gitDetail.tags.length || '—'}</p>
                              <p className="text-[9px] uppercase tracking-widest text-outline mt-1">Tags</p>
                            </div>
                            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/5 p-3 text-center">
                              <p className="text-lg font-bold text-primary">{gitStatus.data.files.length}</p>
                              <p className="text-[9px] uppercase tracking-widest text-outline mt-1">Changes</p>
                            </div>
                          </div>
                          {/* Recent commits */}
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Recent Commits</span>
                            {gitDetail.commits.slice(0, 5).map((c) => (
                              <div key={c.hash} className="flex items-center gap-3 p-2 bg-surface-container-lowest/50 rounded-lg border border-outline-variant/5">
                                <GitCommitHorizontal size={14} className="text-outline shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs truncate font-medium">{c.message}</p>
                                  <p className="text-[9px] text-outline font-mono">{c.short_hash} · {c.author}</p>
                                </div>
                                <span className="text-[9px] text-on-surface-variant shrink-0">{c.time_ago}</span>
                              </div>
                            ))}
                          </div>
                          {/* File change summary */}
                          {gitStatus.data.files.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-outline">File Changes</span>
                              <div className="flex items-center gap-3">
                                {(() => {
                                  const staged = gitStatus.data.files.filter(f => f.status === 'staged').length;
                                  const unstaged = gitStatus.data.files.filter(f => f.status === 'unstaged').length;
                                  const untracked = gitStatus.data.files.filter(f => f.status === 'untracked').length;
                                  return (
                                    <>
                                      {staged > 0 && <span className="text-[10px] bg-tertiary/10 text-tertiary px-2 py-0.5 rounded">{staged} staged</span>}
                                      {unstaged > 0 && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded">{unstaged} modified</span>}
                                      {untracked > 0 && <span className="text-[10px] bg-warning/10 text-warning px-2 py-0.5 rounded">{untracked} untracked</span>}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Branches Tab ── */}
                      {gitModalTab === 'branches' && (
                        <div className="space-y-2">
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
                      {gitModalTab === 'tags' && (
                        <div className="space-y-2">
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
                                  {/* Expand/collapse chevron */}
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
                                    {/* Loading skeleton */}
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

                                    {/* Loaded content */}
                                    {detail && (
                                      <>
                                        {/* Commits section */}
                                        {detail.commits.length > 0 && (
                                          <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-outline mb-1.5">
                                              Commits ({detail.commits.length})
                                            </p>
                                            <div className="space-y-1 max-h-40 overflow-y-auto">
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

                                        {/* File changes section */}
                                        {detail.file_changes.length > 0 && (
                                          <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-outline mb-1.5">
                                              Files Changed ({detail.file_changes.length > 50 ? '50+' : detail.file_changes.length})
                                            </p>
                                            <div className="space-y-1 max-h-40 overflow-y-auto">
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

                                        {/* Empty state */}
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

                      {/* ── History Tab ── */}
                      {gitModalTab === 'history' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Commit History</span>
                            <span className="text-[10px] text-on-surface-variant">{gitDetail.commits.length} commits</span>
                          </div>
                          {gitDetail.commits.length === 0 ? (
                            <div className="flex items-center justify-center py-8 text-xs text-on-surface-variant opacity-60">No commits</div>
                          ) : gitDetail.commits.map((c) => (
                            <div key={c.hash} className="flex items-center gap-3 p-3 bg-surface-container-lowest/50 rounded-lg border border-outline-variant/5">
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
                          {gitDetail.commits.length >= 50 && (
                            <button
                              onClick={() => gitDetail.loadMoreCommits(gitDetail.commits.length)}
                              className="w-full py-2 text-xs text-primary font-bold hover:bg-primary/10 rounded-lg transition-colors"
                            >
                              Load more...
                            </button>
                          )}
                        </div>
                      )}

                      {/* ── Changes Tab (preserves existing stage/unstage UI) ── */}
                      {gitModalTab === 'changes' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-outline">{t('project.changesDetected')}</span>
                            <span className="text-[10px] font-bold text-tertiary">
                              {gitStatus.data.files.length === 0
                                ? 'No changes'
                                : `${gitStatus.data.files.length} File${gitStatus.data.files.length > 1 ? 's' : ''} Changed`}
                            </span>
                          </div>
                          {gitStatus.data.files.length === 0 ? (
                            <div className="flex items-center justify-center py-8 text-xs text-on-surface-variant opacity-60">
                              No changes detected
                            </div>
                          ) : (
                            <>
                              {/* Staged files */}
                              {(() => {
                                const stagedFiles = gitStatus.data.files.filter(f => f.status === 'staged');
                                if (stagedFiles.length === 0) return null;
                                const collapsed = collapsedGroups['staged'] ?? false;
                                return (
                                  <div className="space-y-1">
                                    <button
                                      onClick={() => setCollapsedGroups(prev => ({ ...prev, staged: !prev.staged }))}
                                      className="flex items-center gap-2 w-full hover:bg-surface-container-high/30 rounded px-1 py-0.5 transition-colors"
                                    >
                                      {collapsed ? <ChevronRight size={12} className="text-tertiary shrink-0" /> : <ChevronDown size={12} className="text-tertiary shrink-0" />}
                                      <span className="text-[9px] font-bold uppercase tracking-widest text-tertiary">Staged</span>
                                      <span className="text-[9px] font-bold text-tertiary/70 bg-tertiary/10 px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{stagedFiles.length}</span>
                                    </button>
                                    <AnimatePresence initial={false}>
                                      {!collapsed && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                          <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/10 overflow-hidden divide-y divide-outline-variant/5">
                                            {stagedFiles.map((file) => {
                                              const fileName = file.path.split('/').pop() || file.path;
                                              return (
                                                <div key={file.path} className="flex items-center gap-3 p-2.5">
                                                  <FileText size={14} className="text-tertiary shrink-0" />
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
                                                  <button onClick={() => handleUnstageFile(file.path)} disabled={stagingPath === file.path} className="p-1 rounded-md text-warning hover:bg-warning/10 transition-colors disabled:opacity-50" title="Unstage">
                                                    {stagingPath === file.path ? <Loader2 size={12} className="animate-spin" /> : <MinusCircle size={12} />}
                                                  </button>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                );
                              })()}
                              {/* Unstaged files */}
                              {(() => {
                                const unstagedFiles = gitStatus.data.files.filter(f => f.status === 'unstaged');
                                if (unstagedFiles.length === 0) return null;
                                const collapsed = collapsedGroups['unstaged'] ?? false;
                                return (
                                  <div className="space-y-1">
                                    <button
                                      onClick={() => setCollapsedGroups(prev => ({ ...prev, unstaged: !prev.unstaged }))}
                                      className="flex items-center gap-2 w-full hover:bg-surface-container-high/30 rounded px-1 py-0.5 transition-colors"
                                    >
                                      {collapsed ? <ChevronRight size={12} className="text-primary shrink-0" /> : <ChevronDown size={12} className="text-primary shrink-0" />}
                                      <span className="text-[9px] font-bold uppercase tracking-widest text-primary">Modified</span>
                                      <span className="text-[9px] font-bold text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{unstagedFiles.length}</span>
                                    </button>
                                    <AnimatePresence initial={false}>
                                      {!collapsed && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                          <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/10 overflow-hidden divide-y divide-outline-variant/5">
                                            {unstagedFiles.map((file) => {
                                              const fileName = file.path.split('/').pop() || file.path;
                                              return (
                                                <div key={file.path} className="flex items-center gap-3 p-2.5">
                                                  <FileText size={14} className="text-primary shrink-0" />
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
                                                  <button onClick={() => handleStageFile(file.path)} disabled={stagingPath === file.path} className="p-1 rounded-md text-tertiary hover:bg-tertiary/10 transition-colors disabled:opacity-50" title="Stage">
                                                    {stagingPath === file.path ? <Loader2 size={12} className="animate-spin" /> : <PlusCircle size={12} />}
                                                  </button>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                );
                              })()}
                              {/* Untracked files */}
                              {(() => {
                                const untrackedFiles = gitStatus.data.files.filter(f => f.status === 'untracked');
                                if (untrackedFiles.length === 0) return null;
                                const collapsed = collapsedGroups['untracked'] ?? true;
                                return (
                                  <div className="space-y-1">
                                    <button
                                      onClick={() => setCollapsedGroups(prev => ({ ...prev, untracked: !prev.untracked }))}
                                      className="flex items-center gap-2 w-full hover:bg-surface-container-high/30 rounded px-1 py-0.5 transition-colors"
                                    >
                                      {collapsed ? <ChevronRight size={12} className="text-warning shrink-0" /> : <ChevronDown size={12} className="text-warning shrink-0" />}
                                      <span className="text-[9px] font-bold uppercase tracking-widest text-warning">Untracked</span>
                                      <span className="text-[9px] font-bold text-warning/70 bg-warning/10 px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{untrackedFiles.length}</span>
                                    </button>
                                    <AnimatePresence initial={false}>
                                      {!collapsed && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                          <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/10 overflow-hidden divide-y divide-outline-variant/5">
                                            {untrackedFiles.map((file) => {
                                              const fileName = file.path.split('/').pop() || file.path;
                                              return (
                                                <div key={file.path} className="flex items-center gap-3 p-2.5">
                                                  <FileText size={14} className="text-warning shrink-0" />
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold truncate">{fileName}</p>
                                                    <p className="text-[10px] text-outline truncate">{file.path}</p>
                                                  </div>
                                                  <button onClick={() => handleStageFile(file.path)} disabled={stagingPath === file.path} className="p-1 rounded-md text-tertiary hover:bg-tertiary/10 transition-colors disabled:opacity-50" title="Stage">
                                                    {stagingPath === file.path ? <Loader2 size={12} className="animate-spin" /> : <PlusCircle size={12} />}
                                                  </button>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </div>
                      )}

                      {/* ── Features Tab (completed feature list from queue.yaml) ── */}
                      {gitModalTab === 'features' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Completed Features</span>
                          </div>
                          {(() => {
                            // Match completed features with their tags
                            const featureTags = gitDetail.tags.filter(t => t.name.startsWith('feat-') || t.name.startsWith('fix-'));
                            if (featureTags.length === 0) {
                              return <div className="flex items-center justify-center py-8 text-xs text-on-surface-variant opacity-60">No feature tags found</div>;
                            }
                            return featureTags.map((tag) => {
                              const dateStr = tag.date > 0 ? new Date(tag.date * 1000).toLocaleDateString() : '—';
                              // Extract feature name from tag: "feat-xxx-20260403" -> "feat-xxx"
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

                      {/* ── Graph Tab (branch topology visualization) ── */}
                      {gitModalTab === 'graph' && (
                        <BranchGraphTab
                          nodes={gitDetail.graphNodes}
                          edges={gitDetail.graphEdges}
                          branches={gitDetail.branches}
                          hoveredNode={hoveredGraphNode}
                          onHoverNode={setHoveredGraphNode}
                        />
                      )}
                    </>
                  ) : null}
                </div>
              </div>

              {/* ─── Footer: commit + push/pull ─── */}
              <div className="shrink-0 px-4 py-3 bg-surface-container-high/30 border-t border-outline-variant/10 space-y-2">
                {/* Commit input + button */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCommit()}
                    placeholder="Commit message..."
                    disabled={isCommitting}
                    className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary/50 font-mono disabled:opacity-50"
                  />
                  <button
                    onClick={handleCommit}
                    disabled={isCommitting || !commitMessage.trim() || !gitStatus.data?.files.some(f => f.status === 'staged')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                      commitMessage.trim() && gitStatus.data?.files.some(f => f.status === 'staged')
                        ? "bg-primary text-on-primary hover:brightness-110"
                        : "bg-surface-container-highest text-on-surface-variant border border-outline-variant/10"
                    )}
                  >
                    {isCommitting ? <Loader2 size={12} className="animate-spin" /> : <GitCommitHorizontal size={12} />}
                    Commit
                  </button>
                </div>

                {/* Sync feedback message */}
                {syncMessage && (
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium",
                    syncMessage.type === 'success'
                      ? "bg-tertiary/10 text-tertiary border border-tertiary/20"
                      : "bg-error/10 text-error border border-error/20"
                  )}>
                    {syncMessage.type === 'success' ? <CheckCircle2 size={12} className="shrink-0" /> : <AlertTriangle size={12} className="shrink-0" />}
                    <span className="truncate">{syncMessage.text}</span>
                  </div>
                )}

                {/* Push / Pull buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handlePush}
                    disabled={isPushing || isPulling || !gitStatus.data?.remote_url}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-on-primary py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {isPushing ? <RefreshCw size={12} className="animate-spin" /> : <ArrowUpRight size={12} />}
                    {isPushing ? t('project.syncing') : t('project.pushChanges')}
                  </button>
                  <button
                    onClick={handlePull}
                    disabled={isPushing || isPulling || !gitStatus.data?.remote_url}
                    className="flex-1 flex items-center justify-center gap-2 bg-surface-container-highest text-on-surface py-2 rounded-lg text-xs font-bold hover:bg-surface-variant transition-all border border-outline-variant/10 disabled:opacity-50"
                  >
                    {isPulling ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    {isPulling ? t('project.syncing') : t('project.updateRemote')}
                  </button>
                </div>
              </div>

              {/* ─── Resize handle ─── */}
              <div
                onMouseDown={handleGitResizeStart}
                className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-end justify-end p-1 opacity-30 hover:opacity-60 transition-opacity"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className="text-on-surface-variant">
                  <circle cx="7" cy="1" r="0.8" />
                  <circle cx="7" cy="4" r="0.8" />
                  <circle cx="7" cy="7" r="0.8" />
                  <circle cx="4" cy="4" r="0.8" />
                  <circle cx="4" cy="7" r="0.8" />
                  <circle cx="1" cy="7" r="0.8" />
                </svg>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Generation Modal */}
      <AnimatePresence>
        {showTaskModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowTaskModal(false); setGeneratedPlan(null); }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-surface-container-low border border-outline-variant/20 rounded-xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-high/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Sparkles size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest">{t('project.generateTask')}</h3>
                    <p className="text-[10px] text-outline uppercase tracking-tighter">AI-Driven Context Decomposition</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowTaskModal(false); setGeneratedPlan(null); }}
                  className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 flex flex-col items-center justify-center min-h-[300px] max-h-[60vh] overflow-y-auto">
                {!isGenerating && !generatedPlan ? (
                  <div className="text-center space-y-6 max-w-md">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                      <Layers size={32} className="text-primary" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-bold">{t('project.splittingModules')}</h4>
                      <p className="text-xs text-on-surface-variant opacity-70 leading-relaxed">
                        I will analyze your project context and decompose it into logical functional modules and business tasks.
                      </p>
                    </div>
                    <button
                      onClick={handleGenerateTasks}
                      className="w-full bg-primary text-on-primary py-3 rounded-lg text-sm font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20"
                    >
                      {t('project.generateTask')}
                    </button>
                  </div>
                ) : isGenerating ? (
                  <div className="w-full space-y-8">
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        <Bot size={20} className="absolute inset-0 m-auto text-primary" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-primary animate-pulse">
                        {t('project.splittingModules')}
                      </span>
                    </div>
                  </div>
                ) : generatedPlan ? (
                  <div className="w-full space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-sm font-bold">{generatedPlan.name}</h4>
                        <p className="text-[10px] text-on-surface-variant font-mono">{generatedPlan.id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">
                          P{generatedPlan.priority}
                        </span>
                        <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded font-bold">
                          {generatedPlan.size}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      {generatedPlan.description}
                    </p>
                    {generatedPlan.tasks.map((group, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: idx * 0.2 }}
                        className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle2 size={14} className="text-tertiary" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            {group.group_name}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.items.map((item, tIdx) => (
                            <span key={tIdx} className="text-[10px] bg-surface-container-high px-2 py-1 rounded border border-outline-variant/10">
                              {item}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="p-4 bg-surface-container-high/30 border-t border-outline-variant/10 flex gap-3">
                {generatedPlan ? (
                  <>
                    <button
                      onClick={() => setGeneratedPlan(null)}
                      className="flex-1 px-6 py-2 bg-surface-container-highest text-on-surface rounded-lg text-xs font-bold hover:bg-surface-variant transition-all border border-outline-variant/10"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleCreateFeature}
                      className="flex-1 flex items-center justify-center gap-2 bg-primary text-on-primary py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all"
                    >
                      <Plus size={14} />
                      Create Feature
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setShowTaskModal(false); setGeneratedPlan(null); }}
                    className="px-6 py-2 bg-surface-container-highest text-on-surface rounded-lg text-xs font-bold hover:bg-surface-variant transition-all border border-outline-variant/10 ml-auto"
                  >
                    {isGenerating ? 'Cancel' : 'Close'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* API Key Configuration Modal */}
      <AnimatePresence>
        {showApiKeyModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowApiKeyModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-surface-container-low border border-outline-variant/20 rounded-xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-high/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary/10 rounded-lg">
                    <Key size={20} className="text-secondary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest">API Key</h3>
                    <p className="text-[10px] text-outline">Gemini API Key for AI features</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowApiKeyModal(false)}
                  className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  pmAgent.apiKeyConfigured
                    ? "bg-tertiary/10 border-tertiary/20"
                    : "bg-warning/10 border-warning/20"
                )}>
                  {pmAgent.apiKeyConfigured ? (
                    <CheckCircle2 size={16} className="text-tertiary" />
                  ) : (
                    <AlertTriangle size={16} className="text-warning" />
                  )}
                  <span className="text-xs text-on-surface-variant">
                    {pmAgent.apiKeyConfigured
                      ? 'API Key is configured and stored securely in your OS Keyring.'
                      : 'No API Key configured. AI features require a Gemini API key.'}
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Gemini API Key
                  </label>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStoreApiKey()}
                    placeholder="Enter your Gemini API key..."
                    className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-3 text-xs text-on-surface focus:outline-none focus:border-primary/50 font-mono"
                  />
                  <p className="text-[9px] text-outline leading-relaxed">
                    Your key is stored in the OS Keyring and never sent to the frontend or exposed in network requests.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-surface-container-high/30 border-t border-outline-variant/10 flex gap-3">
                {pmAgent.apiKeyConfigured && (
                  <button
                    onClick={() => pmAgent.removeApiKey()}
                    className="px-4 py-2 bg-error/10 text-error rounded-lg text-xs font-bold hover:bg-error/20 transition-all border border-error/20"
                  >
                    Delete Key
                  </button>
                )}
                <div className="flex-1" />
                <button
                  onClick={() => setShowApiKeyModal(false)}
                  className="px-4 py-2 bg-surface-container-highest text-on-surface rounded-lg text-xs font-bold hover:bg-surface-variant transition-all border border-outline-variant/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStoreApiKey}
                  disabled={!apiKeyInput.trim()}
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50"
                >
                  Save Key
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
