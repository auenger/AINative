import React, { useState, useEffect } from 'react';
import {
  Activity,
  Bot,
  PlayCircle,
  GitBranch,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Circle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
  Trash2,
  Terminal,
  Zap,
  ArrowRight,
  Shield,
  FlaskConical,
  FileText,
  Cpu,
  Eye,
  Pause,
  Play,
  RotateCcw,
  XCircle as StopIcon,
  AlertCircle,
  Route,
  Settings2,
  Edit3,
  Layers,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAgentRuntimes } from '../../lib/useAgentRuntimes';
import { usePipelineEngine } from '../../lib/usePipelineEngine';
import { useSmartRouter } from '../../lib/useSmartRouter';
import { useAgentConfigs } from '../../lib/useAgentConfigs';
import { PipelinePanel } from '../common/PipelinePanel';
import { PipelineVisualEditor } from './PipelineVisualEditor';
import { PipelineTextEditor } from './PipelineTextEditor';
import type {
  AgentRuntimeInfo,
  AgentRuntimeStatusType,
  AgentConfig,
  AgentOrchestrationMode,
  PipelineConfig,
  PipelineExecution,
  RoutingDecision,
  RoutingRule,
  TaskCategoryType,
} from '../../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type PanelTab = 'runtimes' | 'agents' | 'executions' | 'routes';

const TAB_ITEMS: { id: PanelTab; label: string; icon: any }[] = [
  { id: 'runtimes', label: 'Runtimes', icon: Cpu },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'executions', label: 'Executions', icon: PlayCircle },
  { id: 'routes', label: 'Routes', icon: GitBranch },
];

/** Runtime type to color/icon mapping. */
function runtimeTypeStyle(type: string): { color: string; icon: any } {
  switch (type) {
    case 'cli':
    default:
      return { color: 'text-purple-400', icon: Terminal };
  }
}

/** Status indicator dot. */
function StatusDot({ status }: { status: AgentRuntimeStatusType }) {
  const cls =
    status === 'available' ? 'bg-tertiary' :
    status === 'busy' ? 'bg-warning animate-pulse' :
    status === 'unhealthy' ? 'bg-error' :
    'bg-outline';
  return <span className={cn('w-2 h-2 rounded-full inline-block shrink-0', cls)} />;
}

/** Status label. */
function statusLabel(status: AgentRuntimeStatusType): string {
  switch (status) {
    case 'available': return 'Available';
    case 'busy': return 'Busy';
    case 'unhealthy': return 'Unhealthy';
    case 'not-installed': return 'Not Installed';
    default: return status;
  }
}

// ---------------------------------------------------------------------------
// RuntimeCard component
// ---------------------------------------------------------------------------

interface RuntimeCardProps {
  runtime: AgentRuntimeInfo;
}

