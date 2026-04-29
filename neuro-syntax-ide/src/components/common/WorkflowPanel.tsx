import React, { useState, useCallback } from 'react';
import { Layers, GitBranch, Archive, Minus, Plus, RotateCcw, Save, CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { useWorkflowConfig } from '../../lib/useWorkflowConfig';
import type { WorkflowConfig } from '../../types';

// ---------------------------------------------------------------------------
// Toggle switch component (reuses SettingsView pattern)
// ---------------------------------------------------------------------------

function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-on-surface-variant">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/40',
          checked ? 'bg-primary' : 'bg-surface-container-highest',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out',
            checked ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Number stepper component
// ---------------------------------------------------------------------------

function NumberStepper({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  label: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-on-surface-variant">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          className={cn(
            'w-6 h-6 rounded flex items-center justify-center text-on-surface-variant transition-colors',
            value <= min ? 'opacity-30 cursor-not-allowed' : 'hover:bg-surface-container-high',
          )}
        >
          <Minus size={14} />
        </button>
        <span className="text-sm font-mono font-bold text-primary w-6 text-center">{value}</span>
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          className={cn(
            'w-6 h-6 rounded flex items-center justify-center text-on-surface-variant transition-colors',
            value >= max ? 'opacity-30 cursor-not-allowed' : 'hover:bg-surface-container-high',
          )}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkflowPanel — Settings > Workflow tab
// ---------------------------------------------------------------------------

export const WorkflowPanel: React.FC = () => {
  const { t } = useTranslation();
  const { config, loading, error, dirty, save, update, reset } = useWorkflowConfig();
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = useCallback(async () => {
    await save();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  }, [save]);

  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  const updateParallelism = useCallback((patch: Partial<WorkflowConfig['parallelism']>) => {
    update({ parallelism: patch });
  }, [update]);

  const updateWorkflow = useCallback((patch: Partial<WorkflowConfig['workflow']>) => {
    update({ workflow: patch });
  }, [update]);

  const updateGit = useCallback((patch: Partial<WorkflowConfig['git']>) => {
    update({ git: patch });
  }, [update]);

  const updateArchive = useCallback((patch: Partial<WorkflowConfig['completion']['archive']>) => {
    update({ completion: { archive: patch } });
  }, [update]);

  const updateCleanup = useCallback((patch: Partial<WorkflowConfig['completion']['cleanup']>) => {
    update({ completion: { cleanup: patch } });
  }, [update]);

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <h3 className="config-section-title flex items-center gap-2 !text-sm !tracking-normal !opacity-100 !text-on-surface !mb-0">
          <Layers size={14} className="text-primary" />
          {t('settings.workflow.title')}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={loading || !dirty}
            className={cn(
              'config-action-btn flex items-center gap-1',
              dirty && !loading
                ? 'text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/20'
                : 'text-on-surface-variant opacity-30 cursor-not-allowed border border-transparent',
            )}
          >
            <RotateCcw size={12} />
            {t('settings.workflow.reset')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || !dirty}
            className={cn(
              'config-action-btn flex items-center gap-1',
              dirty && !loading
                ? 'text-primary hover:bg-primary/10 border border-primary/30'
                : 'text-on-surface-variant opacity-30 cursor-not-allowed border border-transparent',
            )}
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 size={12} className="text-green-500" />
            ) : (
              <Save size={12} />
            )}
            {saveSuccess ? t('settings.saved') : t('settings.save')}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-error/10 border border-error/20 rounded-md text-xs text-error">
          {error}
        </div>
      )}

      {/* Group 1: Parallelism & Automation */}
      <div className="config-card">
        <h3 className="text-sm font-headline font-bold text-on-surface mb-1 flex items-center gap-2">
          <Layers size={14} className="text-primary" />
          {t('settings.workflow.parallelism')}
        </h3>
        <p className="text-xs text-on-surface-variant opacity-60 mb-4">
          {t('settings.workflow.parallelismDesc')}
        </p>

        <div className="space-y-3">
          <NumberStepper
            value={config.parallelism.max_concurrent}
            onChange={(v) => updateParallelism({ max_concurrent: v })}
            min={1}
            max={5}
            label={t('settings.workflow.maxConcurrent')}
          />
          <Toggle
            checked={config.workflow.auto_start}
            onChange={(v) => updateWorkflow({ auto_start: v })}
            label={t('settings.workflow.autoStart')}
          />
          <Toggle
            checked={config.workflow.auto_start_next}
            onChange={(v) => updateWorkflow({ auto_start_next: v })}
            label={t('settings.workflow.autoStartNext')}
          />
        </div>
      </div>

      {/* Group 2: Git Behavior */}
      <div className="config-card">
        <h3 className="text-sm font-headline font-bold text-on-surface mb-1 flex items-center gap-2">
          <GitBranch size={14} className="text-primary" />
          {t('settings.workflow.gitBehavior')}
        </h3>
        <p className="text-xs text-on-surface-variant opacity-60 mb-4">
          {t('settings.workflow.gitBehaviorDesc')}
        </p>

        <div className="space-y-3">
          <Toggle
            checked={config.git.auto_push}
            onChange={(v) => updateGit({ auto_push: v })}
            label={t('settings.workflow.autoPush')}
          />
          <Toggle
            checked={config.git.push_tags}
            onChange={(v) => updateGit({ push_tags: v })}
            label={t('settings.workflow.pushTags')}
          />
        </div>
      </div>

      {/* Group 3: Completion & Cleanup */}
      <div className="config-card">
        <h3 className="text-sm font-headline font-bold text-on-surface mb-1 flex items-center gap-2">
          <Archive size={14} className="text-primary" />
          {t('settings.workflow.completion')}
        </h3>
        <p className="text-xs text-on-surface-variant opacity-60 mb-4">
          {t('settings.workflow.completionDesc')}
        </p>

        <div className="space-y-3">
          <Toggle
            checked={config.completion.archive.create_tag}
            onChange={(v) => updateArchive({ create_tag: v })}
            label={t('settings.workflow.createTag')}
          />
          <div className="border-t border-outline-variant/10 my-2" />
          <Toggle
            checked={config.completion.cleanup.delete_worktree}
            onChange={(v) => updateCleanup({ delete_worktree: v })}
            label={t('settings.workflow.deleteWorktree')}
          />
          <Toggle
            checked={config.completion.cleanup.delete_branch}
            onChange={(v) => updateCleanup({ delete_branch: v })}
            label={t('settings.workflow.deleteBranch')}
          />
        </div>
      </div>
    </div>
  );
};
