import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { FileText, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAgentStream } from '../../lib/useAgentStream';
import type { ChatMessage } from '../../lib/useAgentStream';
import type {
  BMADSessionState,
  PRDDocument,
  PRDSection,
  PRDIntent,
  PRDStakeLevel,
  PRDMode,
  Assumption,
} from '../../types';
import { PRD_SYSTEM_PROMPT, PRD_GREETING } from '../../lib/bmad/prd-prompts';
import { WorkshopChatPanel } from './WorkshopChatPanel';
import { IntentSelector, type IntentOption } from './IntentSelector';
import { StakeCalibration, type StakeOption } from './StakeCalibration';
import { WorkModeSelector, type WorkModeOption } from './WorkModeSelector';
import { PRDDocumentPreview } from './PRDDocumentPreview';
import { ValidationReport, type ValidationReportData } from './ValidationReport';
import { FinalizationChecklist, type FinalizationStep } from './FinalizationChecklist';

// ─── Props ───

interface PrdCreationPanelProps {
  workspacePath: string;
  sessionState: BMADSessionState;
  onDocumentChange: (doc: PRDDocument) => void;
  className?: string;
}

// ─── HTML-comment marker parsers ───

interface ParsedIntentSelector {
  options: IntentOption[];
}

interface ParsedStakeCalibration {
  options: StakeOption[];
}

interface ParsedWorkModeSelector {
  options: WorkModeOption[];
}

interface ParsedPrdSection {
  id: string;
  title: string;
  status: 'complete' | 'in-progress' | 'empty';
  content: string;
}

interface ParsedPrdComplete {
  title: string;
  sectionCount: number;
  assumptionCount: number;
  status: string;
}

interface ParsedValidationReport extends ValidationReportData {}

interface ParsedFinalizationStep {
  step: number;
  title: string;
  status: 'complete' | 'in-progress' | 'pending';
  note?: string;
}

interface ParsedPrdFinal {
  title: string;
  status: string;
  readyForFeature: boolean;
}

type PrdPayload =
  | { type: 'intent-selector'; data: ParsedIntentSelector }
  | { type: 'stake-calibration'; data: ParsedStakeCalibration }
  | { type: 'work-mode-selector'; data: ParsedWorkModeSelector }
  | { type: 'prd-section'; data: ParsedPrdSection }
  | { type: 'prd-complete'; data: ParsedPrdComplete }
  | { type: 'validation-report'; data: ParsedValidationReport }
  | { type: 'finalization-step'; data: ParsedFinalizationStep }
  | { type: 'prd-final'; data: ParsedPrdFinal };

function parsePrdMarker(content: string): { text: string; payload: PrdPayload | null } {
  // Try each marker type in order of specificity
  const markers: Array<{ tag: string; type: PrdPayload['type'] }> = [
    { tag: 'intent-selector', type: 'intent-selector' },
    { tag: 'stake-calibration', type: 'stake-calibration' },
    { tag: 'work-mode-selector', type: 'work-mode-selector' },
    { tag: 'prd-section', type: 'prd-section' },
    { tag: 'prd-complete', type: 'prd-complete' },
    { tag: 'validation-report', type: 'validation-report' },
    { tag: 'finalization-step', type: 'finalization-step' },
    { tag: 'prd-final', type: 'prd-final' },
  ];

  for (const { tag, type } of markers) {
    const regex = new RegExp(
      `<!-- workshop:${tag} -->\\s*({[\\s\\S]*?})\\s*<!-- /workshop:${tag} -->`
    );
    const match = content.match(regex);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        const cleanText = content.replace(
          new RegExp(`<!-- workshop:${tag} -->[\\s\\S]*?<!-- /workshop:${tag} -->`),
          ''
        ).trim();
        return { text: cleanText, payload: { type, data } as PrdPayload };
      } catch {
        // ignore parse errors
      }
    }
  }

  return { text: content, payload: null };
}

// ─── Extract assumptions from content ───

function extractAssumptions(sections: PRDSection[]): Assumption[] {
  const assumptions: Assumption[] = [];
  for (const section of sections) {
    const regex = /\[ASSUMPTION:\s*([^\]]+)\]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(section.content)) !== null) {
      assumptions.push({
        id: `asm-${assumptions.length}`,
        text: match[1].trim(),
        confirmed: false,
      });
    }
  }
  return assumptions;
}

// ─── PRD Phase ───

type PrdPhase = 'discovery' | 'writing' | 'validation' | 'finalization';

// ─── Component ───

