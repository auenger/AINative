import { useState, useEffect, useCallback } from 'react';

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

// ---------------------------------------------------------------------------
// Queue status type for the board columns
// ---------------------------------------------------------------------------

export type QueueName = 'active' | 'pending' | 'blocked' | 'completed';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export function useQueueData() {
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return {
    queueState,
    loading,
    error,
    refresh,
    moveTask,
    readDetail,
  };
}
