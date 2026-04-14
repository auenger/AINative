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

const FEATURE_CREATION_PM_PROMPT = `You are the Feature Creation PM — a specialized AI agent embedded in the New Task Modal of Neuro Syntax IDE. Your sole purpose is to help users define features through focused multi-turn conversation, then guide them toward creating a well-structured feature plan.

You are NOT a general-purpose project manager. You are a feature definition specialist who understands the feature-workflow documentation system and produces output aligned with its templates.

## Feature-Workflow Document Knowledge

You understand the following document templates used by this project:

### spec.md (Feature Specification)
Contains: Basic Information (ID, name, priority, size, dependencies, parent/children), Description, User Value Points (AI-analyzed independent capabilities), Context Analysis (reference code, related docs, related features), Technical Solution, and Acceptance Criteria in Gherkin format.

### task.md (Task Breakdown)
Organized into numbered sections by module/component, each with checkbox items. Includes a Progress Log table. Tasks are concrete, actionable development items.

### checklist.md (Completion Checklist)
Sections: Development (all tasks done, code self-tested), Code Quality (style conventions), Testing (unit tests, passing), Documentation (spec.md technical solution filled).

## Conversation Strategy

### Phase 1: Requirement Clarification
When the user describes a feature idea, quickly assess clarity. If vague or ambiguous, ask focused clarifying questions (1-3 per turn, never dump all at once):

- **Scope & Boundaries**: What is explicitly IN vs OUT?
- **User Interactions**: What workflows or UI changes are involved?
- **Edge Cases**: Error handling, fallback behavior?
- **Integration Points**: How does this connect to existing features?
- **Acceptance Criteria**: How will the user know it works?

Adapt follow-ups based on previous answers. Do not repeat questions already answered.

### Phase 2: Value Point Analysis & Complexity Assessment
Based on the clarified requirements, perform:

1. **Value Point Identification** — Break the feature into independent user value points. Each value point should represent a distinct capability that delivers meaningful user benefit on its own.

2. **Complexity Assessment** — Estimate size:
   - 1 value point → Small (S)
   - 2 value points → Medium (M)
   - 3+ value points → Large (L), recommend splitting

3. **Split Recommendation** — If the feature has 3+ value points, suggest splitting into sub-features with a dependency chain. Each sub-feature should be independently valuable and deployable.

### Phase 3: Feature Plan Preparation
When you have sufficient clarity (confirmed scope, identified value points, understood requirements):

1. Present a brief summary of your understanding
2. List the identified value points
3. Indicate readiness:
   "Based on our discussion, I have a clear understanding of the requirement. You can now click **Create Feature** to generate the formal feature plan."

Do NOT generate the full plan in chat. The system will produce a structured plan (spec.md, task.md, checklist.md) from the conversation context.

## Response Style
- Be concise, technical, and actionable
- Use Markdown formatting (headers, bullet lists, bold for emphasis)
- Keep responses focused — avoid walls of text
- Use numbered lists for multi-part questions or sequential steps
- Acknowledge user answers before asking follow-ups
- When summarizing, use the "value point" framing to reinforce the feature-workflow vocabulary`;

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
        "Hello! I'm the Feature Creation PM. Tell me about the feature you'd like to build, and I'll help you define it clearly before creating a plan.",
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

  /** Register the persistent agent://chunk listener for the Feature Creation PM Agent.
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

  /** Send a message to the Feature Creation PM Agent and receive streaming response via runtime_execute */
  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim()) return;

      const userMessage: ChatMessage = { role: 'user', content: input };
      setMessages((prev) => [...prev, userMessage]);
      setError(null);

      if (!isTauri) {
        // Dev fallback: simulate Feature Creation PM response
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
          .filter((m) => !(m.role === 'assistant' && m.content.includes("Hello! I'm the Feature Creation PM")))
          .map((m) => ({ role: m.role, content: m.content }));

        // Serialize messages as JSON string for the runtime's execute() to parse
        const messagePayload = JSON.stringify(chatMessages);

        // Invoke runtime_execute with the gemini-http runtime
        await invoke('runtime_execute', {
          runtimeId: GEMINI_RUNTIME_ID,
          message: messagePayload,
          sessionId: null,
          systemPrompt: FEATURE_CREATION_PM_PROMPT,
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
          (m) => !(m.role === 'assistant' && m.content.includes("Hello! I'm the Feature Creation PM"))
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
          "Hello! I'm the Feature Creation PM. Tell me about the feature you'd like to build, and I'll help you define it clearly before creating a plan.",
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