export const PrdCreationPanel: React.FC<PrdCreationPanelProps> = ({
  workspacePath,
  sessionState,
  onDocumentChange,
  className,
}) => {
  // ─── State ───
  const [isStarted, setIsStarted] = useState(false);
  const [prdPhase, setPrdPhase] = useState<PrdPhase>('discovery');
  const [intent, setIntent] = useState<PRDIntent | null>(null);
  const [stakeLevel, setStakeLevel] = useState<PRDStakeLevel | null>(null);
  const [mode, setMode] = useState<PRDMode | null>(null);
  const [prdTitle, setPrdTitle] = useState('');
  const [prdSections, setPrdSections] = useState<PRDSection[]>([]);
  const [assumptions, setAssumptions] = useState<Assumption[]>([]);
  const [validationReport, setValidationReport] = useState<ValidationReportData | null>(null);
  const [finalizationSteps, setFinalizationSteps] = useState<FinalizationStep[]>([
    { step: 1, title: 'Decision Log Audit', status: 'pending' },
    { step: 2, title: 'Input Coordination', status: 'pending' },
    { step: 3, title: 'Reviewer Checkpoint', status: 'pending' },
    { step: 4, title: 'Open Items Triage', status: 'pending' },
    { step: 5, title: 'Document Polish', status: 'pending' },
    { step: 6, title: 'External Handoff', status: 'pending' },
    { step: 7, title: 'Close', status: 'pending' },
  ]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // Drag-to-resize state
  const [splitRatio, setSplitRatio] = useState(0.45);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // ─── Agent Stream ───
  const agent = useAgentStream({
    runtimeId: 'agent-sdk',
    systemPrompt: PRD_SYSTEM_PROMPT,
    greetingMessage: PRD_GREETING,
    useSessions: true,
    persistMessages: true,
    storageKey: 'prd-creation-workshop',
  });

  // ─── Parse messages for PRD payloads ───
  const parsedMessages = useMemo(() => {
    return agent.messages.map((msg) => {
      if (msg.role === 'assistant' && !msg.isToolCall) {
        const { text, payload } = parsePrdMarker(msg.content);
        return { ...msg, content: text, workshopPayload: payload };
      }
      return msg;
    });
  }, [agent.messages]);

  // ─── Watch for structured payloads from agent ───
  const lastProcessedRef = useRef<string>('');
  useEffect(() => {
    const lastMsg = parsedMessages[parsedMessages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return;
    if (lastMsg.content === lastProcessedRef.current) return;
    lastProcessedRef.current = lastMsg.content;

    const payload = (lastMsg as any).workshopPayload as PrdPayload | null | undefined;
    if (!payload) return;

    switch (payload.type) {
      case 'prd-section': {
        const sec = payload.data as ParsedPrdSection;
        setPrdSections((prev) => {
          const existing = prev.findIndex((s) => s.id === sec.id);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = { ...updated[existing], ...sec };
            return updated;
          }
          return [...prev, { id: sec.id, title: sec.title, status: sec.status, content: sec.content }];
        });
        if (sec.status === 'in-progress') {
          setActiveSectionId(sec.id);
        }
        break;
      }
      case 'prd-complete': {
        const data = payload.data as ParsedPrdComplete;
        setPrdTitle(data.title);
        setPrdPhase('validation');
        break;
      }
      case 'validation-report': {
        const report = payload.data as ParsedValidationReport;
        setValidationReport(report);
        break;
      }
      case 'finalization-step': {
        const step = payload.data as ParsedFinalizationStep;
        setFinalizationSteps((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex((s) => s.step === step.step);
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], ...step };
          }
          return updated;
        });
        break;
      }
      case 'prd-final': {
        const data = payload.data as ParsedPrdFinal;
        if (data.readyForFeature) {
          setPrdPhase('finalization');
        }
        break;
      }
    }
  }, [parsedMessages]);

  // ─── Update PRD document state for parent ───
  useEffect(() => {
    if (prdSections.length > 0) {
      const extractedAssumptions = extractAssumptions(prdSections);
      setAssumptions(extractedAssumptions);

      onDocumentChange({
        title: prdTitle,
        sections: prdSections,
        assumptions: extractedAssumptions,
        stakeLevel: stakeLevel ?? 'hobby',
        mode: mode ?? 'fast-path',
        timestamp: Date.now(),
      });
    }
  }, [prdSections, prdTitle, stakeLevel, mode, onDocumentChange]);

  // ─── Drag-to-resize handler ───
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = Math.min(0.75, Math.max(0.25, (ev.clientX - rect.left) / rect.width));
      setSplitRatio(ratio);
    };

    const handleMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // ─── Assumption handlers ───
  const handleConfirmAssumption = useCallback((id: string) => {
    setAssumptions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, confirmed: true } : a))
    );
  }, []);

  const handleEditAssumption = useCallback((id: string, newText: string) => {
    setAssumptions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, text: newText } : a))
    );
  }, []);

  // ─── Save PRD to workspace ───
  const handleSavePrd = useCallback(async () => {
    if (!prdSections.length || !prdTitle) return;

    const prdContent = [
      `# ${prdTitle}`,
      '',
      `> PRD Document | Stake Level: ${stakeLevel ?? 'hobby'} | Mode: ${mode ?? 'fast-path'}`,
      `> Generated: ${new Date().toISOString()}`,
      '',
      ...prdSections.map((s) => `## ${s.title}\n\n${s.content}`),
    ].join('\n\n');

    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const filename = prdTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'prd';
        await invoke('write_text_file', {
          path: `${workspacePath}/docs/${filename}-prd.md`,
          content: prdContent,
        });
      } catch (e) {
        console.error('[PRD] Error saving PRD file:', e);
      }
    }
  }, [prdTitle, prdSections, stakeLevel, mode, workspacePath]);

  // ─── Discovery selection handlers ───
  const handleIntentSelect = useCallback((id: string) => {
    setIntent(id as PRDIntent);
    agent.sendMessage(id);
  }, [agent]);

  const handleStakeSelect = useCallback((id: string) => {
    setStakeLevel(id as PRDStakeLevel);
    agent.sendMessage(id);
  }, [agent]);

  const handleModeSelect = useCallback((id: string) => {
    setMode(id as PRDMode);
    setPrdPhase('writing');
    agent.sendMessage(id);
  }, [agent]);

  // ─── Send message handler ───
  const handleSendMessage = useCallback((text: string) => {
    agent.sendMessage(text);
  }, [agent]);

  // ─── Create Feature handler ───
  const handleCreateFeature = useCallback(async () => {
    // Build PRD content as markdown
    const prdContent = prdSections
      .map((s) => `## ${s.title}\n\n${s.content}`)
      .join('\n\n');

    // Generate a slug from the PRD title
    const slug = prdTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || `prd-${Date.now()}`;
    const featureId = `feat-${slug}`;

    // Use the createFeature IPC (matches CreateFeatureRequest in Rust)
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('create_feature_from_agent', {
          parentId: 'feat-bmad-workshop',
          plan: {
            id: featureId,
            name: prdTitle,
            priority: 50,
            size: 'M',
            dependencies: [],
            description: prdContent,
            valuePoints: [],
            tasks: [],
          },
        });
      } catch (e) {
        console.error('[PRD] Error creating feature:', e);
      }
    }
  }, [prdTitle, prdSections]);

  // ─── Custom message renderer ───
  const renderWorkshopMessage = useCallback(
    (msg: ChatMessage, _idx: number): React.ReactNode | null => {
      if (msg.role !== 'assistant') return null;

      const payload = msg.workshopPayload as PrdPayload | null | undefined;
      if (!payload) return null;

      switch (payload.type) {
        case 'intent-selector':
          return (
            <IntentSelector
              options={payload.data.options}
              onSelect={handleIntentSelect}
              disabled={agent.isStreaming}
            />
          );

        case 'stake-calibration':
          return (
            <StakeCalibration
              options={payload.data.options}
              onSelect={handleStakeSelect}
              disabled={agent.isStreaming}
            />
          );

        case 'work-mode-selector':
          return (
            <WorkModeSelector
              options={payload.data.options}
              onSelect={handleModeSelect}
              disabled={agent.isStreaming}
            />
          );

        case 'validation-report':
          return <ValidationReport report={payload.data} />;

        case 'prd-final':
          return (
            <FinalizationChecklist
              steps={finalizationSteps}
              allComplete={finalizationSteps.every((s) => s.status === 'complete')}
              onCreateFeature={handleCreateFeature}
            />
          );

        default:
          return null;
      }
    },
    [handleIntentSelect, handleStakeSelect, handleModeSelect, agent.isStreaming, finalizationSteps, handleCreateFeature],
  );

  // ─── Build right panel for chat (validation report in chat context) ───
  const chatRightPanel = useMemo(() => {
    if (prdPhase === 'discovery' || !prdSections.length) return undefined;
    return undefined; // PRD preview is in the split view, not in chat right panel
  }, [prdPhase, prdSections]);

  // ─── Welcome screen ───
  if (!isStarted || agent.connectionState === 'disconnected') {
    return (
      <div className={cn("flex flex-col h-full w-full bg-surface", className)}>
        <div className="flex items-center justify-between px-4 py-2 bg-surface-container-low border-b border-outline-variant/10 shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            <span className="text-xs font-headline font-bold text-on-surface">Create PRD</span>
          </div>
          <div className="flex items-center gap-2">
            {sessionState.brainstormOutput && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-secondary/20 text-secondary">
                Brainstorm
              </span>
            )}
            {sessionState.partyInsights && sessionState.partyInsights.length > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-tertiary/20 text-tertiary">
                {sessionState.partyInsights.length} insights
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="p-4 rounded-2xl bg-surface-container-high">
              <FileText size={32} className="text-primary" />
            </div>
            <h2 className="text-sm font-headline font-bold text-on-surface">Create PRD</h2>
            <p className="text-[10px] text-on-surface-variant max-w-xs text-center leading-relaxed">
              AI-guided PRD creation with coaching mode. Import brainstorm ideas and party mode
              insights to build comprehensive product requirements.
            </p>
          </div>

          {/* Context badges */}
          <div className="flex items-center gap-2 mb-4">
            {sessionState.brainstormOutput && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-secondary/20 text-secondary">
                {sessionState.brainstormOutput.ideas.length} brainstorm ideas
              </span>
            )}
            {sessionState.partyInsights && sessionState.partyInsights.length > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-tertiary/20 text-tertiary">
                {sessionState.partyInsights.length} party insights
              </span>
            )}
          </div>

          {!(sessionState.brainstormOutput || sessionState.partyInsights?.length) && (
            <p className="text-[9px] text-on-surface-variant/60 italic mb-4">
              Complete Brainstorm or Party Mode first to feed outputs here
            </p>
          )}

          <button
            onClick={async () => {
              setIsStarted(true);
              await agent.startSession();
            }}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors"
          >
            Start PRD Session
          </button>
        </div>
      </div>
    );
  }

  // ─── Main split layout: Chat left, PRD Preview right ───
  return (
    <div className={cn("flex flex-col h-full w-full bg-surface", className)}>
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-container-low border-b border-outline-variant/10 shrink-0">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-primary" />
          <span className="text-xs font-headline font-bold text-on-surface">Create PRD</span>
          {prdPhase !== 'discovery' && (
            <span className={cn(
              'px-1.5 py-0.5 text-[9px] font-bold rounded',
              prdPhase === 'writing' ? 'bg-primary/10 text-primary' :
              prdPhase === 'validation' ? 'bg-warning/10 text-warning' :
              'bg-tertiary/10 text-tertiary',
            )}>
              {prdPhase}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {intent && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-surface-container-high text-on-surface-variant">
              {intent}
            </span>
          )}
          {stakeLevel && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-surface-container-high text-on-surface-variant">
              {stakeLevel}
            </span>
          )}
          {mode && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-primary/10 text-primary">
              {mode === 'fast-path' ? 'Fast' : 'Coaching'}
            </span>
          )}
          {prdSections.length > 0 && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-primary/20 text-primary">
              {prdSections.filter((s) => s.status === 'complete').length}/{prdSections.length}
            </span>
          )}
          <button
            onClick={() => {
              agent.newSession();
              setIsStarted(false);
              setPrdPhase('discovery');
              setIntent(null);
              setStakeLevel(null);
              setMode(null);
              setPrdTitle('');
              setPrdSections([]);
              setAssumptions([]);
              setValidationReport(null);
            }}
            className="p-1.5 rounded-md hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-on-surface"
            title="New Session"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Split Layout */}
      <div ref={containerRef} className="flex-1 overflow-hidden flex">
        {/* Left: Chat Panel */}
        <div
          className="flex shrink-0 overflow-hidden"
          style={{ width: `${splitRatio * 100}%` }}
        >
          <WorkshopChatPanel
            messages={parsedMessages}
            isStreaming={agent.isStreaming}
            onSendMessage={handleSendMessage}
            placeholder={
              prdPhase === 'discovery'
                ? 'Describe your product idea...'
                : prdPhase === 'writing'
                  ? 'Share your thoughts or answer the agent\'s questions...'
                  : prdPhase === 'validation'
                    ? 'Review the validation report and suggest improvements...'
                    : 'Finalize your PRD...'
            }
            renderWorkshopMessage={renderWorkshopMessage}
          />
        </div>

        {/* Drag divider */}
        <div
          onMouseDown={handleMouseDown}
          className="w-1.5 cursor-col-resize bg-outline-variant/10 hover:bg-primary/30 transition-colors shrink-0"
        />

        {/* Right: PRD Preview */}
        <div className="flex-1 overflow-hidden">
          <PRDDocumentPreview
            title={prdTitle}
            sections={prdSections}
            assumptions={assumptions}
            onConfirmAssumption={handleConfirmAssumption}
            onEditAssumption={handleEditAssumption}
            activeSectionId={activeSectionId ?? undefined}
            onSectionClick={setActiveSectionId}
          />
        </div>
      </div>
    </div>
  );
};
