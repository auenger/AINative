import { useState, useEffect, useCallback, useRef } from 'react';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// ── Event types matching the Rust SessionEvent enum ─────────────

export type SessionEvent =
  | { type: 'tool_start'; session_id: string; tool_id: string; tool_name: string; status: string }
  | { type: 'tool_done'; session_id: string; tool_id: string }
  | { type: 'tools_clear'; session_id: string }
  | { type: 'turn_end'; session_id: string }
  | { type: 'subagent_start'; session_id: string; parent_tool_id: string; tool_id: string; tool_name: string; status: string }
  | { type: 'subagent_done'; session_id: string; parent_tool_id: string; tool_id: string }
  | { type: 'subagent_clear'; session_id: string; parent_tool_id: string }
  | { type: 'session_discovered'; session_id: string }
  | { type: 'session_lost'; session_id: string };

// ── Tracked session state ───────────────────────────────────────

export interface TrackedSession {
  session_id: string;
  active_tool_ids: Set<string>;
  active_tool_names: Map<string, string>;
  active_tool_statuses: Map<string, string>;
  is_waiting: boolean;
  /** parentToolId → Map<subToolId, toolName> */
  subagent_tools: Map<string, Map<string, string>>;
}

export interface ClaudeSessionWatcherState {
  /** Map of session_id → TrackedSession */
  sessions: Map<string, TrackedSession>;
  /** Whether the watcher is actively running */
  isWatching: boolean;
  /** Start watching sessions for a workspace */
  start: (workspacePath: string) => Promise<void>;
  /** Stop watching */
  stop: () => Promise<void>;
  /** The primary (most recently active) session */
  primarySession: TrackedSession | null;
}

// ── Helpers ─────────────────────────────────────────────────────

function createTrackedSession(sessionId: string): TrackedSession {
  return {
    session_id: sessionId,
    active_tool_ids: new Set(),
    active_tool_names: new Map(),
    active_tool_statuses: new Map(),
    is_waiting: false,
    subagent_tools: new Map(),
  };
}

// ── Dev mode simulation ─────────────────────────────────────────

const SIM_TOOLS = [
  { name: 'Read', status: 'Reading PixelAgentView.tsx' },
  { name: 'Edit', status: 'Editing officeState.ts' },
  { name: 'Bash', status: 'Running: cargo check' },
  { name: 'Grep', status: 'Searching code' },
  { name: 'Glob', status: 'Searching files' },
  { name: 'Task', status: 'Subtask: explore codebase' },
  { name: 'WebSearch', status: 'Searching the web' },
];

function startDevSimulation(
  onEvent: (event: SessionEvent) => void,
): () => void {
  const sessionId = 'dev-session-sim';
  let currentToolId: string | null = null;
  let toolDoneTimer: ReturnType<typeof setTimeout> | null = null;

  // Emit session discovered
  onEvent({ type: 'session_discovered', session_id: sessionId });

  const cycle = () => {
    // Clear previous tool
    if (currentToolId) {
      onEvent({ type: 'tool_done', session_id: sessionId, tool_id: currentToolId });
      currentToolId = null;
    }

    // Occasionally go idle (turn end)
    if (Math.random() < 0.15) {
      onEvent({ type: 'turn_end', session_id: sessionId });
      toolDoneTimer = setTimeout(cycle, 3000 + Math.random() * 5000);
      return;
    }

    // Occasionally simulate a sub-agent
    if (Math.random() < 0.2) {
      const parentToolId = `sim-task-${Date.now()}`;
      const subToolId = `sim-sub-${Date.now()}`;
      const subTool = SIM_TOOLS[Math.floor(Math.random() * SIM_TOOLS.length)];

      onEvent({
        type: 'tool_start',
        session_id: sessionId,
        tool_id: parentToolId,
        tool_name: 'Task',
        status: `Subtask: ${subTool.status}`,
      });

      setTimeout(() => {
        onEvent({
          type: 'subagent_start',
          session_id: sessionId,
          parent_tool_id: parentToolId,
          tool_id: subToolId,
          tool_name: subTool.name,
          status: subTool.status,
        });
      }, 200);

      setTimeout(() => {
        onEvent({
          type: 'subagent_done',
          session_id: sessionId,
          parent_tool_id: parentToolId,
          tool_id: subToolId,
        });
        onEvent({ type: 'tool_done', session_id: sessionId, tool_id: parentToolId });
        onEvent({ type: 'subagent_clear', session_id: sessionId, parent_tool_id: parentToolId });
        currentToolId = null;
        toolDoneTimer = setTimeout(cycle, 2000 + Math.random() * 4000);
      }, 3000 + Math.random() * 3000);

      currentToolId = parentToolId;
      return;
    }

    // Regular tool
    const tool = SIM_TOOLS[Math.floor(Math.random() * SIM_TOOLS.length)];
    currentToolId = `sim-${Date.now()}`;

    onEvent({
      type: 'tool_start',
      session_id: sessionId,
      tool_id: currentToolId,
      tool_name: tool.name,
      status: tool.status,
    });

    toolDoneTimer = setTimeout(cycle, 4000 + Math.random() * 8000);
  };

  toolDoneTimer = setTimeout(cycle, 1000);

  return () => {
    if (toolDoneTimer) clearTimeout(toolDoneTimer);
  };
}

