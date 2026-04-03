import { useState, useCallback } from 'react';
import type { RoutingConfig, RoutingDecision, FallbackLogEntry } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) return undefined as unknown as T;
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args);
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface SmartRouterState {
  /** Current routing configuration. */
  config: RoutingConfig | null;
  /** Recent routing decisions. */
  decisions: RoutingDecision[];
  /** Recent fallback log entries. */
  fallbackLog: FallbackLogEntry[];
  /** Last error. */
  error: string | null;
  /** Whether an operation is in progress. */
  loading: boolean;
  /** Load the routing configuration. */
  loadConfig: () => Promise<void>;
  /** Submit a task for routing (returns the routing decision). */
  routeTask: (taskSummary: string, preferredRuntime?: string) => Promise<RoutingDecision>;
  /** Update the routing configuration. */
  updateConfig: (config: RoutingConfig) => Promise<void>;
  /** Load recent routing decisions. */
  loadDecisions: () => Promise<void>;
  /** Load recent fallback log. */
  loadFallbackLog: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSmartRouter(): SmartRouterState {
  const [config, setConfig] = useState<RoutingConfig | null>(null);
  const [decisions, setDecisions] = useState<RoutingDecision[]>([]);
  const [fallbackLog, setFallbackLog] = useState<FallbackLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // --- Config operations ---

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isTauri) {
        const cfg = await invoke<RoutingConfig>('get_routing_config');
        setConfig(cfg);
      } else {
        // Dev fallback
        setConfig({
          rules: [
            { category: 'code_generation', runtime_id: 'claude-code', priority: 1, fallback_chain: ['codex'] },
            { category: 'code_review', runtime_id: 'claude-code', priority: 1, fallback_chain: ['codex'] },
            { category: 'requirements', runtime_id: 'claude-code', priority: 1, fallback_chain: [] },
            { category: 'testing', runtime_id: 'claude-code', priority: 1, fallback_chain: ['codex'] },
            { category: 'general', runtime_id: 'claude-code', priority: 1, fallback_chain: ['codex'] },
          ],
          default_runtime: 'claude-code',
          default_fallback_chain: ['codex'],
        });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const routeTask = useCallback(async (taskSummary: string, preferredRuntime?: string): Promise<RoutingDecision> => {
    setLoading(true);
    setError(null);
    try {
      if (isTauri) {
        const decision = await invoke<RoutingDecision>('route_task', {
          taskSummary,
          preferredRuntime: preferredRuntime ?? null,
        });
        setDecisions(prev => [decision, ...prev].slice(0, 50));
        return decision;
      } else {
        // Dev fallback: simulate routing
        const decision: RoutingDecision = {
          decision_id: `route-${Date.now().toString(36)}`,
          category: 'general',
          category_label: 'General',
          selected_runtime: preferredRuntime ?? 'claude-code',
          fallback_used: false,
          original_preference: preferredRuntime ?? null,
          reason: 'Default routing based on task type',
          timestamp: new Date().toISOString(),
        };
        setDecisions(prev => [decision, ...prev].slice(0, 50));
        return decision;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (newConfig: RoutingConfig) => {
    setLoading(true);
    setError(null);
    try {
      if (isTauri) {
        await invoke('update_routing_config', { config: newConfig });
      }
      setConfig(newConfig);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDecisions = useCallback(async () => {
    try {
      if (isTauri) {
        const list = await invoke<RoutingDecision[]>('list_routing_decisions');
        setDecisions(list);
      } else {
        // Dev fallback: use existing state (already populated by routeTask)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const loadFallbackLog = useCallback(async () => {
    try {
      if (isTauri) {
        const list = await invoke<FallbackLogEntry[]>('list_fallback_log');
        setFallbackLog(list);
      } else {
        // Dev fallback
        setFallbackLog([]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return {
    config,
    decisions,
    fallbackLog,
    error,
    loading,
    loadConfig,
    routeTask,
    updateConfig,
    loadDecisions,
    loadFallbackLog,
  };
}
