import React from 'react';
import { Bell, FolderOpen } from 'lucide-react';

export const StatusBar: React.FC<{ workspacePath?: string }> = ({ workspacePath }) => {
  return (
    <footer
      className={
        'fixed bottom-0 left-0 w-full h-6 flex justify-between items-center ' +
        'px-4 z-50 bg-app font-mono text-[10px] uppercase tracking-tighter ' +
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