// ── Hook ────────────────────────────────────────────────────────

export function useClaudeSessionWatcher(): ClaudeSessionWatcherState {
  const [sessions, setSessions] = useState<Map<string, TrackedSession>>(new Map());
  const [isWatching, setIsWatching] = useState(false);
  const unlistenRef = useRef<(() => void) | null>(null);
  const devCleanupRef = useRef<(() => void) | null>(null);
  const isWatchingRef = useRef(false);

  const processEvent = useCallback((event: SessionEvent) => {
    setSessions(prev => {
      const next = new Map(prev);

      switch (event.type) {
        case 'session_discovered': {
          if (!next.has(event.session_id)) {
            next.set(event.session_id, createTrackedSession(event.session_id));
          }
          break;
        }
        case 'session_lost': {
          next.delete(event.session_id);
          break;
        }
        case 'tool_start': {
          const s = next.get(event.session_id);
          if (s) {
            s.active_tool_ids.add(event.tool_id);
            s.active_tool_names.set(event.tool_id, event.tool_name);
            s.active_tool_statuses.set(event.tool_id, event.status);
            s.is_waiting = false;
            next.set(event.session_id, { ...s });
          }
          break;
        }
        case 'tool_done': {
          const s = next.get(event.session_id);
          if (s) {
            s.active_tool_ids.delete(event.tool_id);
            s.active_tool_names.delete(event.tool_id);
            s.active_tool_statuses.delete(event.tool_id);
            next.set(event.session_id, { ...s });
          }
          break;
        }
        case 'tools_clear': {
          const s = next.get(event.session_id);
          if (s) {
            s.active_tool_ids.clear();
            s.active_tool_names.clear();
            s.active_tool_statuses.clear();
            next.set(event.session_id, { ...s });
          }
          break;
        }
        case 'turn_end': {
          const s = next.get(event.session_id);
          if (s) {
            s.is_waiting = true;
            next.set(event.session_id, { ...s });
          }
          break;
        }
        case 'subagent_start': {
          const s = next.get(event.session_id);
          if (s) {
            let subs = s.subagent_tools.get(event.parent_tool_id);
            if (!subs) {
              subs = new Map();
              s.subagent_tools.set(event.parent_tool_id, subs);
            }
            subs.set(event.tool_id, event.tool_name);
            next.set(event.session_id, { ...s });
          }
          break;
        }
        case 'subagent_done': {
          const s = next.get(event.session_id);
          if (s) {
            const subs = s.subagent_tools.get(event.parent_tool_id);
            if (subs) {
              subs.delete(event.tool_id);
            }
            next.set(event.session_id, { ...s });
          }
          break;
        }
        case 'subagent_clear': {
          const s = next.get(event.session_id);
          if (s) {
            s.subagent_tools.delete(event.parent_tool_id);
            next.set(event.session_id, { ...s });
          }
          break;
        }
      }

      return next;
    });
  }, []);

  const start = useCallback(async (workspacePath: string) => {
    if (isWatchingRef.current) return;
    isWatchingRef.current = true;

    if (!isTauri) {
      // Dev mode simulation
      setIsWatching(true);
      devCleanupRef.current = startDevSimulation(processEvent);
      return;
    }

    try {
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<SessionEvent>(
        'claude://session-event',
        (event) => {
          processEvent(event.payload);
        },
      );
      unlistenRef.current = unlisten;

      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('start_session_watcher', { workspacePath });
      setIsWatching(true);
    } catch (e) {
      console.error('[useClaudeSessionWatcher] Failed to start:', e);
      isWatchingRef.current = false;
    }
  }, [processEvent]);

  const stop = useCallback(async () => {
    isWatchingRef.current = false;

    if (devCleanupRef.current) {
      devCleanupRef.current();
      devCleanupRef.current = null;
    }

    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }

    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('stop_session_watcher');
      } catch {
        // Ignore
      }
    }

    setIsWatching(false);
    setSessions(new Map());
  }, []);

  // Derive primary session (the one with the most recent activity)
  const primarySession = sessions.size > 0
    ? Array.from(sessions.values()).find(s => !s.is_waiting) || sessions.values().next().value || null
    : null;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isWatchingRef.current = false;
      if (devCleanupRef.current) {
        devCleanupRef.current();
        devCleanupRef.current = null;
      }
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, []);

  return {
    sessions,
    isWatching,
    start,
    stop,
    primarySession,
  };
}
