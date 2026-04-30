import { useState, useEffect, useCallback } from 'react';
import type { WorkflowConfig } from '../types';

// ---------------------------------------------------------------------------
// Tauri helpers (safe no-op outside Tauri)
// ---------------------------------------------------------------------------

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) return undefined as unknown as T;
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args);
}

// ---------------------------------------------------------------------------
// Default workflow config (matches config.yaml defaults)
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: WorkflowConfig = {
  parallelism: { max_concurrent: 1 },
  workflow: { auto_start: false, auto_start_next: true },
  git: { auto_push: false, push_tags: true },
  completion: {
    archive: { create_tag: true },
    cleanup: { delete_worktree: true, delete_branch: true },
  },
};

const STORAGE_KEY = 'neuro-syntax-ide:workflow-config';
const CONFIG_REL_PATH = 'feature-workflow/config.yaml';

/** Resolve the absolute config path using the stored workspace. */
async function resolveConfigPath(): Promise<string | null> {
  if (!isTauri) return null;
  const ws = await invoke<{ path: string; valid: boolean }>('get_stored_workspace');
  return ws?.valid && ws.path ? `${ws.path}/${CONFIG_REL_PATH}` : null;
}

// ---------------------------------------------------------------------------
// Simple YAML parser for the config fields we care about
// ---------------------------------------------------------------------------

function parseWorkflowConfig(yaml: string): WorkflowConfig {
  const config: WorkflowConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  const lines = yaml.split('\n');
  let currentPath: string[] = [];

  for (const line of lines) {
    // Skip comments and empty lines
    const trimmed = line.trimEnd();
    if (!trimmed || trimmed.trimStart().startsWith('#')) continue;

    // Calculate indentation level
    const indent = line.length - line.trimStart().length;
    const content = trimmed.trimStart();

    // Parse key: value
    const match = content.match(/^([\w_-]+):\s*(.+)$/);
    if (match) {
      const key = match[1];
      const value = match[2].trim().replace(/['"]/g, '');

      // Determine path depth (2 spaces per level)
      const depth = Math.round(indent / 2);
      currentPath = currentPath.slice(0, depth);
      currentPath.push(key);

      // Navigate and set value
      const pathStr = currentPath.join('.');
      const numVal = Number(value);

      switch (pathStr) {
        case 'parallelism.max_concurrent':
          config.parallelism.max_concurrent = Number.isNaN(numVal) ? 1 : numVal;
          break;
        case 'workflow.auto_start':
          config.workflow.auto_start = value === 'true';
          break;
        case 'workflow.auto_start_next':
          config.workflow.auto_start_next = value === 'true';
          break;
        case 'git.auto_push':
          config.git.auto_push = value === 'true';
          break;
        case 'git.push_tags':
          config.git.push_tags = value === 'true';
          break;
        case 'completion.archive.create_tag':
          config.completion.archive.create_tag = value === 'true';
          break;
        case 'completion.cleanup.delete_worktree':
          config.completion.cleanup.delete_worktree = value === 'true';
          break;
        case 'completion.cleanup.delete_branch':
          config.completion.cleanup.delete_branch = value === 'true';
          break;
      }
    }
  }

  return config;
}

// ---------------------------------------------------------------------------
// Simple YAML serializer for the config fields we care about
// ---------------------------------------------------------------------------

function serializeWorkflowConfig(config: WorkflowConfig): string {
  return [
    '# feature-workflow/config.yaml',
    '# Auto-updated by Neuro Syntax IDE Settings',
    '',
    `parallelism:`,
    `  max_concurrent: ${config.parallelism.max_concurrent}`,
    '',
    `workflow:`,
    `  auto_start: ${config.workflow.auto_start}`,
    `  auto_start_next: ${config.workflow.auto_start_next}`,
    '',
    `git:`,
    `  auto_push: ${config.git.auto_push}`,
    `  push_tags: ${config.git.push_tags}`,
    '',
    `completion:`,
    `  archive:`,
    `    create_tag: ${config.completion.archive.create_tag}`,
    `  cleanup:`,
    `    delete_worktree: ${config.completion.cleanup.delete_worktree}`,
    `    delete_branch: ${config.completion.cleanup.delete_branch}`,
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWorkflowConfig() {
  const [config, setConfig] = useState<WorkflowConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  /** Load config from backend (or dev fallback). */
  const load = useCallback(async (signal?: AbortSignal) => {
    if (dirty) return;

    setLoading(true);
    setError(null);

    try {
      if (isTauri) {
        const configPath = await resolveConfigPath();
        if (!configPath) throw new Error('Workspace not configured');
        const yaml = await invoke<string>('read_file', {
          path: configPath,
        });
        if (signal?.aborted) return;
        const parsed = parseWorkflowConfig(yaml);
        setConfig(parsed);
      } else {
        // Dev fallback: read from localStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            setConfig(JSON.parse(stored));
          } catch {
            setConfig(DEFAULT_CONFIG);
          }
        }
      }
      setDirty(false);
    } catch (e: unknown) {
      if (signal?.aborted) return;
      if (isTauri) {
        setError(e instanceof Error ? e.message : String(e));
      }
      setConfig(DEFAULT_CONFIG);
      setDirty(false);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [dirty]);

  /** Persist current config to backend. */
  const save = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (isTauri) {
        const configPath = await resolveConfigPath();
        if (!configPath) throw new Error('Workspace not configured');
        const yaml = serializeWorkflowConfig(config);
        await invoke('write_file', {
          path: configPath,
          content: yaml,
        });
      } else {
        // Dev fallback: save to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      }
      setDirty(false);
    } catch (e: unknown) {
      if (isTauri) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setLoading(false);
    }
  }, [config]);

  /** Update a partial slice of config and mark as dirty. */
  const update = useCallback((patch: Partial<WorkflowConfig>) => {
    setConfig(prev => {
      const next = { ...prev };
      if (patch.parallelism !== undefined) next.parallelism = { ...prev.parallelism, ...patch.parallelism };
      if (patch.workflow !== undefined) next.workflow = { ...prev.workflow, ...patch.workflow };
      if (patch.git !== undefined) next.git = { ...prev.git, ...patch.git };
      if (patch.completion !== undefined) {
        next.completion = {
          archive: { ...prev.completion.archive, ...patch.completion.archive },
          cleanup: { ...prev.completion.cleanup, ...patch.completion.cleanup },
        };
      }
      return next;
    });
    setDirty(true);
  }, []);

  /** Reset to last saved state. */
  const reset = useCallback(() => {
    load();
  }, [load]);

  // Load on mount
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return {
    config,
    loading,
    error,
    dirty,
    load,
    save,
    update,
    reset,
  };
}
