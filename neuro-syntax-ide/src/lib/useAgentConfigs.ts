import { useState, useCallback } from 'react';
import type { AgentConfig } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const STORAGE_KEY = 'neuro_agent_configs';

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) return undefined as unknown as T;
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args);
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface AgentConfigsState {
  /** All saved agent configs. */
  agents: AgentConfig[];
  /** Last error. */
  error: string | null;
  /** Whether an operation is in progress. */
  loading: boolean;
  /** Load all agent configs. */
  loadAgents: () => Promise<void>;
  /** Create or update an agent config. */
  saveAgent: (agent: AgentConfig) => Promise<void>;
  /** Delete an agent config by id. */
  deleteAgent: (id: string) => Promise<void>;
  /** Get a single agent by id. */
  getAgent: (id: string) => AgentConfig | undefined;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAgentConfigs(): AgentConfigsState {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isTauri) {
        const list = await invoke<AgentConfig[]>('list_agent_configs');
        setAgents(list);
      } else {
        // Dev fallback: load from localStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setAgents(JSON.parse(stored));
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const saveAgent = useCallback(async (agent: AgentConfig) => {
    setLoading(true);
    setError(null);
    try {
      if (isTauri) {
        await invoke('save_agent_config', { config: agent });
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        const existing: AgentConfig[] = stored ? JSON.parse(stored) : [];
        const idx = existing.findIndex(a => a.id === agent.id);
        if (idx >= 0) existing[idx] = agent;
        else existing.push(agent);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      }
      setAgents(prev => {
        const idx = prev.findIndex(a => a.id === agent.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = agent;
          return next;
        }
        return [...prev, agent];
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAgent = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      if (isTauri) {
        await invoke('delete_agent_config', { id });
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const existing: AgentConfig[] = JSON.parse(stored);
          const filtered = existing.filter(a => a.id !== id);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        }
      }
      setAgents(prev => prev.filter(a => a.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const getAgent = useCallback((id: string): AgentConfig | undefined => {
    return agents.find(a => a.id === id);
  }, [agents]);

  return {
    agents,
    error,
    loading,
    loadAgents,
    saveAgent,
    deleteAgent,
    getAgent,
  };
}
