import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Users, Loader2, Clock, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, X, Plus, FileText, RotateCcw } from 'lucide-react';
import { cn, filterToolCallText } from '../../lib/utils';
import { useAgentStream } from '../../lib/useAgentStream';
import type { ChatMessage } from '../../lib/useAgentStream';
import type { BMADSessionState, PartyInsight, PartyReport, PartyModeConfig, DEFAULT_PARTY_MODE_CONFIG } from '../../types';
import {
  ALL_PERSONAS,
  getPersonaById,
  ACCENT_CLASS_MAP,
  searchPersonas,
  PERSONA_CATEGORIES,
  type PersonaDefinition,
  type PersonaCategory,
} from '../../lib/bmad/persona-definitions';
import {
  PARTY_ORCHESTRATOR_PROMPT,
  PARTY_GREETING,
  buildPersonaPrompt,
  buildConvergencePrompt,
} from '../../lib/bmad/party-mode-prompts';
import { WorkshopChatPanel } from './WorkshopChatPanel';
import { PersonaCardMessage } from './PersonaCardMessage';
import { OrchestratorNoteMessage } from './OrchestratorNoteMessage';
import { PersonaReferencePicker, extractMentions } from './PersonaReferencePicker';

// ─── Types ───

interface PartyModePanelProps {
  workspacePath: string;
  sessionState: BMADSessionState;
  onInsightsChange: (insights: PartyInsight[]) => void;
  onReportGenerated?: (report: PartyReport) => void;
  onCreatePRD?: () => void;
  className?: string;
}

/** A round of persona responses */
interface PersonaRound {
  id: string;
  roundNumber: number;
  selectedPersonas: string[];
  topic: string;
  responses: Record<string, string>;
  loading: Record<string, boolean>;
  note: string | null;
  completedAt?: number;
}

/** SDK call pool state */
interface CallPoolState {
  running: number;
  queued: number;
  completed: number;
  timedOut: number;
}

// ─── HTML-comment marker parsers ───

interface ParsedRoster {
  personas: string[];
  topic_summary: string;
}

function parseRosterMarker(content: string): ParsedRoster | null {
  const match = content.match(
    /<!-- workshop:party-roster -->\s*({[\s\S]*?})\s*<!-- \/workshop:party-roster -->/,
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
    /<!-- workshop:orchestrator-note -->\s*({[\s\S]*?})\s*<!-- \/workshop:orchestrator-note -->/,
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1]).note ?? null;
  } catch {
    return null;
  }
}

interface ParsedReport {
  consensus: string[];
  disagreements: string[];
  recommended_actions: string[];
  risks: string[];
  summary: string;
}

