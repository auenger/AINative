import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Target, Activity, Terminal, Brain, ArrowRight, Bot, GitBranch, GitCommit, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { HardwareStats, GitStats, RecentCommit } from '../../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HISTORY_LENGTH = 60; // keep 60 data points (60 seconds)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Health status derived from CPU usage thresholds. */
function getHealthStatus(cpu: number): { label: string; color: string; dotClass: string } {
  if (cpu > 95) return { label: 'CRITICAL', color: 'text-error', dotClass: 'bg-error' };
  if (cpu > 80) return { label: 'WARNING', color: 'text-warning', dotClass: 'bg-warning' };
  return { label: 'NOMINAL', color: 'text-tertiary', dotClass: 'bg-tertiary' };
}

/** Render a tiny SVG sparkline from an array of 0-100 values. */
function Sparkline({ data, width = 100, height = 30, strokeClass = 'stroke-secondary' }: { data: number[]; width?: number; height?: number; strokeClass?: string }) {
  if (data.length < 2) return null;
  // Pad data to HISTORY_LENGTH so the viewBox always spans 60 logical slots,
  // preventing "jumpy" visuals when fewer points are available.
  const padded = [...Array(HISTORY_LENGTH - data.length).fill(null), ...data];
  const validPoints = padded.filter((v): v is number => v !== null);
  if (validPoints.length < 2) return null;
  const step = width / (HISTORY_LENGTH - 1);
  const points = padded
    .map((v, i) => (v !== null ? `${i * step},${height - (v / 100) * height}` : ''))
    .filter(Boolean)
    .join(' ');
  return (
    <svg
      className={`w-full h-full ${strokeClass} fill-none stroke-2`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <polyline points={points} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tauri helpers (safe no-op when running outside Tauri)
// ---------------------------------------------------------------------------

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) return undefined as unknown as T;
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args);
}

