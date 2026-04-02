import React from 'react';
import { Terminal, Ban, X } from 'lucide-react';
import { LogEntry } from '../types';
import { cn } from '../lib/utils';

interface BottomPanelProps {
  logs: LogEntry[];
  visible: boolean;
  onClose: () => void;
  onOpen: () => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({ logs, visible, onClose, onOpen }) => {
  return (
    <footer
      className={cn(
        "bg-surface-container-lowest border-t border-outline-variant/20 flex flex-col z-20 transition-all duration-300 ease-in-out overflow-hidden",
        visible ? "max-h-48" : "max-h-[28px]"
      )}
    >
      {visible ? (
        <>
          <div className="h-7 bg-surface-container-low flex items-center px-4 justify-between border-b border-outline-variant/10 shrink-0">
            <div className="flex items-center gap-4 h-full">
              <div className="flex items-center gap-2 text-primary border-b border-primary h-full px-2">
                <Terminal size={12} />
                <span className="font-bold text-[10px] uppercase tracking-widest">AI TASK LOGS</span>
              </div>
              <div className="flex items-center gap-2 text-on-surface-variant opacity-50 hover:opacity-100 cursor-pointer px-2 text-[10px] font-bold uppercase tracking-widest">
                <span>DEBUG CONSOLE</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Ban size={12} className="text-on-surface-variant cursor-pointer hover:text-on-surface" />
              <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface cursor-pointer">
                <X size={12} />
              </button>
            </div>
          </div>
          <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] leading-relaxed scroll-hide">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-4 mb-1">
                <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                <span className={cn(
                  "font-bold shrink-0",
                  log.level === 'SUCCESS' && "text-tertiary",
                  log.level === 'INFO' && "text-primary",
                  log.level === 'DEBUG' && "text-secondary",
                  log.level === 'WARN' && "text-error",
                  log.level === 'EXEC' && "text-secondary",
                  log.level === 'ACTIVE' && "text-secondary",
                  log.level === 'BUSY' && "text-primary"
                )}>
                  {log.level}
                </span>
                <span className={cn(
                  "text-on-surface-variant",
                  log.level === 'ACTIVE' && "text-secondary-fixed",
                  log.level === 'BUSY' && "text-on-surface"
                )}>
                  {log.message}
                </span>
              </div>
            ))}
            <div className="mt-2 text-on-surface-variant opacity-50 animate-pulse">
              &gt; _
            </div>
          </div>
        </>
      ) : (
        <button
          onClick={onOpen}
          className="h-[28px] flex items-center gap-2 px-4 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/50 transition-colors cursor-pointer w-full"
          title="Show Console"
        >
          <Terminal size={12} />
          <span className="font-bold text-[10px] uppercase tracking-widest">Console</span>
        </button>
      )}
    </footer>
  );
};
