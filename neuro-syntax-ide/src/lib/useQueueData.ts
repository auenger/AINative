import { useState, useEffect, useCallback, useRef } from 'react';
import type { TaskExecutionOverlay, GhostCard, QueueName } from '../types';

// ---------------------------------------------------------------------------
// Types matching Rust QueueState / FeatureNode / FsChangeEvent
// ---------------------------------------------------------------------------

export interface FeatureNode {
  id: string;
  name: string;
  priority: number;
  size: string;
  dependencies: string[];
  completed_at?: string;
  tag?: string;
  details?: {
    status: string;
    description?: string;
    plan?: string;
  };
}

export interface ParentEntry {
  id: string;
  name: string;
  features: string[];
}

export interface QueueMeta {
  last_updated: string;
  version: number;
}

export interface QueueState {
  meta: QueueMeta;
  parents: ParentEntry[];
  active: FeatureNode[];
  pending: FeatureNode[];
  blocked: FeatureNode[];
  completed: FeatureNode[];
}

export interface FsChangeEvent {
  paths: string[];
  kind: string;
}

// Re-export QueueName from types for backward compat
export type { QueueName };

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export function useQueueData() {
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number>(0); // seconds, 0 = disabled
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Overlay State (Layer A: execution overlays on existing cards) ───
  const [overlayState, setOverlayState] = useState<Map<string, TaskExecutionOverlay>>(new Map());
  const overlayCleanupTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ─── Ghost Card State (Layer B: new feature placeholders) ───
  const [ghostCards, setGhostCards] = useState<GhostCard[]>([]);

  /** Set or merge-update an overlay for a feature. */
  const setOverlay = useCallback((featureId: string, partial: Partial<TaskExecutionOverlay> & { action: TaskExecutionOverlay['action'] }) => {
    setOverlayState(prev => {
      const next = new Map(prev);
      const existing = next.get(featureId);
      const overlay: TaskExecutionOverlay = existing
        ? { ...existing, ...partial }
        : { featureId, status: partial.status ?? 'dispatching', startedAt: Date.now(), action: partial.action, ...partial };
      next.set(featureId, overlay);
      return next;
    });
  }, []);

  /** Clear overlay for a feature. */
  const clearOverlay = useCallback((featureId: string) => {
    // Clear any cleanup timer
    const timer = overlayCleanupTimers.current.get(featureId);
    if (timer) {
      clearTimeout(timer);
      overlayCleanupTimers.current.delete(featureId);
    }
    setOverlayState(prev => {
      const next = new Map(prev);
      next.delete(featureId);
      return next;
    });
  }, []);

  /** Set overlay to error status with auto-cleanup after 30s. */
  const setOverlayError = useCallback((featureId: string) => {
    setOverlay(featureId, { status: 'error', action: 'review' } as Partial<TaskExecutionOverlay> & { action: TaskExecutionOverlay['action'] });

    // Clear any existing timer
    const existing = overlayCleanupTimers.current.get(featureId);
    if (existing) clearTimeout(existing);

    // Auto-cleanup error overlay after 30s
    const timer = setTimeout(() => {
      setOverlayState(prev => {
        const next = new Map(prev);
        const overlay = next.get(featureId);
        if (overlay?.status === 'error') {
          next.delete(featureId);
        }
        return next;
      });
      overlayCleanupTimers.current.delete(featureId);
    }, 30000);
    overlayCleanupTimers.current.set(featureId, timer);
  }, [setOverlay]);

  /** Add a ghost card. */
  const addGhostCard = useCallback((ghost: Omit<GhostCard, 'startedAt'>) => {
    const newGhost: GhostCard = { ...ghost, startedAt: Date.now() };
    setGhostCards(prev => [...prev, newGhost]);
    return newGhost.tempId;
  }, []);

  /** Update a ghost card by tempId (merge). */
  const updateGhostCard = useCallback((tempId: string, partial: Partial<GhostCard>) => {
    setGhostCards(prev => prev.map(g => g.tempId === tempId ? { ...g, ...partial } : g));
  }, []);

  /** Remove a ghost card by tempId. */
  const removeGhostCard = useCallback((tempId: string) => {
    setGhostCards(prev => prev.filter(g => g.tempId !== tempId));
  }, []);

  /** Fetch the latest queue state from Rust backend. */
  const refresh = useCallback(async () => {
    if (!isTauri) {
      // Dev fallback: return mock data
      setQueueState({
        meta: { last_updated: new Date().toISOString(), version: 1 },
        parents: [
          {
            id: 'epic-neuro-syntax-ide-roadmap',
            name: 'Neuro Syntax IDE Roadmap',
            features: [
              'feat-fs-database-engine',
              'feat-editor-monaco',
              'feat-hardware-monitor',
              'feat-ai-agent-service',
            ],
          },
        ],
        active: [],
        pending: [
          {
            id: 'feat-fs-database-engine',
            name: 'FS-as-Database Engine',
            priority: 75,
            size: 'L',
            dependencies: ['feat-workspace-loader'],
          },
          {
            id: 'feat-editor-monaco',
            name: 'Monaco Editor',
            priority: 60,
            size: 'M',
            dependencies: ['feat-workspace-loader'],
          },
          {
            id: 'feat-hardware-monitor',
            name: 'Hardware Monitor',
            priority: 40,
            size: 'M',
            dependencies: ['feat-workspace-loader'],
          },
          {
            id: 'feat-ai-agent-service',
            name: 'AI Agent Service',
            priority: 30,
            size: 'L',
            dependencies: ['feat-fs-database-engine'],
          },
        ],
        blocked: [],
        completed: [
          {
            id: 'feat-tauri-v2-init',
            name: 'Tauri V2 Init',
            priority: 100,
            size: 'S',
            dependencies: [],
            completed_at: '2026-04-01T10:00:00Z',
            tag: 'feat-tauri-v2-init-20260401',
          },
          {
            id: 'feat-workspace-loader',
            name: 'Workspace Loader',
            priority: 90,
            size: 'M',
            dependencies: [],
            completed_at: '2026-04-01T11:10:00Z',
            tag: 'feat-workspace-loader-20260401',
          },
          {
            id: 'feat-native-terminal',
            name: 'Native Terminal',
            priority: 70,
            size: 'M',
            dependencies: [],
            completed_at: '2026-04-01T11:10:00Z',
            tag: 'feat-native-terminal-20260401',
          },
        ],
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const state: QueueState = await invoke('fetch_queue_state');
      setQueueState(state);

      // ─── Auto-cleanup overlays and ghost cards after refresh ───
      // Clean "done" overlays (the real data is now in queueState)
      setOverlayState(prev => {
        const next = new Map(prev);
        for (const [key, overlay] of next) {
          if (overlay.status === 'done') {
            next.delete(key);
          }
        }
        return next;
      });

      // Remove ghost cards whose real featureId now exists in queueState
      setGhostCards(prev => {
        if (prev.length === 0) return prev;
        const allIds = new Set<string>();
        if (state) {
          for (const f of state.active) allIds.add(f.id);
          for (const f of state.pending) allIds.add(f.id);
          for (const f of state.blocked) allIds.add(f.id);
          for (const f of state.completed) allIds.add(f.id);
        }
        return prev.filter(g => !g.featureId || !allIds.has(g.featureId));
      });
    } catch (e: any) {
      setError(e?.toString() ?? 'Failed to fetch queue state');
    } finally {
      setLoading(false);
    }
  }, []);

  /** Move a feature to a different queue column. */
  const moveTask = useCallback(async (taskId: string, targetQueue: QueueName) => {
    if (!isTauri) {
      // Dev fallback: optimistic update on mock data
      setQueueState(prev => {
        if (!prev) return prev;
        const allQueues: { key: QueueName; items: FeatureNode[] }[] = [
          { key: 'active', items: prev.active },
          { key: 'pending', items: prev.pending },
          { key: 'blocked', items: prev.blocked },
          { key: 'completed', items: prev.completed },
        ];
        let found: FeatureNode | null = null;
        const updated: Record<QueueName, FeatureNode[]> = {
          active: [],
          pending: [],
          blocked: [],
          completed: [],
        };
        for (const q of allQueues) {
          const idx = q.items.findIndex(n => n.id === taskId);
          if (idx >= 0 && !found) {
            found = q.items[idx];
            updated[q.key] = q.items.filter((_, i) => i !== idx);
          } else {
            updated[q.key] = q.items;
          }
        }
        if (found) {
          updated[targetQueue] = [...updated[targetQueue], found];
        }
        return { ...prev, ...updated };
      });
      return;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('update_task_status', { taskId, targetQueue: targetQueue });
      // Refresh after update
      await refresh();
    } catch (e: any) {
      setError(e?.toString() ?? 'Failed to update task status');
    }
  }, [refresh]);

  /** Read a single feature's detail files. */
  const readDetail = useCallback(async (featureId: string): Promise<Record<string, string> | null> => {
    if (!isTauri) return null;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('read_feature_detail', { featureId });
    } catch {
      return null;
    }
  }, []);

  // ---- Initial load & FS watcher listener ----

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isTauri) return;

    let unlisten: (() => void) | null = null;

    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<FsChangeEvent>('fs://workspace-changed', () => {
          // Auto-refresh when file changes are detected
          refresh();
        });
      } catch {
        // Ignore
      }
    })();

    return () => {
      unlisten?.();
    };
  }, [refresh]);

  // ---- Configurable auto-refresh interval ----

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Set up new interval if enabled (> 0)
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        refresh();
      }, refreshInterval * 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [refreshInterval, refresh]);

  // Cleanup overlay timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of overlayCleanupTimers.current.values()) {
        clearTimeout(timer);
      }
      overlayCleanupTimers.current.clear();
    };
  }, []);

  return {
    queueState,
    loading,
    error,
    refresh,
    moveTask,
    readDetail,
    refreshInterval,
    setRefreshInterval,
    // Overlay state (Layer A)
    overlayState,
    setOverlay,
    clearOverlay,
    setOverlayError,
    // Ghost card state (Layer B)
    ghostCards,
    addGhostCard,
    updateGhostCard,
    removeGhostCard,
  };
}
