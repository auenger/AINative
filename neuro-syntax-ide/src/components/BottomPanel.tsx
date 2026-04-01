import React from 'react';
import { Terminal, Ban, X } from 'lucide-react';
import { LogEntry } from '../types';
import { cn } from '../lib/utils';

interface BottomPanelProps {
  logs: LogEntry[];
}

export const BottomPanel: React.FC<BottomPanelProps> = ({ logs }) => {
  return (
    <footer className="h-48 bg-surface-container-lowest border-t border-outline-variant/20 flex flex-col z-20">
      <div className="h-7 bg-surface-container-low flex items-center px-4 justify-between border-b border-outline-variant/10">
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
          <X size={12} className="text-on-surface-variant cursor-pointer hover:text-on-surface" />
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
    </footer>
  );
};
