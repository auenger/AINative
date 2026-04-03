import { useState, useEffect, useCallback } from 'react';
import type { AppSettings } from '../types';

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
  },
  app: {
    auto_refresh_interval: 30,
  },
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
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const loaded = await invoke<AppSettings>('read_settings');
      // Merge with defaults so new fields are always present
      setSettings({
        providers: { ...DEFAULT_SETTINGS.providers, ...loaded.providers },
        llm: { ...DEFAULT_SETTINGS.llm, ...loaded.llm },
        app: { ...DEFAULT_SETTINGS.app, ...loaded.app },
      });
      setDirty(false);
    } catch (e: unknown) {
      // In dev mode (no Tauri), just use defaults silently
      if (isTauri) {
        setError(e instanceof Error ? e.message : String(e));
      }
      setSettings(DEFAULT_SETTINGS);
      setDirty(false);
    } finally {
      setLoading(false);
    }
  }, []);

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
      return next;
    });
    setDirty(true);
  }, []);

  // Load on mount
  useEffect(() => {
    load();
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
