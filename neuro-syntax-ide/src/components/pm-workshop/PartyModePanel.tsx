import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Users, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAgentStream } from '../../lib/useAgentStream';
import type { ChatMessage } from '../../lib/useAgentStream';
import type { BMADSessionState, PartyInsight } from '../../types';
import { ALL_PERSONAS, getPersonaById, ACCENT_CLASS_MAP } from '../../lib/bmad/persona-definitions';
import { PARTY_ORCHESTRATOR_PROMPT, PARTY_GREETING, buildPersonaPrompt } from '../../lib/bmad/party-mode-prompts';
import { WorkshopChatPanel } from './WorkshopChatPanel';
import { PersonaCardMessage } from './PersonaCardMessage';
import { OrchestratorNoteMessage } from './OrchestratorNoteMessage';
import { PersonaReferencePicker, extractMentions } from './PersonaReferencePicker';

// ─── Types ───

interface PartyModePanelProps {
  workspacePath: string;
  sessionState: BMADSessionState;
  onInsightsChange: (insights: PartyInsight[]) => void;
}

/** A round of persona responses */
interface PersonaRound {
  id: string;
  selectedPersonas: string[];
  topic: string;
  responses: Record<string, string>;
  loading: Record<string, boolean>;
  note: string | null;
  completedAt?: number;
}

// ─── HTML-comment marker parser ───

interface ParsedRoster {
  personas: string[];
  topic_summary: string;
}

function parseRosterMarker(content: string): ParsedRoster | null {
  const match = content.match(
    /<!-- workshop:party-roster -->\s*({[\s\S]*?})\s*<!-- \/workshop:party-roster -->/
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function parseOrchestratorNote(content: string): string | null {
  const match = content.match(
    /<!-- workshop:orchestrator-note -->\s*({[\s\S]*?})\s*<!-- \/workshop:orchestrator-note -->/
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1]).note ?? null;
  } catch {
    return null;
  }
}

// ─── Dev fallback simulated responses ───

function getSimulatedResponse(personaId: string): string {
  const responses: Record<string, string> = {
    winston: "From a product strategy perspective, I think the key question is whether this delivers real user value. We need to validate the core assumption before investing heavily in implementation.\n\nLet's think about what metrics would tell us if this is working. I'd suggest starting with a clear hypothesis and tracking user behavior changes.",
    alex: "Architecturally speaking, this approach has merit but we need to consider the scalability implications. The current design would work for the initial use case, but I'd recommend building in abstraction layers early to avoid technical debt later.\n\nSpecifically, I'd want to see clear interface boundaries between components so we can evolve independently.",
    sally: "From a UX standpoint, I'm concerned about the cognitive load this adds. Users should be able to accomplish their goal within 2-3 interactions.\n\nCan we simplify the flow while keeping the core functionality? I'd suggest we map out the user journey first and identify where we can reduce friction.",
    marcus: "I see several risk areas here. What happens when the network is unstable? How do we handle concurrent access?\n\nWe should define our failure modes and build graceful degradation into the design from the start. I'd also want to see a testing strategy that covers these edge cases.",
    jordan: "Looking at this from an implementation perspective, I estimate this would take about 2-3 sprints if we scope it well.\n\nI'd suggest breaking it into phases: core functionality first, then polish and edge cases. This way we can get feedback early and adjust course if needed.",
  };
  return responses[personaId] ?? "I have some thoughts on this topic that I'd like to share...";
}

// ─── Component ───

