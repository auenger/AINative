import React from 'react';
import {
  ClipboardList,
  GitBranch,
  Rocket,
  Settings,
  FileCode,
  Layout,
  Bot,
  Building2,
  Github
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { ViewType } from '../types';

interface SideNavProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export const SideNav: React.FC<SideNavProps> = ({ activeView, onViewChange }) => {
  const { t } = useTranslation();

  const navItems: { id: ViewType; icon: any; label: string }[] = [
    { id: 'project', icon: Layout, label: t('nav.project') },
    { id: 'tasks', icon: ClipboardList, label: t('nav.tasks') },
    { id: 'editor', icon: FileCode, label: t('nav.editor') },
    { id: 'git', icon: Github, label: t('nav.git', 'Git') },
    { id: 'mission-control', icon: Rocket, label: t('nav.missionControl') },
    { id: 'agents', icon: Bot, label: t('nav.agents') },
    { id: 'agent-pixel', icon: Building2, label: t('nav.observatory') },
    // ⚠️ Workflow tab hidden — reserved for future design & capability enhancement
    // { id: 'workflow', icon: GitBranch, label: t('nav.workflow') },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full flex flex-col z-50 bg-app w-16 items-center border-r border-outline-variant/10">
      <div className="flex items-center justify-center h-10 shrink-0">
        <img src="/logo.png" alt="Neuro Syntax" className="w-7 h-7 rounded-md" />
      </div>
      <div className="flex flex-col w-full gap-2 pt-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              "w-full flex flex-col items-center py-3 transition-all relative group",
              activeView === item.id
                ? "text-primary bg-surface-container-high/50 border-l-2 border-primary"
                : "text-on-surface-variant opacity-70 hover:bg-surface-container-high hover:text-primary"
            )}
          >
            <item.icon size={20} strokeWidth={activeView === item.id ? 2.5 : 2} />
            <span className="text-[8px] mt-1 font-headline uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-auto flex flex-col w-full gap-2 mb-6">
        <button 
          onClick={() => onViewChange('settings')}
          className={cn(
            "w-full flex justify-center py-3 transition-colors",
            activeView === 'settings' ? "text-blue-400" : "text-slate-500 opacity-70 hover:text-blue-300"
          )}
        >
          <Settings size={20} />
        </button>
      </div>
    </aside>
  );
};
