import React, { useState, useRef, useEffect } from 'react';
import { Bell, FolderOpen, Terminal, Cpu, ChevronDown, RefreshCw, Eye } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAgentRuntimes } from '../lib/useAgentRuntimes';
import { useRuntimeMonitor } from '../lib/useRuntimeMonitor';
import { RuntimeOutputModal } from './RuntimeOutputModal';
import type { AgentRuntimeInfo, RuntimeProcessInfo, ActiveSessionInfo } from '../types';

interface StatusBarProps {
  workspacePath?: string;
  consoleVisible?: boolean;
  onToggleConsole?: () => void;
}

/** Status color for runtime status dot */
function statusColor(status: string): string {
  switch (status) {
    case 'available': return 'bg-green-400';
    case 'busy': return 'bg-yellow-400 animate-pulse';
    case 'unhealthy': return 'bg-red-400';
    case 'not-installed': return 'bg-gray-500';
    default: return 'bg-gray-500';
  }
}

/** Status label for runtime */
function statusLabel(status: string): string {
  switch (status) {
    case 'available': return 'Available';
    case 'busy': return 'Busy';
    case 'unhealthy': return 'Unhealthy';
    case 'not-installed': return 'Not Installed';
    default: return status;
  }
}

/** Format bytes to human-readable string */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/** Format uptime from unix timestamp */
function formatUptime(startedAt: number | null): string {
  if (!startedAt) return '--';
  const diff = Math.floor(Date.now() / 1000) - startedAt;
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

export const StatusBar: React.FC<StatusBarProps> = ({ workspacePath, consoleVisible, onToggleConsole }) => {
  const { runtimes, availableCount, scan } = useAgentRuntimes();
  const {
    runtimes: activeRuntimes,
    isMonitoring,
    hasActiveRuntime,
    start: startMonitor,
    stop: stopMonitor,
    scan: scanRuntimes,
  } = useRuntimeMonitor();
  const [showRuntimes, setShowRuntimes] = useState(false);

  // Multi-runtime session output state (feat-runtime-output-polish)
  const [showOutputModal, setShowOutputModal] = useState(false);
  const [outputModalRuntimeId, setOutputModalRuntimeId] = useState<string>('');
  const [outputModalRuntimeName, setOutputModalRuntimeName] = useState<string>('');

  // Per-runtime active session tracking
  const [activeSessions, setActiveSessions] = useState<Record<string, ActiveSessionInfo | null>>({});

  const popoverRef = useRef<HTMLDivElement>(null);
  const monitorStarted = useRef(false);

  // Start runtime monitor when workspace is available
  useEffect(() => {
    if (workspacePath && !monitorStarted.current) {
      monitorStarted.current = true;
      startMonitor(workspacePath);
    }
    return () => {
      if (monitorStarted.current) {
        monitorStarted.current = false;
        stopMonitor();
      }
    };
  }, [workspacePath, startMonitor, stopMonitor]);

  // Close popover on outside click
  useEffect(() => {
    if (!showRuntimes) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowRuntimes(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showRuntimes]);

  // Poll active sessions per runtime every 3s (feat-runtime-output-polish)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const poll = async () => {
      const results: Record<string, ActiveSessionInfo | null> = {};
      for (const rt of runtimes) {
        try {
          const info = await invoke<ActiveSessionInfo | null>('get_active_session', { runtimeId: rt.id });
          results[rt.id] = info;
        } catch {
          results[rt.id] = null;
        }
      }
      setActiveSessions(results);
    };
    poll();
    interval = setInterval(poll, 3000);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [runtimes]);

  // Group active processes by runtime_id (multiple processes may share same id)
  const activeByRuntimeId = new Map<string, RuntimeProcessInfo[]>();
  for (const ar of activeRuntimes) {
    const list = activeByRuntimeId.get(ar.runtime_id) || [];
    list.push(ar);
    activeByRuntimeId.set(ar.runtime_id, list);
  }

  // Build merged list: static runtimes + all their active processes
  const mergedRuntimes: Array<AgentRuntimeInfo & { activeProcesses: RuntimeProcessInfo[] }> = runtimes.map((rt: AgentRuntimeInfo) => {
    const processes = activeByRuntimeId.get(rt.id) || [];
    return { ...rt, activeProcesses: processes };
  });

  /** Open output modal for a specific runtime */
  const handleViewOutput = (runtimeId: string, runtimeName: string) => {
    setOutputModalRuntimeId(runtimeId);
    setOutputModalRuntimeName(runtimeName);
    setShowOutputModal(true);
    setShowRuntimes(false);
  };

  return (
    <footer
      className={
        'h-6 shrink-0 flex justify-between items-center ' +
        'px-4 z-50 bg-surface-container-lowest font-mono text-[10px] uppercase tracking-tighter ' +
        'border-t border-outline-variant/10'
      }
    >
      <div className="flex items-center gap-4">
        <span className="text-on-surface-variant">Neuro Syntax v1.0.4</span>
        {workspacePath && (
          <div className="flex items-center gap-1.5 text-on-surface-variant">
            <FolderOpen size={10} className="text-primary" />
            <span className="truncate max-w-[300px]">{workspacePath.split("/").pop()}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <span className="text-on-surface-variant hover:text-white cursor-pointer">UTF-8</span>
          <span className="text-on-surface-variant hover:text-white cursor-pointer">Main</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {/* Agent Runtime Status Indicator */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => setShowRuntimes(!showRuntimes)}
            className="flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            title={`${availableCount} agent runtime(s) available`}
          >
            {hasActiveRuntime ? (
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            ) : (
              <Cpu size={10} />
            )}
            <span>{hasActiveRuntime ? 'Running' : `${availableCount} Agent${availableCount !== 1 ? 's' : ''}`}</span>
            <ChevronDown size={8} />
          </button>

          {showRuntimes && (
            <div className="absolute bottom-full right-0 mb-1 w-80 bg-surface-container-low rounded-lg border border-outline-variant/20 shadow-xl z-[100]">
              <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant/10">
                <span className="text-on-surface text-xs font-semibold">Agent Runtimes</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    scan();
                    if (workspacePath) scanRuntimes(workspacePath);
                  }}
                  className="text-primary text-[10px] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw size={8} />
                  Rescan
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {mergedRuntimes.map((rt) => {
                  const hasRunning = rt.activeProcesses.length > 0;
                  const sessionInfo = activeSessions[rt.id];
                  return (
                    <div key={rt.id} className="px-3 py-2 hover:bg-surface-container/50 border-b border-outline-variant/5 last:border-b-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            hasRunning
                              ? 'bg-green-400 animate-pulse'
                              : statusColor(rt.status)
                          }`} />
                          <div>
                            <div className="text-on-surface text-[10px] font-medium">
                              {rt.name}
                              {hasRunning && (
                                <span className="ml-1.5 text-green-400 text-[9px] font-bold">
                                  {rt.activeProcesses.length} Running
                                </span>
                              )}
                            </div>
                            {rt.version && (
                              <div className="text-on-surface-variant text-[9px]">{rt.version}</div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-on-surface-variant text-[9px]">
                            {hasRunning ? `${rt.activeProcesses.length} Running` : statusLabel(rt.status)}
                          </div>
                          {rt.status === 'not-installed' && (
                            <div className="text-primary text-[8px] cursor-pointer" title={rt.install_hint}>
                              Install
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Process details — show all active processes */}
                      {rt.activeProcesses.map((process: RuntimeProcessInfo) => (
                        <div key={process.pid} className="mt-1.5 pl-3.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[8px] text-on-surface-variant">
                          <span>PID: {process.pid}</span>
                          <span>CPU: {process.cpu_usage.toFixed(1)}%</span>
                          <span>MEM: {formatBytes(process.memory_bytes)}</span>
                          <span>Uptime: {formatUptime(process.started_at)}</span>
                        </div>
                      ))}
                      {/* View Output button — available for any runtime with active session (feat-runtime-output-polish) */}
                      {sessionInfo && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewOutput(rt.id, rt.name);
                          }}
                          className="mt-1.5 ml-3.5 flex items-center gap-1 text-[9px] text-primary hover:underline cursor-pointer"
                        >
                          <Eye size={8} />
                          View Output{sessionInfo.is_done ? '' : ' (Live)'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {onToggleConsole && (
          <button
            onClick={onToggleConsole}
            className={consoleVisible
              ? "flex items-center gap-1.5 text-tertiary font-bold hover:text-on-surface transition-colors cursor-pointer"
              : "flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            }
            title={consoleVisible ? 'Hide Console' : 'Show Console'}
          >
            <Terminal size={10} />
            <span>Console</span>
          </button>
        )}
        <div className="flex items-center gap-1.5 text-tertiary font-bold">
          <div className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></div>
          <span>Connected</span>
        </div>
        <span className="text-tertiary font-bold">Ready</span>
        <Bell size={10} className="text-on-surface-variant" />
      </div>

      {/* Runtime Output Modal (feat-runtime-output-polish) */}
      <RuntimeOutputModal
        visible={showOutputModal}
        onClose={() => setShowOutputModal(false)}
        runtimeId={outputModalRuntimeId}
        runtimeName={outputModalRuntimeName}
      />
    </footer>
  );
};
