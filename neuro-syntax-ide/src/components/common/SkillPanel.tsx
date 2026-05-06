import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Package, Download, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ReadinessReport, PluginInfo, InstallResult, SkillStatus } from '../../types';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const SkillPanel: React.FC<{ workspacePath?: string }> = ({ workspacePath }) => {
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [pluginInfo, setPluginInfo] = useState<PluginInfo | null>(null);
  const [status, setStatus] = useState<SkillStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<InstallResult | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isTauri) { setLoading(false); return; }
    setLoading(true);
    try {
      const [r, p, s] = await Promise.all([
        workspacePath
          ? invoke<ReadinessReport>('check_skill_readiness', { projectPath: workspacePath })
          : Promise.resolve(null),
        invoke<PluginInfo>('get_bundled_plugin_info'),
        workspacePath
          ? invoke<SkillStatus>('scan_installed_skills', { projectPath: workspacePath })
          : Promise.resolve(null),
      ]);
      if (r) setReport(r);
      setPluginInfo(p);
      if (s) setStatus(s);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleInstall = async () => {
    if (!workspacePath) return;
    setInstalling(true);
    setInstallResult(null);
    try {
      const r = await invoke<InstallResult>('install_bundled_skills', {
        projectPath: workspacePath,
      });
      setInstallResult(r);
      refresh();
    } catch (e) {
      setInstallResult({
        success: false,
        installed: 0,
        skipped: 0,
        updated: 0,
        errors: [String(e)],
      });
    } finally {
      setInstalling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Plugin Info Card */}
      {pluginInfo && (
        <div className="config-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-primary" />
              <span className="text-sm font-semibold text-on-surface">{pluginInfo.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                v{pluginInfo.version}
              </span>
            </div>
            <button
              onClick={refresh}
              className="text-on-surface-variant hover:text-on-surface cursor-pointer"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <p className="text-xs text-on-surface-variant mb-3">{pluginInfo.description}</p>
          <div className="flex gap-4 text-xs text-on-surface-variant">
            <span>{pluginInfo.skill_count} Skills</span>
            <span>{pluginInfo.command_count} Commands</span>
            <span>{pluginInfo.agent_count} Agents</span>
          </div>
        </div>
      )}

      {/* Readiness Status */}
      {report && (
        <div className="config-card">
          <h3 className="text-sm font-semibold text-on-surface mb-3">Readiness Status</h3>
          <div className="flex items-center gap-3 mb-3">
            <div className={cn(
              'w-2.5 h-2.5 rounded-full',
              report.ready ? 'bg-green-400' : report.installed.length > 0 ? 'bg-yellow-400' : 'bg-red-400',
            )} />
            <span className={cn(
              'text-sm font-medium',
              report.ready ? 'text-green-400' : report.installed.length > 0 ? 'text-yellow-400' : 'text-red-400',
            )}>
              {report.ready ? 'All skills installed' : `${report.missing.length} missing`}
            </span>
            <span className="text-xs text-on-surface-variant">
              ({report.installed.length}/{report.total_required})
            </span>
          </div>

          {/* Missing skills list */}
          {report.missing.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-on-surface-variant mb-2">Missing:</div>
              <div className="flex flex-wrap gap-1.5">
                {report.missing.map((m) => (
                  <span key={m} className="text-[10px] px-2 py-0.5 rounded bg-error/10 text-error border border-error/20">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Installed list */}
          {status && (
            <div>
              <div className="text-xs text-on-surface-variant mb-2">Installed:</div>
              <div className="flex flex-wrap gap-1.5">
                {report.installed.map((s) => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                    <CheckCircle2 size={8} className="inline mr-1" />
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Install Actions */}
      <div className="config-card">
        <div className="flex items-center gap-3">
          <button
            onClick={handleInstall}
            disabled={installing || !workspacePath}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              installing || !workspacePath
                ? 'bg-surface-container-highest text-on-surface-variant cursor-not-allowed'
                : 'bg-primary text-on-primary hover:bg-primary/90 cursor-pointer',
            )}
          >
            {installing ? (
              <><Loader2 size={14} className="animate-spin" /> Installing...</>
            ) : (
              <><Download size={14} /> Reinstall All Skills</>
            )}
          </button>
          {!workspacePath && (
            <span className="text-xs text-on-surface-variant">Open a workspace first</span>
          )}
        </div>

        {installResult && (
          <div className={cn(
            'mt-3 px-3 py-2 rounded-md text-xs',
            installResult.success
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-error/10 text-error border border-error/20',
          )}>
            {installResult.success ? (
              <span>Installed: {installResult.installed} | Skipped: {installResult.skipped} | Updated: {installResult.updated}</span>
            ) : (
              <span>Error: {installResult.errors.join('; ')}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