const RuntimeCard: React.FC<RuntimeCardProps> = ({ runtime }) => {
  const { color, icon: TypeIcon } = runtimeTypeStyle(runtime.type);
  const notInstalled = runtime.status === 'not-installed';

  return (
    <div className={cn(
      'glass-panel rounded-lg p-4 flex flex-col gap-3 transition-all',
      notInstalled && 'opacity-60',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('p-1.5 rounded', 'bg-primary-container/10')}>
            <TypeIcon size={16} className={color} />
          </div>
          <div>
            <h4 className="text-sm font-headline font-bold">{runtime.name}</h4>
            <span className="text-[9px] font-mono text-on-surface-variant uppercase">{runtime.id}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusDot status={runtime.status} />
          <span className={cn(
            'text-[9px] font-bold uppercase tracking-wider',
            runtime.status === 'available' ? 'text-tertiary' :
            runtime.status === 'unhealthy' ? 'text-error' :
            runtime.status === 'busy' ? 'text-warning' :
            'text-outline',
          )}>
            {statusLabel(runtime.status)}
          </span>
        </div>
      </div>

      {/* Version & Path */}
      <div className="flex items-center gap-3 text-[10px] text-on-surface-variant">
        {runtime.version && (
          <span className="font-mono">v{runtime.version}</span>
        )}
        {runtime.install_path && (
          <span className="font-mono truncate opacity-60">{runtime.install_path}</span>
        )}
      </div>

      {/* Capabilities */}
      {runtime.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {runtime.capabilities.map(cap => (
            <span key={cap} className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant">
              {cap}
            </span>
          ))}
        </div>
      )}

      {/* Install hint for not-installed */}
      {notInstalled && (
        <div className="mt-1 flex items-center gap-2">
          <code className="text-[9px] font-mono text-primary bg-surface-container-lowest px-2 py-1 rounded flex-1 truncate">
            {runtime.install_hint}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(runtime.install_hint)}
            className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-primary transition-colors"
            title="Copy install command"
          >
            <Copy size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// RuntimeList component
// ---------------------------------------------------------------------------

interface RuntimeListProps {
  runtimes: AgentRuntimeInfo[];
  scanning: boolean;
  onScan: () => void;
}

const RuntimeList: React.FC<RuntimeListProps> = ({ runtimes, scanning, onScan }) => {
  return (
    <div className="flex flex-col gap-4">
      {/* Header with scan button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Detected Runtimes
          </h3>
          <p className="text-[10px] text-on-surface-variant opacity-60 mt-0.5">
            {runtimes.filter(r => r.status === 'available').length} available, {runtimes.filter(r => r.status === 'not-installed').length} not installed
          </p>
        </div>
        <button
          onClick={onScan}
          disabled={scanning}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-colors',
            scanning
              ? 'text-on-surface-variant opacity-50 cursor-not-allowed'
              : 'text-primary hover:bg-primary/10',
          )}
        >
          <RefreshCw size={12} className={scanning ? 'animate-spin' : ''} />
          {scanning ? 'Scanning...' : 'Rescan'}
        </button>
      </div>

      {/* Runtime grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {runtimes.map(rt => (
          <RuntimeCard key={rt.id} runtime={rt} />
        ))}
      </div>

      {runtimes.length === 0 && !scanning && (
        <div className="text-center py-12 text-on-surface-variant opacity-50">
          <Cpu size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-xs">No runtimes detected</p>
          <p className="text-[10px] mt-1">Click Rescan to detect agent runtimes</p>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// AgentCreator form component
// ---------------------------------------------------------------------------

interface AgentCreatorProps {
  runtimes: AgentRuntimeInfo[];
  pipelineIds: string[];
  onSave: (agent: AgentConfig) => void;
  onCancel: () => void;
  initial?: AgentConfig;
}

const AgentCreator: React.FC<AgentCreatorProps> = ({ runtimes, pipelineIds, onSave, onCancel, initial }) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [mode, setMode] = useState<AgentOrchestrationMode>(initial?.mode ?? 'pipeline');
  const [pipelineId, setPipelineId] = useState(initial?.pipeline_id ?? '');
  const [preferredRuntime, setPreferredRuntime] = useState(initial?.preferred_runtime ?? '');
  const [systemPrompt, setSystemPrompt] = useState(initial?.system_prompt ?? '');

  const availableRuntimes = runtimes.filter(r => r.status === 'available');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = initial?.id ?? name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    onSave({
      id,
      name,
      mode,
      pipeline_id: mode === 'pipeline' ? pipelineId : undefined,
      preferred_runtime: mode === 'route' ? preferredRuntime : undefined,
      description: description || undefined,
      system_prompt: systemPrompt || undefined,
      enabled: true,
      created_at: initial?.created_at ?? new Date().toISOString(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-surface-container-low p-4 rounded-lg border border-outline-variant/10">
      <div className="flex items-center justify-between">
        <h3 className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          {initial ? 'Edit Agent' : 'New Agent'}
        </h3>
        <button type="button" onClick={onCancel} className="text-on-surface-variant hover:text-on-surface text-xs">
          Cancel
        </button>
      </div>

      {/* Name */}
      <label className="block">
        <span className="text-[10px] font-bold text-outline uppercase tracking-tighter">Agent Name</span>
        <input
          type="text"
          required
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="My Agent"
          className="mt-1 w-full bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface p-2 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none"
        />
      </label>

      {/* Description */}
      <label className="block">
        <span className="text-[10px] font-bold text-outline uppercase tracking-tighter">Description</span>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What does this agent do?"
          className="mt-1 w-full bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface p-2 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none"
        />
      </label>

      {/* Mode selection */}
      <label className="block">
        <span className="text-[10px] font-bold text-outline uppercase tracking-tighter">Orchestration Mode</span>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('pipeline')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-sm border transition-colors',
              mode === 'pipeline'
                ? 'border-primary text-primary bg-primary/10'
                : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50',
            )}
          >
            <Activity size={12} />
            Pipeline
          </button>
          <button
            type="button"
            onClick={() => setMode('route')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-sm border transition-colors',
              mode === 'route'
                ? 'border-primary text-primary bg-primary/10'
                : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50',
            )}
          >
            <Route size={12} />
            Route
          </button>
        </div>
      </label>

      {/* Pipeline selector (for pipeline mode) */}
      {mode === 'pipeline' && (
        <label className="block">
          <span className="text-[10px] font-bold text-outline uppercase tracking-tighter">Pipeline</span>
          <select
            value={pipelineId}
            onChange={e => setPipelineId(e.target.value)}
            required
            className="mt-1 w-full bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface p-2 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none"
          >
            <option value="">Select a pipeline...</option>
            {pipelineIds.map(pid => (
              <option key={pid} value={pid}>{pid}</option>
            ))}
          </select>
        </label>
      )}

      {/* Runtime selector (for route mode) */}
      {mode === 'route' && (
        <label className="block">
          <span className="text-[10px] font-bold text-outline uppercase tracking-tighter">Preferred Runtime</span>
          <select
            value={preferredRuntime}
            onChange={e => setPreferredRuntime(e.target.value)}
            className="mt-1 w-full bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface p-2 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none"
          >
            <option value="">Auto (use router default)</option>
            {availableRuntimes.map(rt => (
              <option key={rt.id} value={rt.id}>{rt.name}</option>
            ))}
          </select>
        </label>
      )}

      {/* System prompt */}
      <label className="block">
        <span className="text-[10px] font-bold text-outline uppercase tracking-tighter">System Prompt (optional)</span>
        <textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          rows={3}
          placeholder="Custom instructions prepended to every request..."
          className="mt-1 w-full bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface p-2 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none font-mono resize-y"
        />
      </label>

      {/* Submit */}
      <button
        type="submit"
        className="w-full bg-primary text-on-primary font-headline text-[10px] font-bold py-2 rounded-sm uppercase tracking-widest hover:brightness-110 transition-all"
      >
        {initial ? 'Update Agent' : 'Create Agent'}
      </button>
    </form>
  );
};

