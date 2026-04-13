import { useState, useCallback, useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types matching Rust AgentChunkEvent / FeaturePlanOutput / TaskGroup
// ---------------------------------------------------------------------------

export interface AgentChunkEvent {
  text: string;
  is_done: boolean;
  error?: string;
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

// ---------------------------------------------------------------------------
// StreamEvent type matching Rust StreamEvent (agent://chunk)
// ---------------------------------------------------------------------------

interface StreamEvent {
  text: string;
  is_done: boolean;
  error?: string;
  type?: string;
  session_id?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PM_SYSTEM_PROMPT = `You are the PM Agent for Neuro Syntax IDE, an AI-native desktop IDE. Your role is to help users define features through multi-turn conversation before creating a formal feature plan.

## Conversation Strategy

### Phase 1: Requirement Clarification
When the user describes a feature, assess clarity. If the description is vague or ambiguous, proactively ask clarifying questions about:
- Scope and boundaries (what's in/out?)
- User interactions and workflows
- Edge cases and error handling
- Integration points with existing features
- Performance or scalability requirements

Ask 1-3 focused questions per turn. Do NOT dump all questions at once. Adapt your follow-ups based on the user's answers.

### Phase 2: Refinement & Negotiation
- Summarize your understanding back to the user periodically
- If the feature seems large, suggest splitting into smaller features with clear value points
- Discuss trade-offs and alternatives when relevant
- Confirm priority and scope with the user

### Phase 3: Ready to Create
When you have enough information (clear scope, confirmed value points, understood requirements), indicate readiness:
"Based on our discussion, I have a clear understanding of the requirement. You can now click **Create Feature** to generate the formal feature plan."

Do NOT generate the plan yourself in chat — just indicate readiness. The system will generate a structured plan from the full conversation context.

## Response Style
- Be concise, technical, and actionable
- Use Markdown formatting for clarity
- Keep responses focused — avoid walls of text
- Use numbered lists for multi-part questions
- Acknowledge user answers before asking follow-ups`;

const GEMINI_RUNTIME_ID = 'gemini-http';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export function useAgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hello! I'm your PM Agent. I'll help you define and maintain the project context. What are we building today?",
    },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamingTextRef = useRef<string>('');

  // Ref to hold the persistent chunk listener unlisten function
  const chunkUnlistenRef = useRef<(() => void) | null>(null);

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

  /** Register the persistent agent://chunk listener for the PM Agent.
   *  Listens on the unified `agent://chunk` event from runtime_execute. */
  const registerChunkListener = useCallback(async () => {
    // Remove any previous listener
    if (chunkUnlistenRef.current) {
      chunkUnlistenRef.current();
      chunkUnlistenRef.current = null;
    }

    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<StreamEvent>('agent://chunk', (event) => {
      const chunk = event.payload;

      // Handle error chunks
      if (chunk.error && chunk.type !== 'stderr') {
        setError(chunk.error);
        if (chunk.is_done) {
          setIsStreaming(false);
        }
        return;
      }

      // Stream text from assistant messages
      if (chunk.text && (chunk.type === 'assistant' || !chunk.type)) {
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
        setIsStreaming(false);
        if (!streamingTextRef.current) {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: '(No response received)' },
          ]);
        }
        // Unregister after stream completes (per-request model)
        unlisten();
        chunkUnlistenRef.current = null;
      }
    });

    chunkUnlistenRef.current = unlisten;
  }, []);

  /** Remove the chunk listener */
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

  /** Send a message to the PM Agent and receive streaming response via runtime_execute */
  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim()) return;

      const userMessage: ChatMessage = { role: 'user', content: input };
      setMessages((prev) => [...prev, userMessage]);
      setError(null);

      if (!isTauri) {
        // Dev fallback: simulate PM Agent response
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `I've analyzed your request: "${input}". Here's what I think we should do:\n\n1. Break this down into smaller modules\n2. Define clear acceptance criteria\n3. Estimate complexity and dependencies\n\nWould you like me to create a formal Feature plan for this?`,
            },
          ]);
        }, 1000);
        return;
      }

      setIsStreaming(true);
      streamingTextRef.current = '';

      try {
        const { invoke } = await import('@tauri-apps/api/core');

        // Register chunk listener before invoking the command
        await registerChunkListener();

        // Build messages array for the API (exclude the initial greeting)
        const chatMessages = [...messages, userMessage]
          .filter((m) => !(m.role === 'assistant' && m.content.includes("Hello! I'm your PM Agent")))
          .map((m) => ({ role: m.role, content: m.content }));

        // Serialize messages as JSON string for the runtime's execute() to parse
        const messagePayload = JSON.stringify(chatMessages);

        // Invoke runtime_execute with the gemini-http runtime
        await invoke('runtime_execute', {
          runtimeId: GEMINI_RUNTIME_ID,
          message: messagePayload,
          sessionId: null,
          systemPrompt: PM_SYSTEM_PROMPT,
        });
      } catch (e: any) {
        setError(e?.toString() ?? 'Failed to send message');
        setIsStreaming(false);
      }
    },
    [messages, registerChunkListener],
  );

  /** Ask the AI to generate a Feature plan (structured JSON) from full chat context */
  const generateFeaturePlan = useCallback(
    async (chatMessages: ChatMessage[]): Promise<FeaturePlanOutput | null> => {
      if (!isTauri) {
        // Dev fallback: return a mock plan based on last user message
        const lastUserMsg = [...chatMessages].reverse().find(m => m.role === 'user');
        return {
          id: 'feat-mock-feature',
          name: 'Mock Feature',
          priority: 50,
          size: 'M',
          dependencies: [],
          description: lastUserMsg?.content ?? 'Mock feature description',
          value_points: ['VP1: User benefit', 'VP2: Efficiency', 'VP3: Quality'],
          tasks: [
            { group_name: 'Core', items: ['Implement core logic', 'Add error handling'] },
            { group_name: 'UI', items: ['Design component', 'Wire up state'] },
          ],
        };
      }

      try {
        const { invoke } = await import('@tauri-apps/api/core');
        // Filter out the initial greeting and only send meaningful conversation messages
        const filteredMessages = chatMessages.filter(
          (m) => !(m.role === 'assistant' && m.content.includes("Hello! I'm your PM Agent"))
        );
        const plan: FeaturePlanOutput = await invoke('agent_generate_feature_plan', {
          request: {
            messages: filteredMessages.map(m => ({ role: m.role, content: m.content })),
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

  /** Clear the chat history */
  const clearChat = useCallback(() => {
    setMessages([
      {
        role: 'assistant',
        content:
          "Hello! I'm your PM Agent. I'll help you define and maintain the project context. What are we building today?",
      },
    ]);
    streamingTextRef.current = '';
    setError(null);
  }, []);

  // Check API key on mount
  useEffect(() => {
    checkApiKey();
  }, [checkApiKey]);

  return {
    messages,
    isStreaming,
    apiKeyConfigured,
    error,
    sendMessage,
    generateFeaturePlan,
    createFeature,
    configureApiKey,
    removeApiKey,
    checkApiKey,
    clearChat,
  };
}
