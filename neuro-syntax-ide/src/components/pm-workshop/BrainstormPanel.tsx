import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Lightbulb, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { useAgentStream } from '../../lib/useAgentStream';
import type { ChatMessage } from '../../lib/useAgentStream';
import type { BMADSessionState, BrainstormOutput, BrainstormIdea, BrainstormStep, StepProgressPayload } from '../../types';
import { BRAINSTORM_SYSTEM_PROMPT } from '../../lib/bmad/brainstorm-prompts';
import { parseStepProgressMarker, extractLatestStepProgress } from '../../lib/bmad/workshop-markers';
import { ProgressStepper } from './ProgressStepper';
import { IdeaCounterBadge } from './IdeaCounterBadge';
import { WorkshopChatPanel } from './WorkshopChatPanel';
import { OptionCardMessage, type OptionItem } from './OptionCardMessage';
import { IdeaCardMessage } from './IdeaCardMessage';
import { EnergyCheckpointMessage } from './EnergyCheckpointMessage';
import { ActionMenuMessage } from './ActionMenuMessage';

interface BrainstormPanelProps {
  workspacePath: string;
  sessionState: BMADSessionState;
  onOutputChange: (output: BrainstormOutput) => void;
  className?: string;
}

// ─── HTML-comment marker parser ───

interface ParsedWorkshopPayload {
  type: 'option-card' | 'idea-card' | 'energy-checkpoint' | 'action-menu';
  data: any;
}

/**
 * Parse structured HTML-comment markers from assistant message content.
 * Returns { text, payload } where text is the clean content and payload
 * is the extracted structured data (or null if no markers found).
 */
function parseWorkshopMarkers(content: string): { text: string; payload: ParsedWorkshopPayload | null } {
  // Option card (HTML-comment format)
  const optionMatch = content.match(
    /<!-- workshop:option-card -->\s*Options:\s*([\s\S]*?)<!-- \/workshop:option-card -->/
  );
  if (optionMatch) {
    const lines = optionMatch[1].trim().split('\n').filter((l) => l.trim());
    const options: OptionItem[] = lines
      .map((line) => {
        const m = line.match(/^\d+\.\s*"([^"]+)"\s*-\s*"([^"]+)"\s*-\s*"([^"]+)"/);
        if (!m) return null;
        return { id: m[1], emoji: '', title: m[2], description: m[3] };
      })
      .filter(Boolean) as OptionItem[];

    const emojiMap: Record<string, string> = {
      browse: '🔍', recommend: '🤖', random: '🎲', progressive: '📈',
    };
    options.forEach((opt) => {
      if (!opt.emoji) opt.emoji = emojiMap[opt.id] || '💡';
    });

    const cleanText = content
      .replace(/<!-- workshop:option-card -->[\s\S]*?<!-- \/workshop:option-card -->/, '')
      .trim();

    return {
      text: cleanText,
      payload: { type: 'option-card', data: { options } },
    };
  }

  // Option card ([SYSTEM] OPTIONS JSON format)
  const systemOptionMatch = content.match(
    /\[SYSTEM\]\s*"OPTIONS"\s*:\s*(\[[\s\S]*?\])/
  ) || content.match(
    /"OPTIONS"\s*:\s*(\[\s*\{[\s\S]*?"DESCRIPTION"[\s\S]*?\}\s*\])/
  );
  if (systemOptionMatch) {
    try {
      const rawOptions = JSON.parse(systemOptionMatch[1]);
      if (Array.isArray(rawOptions) && rawOptions.length > 0) {
        const options: OptionItem[] = rawOptions.map((opt: any) => ({
          id: opt.ID || opt.id || opt.LABEL || '',
          emoji: '',
          title: opt.DESCRIPTION || opt.LABEL || opt.TITLE || opt.id || '',
          description: opt.DESCRIPTION || opt.LABEL || '',
        }));
        const emojiMap: Record<string, string> = {
          hobby: '🎯', internal: '🔧', startup: '🚀', enterprise: '🏢',
          browse: '🔍', recommend: '🤖', random: '🎲', progressive: '📈',
        };
        options.forEach((opt) => {
          if (!opt.emoji) opt.emoji = emojiMap[opt.id.toLowerCase()] || '💡';
        });

        const cleanText = content
          .replace(systemOptionMatch[0], '')
          .replace(/\[SYSTEM\]\s*/g, '')
          .trim();

        return {
          text: cleanText,
          payload: { type: 'option-card', data: { options } },
        };
      }
    } catch { /* ignore parse errors */ }
  }

  // Idea card
  const ideaMatch = content.match(
    /<!-- workshop:idea-card -->\s*({[\s\S]*?})\s*<!-- \/workshop:idea-card -->/
  );
  if (ideaMatch) {
    try {
      const data = JSON.parse(ideaMatch[1]);
      const cleanText = content
        .replace(/<!-- workshop:idea-card -->[\s\S]*?<!-- \/workshop:idea-card -->/, '')
        .trim();

      return {
        text: cleanText,
        payload: { type: 'idea-card', data },
      };
    } catch { /* ignore parse errors */ }
  }

  // Energy checkpoint
  const checkpointMatch = content.match(
    /<!-- workshop:energy-checkpoint -->\s*({[\s\S]*?})\s*<!-- \/workshop:energy-checkpoint -->/
  );
  if (checkpointMatch) {
    try {
      const data = JSON.parse(checkpointMatch[1]);
      const cleanText = content
        .replace(/<!-- workshop:energy-checkpoint -->[\s\S]*?<!-- \/workshop:energy-checkpoint -->/, '')
        .trim();

      return {
        text: cleanText,
        payload: { type: 'energy-checkpoint', data },
      };
    } catch { /* ignore parse errors */ }
  }

  // Action menu
  const actionMatch = content.match(
    /<!-- workshop:action-menu -->\s*Actions:\s*([\s\S]*?)<!-- \/workshop:action-menu -->/
  );
  if (actionMatch) {
    const lines = actionMatch[1].trim().split('\n').filter((l) => l.trim());
    const actions = lines
      .map((line) => {
        const m = line.match(/^-\s*"([^"]+)"\s*-\s*"([^"]+)"\s*-\s*"([^"]+)"/);
        if (!m) return null;
        return { id: m[1], label: m[2], description: m[3] };
      })
      .filter(Boolean);

    const cleanText = content
      .replace(/<!-- workshop:action-menu -->[\s\S]*?<!-- \/workshop:action-menu -->/, '')
      .trim();

    return {
      text: cleanText,
      payload: { type: 'action-menu', data: { actions } },
    };
  }

  return { text: content, payload: null };
}

