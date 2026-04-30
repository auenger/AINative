import { useState, useCallback, useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types matching Rust types (feat-agent-stdio-core + feat-agent-pipe-adapter)
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
// Pipe Adapter types (feat-agent-pipe-adapter)
// ---------------------------------------------------------------------------

/** Parsed message from a pipe agent, emitted via `agent://message` events. */
export interface PipeMessage {
  /** Session ID */
  session_id: string;
  /** Message type: system | assistant | result | tool_use | tool_result | control_request | thinking | error */
  msg_type: string;
  /** Optional subtype (e.g. "init", "success", "started", "completed") */
  subtype?: string;
  /** Text content */
  text?: string;
  /** Tool name */
  tool_name?: string;
  /** Tool input as JSON */
  tool_input?: unknown;
  /** Tool result content */
  tool_result?: string;
  /** Tool state: "started" | "completed" (Cursor Agent) */
  tool_state?: string;
  /** Cost in USD (Claude Code result) */
  cost_usd?: number;
  /** Duration in ms */
  duration_ms?: number;
  /** Session ID from the agent itself (Claude Code session_id) */
  agent_session_id?: string;
  /** Model name (from system init) */
  model?: string;
  /** Whether this is the final message */
  is_final: boolean;
  /** Raw JSON line for debugging */
  raw?: string;
}

/** Result of a pipe execution session. */
export interface PipeSession {
  /** Session ID */
  session_id: string;
  /** Agent backend used */
  backend: AgentBackend;
  /** Final result text */
  result?: string;
  /** Cost in USD */
  cost_usd?: number;
  /** Duration in ms */
  duration_ms?: number;
}

/** Options for pipe execution. */
export interface PipeExecuteOptions {
  /** Agent type: 'claude-code' | 'cursor-agent' | 'opencode' */
  agentType: AgentBackend;
  /** The prompt/task to send */
  prompt: string;
  /** Working directory for the agent */
  workingDir?: string;
  /** Timeout in seconds */
  timeout?: number;
  /** Model to use (Claude Code only) */
  model?: string;
  /** Resume a previous session (Claude Code only) */
  resumeSession?: string;
  /** System prompt to append (Claude Code only) */
  systemPrompt?: string;
}

// ---------------------------------------------------------------------------
// ACP Adapter types (feat-agent-acp-adapter)
// ---------------------------------------------------------------------------

/** ACP agent configuration — defines how to spawn and communicate with each ACP agent. */
export interface AcpAgentConfig {
  /** Agent backend identifier */
  backend: AgentBackend;
  /** Binary name to execute */
  binary: string;
  /** Command-line arguments */
  args: string[];
  /** Protocol: always 'acp' for this adapter */
  protocol: 'acp';
  /** JSON-RPC method name for initialization */
  init_method: string;
  /** Session method names (varies by agent) */
  session_methods: {
    start?: string;
    turn?: string;
    cancel?: string;
    fork?: string;
    load?: string;
  };
  /** Completion signal: the JSON-RPC notification method that signals task completion */
  completion_signal: string;
  /** Environment variable filter — if empty, pass all env vars */
  env_filter: string[];
  /** Optional environment variables to inject */
  env_inject?: Record<string, string>;
}

/** ACP message from agent — emitted via agent://acp-message events. */
export interface AcpMessage {
  /** Session ID */
  session_id: string;
  /** Message type */
  msg_type: AcpMessageType;
  /** JSON-RPC request id (if this is a response) */
  rpc_id?: number;
  /** JSON-RPC method name (for notifications) */
  method?: string;
  /** Text content */
  text?: string;
  /** Structured data payload */
  data?: unknown;
  /** Tool name (for tool_use notifications) */
  tool_name?: string;
  /** Tool input (for tool_use notifications) */
  tool_input?: unknown;
  /** Whether this is the final message (completion signal received) */
  is_final: boolean;
  /** Error message if something went wrong */
  error?: string;
  /** Raw JSON-RPC line for debugging */
  raw?: string;
}

/** ACP message types */
export type AcpMessageType =
  | 'init'          // initialize response received
  | 'session'       // session created / loaded
  | 'message'       // assistant message chunk
  | 'tool_use'      // tool use notification
  | 'tool_result'   // tool result
  | 'approval'      // approval request from agent (auto-accepted)
  | 'completed'     // completion signal (turn/completed, session/idle, etc.)
  | 'error'         // error from JSON-RPC
  | 'notification'; // generic notification

/** Result of an ACP execution session. */
export interface AcpSession {
  /** Session ID */
  session_id: string;
  /** Agent backend used */
  backend: AgentBackend;
  /** Agent's internal session/thread id */
  agent_session_id?: string;
  /** Final result text */
  result?: string;
  /** Duration in ms */
  duration_ms?: number;
}

/** Info about an active ACP session (for listing). */
export interface AcpSessionInfo {
  /** Session ID */
  session_id: string;
  /** Agent backend */
  backend: AgentBackend;
  /** Status */
  status: 'starting' | 'running' | 'completed' | 'error' | 'cancelled';
  /** Start time (ISO string) */
  started_at: string;
  /** PID of the agent process */
  pid: number | null;
}

/** Options for ACP execution. */
export interface AcpExecuteOptions {
  /** Agent type: 'codex' | 'hermes' | 'kiro' | 'kimi' | 'pi' */
  agentType: AgentBackend;
  /** The prompt/task to send */
  prompt: string;
  /** Working directory for the agent */
  workingDir?: string;
  /** Timeout in seconds */
  timeout?: number;
  /** Model to use (agent-specific) */
  model?: string;
}

// ---------------------------------------------------------------------------
// ACP Agent Configuration Table
// ---------------------------------------------------------------------------

/** Pre-defined ACP agent configurations for all supported agents. */
export const ACP_AGENT_CONFIGS: Record<string, AcpAgentConfig> = {
  codex: {
    backend: 'codex',
    binary: 'codex',
    args: ['app-server', '--listen', 'stdio://'],
    protocol: 'acp',
    init_method: 'initialize',
    session_methods: {
      start: 'thread/start',
      turn: 'turn/start',
      cancel: 'thread/cancel',
    },
    completion_signal: 'turn/completed',
    env_filter: [],
  },
  hermes: {
    backend: 'hermes',
    binary: 'hermes',
    args: ['acp'],
    protocol: 'acp',
    init_method: 'initialize',
    session_methods: {
      start: 'newSession',
      cancel: 'cancelSession',
      fork: 'forkSession',
      load: 'loadSession',
    },
    completion_signal: 'session/idle',
    env_filter: [],
  },
  kiro: {
    backend: 'kiro',
    binary: 'kiro-cli',
    args: ['acp'],
    protocol: 'acp',
    init_method: 'initialize',
    session_methods: {
      start: 'createSession',
      turn: 'prompt',
    },
    completion_signal: 'turn/completed',
    env_filter: [],
  },
  kimi: {
    backend: 'kimi',
    binary: 'kimi',
    args: ['acp'],
    protocol: 'acp',
    init_method: 'initialize',
    session_methods: {
      start: 'session/create',
      turn: 'session/prompt',
      cancel: 'session/cancel',
    },
    completion_signal: 'session/idle',
    env_filter: [],
  },
  pi: {
    backend: 'pi',
    binary: 'pi',
    args: ['--mode', 'rpc'],
    protocol: 'acp',
    init_method: 'initialize',
    session_methods: {
      start: 'session/start',
      cancel: 'session/cancel',
    },
    completion_signal: 'task/complete',
    env_filter: [],
  },
};

// ---------------------------------------------------------------------------
// ACP Message Rendering Utilities (feat-agent-acp-adapter)
// ---------------------------------------------------------------------------

/** Human-readable label for an ACP message type. */
export function acpMessageTypeLabel(msgType: AcpMessageType): string {
  switch (msgType) {
    case 'init': return 'Initialized';
    case 'session': return 'Session';
    case 'message': return 'Assistant';
    case 'tool_use': return 'Tool Use';
    case 'tool_result': return 'Tool Result';
    case 'approval': return 'Approval';
    case 'completed': return 'Completed';
    case 'error': return 'Error';
    case 'notification': return 'Notification';
    default: return msgType;
  }
}

/** Extract displayable text content from an AcpMessage. */
export function acpMessageToText(msg: AcpMessage): string {
  if (msg.error) return `[Error] ${msg.error}`;
  if (msg.text) return msg.text;
  if (msg.msg_type === 'tool_use' && msg.tool_name) {
    return `[Tool: ${msg.tool_name}]`;
  }
  if (msg.msg_type === 'completed') return '[Task Completed]';
  if (msg.msg_type === 'init') return '[Agent Initialized]';
  if (msg.msg_type === 'session') return '[Session Ready]';
  if (msg.msg_type === 'approval') return '[Auto-Approved]';
  if (msg.data) {
    try { return JSON.stringify(msg.data, null, 2); } catch { return ''; }
  }
  return '';
}

/** Check if an ACP agent backend is supported (has a config entry). */
export function isAcpAgent(backend: string): boolean {
  return backend in ACP_AGENT_CONFIGS;
}

/** List all available ACP agent backends. */
export function getAvailableAcpAgents(): string[] {
  return Object.keys(ACP_AGENT_CONFIGS);
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
 * - execute pipe agents (high-level API, agent://message events)
 * - execute ACP agents (JSON-RPC 2.0, agent://acp-message events)
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

  // --- Pipe adapter state ---
  const [pipeMessages, setPipeMessages] = useState<Map<string, PipeMessage[]>>(new Map());
  const [isPipeExecuting, setIsPipeExecuting] = useState(false);
  const [activePipeSessionId, setActivePipeSessionId] = useState<string | null>(null);

  // --- ACP adapter state (feat-agent-acp-adapter) ---
  const [acpMessages, setAcpMessages] = useState<Map<string, AcpMessage[]>>(new Map());
  const [isAcpExecuting, setIsAcpExecuting] = useState(false);
  const [activeAcpSessionId, setActiveAcpSessionId] = useState<string | null>(null);
  const [acpSessions, setAcpSessions] = useState<AcpSessionInfo[]>([]);

  // Unlisten refs for event listeners
  const unlistenRefs = useRef<Array<() => void>>([]);

  // --- Event Listeners ---

  /** Register all event listeners (raw-stdout, session-status, process-exit, message). */
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
      // Clear pipe executing state if this was the active pipe session
      if (event.payload.session_id === activePipeSessionId) {
        setIsPipeExecuting(false);
      }
      // Clear ACP executing state if this was the active ACP session
      if (event.payload.session_id === activeAcpSessionId) {
        setIsAcpExecuting(false);
      }
    });

    // agent://message (pipe adapter parsed messages)
    const unlistenMessage = await listen<PipeMessage>('agent://message', (event) => {
      const msg = event.payload;
      setPipeMessages((prev) => {
        const next = new Map(prev);
        const existing = next.get(msg.session_id) ?? [];
        next.set(msg.session_id, [...existing, msg]);
        return next;
      });
      // Clear executing state on final message
      if (msg.is_final) {
        setIsPipeExecuting(false);
      }
    });

    // agent://acp-message (ACP adapter parsed messages — feat-agent-acp-adapter)
    // This is a SEPARATE event channel from agent://message (pipe) and agent://chunk (legacy).
    const unlistenAcpMessage = await listen<AcpMessage>('agent://acp-message', (event) => {
      const msg = event.payload;
      setAcpMessages((prev) => {
        const next = new Map(prev);
        const existing = next.get(msg.session_id) ?? [];
        next.set(msg.session_id, [...existing, msg]);
        return next;
      });
      // Clear ACP executing state on completion signal
      if (msg.is_final) {
        setIsAcpExecuting(false);
      }
    });

    unlistenRefs.current = [unlistenStdout, unlistenStatus, unlistenExit, unlistenMessage, unlistenAcpMessage];
  }, [activePipeSessionId, activeAcpSessionId]);

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
  // Pipe Adapter Commands (feat-agent-pipe-adapter)
  // ---------------------------------------------------------------------------

  /** Execute a pipe-mode agent task (high-level API).
   *  Spawns the agent, writes prompt, parses NDJSON, emits agent://message events.
   *  Returns the PipeSession info; listen to agent://message for real-time updates.
   */
  const executePipeAgent = useCallback(async (opts: PipeExecuteOptions): Promise<PipeSession | null> => {
    if (!isTauri) return null;
    setError(null);
    setIsPipeExecuting(true);
    setPipeMessages((prev) => {
      const next = new Map(prev);
      next.delete(''); // clear any stale empty-key messages
      return next;
    });

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const session: PipeSession = await invoke('pipe_execute', {
        agentType: opts.agentType,
        prompt: opts.prompt,
        workingDir: opts.workingDir ?? '',
        timeout: opts.timeout,
        model: opts.model,
        resumeSession: opts.resumeSession,
        systemPrompt: opts.systemPrompt,
      });
      setActivePipeSessionId(session.session_id);
      return session;
    } catch (e: any) {
      setError(e?.toString() ?? 'Failed to execute pipe agent');
      setIsPipeExecuting(false);
      return null;
    }
  }, []);

  /** Get pipe messages for a specific session. */
  const getPipeMessages = useCallback((sessionId: string): PipeMessage[] => {
    return pipeMessages.get(sessionId) ?? [];
  }, [pipeMessages]);

  /** Clear pipe messages for a session. */
  const clearPipeMessages = useCallback((sessionId: string) => {
    setPipeMessages((prev) => {
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // ACP Adapter Commands (feat-agent-acp-adapter)
  //
  // These use separate Tauri IPC commands (acp_execute, acp_cancel,
  // acp_list_sessions) that are completely independent from the existing
  // runtime_execute and pipe_execute paths.
  //
  // Events flow through agent://acp-message (NOT agent://chunk or agent://message).
  // ---------------------------------------------------------------------------

  /** Execute an ACP agent task (high-level API).
   *  Spawns the agent via StdioSessionManager, establishes JSON-RPC 2.0
   *  communication, sends initialize -> session start -> prompt.
   *  Returns the AcpSession info; listen to agent://acp-message for real-time updates.
   */
  const executeAcpAgent = useCallback(async (opts: AcpExecuteOptions): Promise<AcpSession | null> => {
    if (!isTauri) return null;
    setError(null);
    setIsAcpExecuting(true);
    setAcpMessages((prev) => {
      const next = new Map(prev);
      next.delete(''); // clear any stale empty-key messages
      return next;
    });

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const session: AcpSession = await invoke('acp_execute', {
        agentType: opts.agentType,
        prompt: opts.prompt,
        workingDir: opts.workingDir ?? '',
        timeout: opts.timeout,
        model: opts.model,
      });
      setActiveAcpSessionId(session.session_id);
      return session;
    } catch (e: any) {
      setError(e?.toString() ?? 'Failed to execute ACP agent');
      setIsAcpExecuting(false);
      return null;
    }
  }, []);

  /** Cancel an active ACP session.
   *  Sends the agent-specific cancel JSON-RPC method (e.g. thread/cancel for Codex).
   */
  const cancelAcpSession = useCallback(async (sessionId: string): Promise<boolean> => {
    if (!isTauri) return false;
    setError(null);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('acp_cancel', { sessionId });
      setIsAcpExecuting(false);
      // Update acpSessions list
      setAcpSessions((prev) =>
        prev.map((s) =>
          s.session_id === sessionId
            ? { ...s, status: 'cancelled' as const }
            : s
        )
      );
      return true;
    } catch (e: any) {
      setError(e?.toString() ?? 'Failed to cancel ACP session');
      return false;
    }
  }, []);

  /** List all active ACP sessions. */
  const listAcpSessions = useCallback(async (): Promise<AcpSessionInfo[]> => {
    if (!isTauri) return [];
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const list: AcpSessionInfo[] = await invoke('acp_list_sessions');
      setAcpSessions(list);
      return list;
    } catch (e: any) {
      setError(e?.toString() ?? 'Failed to list ACP sessions');
      return [];
    }
  }, []);

  /** Get ACP messages for a specific session. */
  const getAcpMessages = useCallback((sessionId: string): AcpMessage[] => {
    return acpMessages.get(sessionId) ?? [];
  }, [acpMessages]);

  /** Clear ACP messages for a session. */
  const clearAcpMessages = useCallback((sessionId: string) => {
    setAcpMessages((prev) => {
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });
  }, []);

  /** Get the ACP agent config for a given backend name. */
  const getAcpAgentConfig = useCallback((backend: string): AcpAgentConfig | undefined => {
    return ACP_AGENT_CONFIGS[backend];
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

    // Pipe adapter (feat-agent-pipe-adapter)
    pipeMessages,
    isPipeExecuting,
    activePipeSessionId,
    executePipeAgent,
    getPipeMessages,
    clearPipeMessages,

    // ACP adapter (feat-agent-acp-adapter)
    acpMessages,
    isAcpExecuting,
    activeAcpSessionId,
    acpSessions,
    executeAcpAgent,
    cancelAcpSession,
    listAcpSessions,
    getAcpMessages,
    clearAcpMessages,
    getAcpAgentConfig,

    // Event listener control
    startListening,
    stopListening,
  };
}
