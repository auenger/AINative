import React from 'react';
import { Bell, FolderOpen, Terminal } from 'lucide-react';

interface StatusBarProps {
  workspacePath?: string;
  consoleVisible?: boolean;
  onToggleConsole?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({ workspacePath, consoleVisible, onToggleConsole }) => {
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
