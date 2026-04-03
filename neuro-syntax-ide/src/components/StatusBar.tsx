import React, { useState, useRef, useEffect } from 'react';
import { Bell, FolderOpen, Terminal, Cpu, ChevronDown } from 'lucide-react';
import { useAgentRuntimes } from '../lib/useAgentRuntimes';
import type { AgentRuntimeInfo } from '../types';

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

export const StatusBar: React.FC<StatusBarProps> = ({ workspacePath, consoleVisible, onToggleConsole }) => {
  const { runtimes, availableCount, scan } = useAgentRuntimes();
  const [showRuntimes, setShowRuntimes] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

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
            <Cpu size={10} />
            <span>{availableCount} Agent{availableCount !== 1 ? 's' : ''}</span>
            <ChevronDown size={8} />
          </button>

          {showRuntimes && (
            <div className="absolute bottom-full right-0 mb-1 w-72 bg-surface-container-low rounded-lg border border-outline-variant/20 shadow-xl z-[100]">
              <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant/10">
                <span className="text-on-surface text-xs font-semibold">Agent Runtimes</span>
                <button
                  onClick={(e) => { e.stopPropagation(); scan(); }}
                  className="text-primary text-[10px] hover:underline cursor-pointer"
                >
                  Rescan
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {runtimes.map((rt: AgentRuntimeInfo) => (
                  <div key={rt.id} className="flex items-center justify-between px-3 py-2 hover:bg-surface-container/50">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${statusColor(rt.status)}`} />
                      <div>
                        <div className="text-on-surface text-[10px] font-medium">{rt.name}</div>
                        {rt.version && (
                          <div className="text-on-surface-variant text-[9px]">{rt.version}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-on-surface-variant text-[9px]">{statusLabel(rt.status)}</div>
                      {rt.status === 'not-installed' && (
                        <div className="text-primary text-[8px] cursor-pointer" title={rt.install_hint}>
                          Install
                        </div>
                      )}
                    </div>
                  </div>
                ))}
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
    </footer>
  );
};
