import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Package, Download, Loader2, CheckCircle2, XCircle, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { InstallResult, ReadinessReport } from '../types';

interface SkillInitPromptProps {
  workspacePath: string;
  report: ReadinessReport;
  onDismiss?: () => void;
  onInstalled?: () => void;
}

export const SkillInitPrompt: React.FC<SkillInitPromptProps> = ({
  workspacePath,
  report,
  onDismiss,
  onInstalled,
}) => {
  const [installing, setInstalling] = useState(false);
  const [result, setResult] = useState<InstallResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || report.ready) return null;

  const handleInstall = async () => {
    setInstalling(true);
    setResult(null);
    try {
      const r = await invoke<InstallResult>('install_bundled_skills', {
        projectPath: workspacePath,
      });
      setResult(r);
      if (r.success) {
        onInstalled?.();
      }
    } catch (e) {
      setResult({
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

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className={cn(
      'mx-4 mb-3 rounded-lg border transition-all',
      'bg-surface-container-low border-outline-variant/20',
      result?.success ? 'border-green-500/30' : 'border-yellow-500/30',
    )}>
      <div className="flex items-start gap-3 p-3">
        <div className={cn(
          'p-1.5 rounded-md',
          result?.success ? 'bg-green-500/10' : 'bg-yellow-500/10',
        )}>
          {result?.success ? (
            <CheckCircle2 size={16} className="text-green-400" />
          ) : (
            <Package size={16} className="text-yellow-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-on-surface">
            {result?.success
              ? 'Skills installed successfully'
              : `${report.missing.length} skill(s) missing`}
          </div>

          {result ? (
            <div className="mt-1 text-xs text-on-surface-variant space-y-0.5">
              <div>{result.installed} installed, {result.skipped} skipped, {result.updated} updated</div>
              {result.errors.length > 0 && (
                <div className="text-error">{result.errors.join('; ')}</div>
              )}
            </div>
          ) : (
            <div className="mt-1 text-xs text-on-surface-variant">
              Feature Workflow requires skills to operate. Click to install from bundled resources.
            </div>
          )}

          {!result?.success && (
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={handleInstall}
                disabled={installing}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all',
                  installing
                    ? 'bg-surface-container-highest text-on-surface-variant cursor-not-allowed'
                    : 'bg-primary text-on-primary hover:bg-primary/90 cursor-pointer',
                )}
              >
                {installing ? (
                  <><Loader2 size={12} className="animate-spin" /> Installing...</>
                ) : (
                  <><Download size={12} /> Install All</>
                )}
              </button>
              {!installing && (
                <button
                  onClick={handleDismiss}
                  className="text-xs text-on-surface-variant hover:text-on-surface cursor-pointer"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}

          {result?.success && (
            <button
              onClick={handleDismiss}
              className="mt-2 text-xs text-primary hover:underline cursor-pointer"
            >
              OK
            </button>
          )}

          {result && !result.success && (
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={handleInstall}
                disabled={installing}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-primary text-on-primary hover:bg-primary/90 cursor-pointer"
              >
                <Download size={12} /> Retry
              </button>
              <button
                onClick={handleDismiss}
                className="text-xs text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleDismiss}
          className="text-on-surface-variant hover:text-on-surface cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
