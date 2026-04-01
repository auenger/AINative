import React from 'react';
import { Bell } from 'lucide-react';

export const StatusBar: React.FC = () => {
  return (
    <footer className="fixed bottom-0 left-0 w-full h-6 flex justify-between items-center px-4 z-50 bg-[#020617] font-mono text-[10px] uppercase tracking-tighter border-t border-outline-variant/10">
      <div className="flex items-center gap-4">
        <span className="text-slate-500">Neuro Syntax v1.0.4</span>
        <div className="flex items-center gap-3">
          <span className="text-slate-500 hover:text-white cursor-pointer">UTF-8</span>
          <span className="text-slate-500 hover:text-white cursor-pointer">Main</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
          <span>Connected</span>
        </div>
        <span className="text-emerald-400 font-bold">Ready</span>
        <Bell size={10} className="text-slate-500" />
      </div>
    </footer>
  );
};