export const PartyModePanel: React.FC<PartyModePanelProps> = ({
  workspacePath,
  sessionState,
  onInsightsChange,
}) => {
  // ─── State ───
  const [isStarted, setIsStarted] = useState(false);
  const [allInsights, setAllInsights] = useState<PartyInsight[]>(sessionState.partyInsights ?? []);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');

  // Persona rounds tracking
  const [rounds, setRounds] = useState<PersonaRound[]>([]);
  const [currentRound, setCurrentRound] = useState<PersonaRound | null>(null);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
  const [conversationSummary, setConversationSummary] = useState('');

  const currentExecuteRef = useRef<number>(0);

  // ─── Orchestrator Agent ───
  const orchestrator = useAgentStream({
    runtimeId: 'claude-code',
    systemPrompt: PARTY_ORCHESTRATOR_PROMPT,
    greetingMessage: PARTY_GREETING,
    useSessions: true,
    persistMessages: true,
    storageKey: 'party-mode-orchestrator',
  });

  // ─── Build display messages (orchestrator + persona cards interleaved) ───
  const displayMessages: ChatMessage[] = useMemo(() => {
    const messages: ChatMessage[] = [];

    for (const msg of orchestrator.messages) {
      if (msg.role === 'user') {
        messages.push(msg);

        // After a user message, insert persona cards for any round
        // triggered by this user message. We match rounds by order.
        // The round index corresponds to the user message index.
        continue;
      }

      // Assistant message — check for markers
      const roster = parseRosterMarker(msg.content);
      const note = parseOrchestratorNote(msg.content);

      if (roster) {
        // Roster selection — the persona cards for this round
        // will be inserted as synthetic messages after the user message
        // This is handled via the round state, not here.
        // Just add the clean text if any
        const cleanText = msg.content
          .replace(/<!-- workshop:party-roster -->[\s\S]*?<!-- \/workshop:party-roster -->/, '')
          .trim();
        if (cleanText) {
          messages.push({ ...msg, content: cleanText });
        }
      } else if (note) {
        // Orchestrator note — add as a workshop message
        messages.push({
          role: 'assistant',
          content: '',
          workshopType: 'orchestrator-note',
          workshopPayload: { type: 'orchestrator-note', data: { note } },
        });
      } else {
        // Regular text (greeting, etc.)
        messages.push(msg);
      }
    }

    return messages;
  }, [orchestrator.messages]);

  // ─── Watch for roster selections from orchestrator ───
  const lastProcessedMsgRef = useRef<string>('');
  useEffect(() => {
    const lastMsg = orchestrator.messages[orchestrator.messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant' || lastMsg.isToolCall) return;
    if (lastMsg.content === lastProcessedMsgRef.current) return;
    lastProcessedMsgRef.current = lastMsg.content;

    const roster = parseRosterMarker(lastMsg.content);
    if (roster) {
      executePersonaSequence(roster.personas, roster.topic_summary);
    }
  }, [orchestrator.messages]);

  // ─── Execute persona sequence (sequential) ───
  const executePersonaSequence = useCallback(
    async (personaIds: string[], topic: string) => {
      currentExecuteRef.current += 1;
      const executeId = currentExecuteRef.current;

      const roundId = `round-${Date.now()}`;
      const newRound: PersonaRound = {
        id: roundId,
        selectedPersonas: personaIds,
        topic,
        responses: {},
        loading: {},
        note: null,
      };

      // Initialize loading state for all selected personas
      for (const pid of personaIds) {
        newRound.loading[pid] = true;
      }

      setCurrentRound(newRound);
      setActivePersonaId(personaIds[0] ?? null);

      const responses: Array<{ personaId: string; personaName: string; content: string }> = [];

      for (const personaId of personaIds) {
        if (currentExecuteRef.current !== executeId) break;

        const persona = getPersonaById(personaId);
        if (!persona) continue;

        setActivePersonaId(personaId);

        const prompt = buildPersonaPrompt(personaId, topic, responses, conversationSummary);

        if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('runtime_execute', {
              runtimeId: 'claude-code',
              message: topic,
              sessionId: null,
              systemPrompt: prompt,
            });
          } catch (e) {
            console.error(`[PartyMode] Error executing persona ${personaId}:`, e);
          }
          // In Tauri, the response comes via agent://chunk events
          // For now we rely on the simulated path; real integration
          // will need a separate chunk listener per persona
        } else {
          // Dev fallback: simulate with delay
          await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
          const simulated = getSimulatedResponse(personaId);

          responses.push({ personaId, personaName: persona.name, content: simulated });

          // Update round state progressively
          setCurrentRound((prev) => {
            if (!prev || prev.id !== roundId) return prev;
            return {
              ...prev,
              responses: { ...prev.responses, [personaId]: simulated },
              loading: { ...prev.loading, [personaId]: false },
            };
          });
        }
      }

      // Complete the round
      if (currentExecuteRef.current === executeId) {
        setActivePersonaId(null);

        const completedRound: PersonaRound = {
          ...newRound,
          responses: responses.reduce<Record<string, string>>((acc, r) => {
            acc[r.personaId] = r.content;
            return acc;
          }, {}),
          loading: {},
          completedAt: Date.now(),
        };

        setCurrentRound(null);
        setRounds((prev) => [...prev, completedRound]);

        // Extract insights
        const newInsights: PartyInsight[] = responses.map((r) => ({
          personaId: r.personaId,
          personaName: r.personaName,
          content: r.content.slice(0, 200),
          timestamp: Date.now(),
        }));
        const updatedInsights = [...allInsights, ...newInsights];
        setAllInsights(updatedInsights);
        onInsightsChange(updatedInsights);

        // Update summary
        const roundSummary = responses
          .map((r) => `${r.personaName}: ${r.content.slice(0, 60)}...`)
          .join(' | ');
        const newSummary = conversationSummary
          ? `${conversationSummary}\n${roundSummary}`
          : roundSummary;
        setConversationSummary(newSummary.length > 400 ? newSummary.slice(-400) : newSummary);
      }
    },
    [conversationSummary, allInsights, onInsightsChange],
  );

  // ─── Start session ───
  const handleStartSession = useCallback(async () => {
    setIsStarted(true);
    await orchestrator.startSession();
  }, [orchestrator]);

  // ─── Send message handler ───
  const handleSendMessage = useCallback(
    (text: string) => {
      const mentions = extractMentions(text);
      if (mentions.length > 0) {
        // Directed: only invoke mentioned personas
        executePersonaSequence(mentions, text);
        orchestrator.sendMessage(text);
      } else {
        // General: let orchestrator select personas
        orchestrator.sendMessage(text);
      }
    },
    [orchestrator, executePersonaSequence],
  );

  // ─── Custom message renderer ───
  const renderWorkshopMessage = useCallback(
    (msg: ChatMessage, _idx: number): React.ReactNode | null => {
      // Orchestrator notes
      if (msg.workshopType === 'orchestrator-note' && msg.workshopPayload) {
        const payload = msg.workshopPayload as { data: { note: string } };
        if (payload.data.note) {
          return <OrchestratorNoteMessage note={payload.data.note} />;
        }
      }
      return null;
    },
    [],
  );

  // ─── Build persona cards for current round + completed rounds ───
  const personaCardsSection = useMemo(() => {
    const cards: React.ReactNode[] = [];

    // Completed rounds
    for (const round of rounds) {
      for (const personaId of round.selectedPersonas) {
        const persona = getPersonaById(personaId);
        if (!persona) continue;
        const content = round.responses[personaId];
        if (!content) continue;

        cards.push(
          <PersonaCardMessage
            key={`${round.id}-${personaId}`}
            personaId={personaId}
            personaName={persona.name}
            personaTitle={persona.title}
            personaIcon={persona.icon}
            accentColor={persona.accentColor}
            content={content}
          />,
        );
      }
    }

    // Current round (in progress)
    if (currentRound) {
      for (const personaId of currentRound.selectedPersonas) {
        const persona = getPersonaById(personaId);
        if (!persona) continue;

        const content = currentRound.responses[personaId] ?? '';
        const isLoading = currentRound.loading[personaId] ?? false;

        if (isLoading && !content) {
          cards.push(
            <PersonaCardMessage
              key={`${currentRound.id}-${personaId}-loading`}
              personaId={personaId}
              personaName={persona.name}
              personaTitle={persona.title}
              personaIcon={persona.icon}
              accentColor={persona.accentColor}
              content=""
              isLoading={true}
            />,
          );
        } else if (content) {
          cards.push(
            <PersonaCardMessage
              key={`${currentRound.id}-${personaId}`}
              personaId={personaId}
              personaName={persona.name}
              personaTitle={persona.title}
              personaIcon={persona.icon}
              accentColor={persona.accentColor}
              content={content}
              isStreaming={activePersonaId === personaId}
            />,
          );
        }
      }
    }

    return cards;
  }, [rounds, currentRound, activePersonaId]);

  // ─── Input addons with PersonaReferencePicker ───
  const inputAddons = useMemo(
    () => (
      <div className="relative">
        {mentionPickerOpen && (
          <PersonaReferencePicker
            filter={mentionFilter}
            onSelect={(persona) => {
              setMentionPickerOpen(false);
              setMentionFilter('');
            }}
            onClose={() => {
              setMentionPickerOpen(false);
              setMentionFilter('');
            }}
          />
        )}
      </div>
    ),
    [mentionPickerOpen, mentionFilter],
  );

  // ─── Render ───
  if (!isStarted || orchestrator.connectionState === 'disconnected') {
    // Welcome page with PersonaRoster
    return (
      <div className="flex flex-col h-full w-full bg-surface">
        <div className="flex items-center justify-between px-4 py-2 bg-surface-container-low border-b border-outline-variant/10 shrink-0">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-tertiary" />
            <span className="text-xs font-headline font-bold text-on-surface">Party Mode</span>
          </div>
          <span className="text-[9px] text-on-surface-variant">{ALL_PERSONAS.length} personas</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="p-4 rounded-2xl bg-surface-container-high">
              <Users size={32} className="text-tertiary" />
            </div>
            <h2 className="text-sm font-headline font-bold text-on-surface">Party Mode</h2>
            <p className="text-[10px] text-on-surface-variant max-w-xs text-center leading-relaxed">
              Multi-persona roundtable discussion. AI personas with diverse expertise debate
              your product decisions from different angles.
            </p>
          </div>

          {/* PersonaRoster Grid */}
          <div className="grid grid-cols-2 gap-2 max-w-sm w-full">
            {ALL_PERSONAS.map((persona) => (
              <div
                key={persona.id}
                className={cn(
                  'p-3 rounded-lg border border-outline-variant/10 bg-surface-container-low',
                  'hover:border-outline-variant/30 transition-colors',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{persona.icon}</span>
                  <span className="text-xs font-bold text-on-surface">{persona.name}</span>
                </div>
                <p className="text-[10px] text-on-surface-variant">{persona.title}</p>
                <p className="text-[9px] text-on-surface-variant/70 mt-1 line-clamp-2">
                  {persona.description}
                </p>
              </div>
            ))}
          </div>

          {sessionState.partyInsights && sessionState.partyInsights.length > 0 && (
            <span className="mt-4 px-2 py-0.5 text-[10px] font-bold rounded-full bg-tertiary/20 text-tertiary">
              {sessionState.partyInsights.length} insights collected
            </span>
          )}

          <button
            onClick={handleStartSession}
            className="mt-6 px-4 py-2 text-xs font-bold rounded-lg bg-tertiary text-on-secondary hover:bg-tertiary/90 transition-colors"
          >
            Start Party Session
          </button>
        </div>
      </div>
    );
  }

  // Discussion view — split layout: chat left, persona cards right
  return (
    <div className="flex flex-col h-full w-full bg-surface">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-container-low border-b border-outline-variant/10 shrink-0">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-tertiary" />
          <span className="text-xs font-headline font-bold text-on-surface">Party Mode</span>
          {activePersonaId && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold rounded bg-tertiary/20 text-tertiary">
              <Loader2 size={9} className="animate-spin" />
              {getPersonaById(activePersonaId)?.name ?? '...'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-on-surface-variant">{ALL_PERSONAS.length} personas</span>
          {allInsights.length > 0 && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-tertiary/20 text-tertiary">
              {allInsights.length} insights
            </span>
          )}
        </div>
      </div>

      {/* Main Content: Chat + Persona Cards side by side */}
      <div className="flex-1 overflow-hidden">
        <WorkshopChatPanel
          messages={displayMessages}
          isStreaming={orchestrator.isStreaming || activePersonaId !== null}
          onSendMessage={handleSendMessage}
          placeholder={
            activePersonaId
              ? `Waiting for ${getPersonaById(activePersonaId)?.name ?? 'persona'}...`
              : 'Enter a topic for the panel, or @name to address a specific persona...'
          }
          renderWorkshopMessage={renderWorkshopMessage}
          inputAddons={inputAddons}
          rightPanel={
            personaCardsSection.length > 0 ? (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <Users size={12} className="text-tertiary" />
                  <span className="text-[10px] font-bold text-on-surface-variant">Persona Responses</span>
                </div>
                {personaCardsSection}
              </div>
            ) : undefined
          }
        />
      </div>
    </div>
  );
};
