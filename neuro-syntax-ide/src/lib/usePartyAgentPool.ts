/**
 * usePartyAgentPool — Manages multi-persona roundtable sessions.
 *
 * The orchestrator agent selects personas, then each persona is invoked
 * sequentially via runtime_execute. Results are rendered as PersonaCardMessages.
 */

import { useState, useCallback, useRef } from 'react';
import type { ChatMessage } from './useAgentStream';
import { useAgentStream } from './useAgentStream';
import { ALL_PERSONAS, getPersonaById } from './bmad/persona-definitions';
import { buildPersonaPrompt } from './bmad/party-mode-prompts';
import type { PartyInsight } from '../types';

// ─── Types ───

export interface PersonaResponse {
  personaId: string;
  personaName: string;
  content: string;
  timestamp: number;
}

export interface PersonaRound {
  topic: string;
  selectedPersonas: string[];
  responses: PersonaResponse[];
  orchestratorNote: string | null;
  completedAt?: number;
}

export interface PartyAgentPoolState {
  /** All completed rounds */
  rounds: PersonaRound[];
  /** Current round in progress */
  currentRound: PersonaRound | null;
  /** Which persona is currently generating (null if none) */
  activePersonaId: string | null;
  /** Cumulative insights extracted from all rounds */
  insights: PartyInsight[];
  /** Conversation summary for context passing */
  conversationSummary: string;
}

// ─── Parsed orchestrator output ───

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
    const data = JSON.parse(match[1]);
    return data.note ?? null;
  } catch {
    return null;
  }
}

// ─── Constants ───

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// ─── Hook ───

export function usePartyAgentPool(runtimeId: string) {
  // ─── State ───
  const [poolState, setPoolState] = useState<PartyAgentPoolState>({
    rounds: [],
    currentRound: null,
    activePersonaId: null,
    insights: [],
    conversationSummary: '',
  });

  // Track persona streaming content
  const personaStreamRef = useRef<string>('');

  // ─── Orchestrator Agent ───
  const orchestrator = useAgentStream({
    runtimeId,
    systemPrompt: '',
    useSessions: false,
    persistMessages: false,
    storageKey: 'party-orchestrator',
  });

  // ─── Execute personas sequentially ───
  const executePersonas = useCallback(
    async (roster: ParsedRoster, userMessage: string) => {
      const { personas, topic_summary } = roster;

      // Initialize new round
      const newRound: PersonaRound = {
        topic: topic_summary || userMessage,
        selectedPersonas: personas,
        responses: [],
        orchestratorNote: null,
      };

      setPoolState((prev) => ({
        ...prev,
        currentRound: newRound,
        activePersonaId: personas[0] ?? null,
      }));

      const responses: PersonaResponse[] = [];

      // Execute each persona sequentially
      for (const personaId of personas) {
        const persona = getPersonaById(personaId);
        if (!persona) continue;

        setPoolState((prev) => ({ ...prev, activePersonaId: personaId }));
        personaStreamRef.current = '';

        const prompt = buildPersonaPrompt(
          personaId,
          topic_summary || userMessage,
          responses,
          poolState.conversationSummary,
        );

        if (isTauri) {
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            // Use runtime_execute with the persona's system prompt
            // The result will come via agent://chunk events, but since we're
            // in sequential mode and useAgentStream handles the chunk listener,
            // we invoke via a dedicated channel
            await invoke('runtime_execute', {
              runtimeId,
              message: userMessage,
              sessionId: null,
              systemPrompt: prompt,
            });
          } catch (e) {
            console.error(`[PartyMode] Error executing persona ${personaId}:`, e);
          }
        } else {
          // Dev fallback: simulate persona response
          const simulatedResponse = simulatePersonaResponse(personaId, userMessage);
          responses.push({
            personaId,
            personaName: persona.name,
            content: simulatedResponse,
            timestamp: Date.now(),
          });
        }

        // Update round with response
        if (!isTauri) {
          setPoolState((prev) => {
            const updatedRound = { ...prev.currentRound! };
            updatedRound.responses = [...updatedRound.responses, responses[responses.length - 1]];
            return { ...prev, currentRound: updatedRound };
          });
        }
      }

      // Round complete
      setPoolState((prev) => {
        const completedRound = { ...prev.currentRound!, completedAt: Date.now() };
        const newInsights = extractInsights(completedRound);
        return {
          ...prev,
          rounds: [...prev.rounds, completedRound],
          currentRound: null,
          activePersonaId: null,
          insights: [...prev.insights, ...newInsights],
          conversationSummary: updateSummary(prev.conversationSummary, completedRound),
        };
      });
    },
    [runtimeId, poolState.conversationSummary],
  );

  // ─── Execute a single directed persona ───
  const executePersona = useCallback(
    async (personaId: string, userMessage: string) => {
      const persona = getPersonaById(personaId);
      if (!persona) return;

      setPoolState((prev) => ({
        ...prev,
        activePersonaId: personaId,
        currentRound: {
          topic: userMessage,
          selectedPersonas: [personaId],
          responses: [],
          orchestratorNote: null,
        },
      }));

      personaStreamRef.current = '';

      const prompt = buildPersonaPrompt(personaId, userMessage, [], poolState.conversationSummary);

      if (isTauri) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('runtime_execute', {
            runtimeId,
            message: userMessage,
            sessionId: null,
            systemPrompt: prompt,
          });
        } catch (e) {
          console.error(`[PartyMode] Error executing persona ${personaId}:`, e);
        }
      } else {
        // Dev fallback
        const simulatedResponse = simulatePersonaResponse(personaId, userMessage);
        const response: PersonaResponse = {
          personaId,
          personaName: persona.name,
          content: simulatedResponse,
          timestamp: Date.now(),
        };

        setPoolState((prev) => {
          const completedRound: PersonaRound = {
            topic: userMessage,
            selectedPersonas: [personaId],
            responses: [response],
            orchestratorNote: null,
            completedAt: Date.now(),
          };
          const newInsights = extractInsights(completedRound);
          return {
            ...prev,
            rounds: [...prev.rounds, completedRound],
            currentRound: null,
            activePersonaId: null,
            insights: [...prev.insights, ...newInsights],
            conversationSummary: updateSummary(prev.conversationSummary, completedRound),
          };
        });
      }
    },
    [runtimeId, poolState.conversationSummary],
  );

  // ─── Get active personas list ───
  const getActivePersonas = useCallback(() => {
    return ALL_PERSONAS;
  }, []);

  // ─── Complete current round (called when streaming finishes) ───
  const completeCurrentPersona = useCallback(
    (personaId: string, content: string) => {
      const persona = getPersonaById(personaId);
      if (!persona) return;

      const response: PersonaResponse = {
        personaId,
        personaName: persona.name,
        content,
        timestamp: Date.now(),
      };

      setPoolState((prev) => {
        if (!prev.currentRound) return prev;

        const updatedRound = { ...prev.currentRound };
        updatedRound.responses = [...updatedRound.responses, response];

        // Check if all personas have responded
        const allDone = updatedRound.selectedPersonas.every((id) =>
          updatedRound.responses.some((r) => r.personaId === id),
        );

        if (allDone) {
          const completedRound = { ...updatedRound, completedAt: Date.now() };
          const newInsights = extractInsights(completedRound);
          return {
            ...prev,
            rounds: [...prev.rounds, completedRound],
            currentRound: null,
            activePersonaId: null,
            insights: [...prev.insights, ...newInsights],
            conversationSummary: updateSummary(prev.conversationSummary, completedRound),
          };
        }

        // Next persona
        const nextIndex = updatedRound.selectedPersonas.indexOf(personaId) + 1;
        const nextPersonaId = updatedRound.selectedPersonas[nextIndex] ?? null;

        return {
          ...prev,
          currentRound: updatedRound,
          activePersonaId: nextPersonaId,
        };
      });
    },
    [],
  );

  // ─── Set orchestrator note on current round ───
  const setOrchestratorNote = useCallback((note: string) => {
    setPoolState((prev) => {
      if (!prev.currentRound) return prev;
      return {
        ...prev,
        currentRound: { ...prev.currentRound, orchestratorNote: note },
      };
    });
  }, []);

  return {
    poolState,
    orchestrator,
    executePersonas,
    executePersona,
    completeCurrentPersona,
    setOrchestratorNote,
    getActivePersonas,
  };
}