function parseReportMarker(content: string): ParsedReport | null {
  const match = content.match(
    /<!-- workshop:party-report -->\s*({[\s\S]*?})\s*<!-- \/workshop:party-report -->/,
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
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
  return responses[personaId] ?? "I have some thoughts on this topic that I'd like to share from my area of expertise.";
}

// ─── Persona Roster Confirm Component ───

interface PersonaRosterConfirmProps {
  recommendedPersonas: string[];
  onConfirm: (selectedIds: string[]) => void;
  onCancel: () => void;
}

const PersonaRosterConfirm: React.FC<PersonaRosterConfirmProps> = ({
  recommendedPersonas,
  onConfirm,
  onCancel,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set(recommendedPersonas));
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const togglePersona = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const searchResults = searchQuery ? searchPersonas(searchQuery) : [];

  return (
    <div className="p-4 rounded-lg border border-outline-variant/20 bg-surface-container-low space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-on-surface">Recommended Panelists</span>
        <span className="text-[9px] text-on-surface-variant">{selected.size} selected</span>
      </div>

      {/* Recommended personas with checkboxes */}
      <div className="space-y-1.5">
        {recommendedPersonas.map((id) => {
          const persona = getPersonaById(id);
          if (!persona) return null;
          return (
            <label
              key={id}
              className={cn(
                'flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors',
                selected.has(id) ? 'bg-tertiary/10 border border-tertiary/30' : 'bg-surface-container/50 border border-transparent',
              )}
            >
              <input
                type="checkbox"
                checked={selected.has(id)}
                onChange={() => togglePersona(id)}
                className="w-3 h-3 accent-tertiary"
              />
              <span className="text-sm">{persona.icon}</span>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-on-surface">{persona.name}</span>
                <span className="text-[9px] text-on-surface-variant ml-1">{persona.title}</span>
              </div>
              {persona.category && (
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
                  {PERSONA_CATEGORIES[persona.category]?.label ?? persona.category}
                </span>
              )}
            </label>
          );
        })}
      </div>

      {/* Search & add */}
      {!showSearch ? (
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-1 text-[9px] text-tertiary hover:text-tertiary/80"
        >
          <Plus size={10} /> Add more personas
        </button>
      ) : (
        <div className="space-y-1.5">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search personas..."
            className="w-full px-2 py-1 text-[10px] bg-surface-container rounded border border-outline-variant/20 focus:outline-none focus:border-tertiary/50"
            autoFocus
          />
          {searchResults
            .filter((p) => !recommendedPersonas.includes(p.id))
            .slice(0, 5)
            .map((persona) => (
              <button
                key={persona.id}
                onClick={() => {
                  togglePersona(persona.id);
                  setSearchQuery('');
                  setShowSearch(false);
                }}
                className="flex items-center gap-2 w-full p-1.5 rounded hover:bg-surface-container transition-colors"
              >
                <span className="text-sm">{persona.icon}</span>
                <span className="text-[10px] font-bold text-on-surface">{persona.name}</span>
                <span className="text-[9px] text-on-surface-variant">{persona.title}</span>
              </button>
            ))}
          <button
            onClick={() => { setShowSearch(false); setSearchQuery(''); }}
            className="text-[9px] text-on-surface-variant hover:text-on-surface"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onConfirm(Array.from(selected))}
          disabled={selected.size < 2}
          className={cn(
            'px-3 py-1.5 text-[10px] font-bold rounded-md transition-colors',
            selected.size >= 2
              ? 'bg-primary text-on-primary hover:bg-primary/90'
              : 'bg-surface-container text-on-surface-variant cursor-not-allowed',
          )}
        >
          Confirm & Start
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-[10px] text-on-surface-variant hover:text-on-surface"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// ─── Report Card Component ───

interface ReportCardProps {
  report: PartyReport;
  onCreatePRD?: () => void;
}

const ReportCard: React.FC<ReportCardProps> = ({ report, onCreatePRD }) => (
  <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low overflow-hidden">
    <div className="flex items-center gap-2 px-3 py-2 bg-tertiary/10 border-b border-outline-variant/10">
      <FileText size={12} className="text-tertiary" />
      <span className="text-[10px] font-bold text-on-surface">Convergence Report</span>
      <span className="text-[9px] text-on-surface-variant ml-auto">
        {report.rounds} rounds &middot; {new Date(report.generatedAt).toLocaleTimeString()}
      </span>
    </div>
    <div className="p-3 space-y-3 text-[10px]">
      {report.summary && (
        <p className="text-on-surface font-medium italic">{report.summary}</p>
      )}
      {report.consensus.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-1">
            <CheckCircle2 size={9} className="text-emerald-400" />
            <span className="font-bold text-emerald-400">Consensus</span>
          </div>
          <ul className="space-y-0.5 pl-3">
            {report.consensus.map((c, i) => (
              <li key={i} className="text-on-surface-variant">{c}</li>
            ))}
          </ul>
        </div>
      )}
      {report.disagreements.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle size={9} className="text-amber-400" />
            <span className="font-bold text-amber-400">Disagreements</span>
          </div>
          <ul className="space-y-0.5 pl-3">
            {report.disagreements.map((d, i) => (
              <li key={i} className="text-on-surface-variant">{d}</li>
            ))}
          </ul>
        </div>
      )}
      {report.recommendedActions.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-1">
            <ChevronDown size={9} className="text-blue-400" />
            <span className="font-bold text-blue-400">Recommended Actions</span>
          </div>
          <ul className="space-y-0.5 pl-3">
            {report.recommendedActions.map((a, i) => (
              <li key={i} className="text-on-surface-variant">{a}</li>
            ))}
          </ul>
        </div>
      )}
      {report.risks.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle size={9} className="text-red-400" />
            <span className="font-bold text-red-400">Risks</span>
          </div>
          <ul className="space-y-0.5 pl-3">
            {report.risks.map((r, i) => (
              <li key={i} className="text-on-surface-variant">{r}</li>
            ))}
          </ul>
        </div>
      )}
      {onCreatePRD && (
        <button
          onClick={onCreatePRD}
          className="mt-2 px-3 py-1.5 text-[10px] font-bold rounded-md bg-tertiary text-on-secondary hover:bg-tertiary/90 transition-colors"
        >
          Create PRD from Report
        </button>
      )}
    </div>
  </div>
);

