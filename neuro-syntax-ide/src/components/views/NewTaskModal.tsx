import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Bot,
  Terminal,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  X,
  FileText,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Send,
  MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { useAgentRuntimes } from '../../lib/useAgentRuntimes';
import { useAgentChat } from '../../lib/useAgentChat';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import type { AgentRuntimeInfo, AgentRuntimeStatusType } from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModalStep = 'select-agent' | 'input-requirement' | 'executing' | 'result';

interface AgentOption {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  status: AgentRuntimeStatusType;
  installHint?: string;
  isBuiltIn: boolean;
  runtimeInfo?: AgentRuntimeInfo;
}

interface NewTaskModalProps {
  open: boolean;
  onClose: () => void;
  onFeatureCreated?: () => void;
}

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Status indicator dot (reused from AgentControlPanel pattern). */
function StatusDot({ status }: { status: AgentRuntimeStatusType }) {
  const cls =
    status === 'available' ? 'bg-tertiary' :
    status === 'busy' ? 'bg-warning animate-pulse' :
    status === 'unhealthy' ? 'bg-error' :
    'bg-outline';
  return <span className={cn('w-2 h-2 rounded-full inline-block shrink-0', cls)} />;
}

function statusLabel(status: AgentRuntimeStatusType): string {
  switch (status) {
    case 'available': return 'Available';
    case 'busy': return 'Busy';
    case 'unhealthy': return 'Unhealthy';
    case 'not-installed': return 'Not Installed';
    default: return status;
  }
}

// ---------------------------------------------------------------------------
// NewTaskModal Component
// ---------------------------------------------------------------------------