async function listen<T>(event: string, cb: (payload: T) => void): Promise<(() => void) | null> {
  if (!isTauri) return null;
  const { listen: tauriListen } = await import('@tauri-apps/api/event');
  const unlisten = await tauriListen<T>(event, (e) => cb(e.payload));
  return unlisten;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MissionControl: React.FC = () => {
  const { t } = useTranslation();

  // Hardware state
  const [hw, setHw] = useState<HardwareStats | null>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);
  const hwStarted = useRef(false);

  // Git state
  const [git, setGit] = useState<GitStats | null>(null);
  const [gitError, setGitError] = useState<string | null>(null);

  // ---------- Hardware monitor lifecycle ----------
  useEffect(() => {
    if (hwStarted.current) return;
    hwStarted.current = true;

    let unlistenFn: (() => void) | null = null;

    (async () => {
      // Listen for hardware tick events
      unlistenFn = (await listen<HardwareStats>('sys-hardware-tick', (payload) => {
        setHw(payload);
        setCpuHistory((prev) => [...prev.slice(-(HISTORY_LENGTH - 1)), payload.cpu_usage]);
        setMemHistory((prev) => [...prev.slice(-(HISTORY_LENGTH - 1)), payload.memory_percent]);
      })) ?? null;

      // Start the backend hardware monitor
      try {
        await invoke('start_hardware_monitor');
      } catch {
        // Not running in Tauri or command failed -- silently degrade
      }
    })();

    return () => {
      unlistenFn?.();
      invoke('stop_hardware_monitor').catch(() => {});
      hwStarted.current = false;
    };
  }, []);

  // ---------- Git stats fetch ----------
  const loadGitStats = useCallback(async () => {
    try {
      const stats = await invoke<GitStats>('fetch_git_stats');
      setGit(stats);
      setGitError(null);
    } catch (e) {
      setGitError(String(e));
    }
  }, []);

  useEffect(() => {
    loadGitStats();
    // Refresh git stats every 30 seconds
    const interval = setInterval(loadGitStats, 30_000);
    return () => clearInterval(interval);
  }, [loadGitStats]);

  // ---------- Derived values ----------
  const cpu = hw?.cpu_usage ?? 0;
  const memPct = hw?.memory_percent ?? 0;
  const health = getHealthStatus(cpu);

  // CPU bar segments (8 segments, each = 12.5%)
  const cpuSegments = Array.from({ length: 8 }, (_, i) => {
    const threshold = (i + 1) * 12.5;
    if (cpu >= threshold) return 'full';
    if (cpu >= threshold - 12.5) return 'partial';
    return 'empty';
  });

  // Memory bar color based on usage
  const memBarColor = memPct > 90 ? 'bg-error' : memPct > 70 ? 'bg-warning' : 'bg-tertiary';

  return (
    <div className="flex-1 p-6 overflow-y-auto scroll-hide bg-surface">
      <div className="flex items-end justify-between mb-8 border-b border-outline-variant pb-4">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface">{t('missionControl.title')}</h1>
          <p className="text-on-surface-variant text-sm font-label opacity-70">AI-Agent Active &bull; System Monitoring Environment</p>
        </div>
        <div className="flex gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-secondary opacity-60">Status</span>
            <div className="flex items-center gap-2">
              <span className={cn('w-2 h-2 rounded-full', health.dotClass, cpu > 80 && 'animate-pulse')}></span>
              <span className={cn('font-mono text-sm', health.color)}>{health.label}</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-secondary opacity-60">Uptime</span>
            <span className="font-mono text-sm text-on-surface-variant">{hw ? formatUptime(hw.uptime) : '--'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 auto-rows-min">
        {/* System Health Card */}
        <div className="col-span-12 lg:col-span-4 bg-surface-container-low p-5 rounded flex flex-col gap-6">
          <h3 className="font-headline font-bold flex items-center gap-2">
            <Activity size={16} />
            {t('missionControl.systemHealth')}
          </h3>

          {/* CPU */}
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-on-surface-variant">CPU UTILIZATION</span>
              <span className={cn(cpu > 80 ? 'text-error' : 'text-secondary')}>
                {cpu.toFixed(1)}%
              </span>
            </div>
            <div className="flex gap-1 h-3">
              {cpuSegments.map((seg, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex-1 transition-all duration-300',
                    seg === 'full' && (cpu > 80 ? 'bg-error' : 'bg-secondary') + ' opacity-100',
                    seg === 'partial' && (cpu > 80 ? 'bg-error' : 'bg-secondary') + ' opacity-50',
                    seg === 'empty' && 'bg-surface-container-highest',
                  )}
                ></div>
              ))}
            </div>
            {/* CPU sparkline */}
            <div className="w-full h-8 opacity-60">
              <Sparkline data={cpuHistory} strokeClass={cpu > 80 ? 'stroke-error' : 'stroke-secondary'} />
            </div>
          </div>

          {/* Memory */}
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-on-surface-variant">MEMORY USAGE</span>
              <span className="text-tertiary">
                {hw ? `${formatBytes(hw.memory_used)} / ${formatBytes(hw.memory_total)}` : '--'}
              </span>
            </div>
            <div className="w-full bg-surface-container-lowest h-1.5 overflow-hidden rounded-full">
              <div
                className={cn('h-full rounded-full transition-all duration-300', memBarColor)}
                style={{ width: `${memPct}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[10px] font-mono text-on-surface-variant">
              <span>{memPct.toFixed(1)}%</span>
              <span>{hw ? formatBytes(hw.memory_total - hw.memory_used) + ' free' : ''}</span>
            </div>
            {/* Memory sparkline */}
            <div className="w-full h-8 opacity-60">
              <Sparkline data={memHistory} strokeClass="stroke-tertiary" />
            </div>
          </div>
        </div>

        {/* Current Mission / Overview Card */}
        <div className="col-span-12 lg:col-span-8 glass-panel p-5 rounded">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-container/20 rounded">
                <Target size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="font-headline font-bold text-lg">System Overview</h3>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-tighter">Real-time hardware & repository monitoring</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-[10px] text-on-surface-variant uppercase">CPU</div>
                <span className={cn('font-mono text-2xl', cpu > 80 ? 'text-error' : 'text-primary')}>
                  {cpu.toFixed(0)}%
                </span>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-on-surface-variant uppercase">RAM</div>
                <span className={cn('font-mono text-2xl', memPct > 80 ? 'text-error' : 'text-tertiary')}>
                  {memPct.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          {/* Combined sparklines */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-surface-container/50 p-3 rounded">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">CPU History (60s)</h4>
              <div className="w-full h-16">
                <Sparkline data={cpuHistory} height={60} strokeClass={cpu > 80 ? 'stroke-error' : 'stroke-secondary'} />
              </div>
            </div>
            <div className="bg-surface-container/50 p-3 rounded">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">Memory History (60s)</h4>
              <div className="w-full h-16">
                <Sparkline data={memHistory} height={60} strokeClass="stroke-tertiary" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="flex flex-col">
              <span className="text-[10px] text-on-surface-variant uppercase">System Uptime</span>
              <span className="text-lg font-headline font-medium">{hw ? formatUptime(hw.uptime) : '--'}</span>
            </div>
            <div className="flex flex-col border-l border-outline-variant/30 pl-4">
              <span className="text-[10px] text-on-surface-variant uppercase">CPU Cores</span>
              <span className="text-lg font-headline font-medium">{cpuHistory.length > 0 ? 'Live' : 'Waiting'}</span>
            </div>
            <div className="flex flex-col border-l border-outline-variant/30 pl-4">
              <span className="text-[10px] text-on-surface-variant uppercase">Refresh Rate</span>
              <span className="text-lg font-headline font-medium">1s</span>
            </div>
            <div className="flex flex-col border-l border-outline-variant/30 pl-4">
              <span className="text-[10px] text-on-surface-variant uppercase">Health</span>
              <span className={cn('text-lg font-headline font-medium', health.color)}>{health.label}</span>
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
            {hw ? (
              <>
                <div className="flex gap-4">
                  <span className="text-outline">{new Date().toLocaleTimeString('en-GB', { hour12: false })}</span>
                  <span className="text-secondary">[INFO]</span>
                  <span className="text-on-surface-variant">Hardware monitor active. Polling every 1s.</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-outline">{new Date().toLocaleTimeString('en-GB', { hour12: false })}</span>
                  <span className="text-tertiary">[SUCCESS]</span>
                  <span className="text-on-surface-variant">CPU: {cpu.toFixed(1)}% | Memory: {formatBytes(hw.memory_used)} / {formatBytes(hw.memory_total)}</span>
                </div>
                {cpu > 80 && (
                  <div className="flex gap-4">
                    <span className="text-outline">{new Date().toLocaleTimeString('en-GB', { hour12: false })}</span>
                    <span className="text-error">[WARN]</span>
                    <span className="text-error">High CPU usage detected: {cpu.toFixed(1)}%</span>
                  </div>
                )}
                {memPct > 85 && (
                  <div className="flex gap-4">
                    <span className="text-outline">{new Date().toLocaleTimeString('en-GB', { hour12: false })}</span>
                    <span className="text-error">[WARN]</span>
                    <span className="text-error">High memory usage: {memPct.toFixed(1)}%</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex gap-4 opacity-60">
                <span className="text-outline">--:--:--</span>
                <span className="text-primary">[SYSTEM]</span>
                <span className="text-on-surface-variant">Waiting for hardware monitor...</span>
              </div>
            )}
            {gitError && (
              <div className="flex gap-4">
                <span className="text-outline">{new Date().toLocaleTimeString('en-GB', { hour12: false })}</span>
                <span className="text-error">[WARN]</span>
                <span className="text-error">Git: {gitError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Git Status Card */}
        <div className="col-span-12 lg:col-span-6 bg-surface-container-lowest p-0 rounded-lg overflow-hidden border border-outline-variant/10 flex flex-col">
          <div className="bg-surface-container-highest px-4 py-2 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <GitBranch size={14} className="text-secondary" />
              <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">Git Status</span>
            </div>
            <span className="text-[10px] font-mono text-secondary uppercase tracking-widest">
              {git?.current_branch ?? '--'}
            </span>
          </div>
          <div className="p-4 flex-1 flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface-container-low p-3 rounded border border-outline-variant/5">
                <div className="flex items-center gap-2 text-on-surface-variant mb-1">
                  <GitCommit size={12} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Commits (7d)</span>
                </div>
                <span className="text-xl font-headline font-bold">{git?.commits_7d ?? '--'}</span>
              </div>
              <div className="bg-surface-container-low p-3 rounded border border-outline-variant/5">
                <div className="flex items-center gap-2 text-on-surface-variant mb-1">
                  <Activity size={12} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Changed</span>
                </div>
                <span className="text-xl font-headline font-bold">{git?.changed_files ?? '--'}</span>
              </div>
              <div className="bg-surface-container-low p-3 rounded border border-outline-variant/5">
                <div className="flex items-center gap-2 text-on-surface-variant mb-1">
                  <Clock size={12} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Uptime</span>
                </div>
                <span className="text-xl font-headline font-bold">{hw ? formatUptime(hw.uptime) : '--'}</span>
              </div>
            </div>

            {/* Recent commits */}
            <div className="flex-1 space-y-2 overflow-y-auto scroll-hide">
              {git?.recent_commits.length ? git.recent_commits.map((c: RecentCommit, idx: number) => (
                <div key={c.short_hash} className="flex items-center justify-between p-2 bg-surface-container-high/30 rounded border border-outline-variant/5">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-8 h-8 rounded flex items-center justify-center', idx === 0 ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary')}>
                      <GitCommit size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold">{c.message}</p>
                      <p className="text-[10px] text-on-surface-variant opacity-60">{c.time_ago} &bull; {c.author}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-outline">{c.short_hash}</span>
                </div>
              )) : (
                <div className="text-center text-on-surface-variant text-xs py-4 opacity-50">
                  {gitError ? 'No Git repository found' : 'Loading git stats...'}
                </div>
              )}
            </div>

            {/* Contributors */}
            {git && git.contributors.length > 0 && (
              <div className="border-t border-outline-variant/20 pt-3 space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Contributors (7d)</h4>
                <div className="space-y-1">
                  {git.contributors.map((c) => (
                    <div key={c.name} className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span>{c.name}</span>
                        <span>{c.commits} commits</span>
                      </div>
                      <div className="w-full bg-surface-container-lowest h-1 rounded-full">
                        <div
                          className="bg-secondary h-full rounded-full"
                          style={{ width: `${Math.min(100, (c.commits / Math.max(git.contributors[0].commits, 1)) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Charts */}
        <div className="col-span-12 lg:col-span-6 grid grid-cols-2 gap-4">
          <div className="bg-surface-container p-5 rounded flex flex-col">
            <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">CPU Trend (60s)</h4>
            <div className="flex-1 flex items-center justify-center pb-2">
              {cpuHistory.length > 1 ? (
                <Sparkline data={cpuHistory} width={200} height={80} strokeClass={cpu > 80 ? 'stroke-error' : 'stroke-secondary'} />
              ) : (
                <span className="text-[10px] text-on-surface-variant opacity-40">Collecting data...</span>
              )}
            </div>
            <div className="flex justify-between text-[8px] text-outline font-mono mt-2 uppercase">
              <span>60s ago</span>
              <span>Now</span>
            </div>
          </div>
          <div className="bg-surface-container p-5 rounded flex flex-col relative overflow-hidden">
            <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">Memory Trend (60s)</h4>
            <div className="flex-1 flex items-center justify-center">
              {memHistory.length > 1 ? (
                <Sparkline data={memHistory} width={200} height={80} strokeClass="stroke-tertiary" />
              ) : (
                <span className="text-[10px] text-on-surface-variant opacity-40">Collecting data...</span>
              )}
            </div>
            <div className="flex justify-between text-[8px] text-outline font-mono mt-2 uppercase">
              <span>60s ago</span>
              <span>Now</span>
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
                <p className="text-xs text-on-surface-variant">Hardware monitoring active. Data refreshes every second.</p>
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