// ─── Helpers ───

/** Extract key insights from a round's responses */
function extractInsights(round: PersonaRound): PartyInsight[] {
  return round.responses.map((r) => ({
    personaId: r.personaId,
    personaName: r.personaName,
    content: r.content.slice(0, 200), // Truncate for summary
    timestamp: r.timestamp,
  }));
}

/** Update conversation summary (keep < 400 chars) */
function updateSummary(current: string, round: PersonaRound): string {
  const roundSummary = round.responses
    .map((r) => `${r.personaName}: ${r.content.slice(0, 60)}...`)
    .join(' | ');

  const newSummary = current ? `${current}\n${roundSummary}` : roundSummary;

  // Keep under 400 chars, trim from the beginning
  if (newSummary.length > 400) {
    return newSummary.slice(newSummary.length - 400);
  }
  return newSummary;
}

/** Dev fallback: simulate persona response */
function simulatePersonaResponse(personaId: string, _topic: string): string {
  const responses: Record<string, string> = {
    winston: "From a product strategy perspective, I think the key question is whether this delivers real user value. We need to validate the core assumption before investing heavily in implementation. Let's think about what metrics would tell us if this is working.",
    alex: "Architecturally speaking, this approach has merit but we need to consider the scalability implications. The current design would work for the initial use case, but I'd recommend building in abstraction layers early to avoid technical debt later.",
    sally: "From a UX standpoint, I'm concerned about the cognitive load this adds. Users should be able to accomplish their goal within 2-3 interactions. Can we simplify the flow while keeping the core functionality?",
    marcus: "I see several risk areas here. What happens when the network is unstable? How do we handle concurrent access? We should define our failure modes and build graceful degradation into the design from the start.",
    jordan: "Looking at this from an implementation perspective, I estimate this would take about 2-3 sprints if we scope it well. I'd suggest breaking it into phases: core functionality first, then polish and edge cases. This way we can get feedback early.",
  };
  return responses[personaId] ?? 'I have some thoughts on this topic...';
}
