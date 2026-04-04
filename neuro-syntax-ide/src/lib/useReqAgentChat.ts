import { useState, useCallback, useRef, useEffect } from 'react';

// Re-export FsChangeEvent type for convenience
export interface FsChangeEvent {
  paths: string[];
  kind: string;
}

export interface FeatureCreatedNotification {
  featureId: string;
  featureDir: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Types matching Rust StreamEvent (agent://chunk) / ReqAgentStatus
// ---------------------------------------------------------------------------

export interface ReqAgentChunkEvent {
  text: string;
  is_done: boolean;
  error?: string;
  /** stream-json message type: "assistant", "result", "system", "tool_use", "raw", "disconnect", "stderr", "timeout", "process_exit" */
  type?: string;
  /** Session ID from the Claude CLI */
  session_id?: string;
}

export interface ReqAgentStatus {
  running: boolean;
  session_id: string | null;
}

export interface ReqChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export type ReqAgentConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY_SESSION_ID = 'req_agent_session_id';
const STORAGE_KEY_MESSAGES = 'req_agent_messages';

const GREETING_MESSAGE: ReqChatMessage = {
  role: 'assistant',
  content:
    "你好！我是需求分析 Agent。我可以帮你分析和文档化软件需求。告诉我你想构建什么功能？",
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export function useReqAgentChat() {
  const [messages, setMessages] = useState<ReqChatMessage[]>(() => {
    // Restore messages from localStorage on init
    if (!isTauri) return [GREETING_MESSAGE];
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MESSAGES);
      if (stored) {
        const parsed = JSON.parse(stored) as ReqChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore parse errors
    }
    return [GREETING_MESSAGE];
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionState, setConnectionState] = useState<ReqAgentConnectionState>('disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCreatedFeature, setLastCreatedFeature] = useState<FeatureCreatedNotification | null>(null);
  const streamingTextRef = useRef<string>('');

  // Ref to hold the persistent chunk listener unlisten function
  const chunkUnlistenRef = useRef<(() => void) | null>(null);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (!isTauri) return;
    try {
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
    } catch {
      // ignore quota errors
    }
  }, [messages]);

  // ---------------------------------------------------------------------------
  // Persistent chunk listener
  // ---------------------------------------------------------------------------

  /** Register the persistent agent://chunk listener.
   *  Called once after startSession succeeds; stays active until stopSession or unmount.
   *  Listens on the unified `agent://chunk` event from runtime_execute. */
  const registerChunkListener = useCallback(async () => {
    // Remove any previous listener
    if (chunkUnlistenRef.current) {
      chunkUnlistenRef.current();
      chunkUnlistenRef.current = null;
    }

    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<ReqAgentChunkEvent>('agent://chunk', (event) => {
      const chunk = event.payload;

      // Handle error chunks (but not stderr — those are just diagnostics)
      if (chunk.error && chunk.type !== 'stderr') {
        setError(chunk.error);
        if (chunk.is_done) {
          setIsStreaming(false);
          // Keep connectionState as 'connected' so user can send another message
          // Only set to 'error' for disconnect or timeout
          if (chunk.type === 'disconnect' || chunk.type === 'timeout') {
            setConnectionState('error');
          }
        }
        return;
      }

      // Stream text from assistant / system / raw messages
      if (chunk.text && (chunk.type === 'assistant' || chunk.type === 'system' || chunk.type === 'raw')) {
        streamingTextRef.current += chunk.text;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: streamingTextRef.current }];
          }
          return [...prev, { role: 'assistant', content: streamingTextRef.current }];
        });
      }

      // When the result message arrives, mark streaming as done
      if (chunk.is_done) {
        setIsStreaming(false);
        if (!streamingTextRef.current) {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: '(未收到响应)' },
          ]);
        }
        // Do NOT set connectionState to disconnected — the session is still active
        // (per-message model: process exits, but session ID persists)
      }
    });

    chunkUnlistenRef.current = unlisten;
  }, []);

  /** Remove the persistent chunk listener */
  const removeChunkListener = useCallback(() => {
    if (chunkUnlistenRef.current) {
      chunkUnlistenRef.current();
      chunkUnlistenRef.current = null;
    }
  }, []);

  // Cleanup listener on unmount
  useEffect(() => {
    return () => {
      removeChunkListener();
    };
  }, [removeChunkListener]);

  // ---------------------------------------------------------------------------
  // Session management
  // ---------------------------------------------------------------------------

  /** Start a new agent session.
   *  Uses runtime_session_start for the unified execute layer. */
  const startSession = useCallback(async (_resumeSessionId?: string) => {
    if (!isTauri) {
      setConnectionState('connected');
      return;
    }

    setConnectionState('connecting');
    setError(null);

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // Use runtime_session_start (unified execute layer)
      const sid: string = await invoke('runtime_session_start', {
        runtimeId: 'claude-code',
      });
      setSessionId(sid);
      setConnectionState('connected');

      // Persist session ID
      try {
        localStorage.setItem(STORAGE_KEY_SESSION_ID, sid);
      } catch {
        // ignore
      }

      // Register the persistent chunk listener for this session
      await registerChunkListener();
    } catch (e: any) {
      const errMsg = e?.toString() ?? 'Failed to start agent session';
      setError(errMsg);
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

    // Remove the persistent chunk listener first
    removeChunkListener();

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('runtime_session_stop');
    } catch {
      // ignore stop errors
    }
    setConnectionState('disconnected');
    setSessionId(null);
    try {
      localStorage.removeItem(STORAGE_KEY_SESSION_ID);
    } catch {
      // ignore
    }
  }, [removeChunkListener]);

  /** Check agent status (used on mount for auto-restore) */
  const checkStatus = useCallback(async () => {
    if (!isTauri) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const status: ReqAgentStatus = await invoke('req_agent_status');

      if (status.running && status.session_id) {
        setSessionId(status.session_id);
        setConnectionState('connected');
        // Re-register the persistent listener
        await registerChunkListener();
      } else {
        setConnectionState('disconnected');
      }
    } catch {
      setConnectionState('disconnected');
    }
  }, [registerChunkListener]);

  // ---------------------------------------------------------------------------
  // Message sending (per-message process model)
  // ---------------------------------------------------------------------------

  /** Send a message to the agent.
   *  Uses runtime_execute for the unified execute layer.
   *  The persistent agent://chunk listener receives all response events. */
  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim()) return;

      // If not connected, start a fresh session first
      if (connectionState !== 'connected') {
        await startSession();
        // After startSession, the persistent listener is registered
      }

      const userMessage: ReqChatMessage = { role: 'user', content: input };
      setMessages((prev) => [...prev, userMessage]);
      setError(null);

      if (!isTauri) {
        // Dev fallback: simulate agent response
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `我已分析了你的需求："${input}"。以下是我的分析：\n\n1. 这个需求可以拆分为几个子模块\n2. 需要考虑边界情况\n3. 建议先完成核心逻辑\n\n你想进一步讨论哪个方面？`,
            },
          ]);
        }, 1000);
        return;
      }

      setIsStreaming(true);
      streamingTextRef.current = '';

      try {
        const { invoke } = await import('@tauri-apps/api/core');
        // Call runtime_execute (unified execute layer)
        await invoke('runtime_execute', {
          runtimeId: 'claude-code',
          message: input,
          sessionId: sessionId,
          systemPrompt: null,
        });
        // The persistent agent://chunk listener will receive all response events
      } catch (e: any) {
        setError(e?.toString() ?? 'Failed to send message');
        setIsStreaming(false);
        setConnectionState('error');
      }
    },
    [connectionState, startSession, sessionId],
  );

  // ---------------------------------------------------------------------------
  // Session lifecycle
  // ---------------------------------------------------------------------------

  /** Start a new session (clear history) */
  const newSession = useCallback(async () => {
    await stopSession();
    setMessages([GREETING_MESSAGE]);
    streamingTextRef.current = '';
    setError(null);
    try {
      localStorage.removeItem(STORAGE_KEY_SESSION_ID);
      localStorage.removeItem(STORAGE_KEY_MESSAGES);
    } catch {
      // ignore
    }
  }, [stopSession]);

  /** Resume a previous session — always starts fresh for reliability */
  const resumeSession = useCallback(async () => {
    await startSession();
  }, [startSession]);

  // Check status on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Listen for feature creation events from the agent (FS watcher detects new features)
  useEffect(() => {
    if (!isTauri) return;

    let unlisten: (() => void) | null = null;

    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<FsChangeEvent>('fs://workspace-changed', (event) => {
          const change = event.payload;
          if (change.kind === 'agent-feature-created') {
            // Extract feature ID from the paths
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
      } catch {
        // Ignore
      }
    })();

    return () => {
      unlisten?.();
    };
  }, []);

  /** Clear the last feature creation notification */
  const clearFeatureNotification = useCallback(() => {
    setLastCreatedFeature(null);
  }, []);

  return {
    messages,
    isStreaming,
    connectionState,
    sessionId,
    error,
    lastCreatedFeature,
    sendMessage,
    startSession,
    stopSession,
    newSession,
    resumeSession,
    checkStatus,
    clearFeatureNotification,
  };
}
