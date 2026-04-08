import React, { useEffect, useRef } from 'react';
import { Activity, Cpu, HardDrive, Clock, Zap, Bot } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useRuntimeMonitor } from '../../lib/useRuntimeMonitor';
import { RuntimeProcessInfo } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatUptime(startedAt: number | null): string {
  if (!startedAt) return '--';
  const diff = Math.floor(Date.now() / 1000) - startedAt;
  if (diff < 0) return '--';
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RuntimeMonitorPanelProps {
  workspacePath?: string;
}

export const RuntimeMonitorPanel: React.FC<RuntimeMonitorPanelProps> = ({ workspacePath }) => {
  const {
    runtimes,
    isMonitoring,
    hasActiveRuntime,
    start,
    stop,
    scan,
  } = useRuntimeMonitor();

  const monitorStarted = useRef(false);

  // Auto-start monitor when workspace is available
  useEffect(() => {
    if (workspacePath && !monitorStarted.current) {
      monitorStarted.current = true;
      start(workspacePath);
    }
    return () => {
      if (monitorStarted.current) {
        monitorStarted.current = false;
        stop();
      }
    };
  }, [workspacePath, start, stop]);

  // Manual rescan handler
  const handleRescan = () => {
    if (workspacePath) {
      scan(workspacePath);
    }
  };

  return (
    <div className="bg-surface-container-lowest p-0 rounded-lg overflow-hidden border border-outline-variant/10 flex flex-col">
      {/* Header */}
      <div className="bg-surface-container-highest px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-secondary" />
          <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">
            Runtime Monitor
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isMonitoring && (
            <div className="flex items-center gap-1.5">
              <div className={cn(
                'w-1.5 h-1.5 rounded-full',
                hasActiveRuntime ? 'bg-green-400 animate-pulse' : 'bg-on-surface-variant/40'
              )} />
              <span className="text-[9px] text-on-surface-variant">
                {hasActiveRuntime ? 'Active' : 'Idle'}
              </span>
            </div>
          )}
          <button
            onClick={handleRescan}
            className="text-[9px] text-primary hover:underline cursor-pointer"
          >
            Rescan
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1">
        {runtimes.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant opacity-50">
            <Bot size={32} className="mb-3" />
            <p className="text-xs font-medium">No Runtime Processes Detected</p>
            <p className="text-[9px] mt-1">Start Claude Code in your terminal to see live status here.</p>
          </div>
        ) : (
          /* Process list */
          <div className="space-y-3">
            {runtimes.map((rt: RuntimeProcessInfo) => (
              <RuntimeProcessCard key={`${rt.runtime_id}-${rt.pid}`} process={rt} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Process Card sub-component
// ---------------------------------------------------------------------------

const RuntimeProcessCard: React.FC<{ process: RuntimeProcessInfo }> = ({ process }) => {
  const isRunning = process.status === 'running';

  return (
    <div className="bg-surface-container/50 p-3 rounded border border-outline-variant/10">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-2 h-2 rounded-full',
            isRunning ? 'bg-green-400 animate-pulse' : 'bg-on-surface-variant/40'
          )} />
          <span className="text-xs font-bold text-on-surface">{process.name}</span>
          <span className={cn(
            'text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase',
            isRunning
              ? 'bg-green-400/20 text-green-400'
              : 'bg-on-surface-variant/20 text-on-surface-variant'
          )}>
            {isRunning ? 'Running' : 'Idle'}
          </span>
        </div>
        <span className="text-[9px] text-on-surface-variant font-mono">PID: {process.pid}</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-surface-container-low p-2 rounded border border-outline-variant/5 flex items-center gap-2">
          <Cpu size={12} className="text-secondary shrink-0" />
          <div>
            <div className="text-[8px] text-on-surface-variant uppercase">CPU</div>
            <div className="text-[10px] font-mono text-on-surface font-medium">
              {process.cpu_usage.toFixed(1)}%
            </div>
          </div>
        </div>
        <div className="bg-surface-container-low p-2 rounded border border-outline-variant/5 flex items-center gap-2">
          <HardDrive size={12} className="text-tertiary shrink-0" />
          <div>
            <div className="text-[8px] text-on-surface-variant uppercase">Memory</div>
            <div className="text-[10px] font-mono text-on-surface font-medium">
              {formatBytes(process.memory_bytes)}
            </div>
          </div>
        </div>
        <div className="bg-surface-container-low p-2 rounded border border-outline-variant/5 flex items-center gap-2">
          <Clock size={12} className="text-primary shrink-0" />
          <div>
            <div className="text-[8px] text-on-surface-variant uppercase">Uptime</div>
            <div className="text-[10px] font-mono text-on-surface font-medium">
              {formatUptime(process.started_at)}
            </div>
          </div>
        </div>
        <div className="bg-surface-container-low p-2 rounded border border-outline-variant/5 flex items-center gap-2">
          <Activity size={12} className="text-warning shrink-0" />
          <div>
            <div className="text-[8px] text-on-surface-variant uppercase">Working Dir</div>
            <div className="text-[10px] font-mono text-on-surface font-medium truncate max-w-[120px]" title={process.working_dir}>
              {process.working_dir.split('/').pop() || '--'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
