import React from 'react';
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Pause,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  XCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type {
  PipelineExecution,
  PipelineStageExecution,
  PipelineStatusType,
  PipelineConfig,
} from '../../types';

// ---------------------------------------------------------------------------
// Stage status icon
// ---------------------------------------------------------------------------

const StageStatusIcon: React.FC<{ status: PipelineStatusType }> = ({ status }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 size={14} className="text-tertiary" />;
    case 'running':
      return <Loader2 size={14} className="text-primary animate-spin" />;
    case 'failed':
      return <XCircle size={14} className="text-error" />;
    case 'paused':
      return <Pause size={14} className="text-secondary" />;
    case 'pending':
    default:
      return <Circle size={14} className="text-outline" />;
  }
};

// ---------------------------------------------------------------------------
// Single stage row
// ---------------------------------------------------------------------------

interface StageRowProps {
  stage: PipelineStageExecution;
  stageName: string;
  isCurrent: boolean;
  expanded: boolean;
  onToggle: () => void;
}

const StageRow: React.FC<StageRowProps> = ({ stage, stageName, isCurrent, expanded, onToggle }) => {
  const hasOutput = stage.output.length > 0;
  const hasError = !!stage.error;

  return (
    <div className={cn(
      'border border-outline-variant/10 rounded-sm',
      isCurrent && 'ring-1 ring-primary/30 bg-surface-container-high/50',
    )}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-container-high/30 transition-colors"
      >
        <StageStatusIcon status={stage.status} />
        <span className={cn(
          'text-xs font-medium flex-1 text-left',
          stage.status === 'completed' ? 'text-on-surface' : 'text-on-surface-variant',
        )}>
          {stageName}
        </span>
        {stage.status === 'running' && (
          <span className="text-[9px] text-primary font-bold uppercase tracking-wider animate-pulse">
            Running
          </span>
        )}
        {stage.attempts > 1 && (
          <span className="text-[9px] text-outline">
            attempt {stage.attempts}
          </span>
        )}
        {hasOutput && (
          expanded ? <ChevronDown size={12} className="text-outline" /> : <ChevronRight size={12} className="text-outline" />
        )}
      </button>

      {/* Expanded output */}
      {expanded && hasOutput && (
        <div className="px-3 pb-2 border-t border-outline-variant/10">
          <pre className="text-[10px] font-mono text-on-surface-variant whitespace-pre-wrap break-words max-h-48 overflow-y-auto mt-2">
            {stage.output}
          </pre>
        </div>
      )}

      {/* Error message */}
      {hasError && (
        <div className="px-3 pb-2 flex items-start gap-2">
          <AlertCircle size={12} className="text-error flex-shrink-0 mt-0.5" />
          <span className="text-[10px] text-error">{stage.error}</span>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// PipelinePanel component
// ---------------------------------------------------------------------------

export interface PipelinePanelProps {
  /** The pipeline configuration. */
  config: PipelineConfig | null;
  /** The current execution state (null if not running). */
  execution: PipelineExecution | null;
  /** Pause handler. */
  onPause: () => void;
  /** Resume handler. */
  onResume: () => void;
  /** Retry failed stage handler. */
  onRetry: () => void;
}

export const PipelinePanel: React.FC<PipelinePanelProps> = ({
  config,
  execution,
  onPause,
  onResume,
  onRetry,
}) => {
  const [expandedStages, setExpandedStages] = React.useState<Set<string>>(new Set());

  const toggleStage = (stageId: string) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full text-on-surface-variant">
        <span className="text-xs">No pipeline selected</span>
      </div>
    );
  }

  const isRunning = execution?.status === 'running';
  const isPaused = execution?.status === 'paused';
  const isFailed = execution?.status === 'failed';
  const isCompleted = execution?.status === 'completed';

  return (
    <div className="flex flex-col h-full bg-surface-container-low">
      {/* Header */}
      <div className="px-4 py-3 border-b border-outline-variant/10 flex items-center justify-between">
        <div>
          <h3 className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Pipeline
          </h3>
          <p className="text-[10px] text-primary mt-0.5 font-mono">{config.name}</p>
        </div>

        {execution && (
          <div className="flex items-center gap-2">
            {isRunning && (
              <button
                onClick={onPause}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary hover:bg-secondary/10 rounded-sm transition-colors"
              >
                <Pause size={12} />
                Pause
              </button>
            )}
            {isPaused && (
              <button
                onClick={onResume}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10 rounded-sm transition-colors"
              >
                <Play size={12} />
                Resume
              </button>
            )}
            {isFailed && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-tertiary hover:bg-tertiary/10 rounded-sm transition-colors"
              >
                <RotateCcw size={12} />
                Retry
              </button>
            )}
            {isCompleted && (
              <span className="flex items-center gap-1 text-[10px] text-tertiary font-bold uppercase tracking-wider">
                <CheckCircle2 size={12} />
                Done
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stage list */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {config.stages.map((stageConf, idx) => {
          const stageExec: PipelineStageExecution | undefined = execution?.stages[idx];
          const isCurrent = execution?.current_stage_index === idx;

          return (
            <StageRow
              key={stageConf.id}
              stage={stageExec ?? {
                stage_id: stageConf.id,
                status: 'pending' as PipelineStatusType,
                input: '',
                output: '',
                error: null,
                attempts: 0,
                started_at: null,
                finished_at: null,
              }}
              stageName={stageConf.name}
              isCurrent={isCurrent}
              expanded={expandedStages.has(stageConf.id)}
              onToggle={() => toggleStage(stageConf.id)}
            />
          );
        })}
      </div>

      {/* Execution info */}
      {execution && (
        <div className="px-4 py-2 border-t border-outline-variant/10 bg-surface-container-lowest">
          <div className="flex items-center justify-between text-[9px] text-outline font-mono">
            <span>ID: {execution.id}</span>
            <span>Status: {execution.status}</span>
            {execution.started_at && (
              <span>Started: {new Date(execution.started_at).toLocaleTimeString()}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