export const NewTaskModal: React.FC<NewTaskModalProps> = ({ open, onClose, onFeatureCreated }) => {
  // Agent runtime detection
  const { runtimes, scanning, scan } = useAgentRuntimes();

  // Agent chat for built-in PM Agent
  const {
    messages,
    sendMessage,
    generateFeaturePlan,
    createFeature,
    apiKeyConfigured,
    isStreaming,
    error: chatError,
    clearChat,
  } = useAgentChat();

  // Step state
  const [step, setStep] = useState<ModalStep>('select-agent');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [requirementText, setRequirementText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Execution state
  const [execError, setExecError] = useState<string | null>(null);
  const [streamingOutput, setStreamingOutput] = useState('');
  const [featureCreated, setFeatureCreated] = useState(false);
  const [createdFeatureId, setCreatedFeatureId] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState('');

  // Streaming text ref for external runtime path
  const streamingRef = useRef<string>('');

  // Chat panel state (PM Agent path)
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom on new messages
  // (selectedAgentId is used instead of selectedAgent to avoid hoisting issues)
  const isBuiltInAgent = selectedAgentId === 'pm-agent';
  useEffect(() => {
    if (step === 'input-requirement' && isBuiltInAgent) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, step, isBuiltInAgent]);

  // Modal drag state
  const [modalPos, setModalPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleModalHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDraggingModal(true);
    dragOffsetRef.current = {
      x: e.clientX - modalPos.x,
      y: e.clientY - modalPos.y,
    };
  }, [modalPos]);

  useEffect(() => {
    if (!isDraggingModal) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffsetRef.current.x;
      const newY = e.clientY - dragOffsetRef.current.y;
      const clampedX = Math.max(-window.innerWidth * 0.3, Math.min(window.innerWidth * 0.5, newX));
      const clampedY = Math.max(-window.innerHeight * 0.4, Math.min(window.innerHeight - 80, newY));
      setModalPos({ x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => {
      setIsDraggingModal(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingModal]);

  // Listen for feature creation events from the agent (fs://workspace-changed)
  useEffect(() => {
    if (!isTauri || !open) return;

    let unlisten: (() => void) | null = null;

    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<{ paths: string[]; kind: string }>('fs://workspace-changed', (event) => {
          const change = event.payload;
          if (change.kind === 'agent-feature-created') {
            for (const p of change.paths) {
              const match = p.match(/features\/pending-([^/]+)/);
              if (match) {
                setFeatureCreated(true);
                setCreatedFeatureId(match[1]);
                setStreamingOutput(prev => prev + `\n\nFeature ${match[1]} created successfully!`);
                setStep('result');
                break;
              }
            }
          }
        });
      } catch {
        // Ignore listener setup errors
      }
    })();

    return () => {
      unlisten?.();
    };
  }, [open]);

  // Build agent options list
  const agentOptions: AgentOption[] = [
    // Built-in PM Agent — always available
    {
      id: 'pm-agent',
      name: 'PM Agent',
      description: 'Built-in AI agent for requirement analysis and feature planning',
      icon: Bot,
      status: 'available' as AgentRuntimeStatusType,
      isBuiltIn: true,
    },
    // Claude Code from runtime detection
    ...runtimes
      .filter(r => r.id === 'claude-code')
      .map(r => ({
        id: r.id,
        name: r.name,
        description: 'Claude Code CLI — powerful AI coding assistant',
        icon: Terminal,
        status: r.status,
        installHint: r.install_hint,
        isBuiltIn: false,
        runtimeInfo: r,
      })),
    // Codex from runtime detection
    ...runtimes
      .filter(r => r.id === 'codex')
      .map(r => ({
        id: r.id,
        name: r.name,
        description: 'OpenAI Codex CLI — AI-powered code generation',
        icon: Terminal,
        status: r.status,
        installHint: r.install_hint,
        isBuiltIn: false,
        runtimeInfo: r,
      })),
  ];

  const selectedAgent = agentOptions.find(a => a.id === selectedAgentId);
  const isAgentDisabled = (agent: AgentOption) =>
    !agent.isBuiltIn && agent.status === 'not-installed';

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleSelectAgent = useCallback((agentId: string) => {
    const agent = agentOptions.find(a => a.id === agentId);
    if (agent && !isAgentDisabled(agent)) {
      setSelectedAgentId(agentId);
      setValidationError(null);
    }
  }, [agentOptions]);

  const handleNextFromAgentSelect = useCallback(() => {
    if (!selectedAgentId) {
      setValidationError('Please select an agent to continue');
      return;
    }
    setStep('input-requirement');
    setValidationError(null);
  }, [selectedAgentId]);

  const handleBack = useCallback(() => {
    if (step === 'input-requirement') {
      setStep('select-agent');
    }
  }, [step]);

  const handleExecute = useCallback(async () => {
    // Validate based on path
    if (selectedAgent?.isBuiltIn) {
      // PM Agent path: need at least 1 round of conversation
      const userMessages = messages.filter(m => m.role === 'user');
      if (userMessages.length === 0) {
        setValidationError('Please chat with the PM Agent before creating a feature');
        return;
      }
    } else {
      if (!requirementText.trim()) {
        setValidationError('Please describe your feature requirement');
        return;
      }
    }
    setValidationError(null);
    setStep('executing');
    setExecError(null);
    setStreamingOutput('');
    setPreviewContent('');
    setFeatureCreated(false);
    setCreatedFeatureId(null);

    try {
      if (selectedAgent?.isBuiltIn) {
        // Built-in PM Agent path: generate plan from chat context -> create feature in FS
        setStreamingOutput('Analyzing conversation context...\n');

        const plan = await generateFeaturePlan(messages);

        if (!plan) {
          setExecError('Failed to generate feature plan. Please check your API key configuration.');
          return;
        }

        const planText = [
          `# ${plan.name}`,
          '',
          `**ID**: ${plan.id}`,
          `**Priority**: ${plan.priority}`,
          `**Size**: ${plan.size}`,
          '',
          `## Description`,
          plan.description,
          '',
          `## Value Points`,
          ...plan.value_points.map((vp, i) => `${i + 1}. ${vp}`),
          '',
          `## Tasks`,
          ...plan.tasks.map(tg => `### ${tg.group_name}\n${tg.items.map(it => `- ${it}`).join('\n')}`),
        ].join('\n');

        setStreamingOutput(prev => prev + '\nFeature plan generated:\n\n' + planText);
        setPreviewContent(planText);

        // Create feature in filesystem
        const featureId = await createFeature('', plan);
        if (featureId) {
          setFeatureCreated(true);
          setCreatedFeatureId(featureId);
          setStreamingOutput(prev => prev + `\n\nFeature ${featureId} created successfully!`);
          setStep('result');
        } else {
          setExecError('Feature plan was generated but filesystem creation failed.');
        }
      } else {
        // External runtime path: runtime_session_start + runtime_execute + agent://chunk
        const runtimeId = selectedAgentId;
        streamingRef.current = '';

        if (!isTauri) {
          // Dev fallback: simulate external agent execution
          setStreamingOutput('Connecting to ' + selectedAgent?.name + '...\n');
          await new Promise(resolve => setTimeout(resolve, 1500));
          setStreamingOutput(prev => prev + 'Executing /new-feature skill...\n');
          await new Promise(resolve => setTimeout(resolve, 2000));
          const mockOutput = `# Mock Feature\n\nFeature created via ${selectedAgent?.name}.\n\n## Tasks\n- Implement core logic\n- Add UI components\n- Write tests`;
          setStreamingOutput(prev => prev + '\n' + mockOutput);
          setPreviewContent(mockOutput);
          setFeatureCreated(true);
          setCreatedFeatureId('feat-mock-feature');
          return;
        }

        const { invoke } = await import('@tauri-apps/api/core');
        const { listen } = await import('@tauri-apps/api/event');

        // 1. Register agent://chunk listener for streaming output
        const unlisten = await listen<{ text: string; is_done: boolean; error?: string; type?: string }>(
          'agent://chunk',
          (event) => {
            const chunk = event.payload;
            // Handle error chunks (but not stderr — those are just diagnostics)
            if (chunk.error && chunk.type !== 'stderr') {
              setExecError(chunk.error);
              if (chunk.is_done) {
                unlisten();
              }
              return;
            }
            // Stream text from assistant / system / raw messages
            if (chunk.text && (chunk.type === 'assistant' || chunk.type === 'system' || chunk.type === 'raw' || !chunk.type)) {
              streamingRef.current += chunk.text;
              setStreamingOutput(streamingRef.current);
            }
            if (chunk.is_done) {
              unlisten();
              setPreviewContent(streamingRef.current);
              // Mark execution done — fs://workspace-changed may still update createdFeatureId
              setFeatureCreated(true);
              setStep('result');
            }
          }
        );

        // 2. Start runtime session
        await invoke('runtime_session_start', { runtimeId });

        // 3. Send /new-feature message via runtime_execute
        await invoke('runtime_execute', {
          runtimeId,
          message: `/new-feature ${requirementText.trim()}`,
          sessionId: null,
          systemPrompt: null,
        });
      }
    } catch (e: any) {
      setExecError(e?.toString() ?? 'An unexpected error occurred during execution');
    }
  }, [selectedAgent, selectedAgentId, requirementText, messages, generateFeaturePlan, createFeature]);

  const handleClose = useCallback(() => {
    // Reset state
    setStep('select-agent');
    setSelectedAgentId(null);
    setRequirementText('');
    setValidationError(null);
    setExecError(null);
    setStreamingOutput('');
    setPreviewContent('');
    setFeatureCreated(false);
    setCreatedFeatureId(null);
    setModalPos({ x: 0, y: 0 });
    setChatInput('');
    clearChat();

    if (featureCreated && onFeatureCreated) {
      onFeatureCreated();
    }
    onClose();
  }, [featureCreated, onFeatureCreated, onClose, clearChat]);

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  /** Step indicator dots */
  const StepIndicator = () => {
    const steps: { key: ModalStep; label: string }[] = [
      { key: 'select-agent', label: 'Agent' },
      { key: 'input-requirement', label: 'Requirement' },
      { key: 'executing', label: 'Execute' },
      { key: 'result', label: 'Result' },
    ];
    const currentIndex = steps.findIndex(s => s.key === step);

    return (
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <React.Fragment key={s.key}>
            <div className={cn(
              'flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors',
              i <= currentIndex ? 'text-primary' : 'text-outline',
            )}>
              <div className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all',
                i < currentIndex ? 'bg-primary text-on-primary' :
                i === currentIndex ? 'bg-primary/20 text-primary ring-1 ring-primary/50' :
                'bg-surface-container-highest text-outline',
              )}>
                {i + 1}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn('w-4 h-px', i < currentIndex ? 'bg-primary' : 'bg-outline/30')} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, x: modalPos.x, y: modalPos.y }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        style={{
          position: 'relative',
          top: 0,
          left: 0,
          minWidth: 560,
          minHeight: 400,
          width: 680,
          resize: 'both',
          overflow: 'hidden',
        }}
        className={cn(
          "flex flex-col max-w-[900px] bg-surface-container-low border border-outline-variant/20 rounded-xl shadow-2xl overflow-hidden",
          isDraggingModal && "select-none"
        )}
      >
        {/* Header */}
        <div
          onMouseDown={handleModalHeaderMouseDown}
          className={cn(
            "shrink-0 flex items-center justify-between px-6 py-4 border-b border-outline-variant/10",
            isDraggingModal ? "cursor-grabbing" : "cursor-grab"
          )}
        >
          <div>
            <h3 className="text-lg font-bold text-on-surface">Create New Feature</h3>
            <p className="text-[10px] text-on-surface-variant mt-0.5">
              Select an Agent to analyze requirements and generate feature documents
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StepIndicator />
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleClose}
              className="p-1.5 hover:bg-surface-container-high rounded-lg transition-colors"
            >
              <X size={14} className="text-outline" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* ---- Step 1: Agent Selection ---- */}
            {step === 'select-agent' && (
              <motion.div
                key="select-agent"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-on-surface">Select Agent</h4>
                  <button
                    onClick={scan}
                    disabled={scanning}
                    className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 font-bold uppercase tracking-wider disabled:opacity-50"
                  >
                    <RefreshCw size={10} className={cn(scanning && 'animate-spin')} />
                    Re-scan
                  </button>
                </div>

                <div className="space-y-2">
                  {agentOptions.map(agent => {
                    const Icon = agent.icon;
                    const disabled = isAgentDisabled(agent);
                    const selected = selectedAgentId === agent.id;

                    return (
                      <button
                        key={agent.id}
                        onClick={() => handleSelectAgent(agent.id)}
                        disabled={disabled}
                        title={disabled && agent.installHint
                          ? `Install: ${agent.installHint}`
                          : undefined}
                        className={cn(
                          'w-full text-left glass-panel rounded-lg p-4 transition-all',
                          'border-2',
                          selected
                            ? 'border-primary bg-primary/5'
                            : 'border-transparent hover:border-primary/30',
                          disabled && 'opacity-50 cursor-not-allowed',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            'p-2 rounded-lg',
                            selected ? 'bg-primary/20' : 'bg-surface-container-highest',
                          )}>
                            <Icon size={18} className={selected ? 'text-primary' : 'text-on-surface-variant'} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-on-surface">{agent.name}</span>
                              {agent.isBuiltIn && (
                                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                                  Built-in
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-on-surface-variant mt-0.5">{agent.description}</p>
                            {disabled && agent.installHint && (
                              <p className="text-[9px] text-on-surface-variant/70 mt-1 font-mono">
                                Install: {agent.installHint}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <StatusDot status={agent.status} />
                            <span className={cn(
                              'text-[9px] font-bold uppercase tracking-wider',
                              agent.status === 'available' ? 'text-tertiary' :
                              agent.status === 'unhealthy' ? 'text-error' :
                              agent.status === 'busy' ? 'text-warning' :
                              'text-outline',
                            )}>
                              {statusLabel(agent.status)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {validationError && (
                  <div className="flex items-center gap-2 text-[10px] text-error font-medium">
                    <AlertCircle size={12} />
                    {validationError}
                  </div>
                )}
              </motion.div>
            )}

            {/* ---- Step 2: Requirement Input ---- */}
            {step === 'input-requirement' && (
              <motion.div
                key="input-requirement"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    {selectedAgent && <selectedAgent.icon size={14} className="text-primary" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-on-surface">
                      {selectedAgent?.isBuiltIn ? 'Chat About Your Requirement' : 'Describe Your Requirement'}
                    </h4>
                    <p className="text-[10px] text-on-surface-variant">
                      {selectedAgent?.isBuiltIn
                        ? 'Describe your feature and the PM Agent will ask clarifying questions'
                        : `Using ${selectedAgent?.name} to analyze your feature request`}
                    </p>
                  </div>
                </div>

                {/* PM Agent path: Chat panel */}
                {selectedAgent?.isBuiltIn ? (
                  <div className="flex flex-col gap-3">
                    {/* API key warning */}
                    {!apiKeyConfigured && (
                      <div className="rounded-lg bg-warning/10 border border-warning/20 px-3 py-2">
                        <span className="text-[10px] text-warning font-medium">
                          API Key not configured — configure in Settings to use PM Agent chat
                        </span>
                      </div>
                    )}

                    {/* Messages list */}
                    <div className="flex-1 min-h-[200px] max-h-[320px] overflow-y-auto rounded-lg bg-surface-container-high border border-outline-variant/10 p-3 space-y-3">
                      {messages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'flex gap-2',
                            msg.role === 'user' ? 'justify-end' : 'justify-start',
                          )}
                        >
                          {msg.role === 'assistant' && (
                            <div className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                              <Bot size={12} className="text-primary" />
                            </div>
                          )}
                          <div
                            className={cn(
                              'max-w-[80%] rounded-lg px-3 py-2 text-[11px] leading-relaxed',
                              msg.role === 'user'
                                ? 'bg-primary text-on-primary'
                                : 'bg-surface-container-highest text-on-surface-variant border border-outline-variant/10',
                            )}
                          >
                            {msg.role === 'assistant' ? (
                              <MarkdownRenderer content={msg.content} />
                            ) : (
                              <span className="whitespace-pre-wrap">{msg.content}</span>
                            )}
                          </div>
                          {msg.role === 'user' && (
                            <div className="shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                              <MessageSquare size={12} className="text-primary" />
                            </div>
                          )}
                        </div>
                      ))}
                      {/* Streaming indicator */}
                      {isStreaming && (
                        <div className="flex gap-2 justify-start">
                          <div className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                            <Bot size={12} className="text-primary" />
                          </div>
                          <div className="max-w-[80%] rounded-lg px-3 py-2 text-[11px] bg-surface-container-highest text-on-surface-variant border border-outline-variant/10">
                            <span className="inline-block w-1.5 h-3 bg-primary/60 animate-pulse rounded-sm" />
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Chat input */}
                    <div className="flex gap-2">
                      <textarea
                        value={chatInput}
                        onChange={e => {
                          setChatInput(e.target.value);
                          if (validationError) setValidationError(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (chatInput.trim() && !isStreaming) {
                              sendMessage(chatInput.trim());
                              setChatInput('');
                            }
                          }
                        }}
                        placeholder="Describe your feature... (Enter to send, Shift+Enter for new line)"
                        disabled={isStreaming}
                        className={cn(
                          'flex-1 px-3 py-2 rounded-lg text-[11px] bg-surface-container-high text-on-surface',
                          'border border-outline-variant/20 focus:border-primary/50 focus:ring-1 focus:ring-primary/30',
                          'placeholder:text-on-surface-variant/40 resize-none outline-none transition-all',
                          'font-body min-h-[36px] max-h-[80px]',
                          isStreaming && 'opacity-50',
                        )}
                        rows={1}
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          if (chatInput.trim() && !isStreaming) {
                            sendMessage(chatInput.trim());
                            setChatInput('');
                          }
                        }}
                        disabled={!chatInput.trim() || isStreaming}
                        className={cn(
                          'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all',
                          chatInput.trim() && !isStreaming
                            ? 'bg-primary text-on-primary hover:bg-primary/90'
                            : 'bg-surface-container-highest text-outline',
                        )}
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* External runtime path: textarea */
                  <div>
                    <textarea
                      value={requirementText}
                      onChange={e => {
                        setRequirementText(e.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      placeholder="Describe the feature you want to build...&#10;&#10;Example: Add a user authentication system with login, registration, and password recovery features"
                      className={cn(
                        'w-full h-40 px-4 py-3 rounded-lg text-sm bg-surface-container-high text-on-surface',
                        'border border-outline-variant/20 focus:border-primary/50 focus:ring-1 focus:ring-primary/30',
                        'placeholder:text-on-surface-variant/40 resize-none outline-none transition-all',
                        'font-body',
                      )}
                      autoFocus
                    />
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] text-on-surface-variant">
                        {requirementText.length} characters
                      </span>
                    </div>
                  </div>
                )}

                {/* Validation error */}
                {validationError && (
                  <div className="flex items-center gap-2 text-[10px] text-error font-medium">
                    <AlertCircle size={12} />
                    {validationError}
                  </div>
                )}

                {/* Chat error */}
                {chatError && step === 'input-requirement' && (
                  <div className="rounded-lg bg-error/10 border border-error/20 p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={14} className="text-error shrink-0 mt-0.5" />
                      <p className="text-[11px] text-error font-medium">{chatError}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ---- Step 3: Executing ---- */}
            {step === 'executing' && (
              <motion.div
                key="executing"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-4 h-full"
              >
                <div className="flex items-center gap-2">
                  {!featureCreated && !execError ? (
                    <>
                      <Loader2 size={14} className="text-primary animate-spin" />
                      <span className="text-sm font-bold text-on-surface">
                        {selectedAgent?.name} is working...
                      </span>
                    </>
                  ) : featureCreated ? (
                    <>
                      <CheckCircle2 size={14} className="text-tertiary" />
                      <span className="text-sm font-bold text-on-surface">Feature created successfully!</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={14} className="text-error" />
                      <span className="text-sm font-bold text-on-surface">Execution failed</span>
                    </>
                  )}
                </div>

                {/* Streaming output */}
                {streamingOutput && (
                  <div className="flex-1 rounded-lg bg-surface-container-high border border-outline-variant/10 p-3 overflow-y-auto">
                    <pre className="text-[11px] text-on-surface-variant whitespace-pre-wrap font-mono leading-relaxed">
                      {streamingOutput}
                    </pre>
                  </div>
                )}

                {/* Preview (after execution completes) */}
                {previewContent && featureCreated && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      <FileText size={10} />
                      Generated Feature Preview
                    </div>
                    <div className="rounded-lg bg-surface-container-high border border-outline-variant/10 p-3 overflow-y-auto">
                      <MarkdownRenderer content={previewContent} />
                    </div>
                  </div>
                )}

                {/* Error display */}
                {execError && (
                  <div className="rounded-lg bg-error/10 border border-error/20 p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={14} className="text-error shrink-0 mt-0.5" />
                      <p className="text-[11px] text-error font-medium">{execError}</p>
                    </div>
                  </div>
                )}

                {/* Chat error from hook */}
                {chatError && !execError && (
                  <div className="rounded-lg bg-error/10 border border-error/20 p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={14} className="text-error shrink-0 mt-0.5" />
                      <p className="text-[11px] text-error font-medium">{chatError}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ---- Step 4: Result ---- */}
            {step === 'result' && (
              <motion.div
                key="result"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-4 h-full"
              >
                <div className="flex items-center gap-2 shrink-0">
                  <CheckCircle2 size={16} className="text-tertiary" />
                  <span className="text-sm font-bold text-on-surface">Feature created successfully!</span>
                </div>

                {createdFeatureId && (
                  <div className="shrink-0 rounded-lg bg-primary/10 border border-primary/20 px-4 py-2">
                    <span className="text-[10px] text-on-surface-variant">Feature ID:</span>
                    <span className="ml-2 text-[11px] font-bold font-mono text-primary">{createdFeatureId}</span>
                  </div>
                )}

                {/* Streaming output summary */}
                {streamingOutput && (
                  <div className="flex-1 rounded-lg bg-surface-container-high border border-outline-variant/10 p-3 overflow-y-auto">
                    <pre className="text-[11px] text-on-surface-variant whitespace-pre-wrap font-mono leading-relaxed">
                      {streamingOutput}
                    </pre>
                  </div>
                )}

                {/* Preview */}
                {previewContent && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      <FileText size={10} />
                      Generated Feature Preview
                    </div>
                    <div className="rounded-lg bg-surface-container-high border border-outline-variant/10 p-3 overflow-y-auto">
                      <MarkdownRenderer content={previewContent} />
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-outline-variant/10">
          <div>
            {step === 'input-requirement' && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-[11px] text-on-surface-variant hover:text-on-surface font-medium transition-colors"
              >
                <ChevronLeft size={12} />
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Cancel / Close button */}
            <button
              onClick={handleClose}
              className="px-4 py-1.5 text-[11px] font-medium text-on-surface-variant hover:text-on-surface transition-colors"
            >
              {(step === 'executing' && !featureCreated && !execError) ? 'Cancel' : 'Close'}
            </button>

            {/* Next / Execute button */}
            {step === 'select-agent' && (
              <button
                onClick={handleNextFromAgentSelect}
                disabled={!selectedAgentId}
                className={cn(
                  'flex items-center gap-1 px-5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider',
                  'transition-all',
                  selectedAgentId
                    ? 'bg-primary text-on-primary hover:bg-primary/90'
                    : 'bg-surface-container-highest text-outline cursor-not-allowed',
                )}
              >
                Next
                <ChevronRight size={12} />
              </button>
            )}

            {step === 'input-requirement' && (
              <button
                onClick={handleExecute}
                disabled={
                  selectedAgent?.isBuiltIn
                    ? messages.filter(m => m.role === 'user').length === 0 || isStreaming
                    : !requirementText.trim() || isStreaming
                }
                className={cn(
                  'flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider',
                  'transition-all',
                  (selectedAgent?.isBuiltIn
                    ? messages.filter(m => m.role === 'user').length > 0 && !isStreaming
                    : requirementText.trim() && !isStreaming)
                    ? 'bg-primary text-on-primary hover:bg-primary/90'
                    : 'bg-surface-container-highest text-outline cursor-not-allowed',
                )}
              >
                <Sparkles size={12} />
                {isStreaming ? 'Creating...' : 'Create Feature'}
              </button>
            )}

            {step === 'executing' && featureCreated && (
              <button
                onClick={handleClose}
                className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-primary text-on-primary hover:bg-primary/90 transition-all"
              >
                <CheckCircle2 size={12} />
                Done
              </button>
            )}

            {step === 'result' && (
              <button
                onClick={handleClose}
                className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-primary text-on-primary hover:bg-primary/90 transition-all"
              >
                <CheckCircle2 size={12} />
                Done
              </button>
            )}

            {step === 'executing' && execError && (
              <button
                onClick={() => {
                  setStep('input-requirement');
                  setExecError(null);
                }}
                className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-primary text-on-primary hover:bg-primary/90 transition-all"
              >
                <ChevronLeft size={12} />
                Retry
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