// ─── BrainstormPanel Component ───

export const BrainstormPanel: React.FC<BrainstormPanelProps> = ({
  workspacePath,
  sessionState,
  onOutputChange,
  className,
}) => {
  const { t } = useTranslation();
  // ─── State ───
  const [currentStep, setCurrentStep] = useState<BrainstormStep>('setup');
  const [completedSteps, setCompletedSteps] = useState<BrainstormStep[]>([]);
  const [ideas, setIdeas] = useState<BrainstormIdea[]>(sessionState.brainstormOutput?.ideas ?? []);
  const [selectedTechnique, setSelectedTechnique] = useState<string | undefined>();
  const [topic, setTopic] = useState('');
  const [stepProgress, setStepProgress] = useState<StepProgressPayload | null>(null);
  const exchangeCountRef = useRef(0);

  // ─── Agent Stream ───
  const agent = useAgentStream({
    runtimeId: 'claude-code',
    systemPrompt: BRAINSTORM_SYSTEM_PROMPT,
    greetingMessage: t("workshop.brainstormGreeting"),
    useSessions: true,
    persistMessages: true,
    storageKey: 'brainstorm-workshop',
  });

  // ─── Parse messages for workshop payloads ───
  const parsedMessages = useMemo(() => {
    return agent.messages.map((msg) => {
      if (msg.role === 'assistant' && !msg.isToolCall) {
        // Step 1: Extract step-progress marker (highest priority, self-closing)
        const { text: stepCleaned, stepProgress: sp } = parseStepProgressMarker(msg.content);
        // Step 2: Run existing marker parser on cleaned text
        const { text, payload } = parseWorkshopMarkers(stepCleaned);
        return { ...msg, content: text, workshopPayload: payload, stepProgress: sp };
      }
      return msg;
    });
  }, [agent.messages]);

  // ─── Track latest step-progress from all messages ───
  React.useEffect(() => {
    const latest = extractLatestStepProgress(parsedMessages);
    if (latest) {
      setStepProgress(latest);
    }
  }, [parsedMessages]);

  // ─── Track extracted ideas from messages ───
  React.useEffect(() => {
    const extractedIdeas: BrainstormIdea[] = [];
    for (const msg of parsedMessages) {
      if (msg.role === 'assistant') {
        const payload = (msg as any).workshopPayload as ParsedWorkshopPayload | null | undefined;
        if (payload?.type === 'idea-card') {
          const d = payload.data;
          extractedIdeas.push({
            id: `idea-${d.number}-${Date.now()}`,
            category: d.category || 'general',
            number: d.number || extractedIdeas.length + 1,
            title: d.title || 'Untitled',
            concept: d.concept || '',
            novelty: d.novelty || '',
          });
        }
      }
    }
    if (extractedIdeas.length > 0) {
      setIdeas(extractedIdeas);
    }
  }, [parsedMessages]);

  // ─── Update output when ideas change ───
  React.useEffect(() => {
    if (ideas.length > 0) {
      onOutputChange({
        ideas,
        summary: t('workshop.brainstormSummary', { count: ideas.length }),
        method: selectedTechnique,
        timestamp: Date.now(),
      });
    }
  }, [ideas, selectedTechnique, onOutputChange]);

  // ─── Step transitions ───
  const advanceStep = useCallback((nextStep: BrainstormStep) => {
    setCurrentStep((prev) => {
      if (prev !== nextStep) {
        setCompletedSteps((cs) => (cs.includes(prev) ? cs : [...cs, prev]));
      }
      return nextStep;
    });
  }, []);

  // Detect step transitions from message content
  React.useEffect(() => {
    const lastMsg = parsedMessages[parsedMessages.length - 1];
    if (lastMsg?.role !== 'assistant') return;

    const payload = (lastMsg as any).workshopPayload as ParsedWorkshopPayload | null | undefined;
    const content = lastMsg.content.toLowerCase();

    if (currentStep === 'setup' && (content.includes('technique selection') || payload?.type === 'option-card')) {
      advanceStep('technique');
    } else if (currentStep === 'technique' && (content.includes('execute') || content.includes("let's dive") || content.includes('execution phase'))) {
      advanceStep('execute');
    } else if (currentStep === 'execute') {
      // Only advance to organize on explicit organize trigger, not on energy-checkpoint
      if (content.includes('organize phase') || content.includes('start organizing') || payload?.type === 'action-menu') {
        advanceStep('organize');
      }
    }
  }, [parsedMessages, currentStep, advanceStep]);

  // ─── Send message handler ───
  const handleSendMessage = useCallback((text: string) => {
    exchangeCountRef.current += 1;

    // Track topic from first user message
    if (!topic && currentStep === 'setup') {
      setTopic(text);
    }

    // Track technique selection
    if (currentStep === 'technique') {
      const techniqueIds = ['browse', 'recommend', 'random', 'progressive',
        'scamper', 'biomimicry', 'six-thinking-hats', 'mind-mapping', 'free-association',
        'reverse-brainstorm', 'morphological', 'design-thinking', 'scenario-planning',
        'backcasting', 'triz-contradiction', 'future-wheel', 'worst-idea', 'constraint-removal',
        'cross-industry', 'metaphorical-thinking', 'starbursting', 'brainwriting-635',
        'round-robin', 'charette', 'gallery-walk', 'world-cafe', 'attribute-listing',
        'how-now-wow', 'affinity-diagram', 'concept-fan', 'random-entry', 'challenge-assumptions',
        'dot-voting', 'impact-effort', 'budget-zero', 'time-box', 'historical-parallel',
        'personal-analogy', 'direct-analogy', 'function-analysis', 's-curve', 'pugh-matrix',
        'science-fiction', 'time-travel', 'magic-wand', 'pre-mortem', 'open-space',
        'fishbowl', 'group-pass', 'mood-board', 'storyboard', 'collage', 'sketchnoting',
        'concept-map', 'resources-swiss-army', 'alien-perspective', 'escape-thinking',
        'po-provocation', 'electronic-brainstorm', 'crawford-slip', 'innovation-trends',
        'root-cause', 'trs-invention'];
      if (techniqueIds.includes(text.toLowerCase())) {
        setSelectedTechnique(text.toLowerCase());
      }
    }

    // Handle action-menu responses
    if (['continue', 'switch', 'deepen', 'rest', 'organize'].includes(text.toLowerCase())) {
      if (text.toLowerCase() === 'organize') {
        advanceStep('organize');
      } else if (text.toLowerCase() === 'switch') {
        setCurrentStep('technique');
      }
    }

    agent.sendMessage(text);
  }, [agent, currentStep, topic, advanceStep]);

  // ─── Custom message renderer ───
  const renderWorkshopMessage = useCallback(
    (msg: ChatMessage, _idx: number): React.ReactNode | null => {
      if (msg.role !== 'assistant') return null;

      // Use pre-parsed workshop payload from parsedMessages
      const payload = msg.workshopPayload as ParsedWorkshopPayload | null | undefined;
      if (!payload) return null;

      switch (payload.type) {
        case 'option-card':
          return (
            <OptionCardMessage
              options={payload.data.options}
              onSelect={(id) => handleSendMessage(id)}
              disabled={agent.isStreaming}
            />
          );

        case 'idea-card':
          return <IdeaCardMessage idea={payload.data} />;

        case 'energy-checkpoint':
          return (
            <EnergyCheckpointMessage
              message={payload.data.message || t('workshop.brainstormEnergy')}
              exchangeCount={payload.data.exchangeCount || exchangeCountRef.current}
              ideaCount={ideas.length}
              onAction={(action) => handleSendMessage(action)}
              disabled={agent.isStreaming}
            />
          );

        case 'action-menu':
          return (
            <ActionMenuMessage
              actions={payload.data.actions || []}
              onAction={(id) => handleSendMessage(id)}
              disabled={agent.isStreaming}
            />
          );

        default:
          return null;
      }
    },
    [handleSendMessage, agent.isStreaming, ideas.length]
  );

  // ─── Session management ───
  const handleStartSession = useCallback(async () => {
    await agent.startSession();
  }, [agent]);

  // ─── Render ───
  return (
    <div className={cn("flex flex-col h-full w-full bg-surface", className)}>
      {/* Progress Stepper */}
      <ProgressStepper currentStep={currentStep} completedSteps={completedSteps} />

      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-container-low border-b border-outline-variant/10 shrink-0">
        <div className="flex items-center gap-2">
          <Lightbulb size={16} className="text-secondary" />
          <span className="text-xs font-headline font-bold text-on-surface">{t('workshop.brainstormTitle')}</span>
          {selectedTechnique && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-secondary/20 text-secondary">
              {selectedTechnique}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {ideas.length > 0 && <IdeaCounterBadge count={ideas.length} />}
          {agent.connectionState !== 'disconnected' && (
            <button
              onClick={() => {
                agent.newSession();
                setCurrentStep('setup');
                setCompletedSteps([]);
                setIdeas([]);
                setSelectedTechnique(undefined);
                setTopic('');
                setStepProgress(null);
              }}
              className="p-1.5 rounded-md hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-on-surface"
              title={t("workshop.newSession")}
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Chat Panel */}
      <div className="flex-1 overflow-hidden">
        {agent.connectionState === 'disconnected' ? (
          <div className="flex flex-col h-full items-center justify-center bg-surface">
            <div className="flex flex-col items-center gap-3 text-on-surface-variant">
              <div className="p-4 rounded-2xl bg-surface-container-high">
                <Lightbulb size={32} className="text-secondary" />
              </div>
              <h2 className="text-sm font-headline font-bold text-on-surface">{t('workshop.brainstormWelcome')}</h2>
              <p className="text-[10px] text-on-surface-variant max-w-xs text-center leading-relaxed">
                {t('workshop.brainstormDesc')}
              </p>
              <button
                onClick={handleStartSession}
                className="mt-2 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors"
              >
                {t('workshop.brainstormStart')}
              </button>
            </div>
          </div>
        ) : (
          <WorkshopChatPanel
            messages={parsedMessages}
            isStreaming={agent.isStreaming}
            onSendMessage={handleSendMessage}
            placeholder={
              currentStep === 'setup'
                ? t('workshop.brainstormPlaceholderSetup')
                : currentStep === 'technique'
                  ? t('workshop.brainstormPlaceholderTechnique')
                  : currentStep === 'execute'
                    ? t('workshop.brainstormPlaceholderExecute')
                    : t('workshop.brainstormPlaceholderOrganize')
            }
            renderWorkshopMessage={renderWorkshopMessage}
            agentStatus={agent.agentStatus}
            stepProgress={stepProgress}
          />
        )}
      </div>
    </div>
  );
};