// ---------------------------------------------------------------------------
// AgentListItem component
// ---------------------------------------------------------------------------

interface AgentListItemProps {
  agent: AgentConfig;
  onEdit: () => void;
  onDelete: () => void;
}

const AgentListItem: React.FC<AgentListItemProps> = ({ agent, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  const modeIcon = agent.mode === 'pipeline' ? Activity : Route;
  const ModeIcon = modeIcon;

  return (
    <div className="glass-panel rounded-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-high/30 transition-colors"
      >
        <ModeIcon size={14} className={agent.enabled ? 'text-primary' : 'text-outline'} />
        <div className="flex-1 text-left">
          <span className="text-xs font-medium text-on-surface">{agent.name}</span>
          <span className="text-[9px] text-on-surface-variant ml-2 font-mono">{agent.id}</span>
        </div>
        <span className={cn(
          'text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
          agent.enabled ? 'bg-tertiary/10 text-tertiary' : 'bg-surface-container-highest text-outline',
        )}>
          {agent.enabled ? 'Active' : 'Disabled'}
        </span>
        <span className="text-[9px] text-on-surface-variant uppercase font-bold">{agent.mode}</span>
        {expanded ? <ChevronDown size={12} className="text-outline" /> : <ChevronRight size={12} className="text-outline" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t border-outline-variant/10 pt-2 space-y-2">
          {agent.description && (
            <p className="text-[10px] text-on-surface-variant">{agent.description}</p>
          )}
          <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
            {agent.pipeline_id && (
              <div>
                <span className="text-outline">Pipeline:</span>{' '}
                <span className="text-primary">{agent.pipeline_id}</span>
              </div>
            )}
            {agent.preferred_runtime && (
              <div>
                <span className="text-outline">Runtime:</span>{' '}
                <span className="text-secondary">{agent.preferred_runtime}</span>
              </div>
            )}
            <div>
              <span className="text-outline">Created:</span>{' '}
              <span className="text-on-surface-variant">{new Date(agent.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          {agent.system_prompt && (
            <div className="bg-surface-container-lowest p-2 rounded-sm">
              <pre className="text-[9px] font-mono text-on-surface-variant whitespace-pre-wrap break-words">
                {agent.system_prompt}
              </pre>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onEdit}
              className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-secondary hover:text-primary transition-colors"
            >
              <Settings2 size={10} />
              Edit
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-error/60 hover:text-error transition-colors"
            >
              <Trash2 size={10} />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ExecutionHistoryItem component
// ---------------------------------------------------------------------------

interface ExecutionHistoryItemProps {
  execution: PipelineExecution;
  pipelineName: string;
  onSelect: () => void;
  isSelected: boolean;
}

const ExecutionHistoryItem: React.FC<ExecutionHistoryItemProps> = ({
  execution,
  pipelineName,
  onSelect,
  isSelected,
}) => {
  const statusColor =
    execution.status === 'completed' ? 'text-tertiary' :
    execution.status === 'running' ? 'text-primary' :
    execution.status === 'failed' ? 'text-error' :
    execution.status === 'paused' ? 'text-warning' :
    'text-outline';

  const StatusIcon =
    execution.status === 'completed' ? CheckCircle2 :
    execution.status === 'running' ? Loader2 :
    execution.status === 'failed' ? XCircle :
    execution.status === 'paused' ? Pause :
    Circle;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-sm transition-colors text-left',
        isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-surface-container-high/30',
      )}
    >
      <StatusIcon size={14} className={cn(statusColor, execution.status === 'running' && 'animate-spin')} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-on-surface truncate">{pipelineName}</div>
        <div className="text-[9px] font-mono text-on-surface-variant">
          {execution.id.slice(0, 16)}... &bull; {execution.status}
        </div>
      </div>
      {execution.started_at && (
        <span className="text-[9px] text-outline shrink-0">
          {new Date(execution.started_at).toLocaleTimeString()}
        </span>
      )}
    </button>
  );
};

// ---------------------------------------------------------------------------
// PipelineListItem component
// ---------------------------------------------------------------------------

interface PipelineListItemProps {
  pipeline: PipelineConfig;
  onEdit: () => void;
  onEditText: () => void;
  onDelete: () => void;
}

const PipelineListItem: React.FC<PipelineListItemProps> = ({ pipeline, onEdit, onEditText, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass-panel rounded-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-high/30 transition-colors"
      >
        <Layers size={14} className="text-primary" />
        <div className="flex-1 text-left">
          <span className="text-xs font-medium text-on-surface">{pipeline.name}</span>
          <span className="text-[9px] text-on-surface-variant ml-2 font-mono">{pipeline.id}</span>
        </div>
        <span className="text-[9px] text-on-surface-variant">
          {pipeline.stages.length} stage{pipeline.stages.length !== 1 ? 's' : ''}
        </span>
        {expanded ? <ChevronDown size={12} className="text-outline" /> : <ChevronRight size={12} className="text-outline" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t border-outline-variant/10 pt-2 space-y-2">
          {pipeline.description && (
            <p className="text-[10px] text-on-surface-variant">{pipeline.description}</p>
          )}
          <div className="flex flex-col gap-1">
            {pipeline.stages.map((stage, idx) => (
              <div key={stage.id} className="flex items-center gap-2 text-[9px] font-mono">
                <span className="text-outline">{idx + 1}.</span>
                <span className="text-on-surface-variant">{stage.name}</span>
                {stage.runtime_id && (
                  <span className="text-primary ml-auto">{stage.runtime_id}</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={onEdit}
              className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-secondary hover:text-primary transition-colors"
            >
              <Edit3 size={10} />
              Edit
            </button>
            <button
              onClick={onEditText}
              className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary transition-colors"
            >
              <FileText size={10} />
              Edit (Text)
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-error/60 hover:text-error transition-colors"
            >
              <Trash2 size={10} />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// RoutingDecisionCard component
// ---------------------------------------------------------------------------

interface RoutingDecisionCardProps {
  decision: RoutingDecision;
}

const RoutingDecisionCard: React.FC<RoutingDecisionCardProps> = ({ decision }) => {
  return (
    <div className="glass-panel rounded-sm p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route size={12} className="text-primary" />
          <span className="text-xs font-medium text-on-surface">{decision.category_label}</span>
        </div>
        <span className="text-[9px] font-mono text-outline">{decision.decision_id.slice(0, 12)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <span className="text-outline">Selected:</span>{' '}
          <span className="text-primary font-mono">{decision.selected_runtime}</span>
        </div>
        <div>
          <span className="text-outline">Category:</span>{' '}
          <span className="text-on-surface-variant">{decision.category}</span>
        </div>
      </div>
      <p className="text-[9px] text-on-surface-variant">{decision.reason}</p>
      {decision.fallback_used && (
        <div className="flex items-center gap-1.5 text-[9px] text-warning">
          <AlertCircle size={10} />
          <span>Fallback from: {decision.original_preference}</span>
        </div>
      )}
      <span className="text-[8px] text-outline font-mono self-end">
        {new Date(decision.timestamp).toLocaleTimeString()}
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// RoutingRuleEditor component
// ---------------------------------------------------------------------------

interface RoutingRuleEditorProps {
  rules: RoutingRule[];
  defaultRuntime: string;
  runtimes: AgentRuntimeInfo[];
  onUpdate: (rules: RoutingRule[], defaultRuntime: string) => void;
}

const CATEGORY_LABELS: Record<TaskCategoryType, string> = {
  code_generation: 'Code Generation',
  code_review: 'Code Review',
  requirements: 'Requirements',
  testing: 'Testing',
  general: 'General',
};

const ALL_CATEGORIES: TaskCategoryType[] = ['code_generation', 'code_review', 'requirements', 'testing', 'general'];

const RoutingRuleEditor: React.FC<RoutingRuleEditorProps> = ({ rules, defaultRuntime, runtimes, onUpdate }) => {
  const availableRuntimes = runtimes.filter(r => r.status === 'available');

  const updateRule = (idx: number, field: keyof RoutingRule, value: any) => {
    const next = [...rules];
    next[idx] = { ...next[idx], [field]: value };
    onUpdate(next, defaultRuntime);
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
        Routing Rules
      </h3>

      {/* Default runtime */}
      <label className="block">
        <span className="text-[10px] font-bold text-outline uppercase tracking-tighter">Default Runtime</span>
        <select
          value={defaultRuntime}
          onChange={e => onUpdate(rules, e.target.value)}
          className="mt-1 w-full bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface p-2 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none"
        >
          {availableRuntimes.map(rt => (
            <option key={rt.id} value={rt.id}>{rt.name}</option>
          ))}
        </select>
      </label>

      {/* Rules list */}
      {rules.map((rule, idx) => (
        <div key={rule.category} className="flex items-center gap-2 p-2 bg-surface-container-lowest rounded-sm border border-outline-variant/10">
          <span className="text-[10px] font-bold text-on-surface-variant w-32 shrink-0">
            {CATEGORY_LABELS[rule.category]}
          </span>
          <ArrowRight size={10} className="text-outline shrink-0" />
          <select
            value={rule.runtime_id}
            onChange={e => updateRule(idx, 'runtime_id', e.target.value)}
            className="flex-1 bg-surface-container border border-outline-variant/20 text-[10px] text-on-surface p-1 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none"
          >
            {availableRuntimes.map(rt => (
              <option key={rt.id} value={rt.id}>{rt.name}</option>
            ))}
          </select>
          <span className="text-[8px] text-outline font-mono shrink-0">P{rule.priority}</span>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main AgentControlPanel component
// ---------------------------------------------------------------------------

export const AgentControlPanel: React.FC = () => {
  // --- State ---
  const [activeTab, setActiveTab] = useState<PanelTab>('runtimes');
  const [showCreator, setShowCreator] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentConfig | null>(null);
  const [selectedExecId, setSelectedExecId] = useState<string | null>(null);
  const [editingPipeline, setEditingPipeline] = useState<PipelineConfig | null | 'new'>(null);
  const [pipelineEditorMode, setPipelineEditorMode] = useState<'visual' | 'text'>('visual');

  // --- Hooks ---
  const runtimesState = useAgentRuntimes();
  const pipelineState = usePipelineEngine();
  const routerState = useSmartRouter();
  const agentConfigsState = useAgentConfigs();

  // Load pipeline configs and routing config on mount
  useEffect(() => {
    pipelineState.loadPipelines();
    routerState.loadConfig();
    agentConfigsState.loadAgents();
  }, []);

  // --- Computed ---
  const executions = Object.values(pipelineState.executions).sort(
    (a, b) => (b.started_at ?? '').localeCompare(a.started_at ?? '')
  );
  const selectedExec = selectedExecId ? pipelineState.getExecution(selectedExecId) : null;

  const getPipelineName = (pipelineId: string): string => {
    const cfg = pipelineState.pipelines[pipelineId];
    return cfg?.name ?? pipelineId;
  };

  // --- Handlers ---
  const handleSaveAgent = async (agent: AgentConfig) => {
    await agentConfigsState.saveAgent(agent);
    setShowCreator(false);
    setEditingAgent(null);
  };

  const handleDeleteAgent = async (id: string) => {
    await agentConfigsState.deleteAgent(id);
  };

  // --- Pipeline handlers ---
  const handleSavePipeline = async (config: PipelineConfig) => {
    await pipelineState.savePipeline(config);
    setEditingPipeline(null);
    setPipelineEditorMode('visual');
  };

  const handleDeletePipeline = async (id: string) => {
    await pipelineState.deletePipeline(id);
    setEditingPipeline(null);
    setPipelineEditorMode('visual');
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-surface">
      {/* Tab sidebar */}
      <aside className="w-48 bg-surface-container-low flex flex-col border-r border-outline-variant/10 shrink-0">
        <div className="p-4 border-b border-outline-variant/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded">
              <Bot size={16} className="text-primary" />
            </div>
            <div>
              <h1 className="font-headline text-sm font-bold">Agent Control</h1>
              <p className="text-[9px] text-on-surface-variant">Runtime Management</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col p-2 gap-1">
          {TAB_ITEMS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-sm text-xs transition-colors',
                activeTab === tab.id
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container-high/50',
              )}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.id === 'executions' && executions.length > 0 && (
                <span className="ml-auto text-[9px] font-mono text-outline">{executions.filter(e => e.status === 'running').length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Quick stats */}
        <div className="mt-auto p-3 border-t border-outline-variant/10">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <div className="text-lg font-headline font-bold text-primary">{runtimesState.availableCount}</div>
              <div className="text-[8px] text-on-surface-variant uppercase tracking-wider">Runtimes</div>
            </div>
            <div>
              <div className="text-lg font-headline font-bold text-secondary">{agentConfigsState.agents.length}</div>
              <div className="text-[8px] text-on-surface-variant uppercase tracking-wider">Agents</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* === Pipeline Editor (full-screen overlay) === */}
        {editingPipeline !== null && pipelineEditorMode === 'visual' && (
          <PipelineVisualEditor
            initialConfig={editingPipeline === 'new' ? null : editingPipeline}
            runtimes={runtimesState.runtimes}
            onSave={handleSavePipeline}
            onDelete={handleDeletePipeline}
            onCancel={() => { setEditingPipeline(null); setPipelineEditorMode('visual'); }}
          />
        )}
        {editingPipeline !== null && pipelineEditorMode === 'text' && (
          <PipelineTextEditor
            initialConfig={editingPipeline === 'new' ? null : editingPipeline}
            onSave={handleSavePipeline}
            onDelete={handleDeletePipeline}
            onCancel={() => { setEditingPipeline(null); setPipelineEditorMode('visual'); }}
          />
        )}

        {/* === Normal tab content === */}
        {editingPipeline === null && (
        <div className="flex-1 overflow-y-auto scroll-hide p-6">
        {/* ==================== RUNTIMES TAB ==================== */}
        {activeTab === 'runtimes' && (
          <div className="max-w-3xl">
            <div className="mb-6 border-b border-outline-variant pb-4">
              <h2 className="font-headline text-2xl font-bold tracking-tight text-on-surface">Runtime Status</h2>
              <p className="text-on-surface-variant text-sm font-label opacity-70">
                Detected AI agent runtimes and their availability
              </p>
            </div>
            <RuntimeList
              runtimes={runtimesState.runtimes}
              scanning={runtimesState.scanning}
              onScan={runtimesState.scan}
            />
          </div>
        )}

        {/* ==================== AGENTS TAB ==================== */}
        {activeTab === 'agents' && (
          <div className="max-w-3xl">
            <div className="mb-6 border-b border-outline-variant pb-4 flex items-end justify-between">
              <div>
                <h2 className="font-headline text-2xl font-bold tracking-tight text-on-surface">Agent Configs</h2>
                <p className="text-on-surface-variant text-sm font-label opacity-70">
                  Create and manage custom agents with pipeline or routing orchestration
                </p>
              </div>
              {!showCreator && !editingAgent && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCreator(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10 rounded-sm transition-colors border border-primary/30"
                  >
                    <Plus size={12} />
                    New Agent
                  </button>
                  <button
                    onClick={() => { setEditingPipeline('new'); setPipelineEditorMode('visual'); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-secondary hover:bg-secondary/10 rounded-sm transition-colors border border-secondary/30"
                  >
                    <Layers size={12} />
                    New Pipeline
                  </button>
                  <button
                    onClick={() => { setEditingPipeline('new'); setPipelineEditorMode('text'); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:bg-surface-container-high rounded-sm transition-colors border border-outline-variant/30"
                  >
                    <FileText size={12} />
                    New Pipeline (Text)
                  </button>
                </div>
              )}
            </div>

            {/* Creator form */}
            {showCreator && (
              <div className="mb-4">
                <AgentCreator
                  runtimes={runtimesState.runtimes}
                  pipelineIds={pipelineState.pipelineIds}
                  onSave={handleSaveAgent}
                  onCancel={() => setShowCreator(false)}
                />
              </div>
            )}

            {/* Edit form */}
            {editingAgent && (
              <div className="mb-4">
                <AgentCreator
                  runtimes={runtimesState.runtimes}
                  pipelineIds={pipelineState.pipelineIds}
                  onSave={handleSaveAgent}
                  onCancel={() => setEditingAgent(null)}
                  initial={editingAgent}
                />
              </div>
            )}

            {/* Agent list */}
            <div className="flex flex-col gap-2">
              {agentConfigsState.agents.map(agent => (
                <AgentListItem
                  key={agent.id}
                  agent={agent}
                  onEdit={() => setEditingAgent(agent)}
                  onDelete={() => handleDeleteAgent(agent.id)}
                />
              ))}
              {agentConfigsState.agents.length === 0 && !showCreator && (
                <div className="text-center py-12 text-on-surface-variant opacity-50">
                  <Bot size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No agents configured</p>
                  <p className="text-[10px] mt-1">Click "New Agent" to create your first agent</p>
                </div>
              )}
            </div>

            {/* Pipeline List */}
            <div className="mt-8">
              <div className="mb-4 flex items-end justify-between border-b border-outline-variant pb-4">
                <div>
                  <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">Pipelines</h2>
                  <p className="text-on-surface-variant text-sm font-label opacity-70">
                    Multi-stage pipeline configurations
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditingPipeline('new'); setPipelineEditorMode('visual'); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-secondary hover:bg-secondary/10 rounded-sm transition-colors border border-secondary/30"
                  >
                    <Plus size={12} />
                    New Pipeline
                  </button>
                  <button
                    onClick={() => { setEditingPipeline('new'); setPipelineEditorMode('text'); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:bg-surface-container-high rounded-sm transition-colors border border-outline-variant/30"
                  >
                    <FileText size={12} />
                    Text
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {pipelineState.pipelineIds.map(pid => {
                  const pipeline = pipelineState.pipelines[pid];
                  if (!pipeline) return null;
                  return (
                    <PipelineListItem
                      key={pid}
                      pipeline={pipeline}
                      onEdit={() => { setEditingPipeline(pipeline); setPipelineEditorMode('visual'); }}
                      onEditText={() => { setEditingPipeline(pipeline); setPipelineEditorMode('text'); }}
                      onDelete={() => handleDeletePipeline(pid)}
                    />
                  );
                })}
                {pipelineState.pipelineIds.length === 0 && (
                  <div className="text-center py-8 text-on-surface-variant opacity-50">
                    <Layers size={24} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No pipelines configured</p>
                    <p className="text-[10px] mt-1">Click "New Pipeline" to create your first pipeline</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== EXECUTIONS TAB ==================== */}
        {activeTab === 'executions' && (
          <div className="flex h-full gap-4" style={{ maxHeight: 'calc(100vh - 160px)' }}>
            {/* Execution list */}
            <div className="w-64 shrink-0 flex flex-col bg-surface-container-low rounded-lg border border-outline-variant/10 overflow-hidden">
              <div className="p-3 border-b border-outline-variant/10">
                <h3 className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  Executions
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto scroll-hide p-2 flex flex-col gap-1">
                {executions.length === 0 ? (
                  <div className="text-center py-8 text-on-surface-variant opacity-50">
                    <PlayCircle size={24} className="mx-auto mb-1 opacity-30" />
                    <p className="text-[10px]">No executions yet</p>
                  </div>
                ) : (
                  executions.map(exec => (
                    <ExecutionHistoryItem
                      key={exec.id}
                      execution={exec}
                      pipelineName={getPipelineName(exec.pipeline_id)}
                      onSelect={() => setSelectedExecId(exec.id)}
                      isSelected={selectedExecId === exec.id}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Execution detail */}
            <div className="flex-1 min-w-0">
              {selectedExec ? (
                <PipelinePanel
                  config={pipelineState.pipelines[selectedExec.pipeline_id] ?? null}
                  execution={selectedExec}
                  onPause={() => pipelineState.pausePipeline(selectedExec.id)}
                  onResume={() => pipelineState.resumePipeline(selectedExec.id)}
                  onRetry={() => pipelineState.retryStage(selectedExec.id)}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-on-surface-variant">
                  <div className="text-center">
                    <Activity size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Select an execution to view details</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== ROUTES TAB ==================== */}
        {activeTab === 'routes' && (
          <div className="max-w-3xl flex flex-col gap-6">
            <div className="border-b border-outline-variant pb-4">
              <h2 className="font-headline text-2xl font-bold tracking-tight text-on-surface">Routing & Dispatch</h2>
              <p className="text-on-surface-variant text-sm font-label opacity-70">
                Smart router configuration and decision history
              </p>
            </div>

            {/* Routing rules editor */}
            {routerState.config && (
              <RoutingRuleEditor
                rules={routerState.config.rules}
                defaultRuntime={routerState.config.default_runtime}
                runtimes={runtimesState.runtimes}
                onUpdate={(rules, defaultRuntime) =>
                  routerState.updateConfig({ ...routerState.config!, rules, default_runtime: defaultRuntime })
                }
              />
            )}

            {/* Recent routing decisions */}
            <div>
              <h3 className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
                Recent Decisions
              </h3>
              {routerState.decisions.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {routerState.decisions.slice(0, 20).map(d => (
                    <RoutingDecisionCard key={d.decision_id} decision={d} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-on-surface-variant opacity-50">
                  <Route size={24} className="mx-auto mb-1 opacity-30" />
                  <p className="text-[10px]">No routing decisions recorded</p>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
        )}
      </main>
    </div>
  );
};
