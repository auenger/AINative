import { useState, useEffect, useCallback } from 'react';
import type { AppSettings, SdkRuntimeConfig, RigProviderConfig } from '../types';

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
// Default settings (used as fallback in dev mode)
// ---------------------------------------------------------------------------

const DEFAULT_SDK_RUNTIME: SdkRuntimeConfig = {
  config_mode: 'claude-config',
  custom_provider: '',
  custom_model: '',
};

const DEFAULT_RIG: RigProviderConfig = {
  provider: '',
  api_key: '',
  base_url: '',
  model: '',
};

const DEFAULT_SETTINGS: AppSettings = {
  providers: {
    zai: {
      api_key: '',
      api_base: 'https://open.bigmodel.cn/api/coding/paas/v4',
    },
  },
  llm: {
    provider: 'zai',
    model: 'glm-4.7',
    max_tokens: 2000,
    temperature: 0.7,
    context_window_tokens: 128000,
    compaction_trigger_ratio: 0.75,
    compaction_keep_recent: 4,
    compaction_strategy: 'sliding_window',
  },
  app: {
    auto_refresh_interval: 30,
  },
  user: {
    name: '',
    email: '',
    avatar_base64: '',
  },
  terminal: {
    default_shell: '',
  },
  agent_runtime: 'claude-code',
  sdk_runtime: { ...DEFAULT_SDK_RUNTIME },
  rig: { ...DEFAULT_RIG },
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  /** Load settings from backend (or dev fallback). */
  const load = useCallback(async (signal?: AbortSignal) => {
    // If user has unsaved edits, skip reload to avoid overwriting their work
    if (dirty) return;

    setLoading(true);
    setError(null);

    try {
      const loaded = await invoke<AppSettings>('read_settings');

      // Discard result if the caller has moved on (e.g. StrictMode re-fire)
      if (signal?.aborted) return;

      // Merge with defaults so new fields are always present
      setSettings({
        providers: { ...DEFAULT_SETTINGS.providers, ...loaded.providers },
        llm: { ...DEFAULT_SETTINGS.llm, ...loaded.llm },
        app: { ...DEFAULT_SETTINGS.app, ...loaded.app },
        user: { ...DEFAULT_SETTINGS.user, ...loaded.user },
        terminal: { ...DEFAULT_SETTINGS.terminal, ...loaded.terminal },
        agent_runtime: loaded.agent_runtime || DEFAULT_SETTINGS.agent_runtime,
        sdk_runtime: { ...DEFAULT_SDK_RUNTIME, ...loaded.sdk_runtime },
        rig: { ...DEFAULT_RIG, ...loaded.rig },
      });
      setDirty(false);
    } catch (e: unknown) {
      if (signal?.aborted) return;
      // In dev mode (no Tauri), just use defaults silently
      if (isTauri) {
        setError(e instanceof Error ? e.message : String(e));
      }
      setSettings(DEFAULT_SETTINGS);
      setDirty(false);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [dirty]);

  /** Persist current settings to backend. */
  const save = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await invoke('write_settings', { settings });
      setDirty(false);
    } catch (e: unknown) {
      if (isTauri) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setLoading(false);
    }
  }, [settings]);

  /** Update a partial slice of settings and mark as dirty. */
  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev };
      if (patch.providers !== undefined) next.providers = patch.providers;
      if (patch.llm !== undefined) next.llm = { ...prev.llm, ...patch.llm };
      if (patch.app !== undefined) next.app = { ...prev.app, ...patch.app };
      if (patch.user !== undefined) next.user = { ...prev.user, ...patch.user };
      if (patch.terminal !== undefined) next.terminal = { ...prev.terminal, ...patch.terminal };
      if (patch.agent_runtime !== undefined) next.agent_runtime = patch.agent_runtime;
      if (patch.sdk_runtime !== undefined) next.sdk_runtime = { ...prev.sdk_runtime, ...patch.sdk_runtime };
      if (patch.rig !== undefined) next.rig = { ...prev.rig, ...patch.rig };
      return next;
    });
    setDirty(true);
  }, []);

  // Load on mount — AbortController ensures StrictMode double-fire is handled
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return {
    settings,
    loading,
    error,
    dirty,
    load,
    save,
    update,
    setSettings,
  };
}
