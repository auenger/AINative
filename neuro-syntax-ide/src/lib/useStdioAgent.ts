import { useState, useCallback, useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types matching Rust types (feat-agent-stdio-core)
// ---------------------------------------------------------------------------

export type AgentBackend =
  | 'claude-code'
  | 'codex'
  | 'hermes'
  | 'opencode'
  | 'kiro'
  | 'kimi'
  | 'cursor-agent'
  | 'pi';

export type ProtocolType = 'pipe' | 'acp';

export type SessionStatus =
  | 'starting'
  | 'ready'
  | 'busy'
  | 'idle'
  | 'error'
  | 'stopped'
  | 'timeout';

export interface AgentSpawnConfig {
  backend: AgentBackend;
  binary?: string;
  args?: string[];
  working_dir?: string;
  env?: Record<string, string>;
  timeout?: number;
  protocol: ProtocolType;
}

export interface SessionInfo {
  id: string;
  backend: AgentBackend;
  protocol: ProtocolType;
  status: SessionStatus;
  created_at: number;
  last_activity: number;
  pid: number | null;
}

export interface SessionHealth {
  session_id: string;
  alive: boolean;
  status: SessionStatus;
  pid: number | null;
}

export interface RawStdoutEvent {
  session_id: string;
  line: string;
}

export interface SessionStatusEvent {
  session_id: string;
  status: SessionStatus;
}

export interface ProcessExitEvent {
  session_id: string;
  exit_code: number | null;
  stderr_tail: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseStdioAgentOptions {
  /** Auto-listen for events on mount. Default: true */
  autoListen?: boolean;
}

/**
 * useStdioAgent — frontend hook for the new stdio session manager.
 * Independent from useAgentStream.ts; both can coexist.
 *
 * Provides:
 * - spawn/destroy sessions
 * - send raw data via stdin
 * - receive raw stdout lines via events
 * - track session status and process exits
 */
export function useStdioAgent(options: UseStdioAgentOptions = {}) {
  const { autoListen = true } = options;

  // --- State ---
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [stdoutLines, setStdoutLines] = useState<Map<string, string[]>>(new Map());
  const [lastStatus, setLastStatus] = useState<SessionStatusEvent | null>(null);
  const [lastExit, setLastExit] = useState<ProcessExitEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Unlisten refs for event listeners
  const unlistenRefs = useRef<Array<() => void>>([]);

  // --- Event Listeners ---

  /** Register all three event listeners (raw-stdout, session-status, process-exit). */
  const startListening = useCallback(async () => {
    if (!isTauri) return;

    const { listen } = await import('@tauri-apps/api/event');

    // agent://raw-stdout
    const unlistenStdout = await listen<RawStdoutEvent>('agent://raw-stdout', (event) => {
      const { session_id, line } = event.payload;
      setStdoutLines((prev) => {
        const next = new Map(prev);
        const existing = next.get(session_id) ?? [];
        next.set(session_id, [...existing, line]);
        return next;
      });
    });

    // agent://session-status
    const unlistenStatus = await listen<SessionStatusEvent>('agent://session-status', (event) => {
      setLastStatus(event.payload);
      // Update sessions list if we have an active session
      setSessions((prev) =>
        prev.map((s) =>
          s.id === event.payload.session_id
            ? { ...s, status: event.payload.status }
            : s
        )
      );
    });

    // agent://process-exit
    const unlistenExit = await listen<ProcessExitEvent>('agent://process-exit', (event) => {
      setLastExit(event.payload);
      // Mark session as stopped/error
      setSessions((prev) =>
        prev.map((s) =>
          s.id === event.payload.session_id
            ? { ...s, status: event.payload.exit_code === 0 ? 'stopped' : 'error' }
            : s
        )
      );
    });

    unlistenRefs.current = [unlistenStdout, unlistenStatus, unlistenExit];
  }, []);

  /** Remove all event listeners. */
  const stopListening = useCallback(() => {
    for (const unlisten of unlistenRefs.current) {
      unlisten();
    }
    unlistenRefs.current = [];
  }, []);

  // Auto-listen on mount
  useEffect(() => {
    if (autoListen) {
      startListening();
    }
    return () => {
      stopListening();
    };
  }, [autoListen, startListening, stopListening]);

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  /** Spawn a new agent CLI subprocess. */
  const spawn = useCallback(async (config: AgentSpawnConfig): Promise<SessionInfo | null> => {
    if (!isTauri) return null;
    setError(null);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const info: SessionInfo = await invoke('agent_spawn', { config });
      setActiveSessionId(info.id);
      setSessions((prev) => [...prev, info]);
      return info;
    } catch (e: any) {
      setError(e?.toString() ?? 'Failed to spawn agent');
      return null;
    }
  }, []);

  /** Send raw data to a session's stdin. */
  const sendRaw = useCallback(async (sessionId: string, data: string): Promise<boolean> => {
    if (!isTauri) return false;
    setError(null);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('agent_send_raw', { sessionId, data });
      return true;
    } catch (e: any) {
      setError(e?.toString() ?? 'Failed to send data');
      return false;
    }
  }, []);

  /** Destroy a session (graceful shutdown). */
  const destroy = useCallback(async (sessionId: string): Promise<boolean> => {
    if (!isTauri) return false;
    setError(null);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('agent_destroy', { sessionId });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
      }
      return true;
    } catch (e: any) {
      setError(e?.toString() ?? 'Failed to destroy session');
      return false;
    }
  }, [activeSessionId]);

  /** List all active sessions. */
  const listSessions = useCallback(async (): Promise<SessionInfo[]> => {
    if (!isTauri) return [];
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const list: SessionInfo[] = await invoke('agent_list_sessions');
      setSessions(list);
      return list;
    } catch (e: any) {
      setError(e?.toString() ?? 'Failed to list sessions');
      return [];
    }
  }, []);

  /** Health check for a specific session. */
  const healthCheck = useCallback(async (sessionId: string): Promise<SessionHealth | null> => {
    if (!isTauri) return null;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('agent_health_check', { sessionId });
    } catch (e: any) {
      setError(e?.toString() ?? 'Health check failed');
      return null;
    }
  }, []);

  /** Get stdout lines for a specific session. */
  const getStdoutLines = useCallback((sessionId: string): string[] => {
    return stdoutLines.get(sessionId) ?? [];
  }, [stdoutLines]);

  /** Clear stdout buffer for a session. */
  const clearStdout = useCallback((sessionId: string) => {
    setStdoutLines((prev) => {
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // Session state
    sessions,
    activeSessionId,
    setActiveSessionId,
    stdoutLines,
    lastStatus,
    lastExit,
    error,

    // Commands
    spawn,
    sendRaw,
    destroy,
    listSessions,
    healthCheck,

    // Helpers
    getStdoutLines,
    clearStdout,

    // Event listener control
    startListening,
    stopListening,
  };
}
