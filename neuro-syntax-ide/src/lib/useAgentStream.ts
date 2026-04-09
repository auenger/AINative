import { useState, useCallback, useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types matching Rust StreamEvent (agent://chunk) / FeaturePlanOutput / TaskGroup
// ---------------------------------------------------------------------------

export interface AgentStreamEvent {
  text: string;
  is_done: boolean;
  error?: string;
  /** Stream message type: "assistant", "system", "raw", "tool_use", "result", "stderr", "disconnect", "timeout", "process_exit", "idle_warning" */
  type?: string;
  /** Session ID from the runtime */
  session_id?: string;
  /** Idle seconds (only set for idle_warning events) */
  idle_seconds?: number;
}

export interface TaskGroup {
  group_name: string;
  items: string[];
}

export interface FeaturePlanOutput {
  id: string;
  name: string;
  priority: number;
  size: string;
  dependencies: string[];
  description: string;
  value_points: string[];
  tasks: TaskGroup[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export type Connection_State = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface FsChangeEvent {
  paths: string[];
  kind: string;
}

export interface FeatureCreatedNotification {
  featureId: string;
  featureDir: string;
  timestamp: number;
}

export interface UseAgentStreamOptions {
  /** The runtime to use: 'claude-code' | 'gemini-http' | etc. */
  runtimeId: string;
  /** Optional system prompt prepended to messages. */
  systemPrompt?: string;
  /** Greeting message shown at start of conversation. */
  greetingMessage?: string;
  /** Whether this runtime requires session management (connect/disconnect). Default: false. */
  useSessions?: boolean;
  /** Whether to persist messages to localStorage. Default: false. */
  persistMessages?: boolean;
  /** localStorage key for message persistence. Default: 'agent-stream-{runtimeId}'. */
  storageKey?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAgentStream(options: UseAgentStreamOptions) {
  const {
    runtimeId: initialRuntimeId,
    systemPrompt = null,
    greetingMessage = '',
    useSessions = false,
    persistMessages = false,
    storageKey: storageKeyProp,
  } = options;

  // --- Dynamic runtimeId state (supports external override) ---
  const [runtimeId, setRuntimeId] = useState<string>(initialRuntimeId);
  const storageKey = storageKeyProp ?? `agent-stream-${runtimeId}`;

  // --- State ---
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (persistMessages && isTauri) {
      try {
        const stored = localStorage.getItem(storageKeyProp ?? `agent-stream-${initialRuntimeId}`);
        if (stored) {
          const parsed = JSON.parse(stored) as ChatMessage[];
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch { /* ignore */ }
    }
    return greetingMessage
      ? [{ role: 'assistant', content: greetingMessage }]
      : [];
  });

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);
  const streamingTextRef = useRef<string>('');
  const chunkUnlistenRef = useRef<(() => void) | null>(null);
  // Track the current streaming request ID to detect stale is_done events from process_exit
  const currentRequestIdRef = useRef<number>(0);

  // Session-related state (only used when useSessions is true)
  const [connectionState, setConnectionState] = useState<Connection_State>(useSessions ? 'disconnected' : 'connected');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastCreatedFeature, setLastCreatedFeature] = useState<FeatureCreatedNotification | null>(null);

  // Idle warning state — set when idle_warning events are received, cleared on new output
  const [idleWarningSeconds, setIdleWarningSeconds] = useState<number | null>(null);

  // Ref to track current runtimeId in sendMessage closures
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Ref to track current runtimeId for closures that need the live value
  const runtimeIdRef = useRef(runtimeId);
  runtimeIdRef.current = runtimeId;

  // Ref to track current sessionId for closures that need the live value (avoids stale closure)
  const sessionIdRef = useRef<string | null>(null);
  // Sync sessionIdRef whenever sessionId state changes
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // --- Persist messages to localStorage ---
  useEffect(() => {
    if (!persistMessages || !isTauri) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch { /* ignore quota errors */ }
  }, [messages, persistMessages, storageKey]);

  // --- Cleanup chunk listener on unmount ( session mode also clears streamingTextRef )
  useEffect(() => {
    return () => {
      if (chunkUnlistenRef.current) {
        chunkUnlistenRef.current();
        chunkUnlistenRef.current = null;
      }
      // Also clear streamingTextRef and error for session mode
      if (useSessions) {
        streamingTextRef.current = '';
        setError(null);
      }
    };
  }, []);

  // Track previous runtimeId to detect actual changes (skip mount)
  const prevRuntimeIdRef = useRef<string | null>(null);

  // --- Handle runtimeId change: disconnect old session, clear streaming state (preserve messages) ---
  useEffect(() => {
    // On first mount, just record the value and skip
    if (prevRuntimeIdRef.current === null) {
      prevRuntimeIdRef.current = runtimeId;
      return;
    }

    // Skip if runtimeId hasn't actually changed
    if (prevRuntimeIdRef.current === runtimeId) return;
    prevRuntimeIdRef.current = runtimeId;

    // Cancel any ongoing streaming
    setIsStreaming(false);
    streamingTextRef.current = '';
    setError(null);

    // Remove chunk listener to stop receiving stale events
    if (chunkUnlistenRef.current) {
      chunkUnlistenRef.current();
      chunkUnlistenRef.current = null;
    }

    // For session-based runtimes, disconnect
    if (useSessions) {
      setConnectionState('disconnected');
      setSessionId(null);
    }

    // Re-check API key for the new runtime
    checkApiKey();
  }, [runtimeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Chunk listener
  // ---------------------------------------------------------------------------

  /** Register the agent://chunk listener for streaming responses. */
  const registerChunkListener = useCallback(async () => {
    // Remove any previous listener
    if (chunkUnlistenRef.current) {
      chunkUnlistenRef.current();
      chunkUnlistenRef.current = null;
    }

    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<AgentStreamEvent>('agent://chunk', (event) => {
      const chunk = event.payload;

      // Capture real session_id from CLI response (first message establishes the session)
      if (chunk.session_id) {
        setSessionId(chunk.session_id);
        sessionIdRef.current = chunk.session_id; // Immediate sync for ref
        try { localStorage.setItem(`${optionsRef.current.storageKey ?? `agent-stream-${optionsRef.current.runtimeId}`}-session`, chunk.session_id); } catch { /* ignore */ }
      }

      // Handle idle_warning: non-error, informational — update UI state only
      if (chunk.type === 'idle_warning') {
        setIdleWarningSeconds(chunk.idle_seconds ?? null);
        return;
      }

      // Any real output clears the idle warning
      if (chunk.text || chunk.error) {
        setIdleWarningSeconds(null);
      }

      // Handle error chunks
      if (chunk.error) {
        if (chunk.type === 'stderr') {
          // stderr errors: log for diagnostics but don't break streaming
          console.warn('[Agent CLI stderr]', chunk.error);
          // If we're NOT streaming yet (no text received) and get a fatal stderr, surface it
          if (!streamingTextRef.current) {
            // Could be a real error (e.g. session not found) -- show to user
            setError(chunk.error);
          }
          return;
        }
        setError(chunk.error);
        if (chunk.is_done) {
          setIsStreaming(false);
          if (useSessions && (chunk.type === 'disconnect' || chunk.type === 'timeout')) {
            setConnectionState('error');
          }
        }
        return;
      }

      // Stream text from assistant/system/raw messages
      if (chunk.text && (chunk.type === 'assistant' || chunk.type === 'system' || chunk.type === 'raw' || !chunk.type)) {
        streamingTextRef.current += chunk.text;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: streamingTextRef.current }];
          }
          return [...prev, { role: 'assistant', content: streamingTextRef.current }];
        });
      }

      if (chunk.is_done) {
        // For process_exit events in session mode: only process if currently streaming.
        // This prevents stale process_exit from a previous CLI invocation from
        // interfering with a new request (e.g. adding "(No response received)").
        if (chunk.type === 'process_exit' && useSessions) {
          // In session mode, process_exit from a previous request is expected.
          // Only act on it if we're still actively streaming for the current request.
          // The "result" type is_done is the authoritative completion signal.
          // If we already have streaming text, process_exit is harmless and should be ignored.
          if (streamingTextRef.current) {
            // We already received content -- process_exit is just cleanup, ignore it.
            return;
          }
          // No text received yet and process_exit -- this means the CLI exited without
          // producing any output. This is the real "no response" case.
        }

        setIsStreaming(false);
        if (!streamingTextRef.current) {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: '(No response received)' },
          ]);
        }
        // Per-request 模式才 unlisten； session 模式保持 listener 持久
        if (!useSessions) {
          unlisten();
          chunkUnlistenRef.current = null;
        }
      }
    });

    chunkUnlistenRef.current = unlisten;
  }, [useSessions]);

  /** Remove the chunk listener. */
  const removeChunkListener = useCallback(() => {
    if (chunkUnlistenRef.current) {
      chunkUnlistenRef.current();
      chunkUnlistenRef.current = null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // API Key management (for gemini-http runtime)
  // ---------------------------------------------------------------------------

  /** Check if API key is configured */
  const checkApiKey = useCallback(async () => {
    if (!isTauri) {
      setApiKeyConfigured(false);
      return;
    }
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const hasKey: boolean = await invoke('has_api_key');
      setApiKeyConfigured(hasKey);
    } catch {
      setApiKeyConfigured(false);
    }
  }, []);

  /** Store API key via Rust backend (keyring) */
  const configureApiKey = useCallback(async (key: string) => {
    if (!isTauri) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('store_api_key', { key });
      setApiKeyConfigured(true);
      setError(null);
    } catch (e: any) {
      setError(e?.toString() ?? 'Failed to store API key');
    }
  }, []);

  /** Delete stored API key */
  const removeApiKey = useCallback(async () => {
    if (!isTauri) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_api_key');
      setApiKeyConfigured(false);
    } catch (e: any) {
      setError(e?.toString() ?? 'Failed to delete API key');
    }
  }, []);

  // Check API key on mount (for gemini-http runtime)
  useEffect(() => {
    if (runtimeId === 'gemini-http') {
      checkApiKey();
    }
  }, [checkApiKey, runtimeId]);

  // ---------------------------------------------------------------------------
  // Session management (for runtimes like claude-code)
  // ---------------------------------------------------------------------------

  /** Start a new agent session */
  const startSession = useCallback(async (_resumeSessionId?: string) => {
    if (!isTauri) {
      setConnectionState('connected');
      return;
    }
    setConnectionState('connecting');
    setError(null);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // Validate runtime is ready (don't store the fake UUID as sessionId)
      await invoke('runtime_session_start', { runtimeId: runtimeIdRef.current });
      // sessionId stays null — will be captured from the first response chunk
      setConnectionState('connected');
      await registerChunkListener();
    } catch (e: any) {
      setError(e?.toString() ?? 'Failed to start agent session');
      setConnectionState('error');
    }
  }, [registerChunkListener]);

  /** Stop the current agent session */
  const stopSession = useCallback(async () => {
    if (!isTauri) {
      setConnectionState('disconnected');
      setSessionId(null);
      return;
    }
    removeChunkListener();
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('runtime_session_stop');
    } catch { /* ignore */ }
    // 完整清理前端状态
    setConnectionState('disconnected');
    setSessionId(null);
    setError(null);
    streamingTextRef.current = '';
    try { localStorage.removeItem(`${storageKey}-session`); } catch { /* ignore */ }
  }, [removeChunkListener, storageKey]);

  /** Check agent status (used on mount for auto-restore) */
  const checkStatus = useCallback(async () => {
    if (!isTauri || !useSessions) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const status: { running: boolean; session_id: string | null } = await invoke('req_agent_status');
      if (status.running && status.session_id) {
        setSessionId(status.session_id);
        setConnectionState('connected');
        await registerChunkListener();
      } else {
        setConnectionState('disconnected');
      }
    } catch {
      setConnectionState('disconnected');
    }
  }, [useSessions, registerChunkListener]);

  // Check status on mount (for session-based runtimes)
  useEffect(() => {
    if (useSessions) {
      checkStatus();
    }
  }, [useSessions, checkStatus]);

  // ---------------------------------------------------------------------------
  // Message sending
  // ---------------------------------------------------------------------------

  /** Send a message and receive streaming response via runtime_execute */
  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim()) return;

      const currentRuntimeId = runtimeIdRef.current;

      // If session-based and not connected, start a fresh session first
      if (useSessions && connectionState !== 'connected') {
        await startSession();
      }

      const userMessage: ChatMessage = { role: 'user', content: input };
      setMessages((prev) => [...prev, userMessage]);
      setError(null);

      if (!isTauri) {
        // Dev fallback: simulate response
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `[${currentRuntimeId}] I've analyzed your request: "${input}". Here's my response...`,
            },
          ]);
        }, 1000);
        return;
      }

      setIsStreaming(true);
      streamingTextRef.current = '';
      // Increment request ID to distinguish this request from stale process_exit events
      currentRequestIdRef.current += 1;
      const thisRequestId = currentRequestIdRef.current;

      try {
        const { invoke } = await import('@tauri-apps/api/core');

        // Ensure chunk listener is registered before invoking the command
        if (useSessions) {
          // Session 模式： 确保 listener 存在（防止意外丢失）
          if (!chunkUnlistenRef.current) {
            await registerChunkListener();
          }
        } else {
          // Per-request 模式： always register a fresh listener
          await registerChunkListener();
        }

        // Build message payload
        let messagePayload: string;
        if (currentRuntimeId === 'gemini-http') {
          // Gemini runtime expects full conversation history as JSON
          const chatMessages = [...messages, userMessage]
            .filter((m) => !(m.role === 'assistant' && m.content.includes(greetingMessage)))
            .map((m) => ({ role: m.role, content: m.content }));
          messagePayload = JSON.stringify(chatMessages);
        } else {
          messagePayload = input;
        }

        await invoke('runtime_execute', {
          runtimeId: currentRuntimeId,
          message: messagePayload,
          sessionId: sessionIdRef.current,
          systemPrompt: systemPrompt,
        });
      } catch (e: any) {
        setError(e?.toString() ?? 'Failed to send message');
        setIsStreaming(false);
        if (useSessions) setConnectionState('error');
      }
    },
    [connectionState, startSession, messages, registerChunkListener, systemPrompt, greetingMessage, useSessions],
  );

  // ---------------------------------------------------------------------------
  // Feature plan helpers (for PM Agent / gemini-http runtime)
  // ---------------------------------------------------------------------------

  /** Ask the AI to generate a Feature plan (structured JSON) */
  const generateFeaturePlan = useCallback(
    async (description: string): Promise<FeaturePlanOutput | null> => {
      if (!isTauri) {
        return {
          id: 'feat-mock-feature',
          name: 'Mock Feature',
          priority: 50,
          size: 'M',
          dependencies: [],
          description,
          value_points: ['VP1: User benefit', 'VP2: Efficiency', 'VP3: Quality'],
          tasks: [
            { group_name: 'Core', items: ['Implement core logic', 'Add error handling'] },
            { group_name: 'UI', items: ['Design component', 'Wire up state'] },
          ],
        };
      }
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const plan: FeaturePlanOutput = await invoke('agent_generate_feature_plan', {
          request: {
            messages: [{ role: 'user', content: description }],
            model: 'gemini-2.0-flash',
          },
        });
        return plan;
      } catch (e: any) {
        setError(e?.toString() ?? 'Failed to generate feature plan');
        return null;
      }
    },
    [],
  );

  /** Create a Feature from a plan in the filesystem */
  const createFeature = useCallback(
    async (parentId: string, plan: FeaturePlanOutput): Promise<string | null> => {
      if (!isTauri) return null;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const featureId: string = await invoke('create_feature_from_agent', {
          request: { parentId, plan },
        });
        return featureId;
      } catch (e: any) {
        setError(e?.toString() ?? 'Failed to create feature');
        return null;
      }
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Session lifecycle (for session-based runtimes)
  // ---------------------------------------------------------------------------

  /** Start a new session (clear history) */
  const newSession = useCallback(async () => {
    if (useSessions) {
      await stopSession();
    }
    setMessages(
      greetingMessage
        ? [{ role: 'assistant', content: greetingMessage }]
        : []
    );
    streamingTextRef.current = '';
    setError(null);
    try {
      localStorage.removeItem(`${storageKey}-session`);
      localStorage.removeItem(storageKey);
    } catch { /* ignore */ }
  }, [useSessions, stopSession, greetingMessage, storageKey]);

  /** Resume a previous session -- always starts fresh for reliability */
  const resumeSession = useCallback(async () => {
    if (useSessions) {
      await startSession();
    }
  }, [useSessions, startSession]);

  // ---------------------------------------------------------------------------
  // Feature creation event listener (for REQ Agent / claude-code runtime)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isTauri || !useSessions) return;
    let unlisten: (() => void) | null = null;
    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<FsChangeEvent>('fs://workspace-changed', (event) => {
          const change = event.payload;
          if (change.kind === 'agent-feature-created') {
            for (const p of change.paths) {
              const match = p.match(/features\/pending-([^/]+)/);
              if (match) {
                setLastCreatedFeature({
                  featureId: match[1],
                  featureDir: p,
                  timestamp: Date.now(),
                });
                break;
              }
            }
          }
        });
      } catch { /* Ignore */ }
    })();
    return () => { unlisten?.(); };
  }, [useSessions]);

  /** Clear the last feature creation notification */
  const clearFeatureNotification = useCallback(() => {
    setLastCreatedFeature(null);
  }, []);

  // ---------------------------------------------------------------------------
  // General
  // ---------------------------------------------------------------------------

  /** Clear the chat history */
  const clearChat = useCallback(() => {
    setMessages(
      greetingMessage
        ? [{ role: 'assistant', content: greetingMessage }]
        : []
    );
    streamingTextRef.current = '';
    setError(null);
  }, [greetingMessage]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // Core chat state
    messages,
    isStreaming,
    error,
    sendMessage,
    clearChat,

    // API Key management (available for all runtimes, used by gemini-http)
    apiKeyConfigured,
    configureApiKey,
    removeApiKey,
    checkApiKey,

    // Session management (available when useSessions is true)
    connectionState,
    sessionId,
    startSession,
    stopSession,
    newSession,
    resumeSession,
    checkStatus,

    // Feature plan helpers (for PM Agent)
    generateFeaturePlan,
    createFeature,

    // Feature creation notification (for REQ Agent)
    lastCreatedFeature,
    clearFeatureNotification,

    // Idle warning state (feat-runtime-timeout-reminder)
    idleWarningSeconds,
    setIdleWarningSeconds,

    // Identity
    runtimeId,
    setRuntimeId,
  };
}