// ─── Process Status Component ───

const ProcessStatus: React.FC<{ pool: CallPoolState; total: number }> = ({ pool, total }) => (
  <div className="flex items-center gap-2 text-[9px]">
    {pool.running > 0 && (
      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400">
        <Loader2 size={8} className="animate-spin" />{pool.running} running
      </span>
    )}
    {pool.queued > 0 && (
      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-400">
        <Clock size={8} />{pool.queued} queued
      </span>
    )}
    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-400">
      <CheckCircle2 size={8} />{pool.completed}/{total} done
    </span>
    {pool.timedOut > 0 && (
      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-400/10 text-red-400">
        <AlertTriangle size={8} />{pool.timedOut} timeout
      </span>
    )}
  </div>
);

// ─── Main Component ───

export const PartyModePanel: React.FC<PartyModePanelProps> = ({
  workspacePath,
  sessionState,
  onInsightsChange,
  onReportGenerated,
  onCreatePRD,
  className,
}) => {
  // ─── Config ───
  const config: PartyModeConfig = sessionState.partyModeConfig ?? {
    workshopRuntimeId: 'claude-code',
    maxConcurrent: 3,
    timeoutSeconds: 120,
    maxRounds: 3,
  };

  // ─── State ───
  const [isStarted, setIsStarted] = useState(false);
  const [allInsights, setAllInsights] = useState<PartyInsight[]>(sessionState.partyInsights ?? []);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [partyReport, setPartyReport] = useState<PartyReport | null>(sessionState.partyReport ?? null);

  // Persona rounds tracking
  const [rounds, setRounds] = useState<PersonaRound[]>([]);
  const [currentRound, setCurrentRound] = useState<PersonaRound | null>(null);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
  const [conversationSummary, setConversationSummary] = useState('');

  // Roster confirmation
  const [pendingRoster, setPendingRoster] = useState<ParsedRoster | null>(null);

  // Call pool state
  const [callPool, setCallPool] = useState<CallPoolState>({ running: 0, queued: 0, completed: 0, timedOut: 0 });

  // Convergence state
  const [isConverging, setIsConverging] = useState(false);

  // Tab for right panel persona cards: null = "All", string = personaId
  const [activePersonaTab, setActivePersonaTab] = useState<string | null>(null);

  const currentExecuteRef = useRef<number>(0);

  // ─── Orchestrator Agent ───
  const orchestrator = useAgentStream({
    runtimeId: config.workshopRuntimeId,
    systemPrompt: PARTY_ORCHESTRATOR_PROMPT,
    greetingMessage: PARTY_GREETING,
    useSessions: true,
    persistMessages: true,
    storageKey: 'party-mode-orchestrator',
  });

  // ─── Build display messages ───
  const displayMessages: ChatMessage[] = useMemo(() => {
    const messages: ChatMessage[] = [];
    const hasUserMessage = orchestrator.messages.some((m) => m.role === 'user');

    for (let i = 0; i < orchestrator.messages.length; i++) {
      const msg = orchestrator.messages[i];

      // Skip greeting message once user has sent their first message
      if (hasUserMessage && i === 0 && msg.role === 'assistant' && !msg.isToolCall && !msg.workshopType) {
        continue;
      }

      if (msg.role === 'user') {
        messages.push(msg);
        continue;
      }

      const roster = parseRosterMarker(msg.content);
      const note = parseOrchestratorNote(msg.content);
      const report = parseReportMarker(msg.content);

      if (roster) {
        const cleanText = msg.content
          .replace(/<!-- workshop:party-roster -->[\s\S]*?<!-- \/workshop:party-roster -->/, '')
          .trim();
        if (cleanText) {
          messages.push({ ...msg, content: cleanText });
        }
      } else if (report) {
        messages.push({
          role: 'assistant',
          content: '',
          workshopType: 'party-report',
          workshopPayload: { type: 'party-report', data: report },
        });
      } else if (note) {
        messages.push({
          role: 'assistant',
          content: '',
          workshopType: 'orchestrator-note',
          workshopPayload: { type: 'orchestrator-note', data: { note } },
        });
      } else {
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
      // Show roster confirmation UI instead of auto-executing
      setPendingRoster(roster);
    }
  }, [orchestrator.messages]);

  // ─── Execute persona sequence with pipeline context and concurrency control ───
  const executePersonaSequence = useCallback(
    async (personaIds: string[], topic: string) => {
      currentExecuteRef.current += 1;
      const executeId = currentExecuteRef.current;
      const roundNumber = rounds.length + 1;

      const roundId = `round-${Date.now()}`;
      const newRound: PersonaRound = {
        id: roundId,
        roundNumber,
        selectedPersonas: personaIds,
        topic,
        responses: {},
        loading: {},
        note: null,
      };

      for (const pid of personaIds) {
        newRound.loading[pid] = true;
      }

      setCurrentRound(newRound);
      setActivePersonaId(personaIds[0] ?? null);
      setCallPool({ running: Math.min(personaIds.length, config.maxConcurrent), queued: Math.max(0, personaIds.length - config.maxConcurrent), completed: 0, timedOut: 0 });

      const responses: Array<{ personaId: string; personaName: string; content: string }> = [];

      for (const personaId of personaIds) {
        if (currentExecuteRef.current !== executeId) break;

        const persona = getPersonaById(personaId);
        if (!persona) continue;

        setActivePersonaId(personaId);

        // Build prompt with full pipeline context from previous responses
        const prompt = buildPersonaPrompt(personaId, topic, responses, conversationSummary);

        if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
          try {
            const { invoke } = await import('@tauri-apps/api/core');

            // Capture mode: route streaming output to persona's card, not orchestrator chat.
            // captureUntilDone returns a Promise that resolves when is_done arrives.
            let capturedText = '';
            const donePromise = orchestrator.captureUntilDone((text: string) => {
              capturedText += text;
              // Update the persona card in real-time
              setCurrentRound((prev) => {
                if (!prev || prev.id !== roundId) return prev;
                return {
                  ...prev,
                  responses: { ...prev.responses, [personaId]: capturedText },
                  loading: { ...prev.loading, [personaId]: false },
                };
              });
            });

            await invoke('runtime_execute', {
              runtimeId: config.workshopRuntimeId,
              message: topic,
              sessionId: null,
              systemPrompt: prompt,
            });

            // Wait for streaming to complete (is_done signal) before moving to next persona
            await donePromise;

            // Stop capturing — route back to orchestrator chat
            orchestrator.setCapture(null);

            if (capturedText.trim()) {
              responses.push({ personaId, personaName: persona.name, content: capturedText.trim() });

              setCallPool((prev) => ({
                ...prev,
                running: Math.max(0, prev.running - 1),
                completed: prev.completed + 1,
              }));
            }
          } catch (e) {
            orchestrator.setCapture(null);
            console.error(`[PartyMode] Error executing persona ${personaId}:`, e);
          }
        } else {
          // Dev fallback: simulate with delay
          await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
          const simulated = getSimulatedResponse(personaId);

          responses.push({ personaId, personaName: persona.name, content: simulated });

          setCurrentRound((prev) => {
            if (!prev || prev.id !== roundId) return prev;
            return {
              ...prev,
              responses: { ...prev.responses, [personaId]: simulated },
              loading: { ...prev.loading, [personaId]: false },
            };
          });

          setCallPool((prev) => ({
            ...prev,
            running: Math.max(0, prev.running - 1),
            completed: prev.completed + 1,
          }));
        }
      }

      // Complete the round
      if (currentExecuteRef.current === executeId) {
        setActivePersonaId(null);
        setCallPool({ running: 0, queued: 0, completed: personaIds.length, timedOut: 0 });

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

        // Extract insights (full content, no truncation)
        const newInsights: PartyInsight[] = responses.map((r) => ({
          personaId: r.personaId,
          personaName: r.personaName,
          content: r.content,
          timestamp: Date.now(),
        }));
        const updatedInsights = [...allInsights, ...newInsights];
        setAllInsights(updatedInsights);
        onInsightsChange(updatedInsights);

        // Update summary — keep full content for pipeline context, limit to last ~2000 chars
        const roundSummary = responses
          .map((r) => `${r.personaName}: ${r.content}`)
          .join('\n\n');
        const newSummary = conversationSummary
          ? `${conversationSummary}\n\n---\n\n${roundSummary}`
          : roundSummary;
        setConversationSummary(newSummary.length > 2000 ? newSummary.slice(-2000) : newSummary);

        // Auto-summary: send persona outputs to left chat for agent summary
        // Filter out tool call noise — only send each persona's actual perspective content
        // (skip at max rounds — convergence handles the final summary)
        if (roundNumber < config.maxRounds && responses.length > 0) {
          const personaOutputs = responses.map((r) =>
            `### ${r.personaName}\n${filterToolCallText(r.content)}`
          ).join('\n\n');
          orchestrator.sendMessage(
            `[Round ${roundNumber} — Discussion Results]\n\n${personaOutputs}\n\n---\n\n请基于以上所有角色的讨论结果，给出一份综合总结，包括：\n1. 各角色的核心观点\n2. 共识点\n3. 分歧点\n4. 建议的下一步`
          );
        }

        // Check if max rounds reached → trigger convergence
        if (roundNumber >= config.maxRounds) {
          triggerConvergence(topic);
        }
      }
    },
    [conversationSummary, allInsights, onInsightsChange, rounds.length, config, orchestrator],
  );

  // ─── Trigger convergence ───
  const triggerConvergence = useCallback(
    (topic: string) => {
      setIsConverging(true);

      const allRoundResponses = rounds.map((round) =>
        round.selectedPersonas
          .map((pid) => {
            const persona = getPersonaById(pid);
            const content = round.responses[pid];
            if (!persona || !content) return null;
            return { personaId: pid, personaName: persona.name, content };
          })
          .filter(Boolean) as Array<{ personaId: string; personaName: string; content: string }>,
      );

      // Add current round if exists
      if (currentRound) {
        const currentResponses = currentRound.selectedPersonas
          .map((pid) => {
            const persona = getPersonaById(pid);
            const content = currentRound.responses[pid];
            if (!persona || !content) return null;
            return { personaId: pid, personaName: persona.name, content };
          })
          .filter(Boolean) as Array<{ personaId: string; personaName: string; content: string }>;
        allRoundResponses.push(currentResponses);
      }

      const convergencePrompt = buildConvergencePrompt(topic, allRoundResponses);

      // Send convergence request to orchestrator
      orchestrator.sendMessage(convergencePrompt);

      // Dev fallback: generate a simulated report
      if (!(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window)) {
        setTimeout(() => {
          const report: PartyReport = {
            consensus: [
              'All personas agree the core concept has merit',
              'Phased implementation is preferred over big-bang delivery',
            ],
            disagreements: [
              'Winston favors MVP-first while Alex wants robust architecture upfront',
              'Sally prioritizes simplicity while Marcus emphasizes comprehensive error handling',
            ],
            recommendedActions: [
              'Start with core functionality, validate with users before expanding',
              'Define clear API boundaries to allow independent evolution',
              'Establish performance budgets before implementation begins',
              'Create a testing strategy covering edge cases from day one',
            ],
            risks: [
              'Scope creep if boundaries aren\'t clearly defined early',
              'Technical debt if architecture is shortchanged for speed',
            ],
            summary: 'The panel generally supports the proposed approach with caveats around scope management and technical foundations. Key tension exists between shipping speed and architectural robustness.',
            generatedAt: Date.now(),
            topic,
            rounds: rounds.length,
          };

          setPartyReport(report);
          setIsConverging(false);
          if (onReportGenerated) onReportGenerated(report);
        }, 1500);
      }
    },
    [rounds, currentRound, orchestrator, onReportGenerated],
  );

  // ─── Watch for report from orchestrator ───
  useEffect(() => {
    const lastMsg = orchestrator.messages[orchestrator.messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return;

    const report = parseReportMarker(lastMsg.content);
    if (report) {
      const fullReport: PartyReport = {
        consensus: report.consensus ?? [],
        disagreements: report.disagreements ?? [],
        recommendedActions: report.recommended_actions ?? [],
        risks: report.risks ?? [],
        summary: report.summary ?? '',
        generatedAt: Date.now(),
        topic: currentRound?.topic ?? '',
        rounds: rounds.length,
      };
      setPartyReport(fullReport);
      setIsConverging(false);
      if (onReportGenerated) onReportGenerated(fullReport);
    }
  }, [orchestrator.messages, onReportGenerated, rounds.length]);

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
        executePersonaSequence(mentions, text);
        orchestrator.sendMessage(text);
      } else {
        orchestrator.sendMessage(text);
      }
    },
    [orchestrator, executePersonaSequence],
  );

  // ─── Roster confirm/cancel handlers ───
  const handleRosterConfirm = useCallback(
    (selectedIds: string[]) => {
      if (pendingRoster) {
        executePersonaSequence(selectedIds, pendingRoster.topic_summary);
      }
      setPendingRoster(null);
    },
    [pendingRoster, executePersonaSequence],
  );

  const handleRosterCancel = useCallback(() => {
    setPendingRoster(null);
  }, []);

  // ─── Custom message renderer ───
  const renderWorkshopMessage = useCallback(
    (msg: ChatMessage, _idx: number): React.ReactNode | null => {
      if (msg.workshopType === 'orchestrator-note' && msg.workshopPayload) {
        const payload = msg.workshopPayload as { data: { note: string } };
        if (payload.data.note) {
          return <OrchestratorNoteMessage note={payload.data.note} />;
        }
      }
      if (msg.workshopType === 'party-report' && msg.workshopPayload) {
        // Report is rendered via partyReport state instead
        return null;
      }
      return null;
    },
    [],
  );

  // ─── Build persona cards for current round + completed rounds ───
  const personaCardsSection = useMemo(() => {
    const cards: React.ReactNode[] = [];

    for (const round of rounds) {
      if (round.roundNumber > 1) {
        cards.push(
          <div key={`round-label-${round.id}`} className="flex items-center gap-2 py-1">
            <span className="text-[9px] font-bold text-on-surface-variant">Round {round.roundNumber}</span>
            <div className="flex-1 h-px bg-outline-variant/10" />
          </div>,
        );
      }
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

    // Report card
    if (partyReport) {
      cards.push(
        <ReportCard
          key="convergence-report"
          report={partyReport}
          onCreatePRD={onCreatePRD}
        />,
      );
    }

    return cards;
  }, [rounds, currentRound, activePersonaId, partyReport, onCreatePRD]);

  // ─── Build list of unique persona IDs with responses (for tabs) ───
  const personaTabIds = useMemo(() => {
    const ids = new Set<string>();
    for (const round of rounds) {
      for (const pid of round.selectedPersonas) {
        if (round.responses[pid]) ids.add(pid);
      }
    }
    if (currentRound) {
      for (const pid of currentRound.selectedPersonas) {
        if (currentRound.responses[pid] || currentRound.loading[pid]) ids.add(pid);
      }
    }
    return Array.from(ids);
  }, [rounds, currentRound]);

  // ─── Filtered cards for active tab ───
  const filteredPersonaCards = useMemo(() => {
    if (!activePersonaTab) return personaCardsSection;
    // Filter to show only cards matching the active persona tab
    return personaCardsSection.filter((card) => {
      if (!React.isValidElement(card)) return true;
      const props = card.props as Record<string, any>;
      // Keep round labels and report cards
      if (!props.personaId) return true;
      return props.personaId === activePersonaTab;
    });
  }, [activePersonaTab, personaCardsSection]);

  // ─── Input addons with PersonaReferencePicker ───
  const inputAddons = useMemo(
    () => (
      <div className="relative">
        {mentionPickerOpen && (
          <PersonaReferencePicker
            filter={mentionFilter}
            onSelect={() => {
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

  // ─── Round indicator ───
  const roundIndicator = useMemo(() => {
    const currentRoundNum = rounds.length + (currentRound ? 1 : 0);
    if (currentRoundNum === 0 && !currentRound) return null;
    return (
      <span className="text-[9px] text-on-surface-variant">
        Round {currentRoundNum}/{config.maxRounds}
      </span>
    );
  }, [rounds.length, currentRound, config.maxRounds]);

  // ─── Render: Welcome page ───
  if (!isStarted || orchestrator.connectionState === 'disconnected') {
    return (
      <div className={cn("flex flex-col h-full w-full bg-surface", className)}>
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

          {/* Persona Grid by Category */}
          <div className="max-w-md w-full space-y-3">
            {(Object.entries(PERSONA_CATEGORIES) as [PersonaCategory, { label: string; icon: React.ReactNode }][])
              .map(([cat, info]) => {
                const personas = ALL_PERSONAS.filter((p) => p.category === cat);
                if (personas.length === 0) return null;
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-xs">{info.icon}</span>
                      <span className="text-[9px] font-bold text-on-surface-variant">{info.label}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {personas.map((persona) => (
                        <div
                          key={persona.id}
                          className={cn(
                            'p-2 rounded-md border border-outline-variant/10 bg-surface-container-low',
                            'hover:border-outline-variant/30 transition-colors',
                          )}
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-sm">{persona.icon}</span>
                            <span className="text-[10px] font-bold text-on-surface">{persona.name}</span>
                          </div>
                          <p className="text-[9px] text-on-surface-variant line-clamp-1">{persona.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>

          {sessionState.partyInsights && sessionState.partyInsights.length > 0 && (
            <span className="mt-4 px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary/20 text-primary">
              {sessionState.partyInsights.length} insights collected
            </span>
          )}

          <button
            onClick={handleStartSession}
            className="mt-6 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors"
          >
            Start Party Session
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Discussion view ───
  return (
    <div className={cn("flex flex-col h-full w-full bg-surface", className)}>
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
          {isConverging && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-400/20 text-amber-400">
              <Loader2 size={9} className="animate-spin" /> Generating report...
            </span>
          )}
          {roundIndicator}
        </div>
        <div className="flex items-center gap-2">
          {(callPool.running > 0 || callPool.queued > 0) && (
            <ProcessStatus pool={callPool} total={rounds.reduce((s, r) => s + r.selectedPersonas.length, 0) + (currentRound?.selectedPersonas.length ?? 0)} />
          )}
          <span className="text-[9px] text-on-surface-variant">{ALL_PERSONAS.length} personas</span>
          {allInsights.length > 0 && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-tertiary/20 text-tertiary">
              {allInsights.length} insights
            </span>
          )}
          <button
            onClick={() => {
              orchestrator.newSession();
              setIsStarted(false);
              setRounds([]);
              setCurrentRound(null);
              setActivePersonaId(null);
              setAllInsights([]);
              setPartyReport(null);
              setConversationSummary('');
              setPendingRoster(null);
              setCallPool({ running: 0, queued: 0, completed: 0, timedOut: 0 });
            }}
            className="p-1.5 rounded-md hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-on-surface"
            title="New Session"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Roster Confirmation (inline) */}
      {pendingRoster && (
        <div className="px-4 py-2 border-b border-outline-variant/10 bg-surface-container-low/50">
          <PersonaRosterConfirm
            recommendedPersonas={pendingRoster.personas}
            onConfirm={handleRosterConfirm}
            onCancel={handleRosterCancel}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <WorkshopChatPanel
          messages={displayMessages}
          isStreaming={orchestrator.isStreaming || activePersonaId !== null || isConverging}
          onSendMessage={handleSendMessage}
          placeholder={
            isConverging
              ? 'Generating convergence report...'
              : activePersonaId
                ? `Waiting for ${getPersonaById(activePersonaId)?.name ?? 'persona'}...`
                : 'Enter a topic for the panel, or @name to address a specific persona...'
          }
          renderWorkshopMessage={renderWorkshopMessage}
          inputAddons={inputAddons}
          agentStatus={orchestrator.agentStatus}
          rightPanel={
            personaCardsSection.length > 0 ? (
              <div className="flex flex-col h-full">
                {/* Tab Bar */}
                <div className="flex items-center gap-0.5 px-3 py-2 border-b border-outline-variant/10 shrink-0 overflow-x-auto">
                  <button
                    onClick={() => setActivePersonaTab(null)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 text-[9px] font-bold rounded-md transition-colors shrink-0',
                      activePersonaTab === null
                        ? 'bg-tertiary/15 text-tertiary'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                    )}
                  >
                    <Users size={9} />
                    All
                  </button>
                  {personaTabIds.map((pid) => {
                    const persona = getPersonaById(pid);
                    if (!persona) return null;
                    const isActive = activePersonaId === pid;
                    return (
                      <button
                        key={pid}
                        onClick={() => setActivePersonaTab(pid)}
                        className={cn(
                          'flex items-center gap-1 px-2 py-1 text-[9px] font-bold rounded-md transition-colors shrink-0',
                          activePersonaTab === pid
                            ? 'bg-tertiary/15 text-tertiary'
                            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                        )}
                      >
                        <span className="text-[10px]">{persona.icon}</span>
                        {persona.name}
                        {isActive && <Loader2 size={7} className="animate-spin text-amber-400 ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
                {/* Card Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {filteredPersonaCards}
                </div>
              </div>
            ) : undefined
          }
        />
      </div>
    </div>
  );
};
