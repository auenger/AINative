import React from 'react';
import { Target, Activity, Terminal, Brain, ArrowRight, Bot, GitBranch, GitCommit, GitPullRequest, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

export const MissionControl: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="flex-1 p-6 overflow-y-auto scroll-hide bg-surface">
      <div className="flex items-end justify-between mb-8 border-b border-outline-variant pb-4">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface">{t('missionControl.title')}</h1>
          <p className="text-on-surface-variant text-sm font-label opacity-70">AI-Agent Active • System Monitoring Environment</p>
        </div>
        <div className="flex gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-secondary opacity-60">Status</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-tertiary"></span>
              <span className="font-mono text-sm text-tertiary">NOMINAL</span>
            </div>
          </div>
          <button className="bg-surface-container-high border border-outline-variant text-on-surface px-4 py-2 text-xs font-headline hover:bg-surface-variant">
            New Branch
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 auto-rows-min">
        {/* Current Mission Card */}
        <div className="col-span-12 lg:col-span-8 glass-panel p-5 rounded">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-container/20 rounded">
                <Target size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="font-headline font-bold text-lg">Current Mission</h3>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-tighter">Objective: Neural Interface Optimization</p>
              </div>
            </div>
            <span className="font-mono text-2xl text-primary">78%</span>
          </div>
          <div className="relative w-full h-2 bg-surface-container-lowest overflow-hidden rounded-full mb-4">
            <div className="absolute top-0 left-0 h-full bg-primary-container shadow-[0_0_10px_rgba(88,166,255,0.5)]" style={{ width: '78%' }}></div>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="flex flex-col">
              <span className="text-[10px] text-on-surface-variant uppercase">Sub-tasks</span>
              <span className="text-lg font-headline font-medium">12/15</span>
            </div>
            <div className="flex flex-col border-l border-outline-variant/30 pl-4">
              <span className="text-[10px] text-on-surface-variant uppercase">Priority</span>
              <span className="text-lg font-headline font-medium text-error">CRITICAL</span>
            </div>
            <div className="flex flex-col border-l border-outline-variant/30 pl-4">
              <span className="text-[10px] text-on-surface-variant uppercase">ETA</span>
              <span className="text-lg font-headline font-medium">04:12:44</span>
            </div>
            <div className="flex flex-col border-l border-outline-variant/30 pl-4">
              <span className="text-[10px] text-on-surface-variant uppercase">Resource</span>
              <span className="text-lg font-headline font-medium">Local-L3</span>
            </div>
          </div>
        </div>

        {/* System Health Card */}
        <div className="col-span-12 lg:col-span-4 bg-surface-container-low p-5 rounded flex flex-col gap-6">
          <h3 className="font-headline font-bold flex items-center gap-2">
            <Activity size={16} />
            {t('missionControl.systemHealth')}
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-on-surface-variant">CPU UTILIZATION</span>
              <span className="text-secondary">42.8%</span>
            </div>
            <div className="flex gap-1 h-3">
              <div className="flex-1 bg-secondary opacity-100"></div>
              <div className="flex-1 bg-secondary opacity-100"></div>
              <div className="flex-1 bg-secondary opacity-60"></div>
              <div className="flex-1 bg-secondary opacity-30"></div>
              <div className="flex-1 bg-surface-container-highest"></div>
              <div className="flex-1 bg-surface-container-highest"></div>
              <div className="flex-1 bg-surface-container-highest"></div>
              <div className="flex-1 bg-surface-container-highest"></div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-on-surface-variant">VRAM USAGE (A100)</span>
              <span className="text-tertiary">14.2 GB / 80 GB</span>
            </div>
            <div className="w-full bg-surface-container-lowest h-1.5 overflow-hidden">
              <div className="bg-tertiary h-full" style={{ width: '18%' }}></div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="flex flex-col">
              <span className="text-[10px] text-on-surface-variant uppercase">Inference Latency</span>
              <span className="text-xl font-headline text-on-surface">24ms</span>
            </div>
            <div className="w-24 h-8 opacity-40">
              <svg className="stroke-secondary fill-none stroke-2" viewBox="0 0 100 30">
                <path d="M0 25 L10 20 L20 28 L30 15 L40 22 L50 10 L60 18 L70 5 L80 12 L90 8 L100 15"></path>
              </svg>
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className="col-span-12 lg:col-span-6 bg-surface-container-lowest p-0 rounded-lg overflow-hidden border border-outline-variant/10 flex flex-col">
          <div className="bg-surface-container-highest px-4 py-2 flex items-center justify-between shrink-0">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-error/40"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-tertiary/40"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-primary/40"></div>
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">AI Activity Log</span>
            <Terminal size={12} className="text-on-surface-variant" />
          </div>
          <div className="p-4 font-mono text-[10px] space-y-2 h-64 overflow-y-auto scroll-hide">
            <div className="flex gap-4"><span className="text-outline">14:22:01</span><span className="text-tertiary">[SUCCESS]</span><span className="text-on-surface-variant">Neural path validation complete.</span></div>
            <div className="flex gap-4"><span className="text-outline">14:22:05</span><span className="text-primary">[SYSTEM]</span><span className="text-on-surface-variant">Initiating kernel optimization...</span></div>
            <div className="flex gap-4"><span className="text-outline">14:22:08</span><span className="text-secondary">[INFO]</span><span className="text-on-surface-variant">Context window expanded to 128k tokens.</span></div>
            <div className="flex gap-4"><span className="text-outline">14:22:15</span><span className="text-error">[WARN]</span><span className="text-error">Deprecation detected in node: "LogicGate_A".</span></div>
            <div className="flex gap-4"><span className="text-outline">14:22:22</span><span className="text-primary">[SYSTEM]</span><span className="text-on-surface-variant">Auto-patching node dependencies.</span></div>
            <div className="flex gap-4 opacity-60"><span className="text-outline">14:22:30</span><span className="text-tertiary">[SUCCESS]</span><span className="text-on-surface-variant">Agent "Sentinel-1" reports standby.</span></div>
            <div className="flex gap-4 animate-pulse"><span className="text-outline">14:22:35</span><span className="text-primary">[BUSY]</span><span className="text-on-surface">Compiling dynamic workflow graph...</span></div>
          </div>
        </div>

        {/* Git Status Card */}
        <div className="col-span-12 lg:col-span-6 bg-surface-container-lowest p-0 rounded-lg overflow-hidden border border-outline-variant/10 flex flex-col">
          <div className="bg-surface-container-highest px-4 py-2 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <GitBranch size={14} className="text-secondary" />
              <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">Git Status</span>
            </div>
            <span className="text-[10px] font-mono text-secondary uppercase tracking-widest">main</span>
          </div>
          <div className="p-4 flex-1 flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface-container-low p-3 rounded border border-outline-variant/5">
                <div className="flex items-center gap-2 text-on-surface-variant mb-1">
                  <GitCommit size={12} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Commits</span>
                </div>
                <span className="text-xl font-headline font-bold">142</span>
              </div>
              <div className="bg-surface-container-low p-3 rounded border border-outline-variant/5">
                <div className="flex items-center gap-2 text-on-surface-variant mb-1">
                  <GitPullRequest size={12} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">PRs</span>
                </div>
                <span className="text-xl font-headline font-bold">3</span>
              </div>
              <div className="bg-surface-container-low p-3 rounded border border-outline-variant/5">
                <div className="flex items-center gap-2 text-on-surface-variant mb-1">
                  <Clock size={12} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Uptime</span>
                </div>
                <span className="text-xl font-headline font-bold">12d</span>
              </div>
            </div>
            
            <div className="flex-1 space-y-2 overflow-y-auto scroll-hide">
              <div className="flex items-center justify-between p-2 bg-surface-container-high/30 rounded border border-outline-variant/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                    <GitCommit size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold">feat: implement pm agent</p>
                    <p className="text-[10px] text-on-surface-variant opacity-60">2 hours ago • neuro-bot</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-outline">a3f2d1</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-surface-container-high/30 rounded border border-outline-variant/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-secondary/10 flex items-center justify-center text-secondary">
                    <GitCommit size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold">fix: i18n missing keys</p>
                    <p className="text-[10px] text-on-surface-variant opacity-60">5 hours ago • neuro-bot</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-outline">b7e9c4</span>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="col-span-12 lg:col-span-6 grid grid-cols-2 gap-4">
          <div className="bg-surface-container p-5 rounded flex flex-col">
            <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">Task Completion</h4>
            <div className="flex-1 flex items-end gap-2 pb-2">
              <div className="flex-1 bg-primary/20 hover:bg-primary transition-all rounded-t-sm" style={{ height: '40%' }}></div>
              <div className="flex-1 bg-primary/20 hover:bg-primary transition-all rounded-t-sm" style={{ height: '65%' }}></div>
              <div className="flex-1 bg-primary/20 hover:bg-primary transition-all rounded-t-sm" style={{ height: '55%' }}></div>
              <div className="flex-1 bg-primary/20 hover:bg-primary transition-all rounded-t-sm" style={{ height: '85%' }}></div>
              <div className="flex-1 bg-primary/20 hover:bg-primary transition-all rounded-t-sm" style={{ height: '70%' }}></div>
              <div className="flex-1 bg-primary/20 hover:bg-primary transition-all rounded-t-sm" style={{ height: '90%' }}></div>
              <div className="flex-1 bg-primary-container rounded-t-sm" style={{ height: '100%' }}></div>
            </div>
            <div className="flex justify-between text-[8px] text-outline font-mono mt-2 uppercase">
              <span>Mon</span>
              <span>Today</span>
            </div>
          </div>
          <div className="bg-surface-container p-5 rounded flex flex-col relative overflow-hidden">
            <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">Skill Affinity</h4>
            <div className="space-y-3 mt-2">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]"><span>Python Dev</span><span>92%</span></div>
                <div className="w-full bg-surface-container-lowest h-1 rounded-full">
                  <div className="bg-secondary h-full rounded-full" style={{ width: '92%' }}></div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]"><span>Logic Reasoning</span><span>78%</span></div>
                <div className="w-full bg-surface-container-lowest h-1 rounded-full">
                  <div className="bg-primary-container h-full rounded-full" style={{ width: '78%' }}></div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]"><span>Data Analysis</span><span>45%</span></div>
                <div className="w-full bg-surface-container-lowest h-1 rounded-full">
                  <div className="bg-tertiary h-full rounded-full" style={{ width: '45%' }}></div>
                </div>
              </div>
            </div>
            <Brain size={72} className="absolute -bottom-4 -right-4 text-on-surface opacity-5" />
          </div>
          <div className="col-span-2 bg-gradient-to-r from-primary-container/10 to-transparent p-4 rounded border border-primary/10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-container-highest flex items-center justify-center">
                <Bot size={30} className="text-primary" />
              </div>
              <div>
                <h5 className="text-sm font-bold">Local AI Cluster Status</h5>
                <p className="text-xs text-on-surface-variant">Orchestrating 3 sub-agents across distributed compute nodes.</p>
              </div>
            </div>
            <button className="text-xs font-headline font-bold text-primary flex items-center gap-1 hover:underline">
              {t('missionControl.manageAgents')} <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
