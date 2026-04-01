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
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = 'gemini-2.0-flash';
const PM_SYSTEM_PROMPT = `You are the PM Agent for Neuro Syntax IDE, an AI-native desktop IDE. Your role is to help users define and manage their project context, plan features, and answer questions about software architecture.

When users ask you to create a feature, respond with a clear plan that includes:
1. Feature ID (feat- prefix, kebab-case)
2. Feature name
3. Priority and size estimate
4. Dependencies
5. Description
6. Key user value points
7. Task breakdown

Be concise, technical, and actionable. Use Markdown formatting for clarity.`;

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

  /** Send a message to the PM Agent and receive streaming response */
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
        const { listen } = await import('@tauri-apps/api/event');

        // Build messages array for the API (exclude the initial greeting)
        const chatMessages = [...messages, userMessage]
          .filter((m) => !(m.role === 'assistant' && m.content.includes("Hello! I'm your PM Agent")))
          .map((m) => ({ role: m.role, content: m.content }));

        // Start listening for chunks before invoking the command
        const unlisten = await listen<AgentChunkEvent>('pm_agent_chunk', (event) => {
          const chunk = event.payload;

          if (chunk.error) {
            setError(chunk.error);
            setIsStreaming(false);
            return;
          }

          if (chunk.text) {
            streamingTextRef.current += chunk.text;
            // Update the assistant message in-place
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
            // Finalize: if no text was ever added, add a default response
            if (!streamingTextRef.current) {
              setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: '(No response received)' },
              ]);
            }
            unlisten();
          }
        });

        // Invoke the streaming command (it returns immediately, chunks come via events)
        await invoke('agent_chat_stream', {
          request: {
            messages: chatMessages,
            model: DEFAULT_MODEL,
            context: PM_SYSTEM_PROMPT,
          },
        });
      } catch (e: any) {
        setError(e?.toString() ?? 'Failed to send message');
        setIsStreaming(false);
      }
    },
    [messages],
  );

  /** Ask the AI to generate a Feature plan (structured JSON) */
  const generateFeaturePlan = useCallback(
    async (description: string): Promise<FeaturePlanOutput | null> => {
      if (!isTauri) {
        // Dev fallback: return a mock plan
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
            model: DEFAULT_MODEL,
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
