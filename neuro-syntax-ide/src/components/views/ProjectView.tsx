import React, { useState, useRef, useEffect } from 'react';
import {
  FolderOpen,
  Github,
  FileText,
  Send,
  Bot,
  ArrowUpRight,
  RefreshCw,
  X,
  Sparkles,
  Layers,
  CheckCircle2,
  Folder,
  Key,
  AlertTriangle,
  Loader2,
  Plus,
  MessageSquarePlus,
  Square,
  Radio,
  WifiOff,
  PlusCircle,
  MinusCircle,
  GitCommitHorizontal,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import ReactMarkdown from 'react-markdown';
import { useAgentChat } from '../../lib/useAgentChat';
import type { FeaturePlanOutput } from '../../lib/useAgentChat';
import { useReqAgentChat } from '../../lib/useReqAgentChat';
import { useGitStatus } from '../../lib/useGitStatus';

interface WorkspaceHook {
  workspacePath: string;
  loading: boolean;
  error: string | null;
  selectWorkspace: () => Promise<void>;
}

interface ProjectViewProps {
  workspace: WorkspaceHook;
}

export const ProjectView: React.FC<ProjectViewProps> = ({ workspace }) => {
  const { t } = useTranslation();
  const { workspacePath, loading: workspaceLoading, error: workspaceError, selectWorkspace } = workspace;

  const agentChat = useAgentChat();
  const reqAgent = useReqAgentChat();
  const gitStatus = useGitStatus(workspacePath);

  const [chatInput, setChatInput] = useState('');
  const [reqChatInput, setReqChatInput] = useState('');
  const [activeChatTab, setActiveChatTab] = useState<'pm' | 'req'>('pm');
  const [showGitModal, setShowGitModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [stagingPath, setStagingPath] = useState<string | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<FeaturePlanOutput | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [projectContext] = useState(`
# Project Context: Neuro Syntax IDE

## Overview
A next-generation, AI-first IDE designed for rapid prototyping and development.

## Core Features
- **AI-Agent Orchestration**: Native support for Gemini and Claude.
- **Task-Driven Workflow**: Integrated task board and AI task generation.
- **Mission Control**: Real-time monitoring of system health and AI activity.

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Motion.
- **Backend**: Express (optional), Node.js.
- **AI**: Google Gemini API, Anthropic Claude API.

## Roadmap
1. [x] Basic IDE Layout
2. [x] Internationalization
3. [ ] Real-time Collaboration
4. [ ] Integrated Debugger
`);

  const handleSendMessage = () => {
    if (!chatInput.trim() || agentChat.isStreaming) return;
    agentChat.sendMessage(chatInput);
    setChatInput('');
  };

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentChat.messages]);

  // Auto-scroll req agent chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [reqAgent.messages]);

  // Refresh git status when the Git modal opens
  useEffect(() => {
    if (showGitModal) {
      gitStatus.refresh();
    }
  }, [showGitModal]);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setShowGitModal(false);
    }, 2000);
  };

  const handleStageFile = async (filePath: string) => {
    setStagingPath(filePath);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('git_stage_file', { path: filePath });
      await gitStatus.refresh();
    } catch (e) {
      console.error('Failed to stage file:', e);
    } finally {
      setStagingPath(null);
    }
  };

  const handleUnstageFile = async (filePath: string) => {
    setStagingPath(filePath);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('git_unstage_file', { path: filePath });
      await gitStatus.refresh();
    } catch (e) {
      console.error('Failed to unstage file:', e);
    } finally {
      setStagingPath(null);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim() || isCommitting) return;
    setIsCommitting(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('git_commit', { message: commitMessage });
      setCommitMessage('');
      await gitStatus.refresh();
    } catch (e) {
      console.error('Failed to commit:', e);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleGenerateTasks = async () => {
    if (!agentChat.apiKeyConfigured) {
      setShowApiKeyModal(true);
      return;
    }
    setIsGenerating(true);
    setGeneratedPlan(null);

    const plan = await agentChat.generateFeaturePlan(
      'Analyze the current project and create a new feature plan based on the project context and recent discussion.'
    );

    if (plan) {
      setGeneratedPlan(plan);
    }
    setIsGenerating(false);
  };

  const handleCreateFeature = async () => {
    if (!generatedPlan) return;
    const featureId = await agentChat.createFeature(
      'epic-neuro-syntax-ide-roadmap',
      generatedPlan
    );
    if (featureId) {
      setGeneratedPlan(null);
      setShowTaskModal(false);
    }
  };

  const handleStoreApiKey = () => {
    if (!apiKeyInput.trim()) return;
    agentChat.configureApiKey(apiKeyInput);
    setApiKeyInput('');
    setShowApiKeyModal(false);
  };

  const handleReqAgentSend = () => {
    if (!reqChatInput.trim() || reqAgent.isStreaming) return;
    reqAgent.sendMessage(reqChatInput);
    setReqChatInput('');
  };

  const handleReqAgentStart = async () => {
    const storedSid = localStorage.getItem('req_agent_session_id');
    await reqAgent.startSession(storedSid || undefined);
  };

  const handleReqAgentNewSession = async () => {
    await reqAgent.newSession();
  };

  const handleReqAgentStop = async () => {
    await reqAgent.stopSession();
  };

  const reqConnectionLabel = () => {
    switch (reqAgent.connectionState) {
      case 'connected': return t('project.reqAgentConnected');
      case 'connecting': return t('project.reqAgentConnecting');
      case 'error': return t('project.reqAgentError');
      default: return t('project.reqAgentDisconnected');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden relative">
      <header className="h-14 bg-surface-container-low flex items-center justify-between px-6 border-b border-outline-variant/10 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="font-headline text-lg font-bold tracking-tight text-on-surface">{t('project.title')}</h1>
          <div className="h-4 w-px bg-outline-variant/30"></div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface-container-high/50 px-2 py-1 rounded border border-outline-variant/10">
            <FolderOpen size={14} className="text-primary" />
            <span className="font-mono opacity-80">
              {workspacePath || t('project.noWorkspace')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={selectWorkspace}
            disabled={workspaceLoading}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-all border",
              workspacePath
                ? "bg-surface-container-high text-on-surface-variant border-outline-variant/10 hover:bg-surface-container-highest"
                : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
            )}
          >
            {workspaceLoading ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <FolderOpen size={14} />
            )}
            {workspacePath ? t('project.selectWorkspace') : t('project.openProject')}
          </button>
          <button
            onClick={() => setShowTaskModal(true)}
            className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded text-xs font-bold hover:bg-primary/20 transition-all border border-primary/20"
          >
            <Sparkles size={14} />
            {t('project.generateTask')}
          </button>
          <button
            onClick={() => setShowGitModal(true)}
            title={t('project.gitStatus')}
            className="p-2 bg-surface-container-high text-on-surface-variant rounded hover:text-secondary hover:bg-secondary/10 transition-all border border-outline-variant/10"
          >
            <Github size={16} />
          </button>
        </div>
      </header>

      {/* Workspace error banner */}
      <AnimatePresence>
        {workspaceError && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-6 py-2 bg-error/10 border-b border-error/20 text-xs text-error flex items-center gap-2">
              <X size={12} />
              {workspaceError}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Key prompt banner */}
      {workspacePath && agentChat.apiKeyConfigured === false && !agentChat.isStreaming && (
        <div className="px-6 py-2 bg-warning/10 border-b border-warning/20 text-xs text-warning flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key size={12} />
            Configure your API Key to enable AI features
          </div>
          <button onClick={() => setShowApiKeyModal(true)} className="text-primary underline text-[10px]">
            Set API Key
          </button>
        </div>
      )}

      {/* Agent error banner */}
      {workspacePath && agentChat.error && (
        <div className="px-6 py-2 bg-error/10 border-b border-error/20 text-xs text-error flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={12} />
            {agentChat.error}
          </div>
          <button onClick={() => setShowApiKeyModal(true)} className="text-primary underline text-[10px]">
            Configure API Key
          </button>
        </div>
      )}

      {/* No workspace prompt */}
      <AnimatePresence>
        {!workspacePath && !workspaceLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 flex items-center justify-center"
          >
            <div className="text-center space-y-6 max-w-md">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Folder size={36} className="text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-on-surface">{t('project.openProject')}</h2>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Select a project directory to get started. Your workspace files will be loaded automatically.
                </p>
              </div>
              <button
                onClick={selectWorkspace}
                className="w-full bg-primary text-on-primary py-3 rounded-lg text-sm font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                <FolderOpen size={18} />
                {t('project.openProject')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content: shown when workspace is loaded */}
      {workspacePath && (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Agent Chat Panel with Tab Switcher */}
          <div className="w-[400px] border-r border-outline-variant/10 flex flex-col bg-surface-container-lowest shrink-0">
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Tab Bar */}
              <div className="flex border-b border-outline-variant/10 bg-surface-container-low">
                <button
                  onClick={() => setActiveChatTab('pm')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2",
                    activeChatTab === 'pm'
                      ? "text-secondary border-secondary bg-surface-container-lowest"
                      : "text-on-surface-variant border-transparent hover:text-on-surface"
                  )}
                >
                  <Bot size={14} />
                  {t('project.pmAgent')}
                </button>
                <button
                  onClick={() => setActiveChatTab('req')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2",
                    activeChatTab === 'req'
                      ? "text-primary border-primary bg-surface-container-lowest"
                      : "text-on-surface-variant border-transparent hover:text-on-surface"
                  )}
                >
                  <Sparkles size={14} />
                  {t('project.reqAgent')}
                </button>
              </div>

              {/* PM Agent Chat */}
              {activeChatTab === 'pm' && (
                <>
                  <div className="p-3 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-secondary/10 rounded-lg">
                        <Bot size={16} className="text-secondary" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t('project.pmAgent')}</span>
                        <span className="text-[9px] text-outline uppercase font-medium tracking-tighter">Context Architect</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded-full",
                        agentChat.apiKeyConfigured
                          ? "bg-tertiary/10"
                          : "bg-outline-variant/10"
                      )}>
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          agentChat.apiKeyConfigured ? "bg-tertiary animate-pulse" : "bg-outline-variant"
                        )}></div>
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-tighter",
                          agentChat.apiKeyConfigured ? "text-tertiary" : "text-outline"
                        )}>
                          {agentChat.isStreaming ? 'Thinking...' : agentChat.apiKeyConfigured ? 'Active' : 'No Key'}
                        </span>
                      </div>
                      <button
                        onClick={() => setShowApiKeyModal(true)}
                        className="p-1 text-on-surface-variant hover:text-primary transition-colors"
                        title="API Key Settings"
                      >
                        <Key size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-hide">
                    {agentChat.messages.map((msg, idx) => (
                      <div key={idx} className={cn(
                        "flex flex-col gap-1 max-w-[85%]",
                        msg.role === 'user' ? "ml-auto items-end" : "items-start"
                      )}>
                        <div className={cn(
                          "p-3 rounded-lg text-xs leading-relaxed",
                          msg.role === 'user'
                            ? "bg-primary text-on-primary rounded-tr-none"
                            : "bg-surface-container-high text-on-surface rounded-tl-none border border-outline-variant/10"
                        )}>
                          {msg.role === 'assistant' ? (
                            <div className="prose prose-invert prose-xs [&_pre]:text-[10px] [&_p]:text-[10px] [&_pre]:p-2 [&_pre]:bg-surface-container-lowest [&_pre]:rounded [&_code]:text-[10px]">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                              {idx === agentChat.messages.length - 1 && agentChat.isStreaming && (
                                <span className="inline-block w-1.5 h-3 bg-primary/70 animate-pulse ml-0.5 align-middle"></span>
                              )}
                            </div>
                          ) : (
                            msg.content
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-4 border-t border-outline-variant/10 bg-surface">
                    <div className="relative">
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                        placeholder={t('project.chatPlaceholder')}
                        disabled={agentChat.isStreaming}
                        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg p-3 pr-10 text-xs text-on-surface focus:outline-none focus:border-primary/50 resize-none h-20 scroll-hide disabled:opacity-50"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={agentChat.isStreaming || !chatInput.trim()}
                        className={cn(
                          "absolute right-2 bottom-2 p-1.5 rounded-md transition-colors",
                          agentChat.isStreaming || !chatInput.trim()
                            ? "text-outline-variant cursor-not-allowed"
                            : "text-primary hover:bg-primary/10"
                        )}
                      >
                        {agentChat.isStreaming ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Send size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Req Agent Chat */}
              {activeChatTab === 'req' && (
                <>
                  <div className="p-3 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg">
                        <Sparkles size={16} className="text-primary" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t('project.reqAgent')}</span>
                        <span className="text-[9px] text-outline uppercase font-medium tracking-tighter">Requirements Analyst</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Connection status indicator */}
                      <div className={cn(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded-full",
                        reqAgent.connectionState === 'connected'
                          ? "bg-tertiary/10"
                          : reqAgent.connectionState === 'connecting'
                            ? "bg-warning/10"
                            : reqAgent.connectionState === 'error'
                              ? "bg-error/10"
                              : "bg-outline-variant/10"
                      )}>
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          reqAgent.connectionState === 'connected'
                            ? "bg-tertiary animate-pulse"
                            : reqAgent.connectionState === 'connecting'
                              ? "bg-warning animate-pulse"
                              : reqAgent.connectionState === 'error'
                                ? "bg-error"
                                : "bg-outline-variant"
                        )}></div>
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-tighter",
                          reqAgent.connectionState === 'connected'
                            ? "text-tertiary"
                            : reqAgent.connectionState === 'connecting'
                              ? "text-warning"
                              : reqAgent.connectionState === 'error'
                                ? "text-error"
                                : "text-outline"
                        )}>
                          {reqAgent.isStreaming ? 'Thinking...' : reqConnectionLabel()}
                        </span>
                      </div>
                      {/* Action buttons */}
                      {reqAgent.connectionState === 'disconnected' && (
                        <button
                          onClick={handleReqAgentStart}
                          className="p-1 text-on-surface-variant hover:text-primary transition-colors"
                          title={t('project.reqAgentConnect')}
                        >
                          <Radio size={12} />
                        </button>
                      )}
                      {reqAgent.connectionState === 'connected' && (
                        <>
                          <button
                            onClick={handleReqAgentNewSession}
                            className="p-1 text-on-surface-variant hover:text-primary transition-colors"
                            title={t('project.reqAgentNewSession')}
                          >
                            <MessageSquarePlus size={12} />
                          </button>
                          <button
                            onClick={handleReqAgentStop}
                            className="p-1 text-on-surface-variant hover:text-error transition-colors"
                            title={t('project.reqAgentStop')}
                          >
                            <Square size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Req Agent Error Banner */}
                  {reqAgent.error && reqAgent.connectionState === 'error' && (
                    <div className="px-4 py-2 bg-error/10 border-b border-error/20 text-[10px] text-error flex items-center gap-2">
                      <AlertTriangle size={10} />
                      <span className="flex-1">{reqAgent.error}</span>
                      <button
                        onClick={handleReqAgentStart}
                        className="text-primary underline text-[9px]"
                      >
                        {t('project.reqAgentRetry')}
                      </button>
                    </div>
                  )}

                  {/* Disconnected state with connect prompt */}
                  {reqAgent.connectionState === 'disconnected' && reqAgent.messages.length <= 1 && (
                    <div className="flex-1 flex items-center justify-center p-6">
                      <div className="text-center space-y-4 max-w-[240px]">
                        <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                          <WifiOff size={24} className="text-primary" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-on-surface">{t('project.reqAgentDisconnected')}</p>
                          <p className="text-[10px] text-on-surface-variant leading-relaxed">
                            {t('project.reqAgentConnectHint')}
                          </p>
                        </div>
                        <button
                          onClick={handleReqAgentStart}
                          className="w-full bg-primary text-on-primary py-2 rounded-lg text-[10px] font-bold hover:brightness-110 transition-all"
                        >
                          <div className="flex items-center justify-center gap-2">
                            <Radio size={12} />
                            {t('project.reqAgentConnect')}
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Chat messages (show when connected or has history) */}
                  {(reqAgent.connectionState !== 'disconnected' || reqAgent.messages.length > 1) && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-hide">
                      {reqAgent.messages.map((msg, idx) => (
                        <div key={idx} className={cn(
                          "flex flex-col gap-1 max-w-[85%]",
                          msg.role === 'user' ? "ml-auto items-end" : "items-start"
                        )}>
                          <div className={cn(
                            "p-3 rounded-lg text-xs leading-relaxed",
                            msg.role === 'user'
                              ? "bg-primary text-on-primary rounded-tr-none"
                              : "bg-surface-container-high text-on-surface rounded-tl-none border border-outline-variant/10"
                          )}>
                            {msg.role === 'assistant' ? (
                              <div className="prose prose-invert prose-xs [&_pre]:text-[10px] [&_p]:text-[10px] [&_pre]:p-2 [&_pre]:bg-surface-container-lowest [&_pre]:rounded [&_code]:text-[10px]">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                {idx === reqAgent.messages.length - 1 && reqAgent.isStreaming && (
                                  <span className="inline-block w-1.5 h-3 bg-primary/70 animate-pulse ml-0.5 align-middle"></span>
                                )}
                              </div>
                            ) : (
                              msg.content
                            )}
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  )}

                  {/* Input area */}
                  <div className="p-4 border-t border-outline-variant/10 bg-surface">
                    <div className="relative">
                      <textarea
                        value={reqChatInput}
                        onChange={(e) => setReqChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleReqAgentSend())}
                        placeholder={t('project.reqAgentPlaceholder')}
                        disabled={reqAgent.isStreaming || reqAgent.connectionState === 'connecting'}
                        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg p-3 pr-10 text-xs text-on-surface focus:outline-none focus:border-primary/50 resize-none h-20 scroll-hide disabled:opacity-50"
                      />
                      <button
                        onClick={handleReqAgentSend}
                        disabled={reqAgent.isStreaming || !reqChatInput.trim() || reqAgent.connectionState === 'connecting'}
                        className={cn(
                          "absolute right-2 bottom-2 p-1.5 rounded-md transition-colors",
                          reqAgent.isStreaming || !reqChatInput.trim() || reqAgent.connectionState === 'connecting'
                            ? "text-outline-variant cursor-not-allowed"
                            : "text-primary hover:bg-primary/10"
                        )}
                      >
                        {reqAgent.isStreaming ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Send size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: Project Context Markdown Rendering */}
          <div className="flex-1 flex flex-col bg-surface overflow-hidden">
            <div className="h-10 border-b border-outline-variant/10 flex items-center px-6 justify-between bg-surface-container-low">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  {t('project.projectContext')}
                </span>
              </div>
              <button className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest">
                {t('project.initProject')}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-10 scroll-hide">
              <div className="max-w-3xl mx-auto prose prose-invert prose-sm">
                <ReactMarkdown>{projectContext}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Git Status Modal */}
      <AnimatePresence>
        {showGitModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGitModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-surface-container-low border border-outline-variant/20 rounded-xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-high/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary/10 rounded-lg">
                    <Github size={20} className="text-secondary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest">{t('project.gitStatus')}</h3>
                    <p className="text-[10px] text-outline font-mono">
                      {gitStatus.data?.remote_url || 'No remote configured'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => gitStatus.refresh()}
                    disabled={gitStatus.loading}
                    className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw size={14} className={cn(gitStatus.loading && "animate-spin")} />
                  </button>
                  <button
                    onClick={() => setShowGitModal(false)}
                    className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {gitStatus.error ? (
                  <div className="flex items-center gap-3 p-4 bg-error/10 rounded-lg border border-error/20">
                    <AlertTriangle size={16} className="text-error shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-error">{gitStatus.error}</p>
                      <p className="text-[10px] text-on-surface-variant mt-1">Make sure the workspace is a Git repository.</p>
                    </div>
                  </div>
                ) : gitStatus.loading && !gitStatus.data ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-primary" />
                  </div>
                ) : gitStatus.data ? (
                  <>
                    {/* Branch info */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-outline">{t('project.branch')}</span>
                        <span className="text-[10px] font-mono bg-secondary/10 text-secondary px-2 py-0.5 rounded">
                          {gitStatus.data.current_branch}
                        </span>
                      </div>
                      <div className="relative h-20 bg-surface-container-lowest rounded-lg border border-outline-variant/5 p-4 flex items-center">
                        <div className="absolute left-4 right-4 h-0.5 bg-outline-variant/20 top-1/2 -translate-y-1/2"></div>
                        <div className="flex justify-between w-full relative z-10">
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-outline-variant border-2 border-surface"></div>
                            <span className="text-[8px] font-mono text-outline">main</span>
                          </div>
                          <div className="flex flex-col items-center gap-1 -mt-8">
                            <div className="w-3 h-3 rounded-full bg-secondary border-2 border-surface"></div>
                            <span className="text-[8px] font-mono text-secondary">{gitStatus.data.current_branch}</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-outline-variant border-2 border-surface"></div>
                            <span className="text-[8px] font-mono text-outline">origin/main</span>
                          </div>
                        </div>
                        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
                          <path d="M 40 40 Q 100 10 200 40" fill="none" stroke="currentColor" strokeWidth="1" className="text-secondary" strokeDasharray="4 2" />
                        </svg>
                      </div>
                    </div>

                    {/* Changed files — grouped into Staged and Unstaged */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-outline">{t('project.changesDetected')}</span>
                        <span className="text-[10px] font-bold text-tertiary">
                          {gitStatus.data.files.length === 0
                            ? 'No changes'
                            : `${gitStatus.data.files.length} File${gitStatus.data.files.length > 1 ? 's' : ''} Changed`}
                        </span>
                      </div>
                      {gitStatus.data.files.length === 0 ? (
                        <div className="flex items-center justify-center py-6 text-xs text-on-surface-variant opacity-60">
                          No changes detected
                        </div>
                      ) : (
                        <>
                          {/* Staged files */}
                          {(() => {
                            const stagedFiles = gitStatus.data.files.filter(f => f.status === 'staged');
                            if (stagedFiles.length === 0) return null;
                            return (
                              <div className="space-y-1">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-tertiary">Staged ({stagedFiles.length})</span>
                                <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/10 overflow-hidden divide-y divide-outline-variant/5">
                                  {stagedFiles.map((file) => {
                                    const fileName = file.path.split('/').pop() || file.path;
                                    return (
                                      <div key={file.path} className="flex items-center gap-3 p-3 bg-surface-container-high/20">
                                        <FileText size={16} className="text-tertiary shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-bold truncate">{fileName}</p>
                                          <p className="text-[10px] text-outline truncate">{file.path}</p>
                                        </div>
                                        {(file.additions > 0 || file.deletions > 0) && (
                                          <div className="flex items-center gap-1 text-[10px] font-mono shrink-0">
                                            {file.additions > 0 && <span className="text-emerald-400">+{file.additions}</span>}
                                            {file.deletions > 0 && <span className="text-error">-{file.deletions}</span>}
                                          </div>
                                        )}
                                        <button
                                          onClick={() => handleUnstageFile(file.path)}
                                          disabled={stagingPath === file.path}
                                          className="p-1.5 rounded-md text-warning hover:bg-warning/10 transition-colors disabled:opacity-50"
                                          title="Unstage"
                                        >
                                          {stagingPath === file.path ? (
                                            <Loader2 size={14} className="animate-spin" />
                                          ) : (
                                            <MinusCircle size={14} />
                                          )}
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Unstaged & Untracked files */}
                          {(() => {
                            const unstagedFiles = gitStatus.data.files.filter(f => f.status === 'unstaged' || f.status === 'untracked');
                            if (unstagedFiles.length === 0) return null;
                            return (
                              <div className="space-y-1">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-primary">Changes ({unstagedFiles.length})</span>
                                <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/10 overflow-hidden divide-y divide-outline-variant/5">
                                  {unstagedFiles.map((file) => {
                                    const fileName = file.path.split('/').pop() || file.path;
                                    const statusColor = file.status === 'untracked'
                                      ? 'text-warning'
                                      : 'text-primary';
                                    const statusLabel = file.status === 'untracked'
                                      ? 'Untracked'
                                      : 'Modified';
                                    return (
                                      <div key={file.path} className="flex items-center gap-3 p-3 bg-surface-container-high/20">
                                        <FileText size={16} className={cn("shrink-0", statusColor)} />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-bold truncate">{fileName}</p>
                                          <p className="text-[10px] text-outline truncate">{file.path}</p>
                                        </div>
                                        <span className={cn("text-[9px] font-bold uppercase shrink-0", statusColor)}>
                                          {statusLabel}
                                        </span>
                                        {(file.additions > 0 || file.deletions > 0) && (
                                          <div className="flex items-center gap-1 text-[10px] font-mono shrink-0">
                                            {file.additions > 0 && <span className="text-emerald-400">+{file.additions}</span>}
                                            {file.deletions > 0 && <span className="text-error">-{file.deletions}</span>}
                                          </div>
                                        )}
                                        <button
                                          onClick={() => handleStageFile(file.path)}
                                          disabled={stagingPath === file.path}
                                          className="p-1.5 rounded-md text-tertiary hover:bg-tertiary/10 transition-colors disabled:opacity-50"
                                          title="Stage"
                                        >
                                          {stagingPath === file.path ? (
                                            <Loader2 size={14} className="animate-spin" />
                                          ) : (
                                            <PlusCircle size={14} />
                                          )}
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="p-4 bg-surface-container-high/30 border-t border-outline-variant/10 space-y-3">
                {/* Commit input + button */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCommit()}
                    placeholder="Commit message..."
                    disabled={isCommitting}
                    className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/50 font-mono disabled:opacity-50"
                  />
                  <button
                    onClick={handleCommit}
                    disabled={isCommitting || !commitMessage.trim() || !gitStatus.data?.files.some(f => f.status === 'staged')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                      commitMessage.trim() && gitStatus.data?.files.some(f => f.status === 'staged')
                        ? "bg-primary text-on-primary hover:brightness-110"
                        : "bg-surface-container-highest text-on-surface-variant border border-outline-variant/10"
                    )}
                  >
                    {isCommitting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <GitCommitHorizontal size={14} />
                    )}
                    Commit
                  </button>
                </div>

                {/* Push / Pull buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-on-primary py-2.5 rounded-lg text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <ArrowUpRight size={14} />}
                    {isSyncing ? t('project.syncing') : t('project.pushChanges')}
                  </button>
                  <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="flex-1 flex items-center justify-center gap-2 bg-surface-container-highest text-on-surface py-2.5 rounded-lg text-xs font-bold hover:bg-surface-variant transition-all border border-outline-variant/10 disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={cn(isSyncing && "animate-spin")} />
                    {t('project.updateRemote')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Generation Modal */}
      <AnimatePresence>
        {showTaskModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowTaskModal(false); setGeneratedPlan(null); }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-surface-container-low border border-outline-variant/20 rounded-xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-high/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Sparkles size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest">{t('project.generateTask')}</h3>
                    <p className="text-[10px] text-outline uppercase tracking-tighter">AI-Driven Context Decomposition</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowTaskModal(false); setGeneratedPlan(null); }}
                  className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 flex flex-col items-center justify-center min-h-[300px] max-h-[60vh] overflow-y-auto">
                {!isGenerating && !generatedPlan ? (
                  <div className="text-center space-y-6 max-w-md">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                      <Layers size={32} className="text-primary" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-bold">{t('project.splittingModules')}</h4>
                      <p className="text-xs text-on-surface-variant opacity-70 leading-relaxed">
                        I will analyze your project context and decompose it into logical functional modules and business tasks.
                      </p>
                    </div>
                    <button
                      onClick={handleGenerateTasks}
                      className="w-full bg-primary text-on-primary py-3 rounded-lg text-sm font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20"
                    >
                      {t('project.generateTask')}
                    </button>
                  </div>
                ) : isGenerating ? (
                  <div className="w-full space-y-8">
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        <Bot size={20} className="absolute inset-0 m-auto text-primary" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-primary animate-pulse">
                        {t('project.splittingModules')}
                      </span>
                    </div>
                  </div>
                ) : generatedPlan ? (
                  <div className="w-full space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-sm font-bold">{generatedPlan.name}</h4>
                        <p className="text-[10px] text-on-surface-variant font-mono">{generatedPlan.id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">
                          P{generatedPlan.priority}
                        </span>
                        <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded font-bold">
                          {generatedPlan.size}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      {generatedPlan.description}
                    </p>
                    {generatedPlan.tasks.map((group, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: idx * 0.2 }}
                        className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle2 size={14} className="text-tertiary" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            {group.group_name}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.items.map((item, tIdx) => (
                            <span key={tIdx} className="text-[10px] bg-surface-container-high px-2 py-1 rounded border border-outline-variant/10">
                              {item}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="p-4 bg-surface-container-high/30 border-t border-outline-variant/10 flex gap-3">
                {generatedPlan ? (
                  <>
                    <button
                      onClick={() => setGeneratedPlan(null)}
                      className="flex-1 px-6 py-2 bg-surface-container-highest text-on-surface rounded-lg text-xs font-bold hover:bg-surface-variant transition-all border border-outline-variant/10"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleCreateFeature}
                      className="flex-1 flex items-center justify-center gap-2 bg-primary text-on-primary py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all"
                    >
                      <Plus size={14} />
                      Create Feature
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setShowTaskModal(false); setGeneratedPlan(null); }}
                    className="px-6 py-2 bg-surface-container-highest text-on-surface rounded-lg text-xs font-bold hover:bg-surface-variant transition-all border border-outline-variant/10 ml-auto"
                  >
                    {isGenerating ? 'Cancel' : 'Close'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* API Key Configuration Modal */}
      <AnimatePresence>
        {showApiKeyModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowApiKeyModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-surface-container-low border border-outline-variant/20 rounded-xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-high/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary/10 rounded-lg">
                    <Key size={20} className="text-secondary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest">API Key</h3>
                    <p className="text-[10px] text-outline">Gemini API Key for AI features</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowApiKeyModal(false)}
                  className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  agentChat.apiKeyConfigured
                    ? "bg-tertiary/10 border-tertiary/20"
                    : "bg-warning/10 border-warning/20"
                )}>
                  {agentChat.apiKeyConfigured ? (
                    <CheckCircle2 size={16} className="text-tertiary" />
                  ) : (
                    <AlertTriangle size={16} className="text-warning" />
                  )}
                  <span className="text-xs text-on-surface-variant">
                    {agentChat.apiKeyConfigured
                      ? 'API Key is configured and stored securely in your OS Keyring.'
                      : 'No API Key configured. AI features require a Gemini API key.'}
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Gemini API Key
                  </label>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStoreApiKey()}
                    placeholder="Enter your Gemini API key..."
                    className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-3 text-xs text-on-surface focus:outline-none focus:border-primary/50 font-mono"
                  />
                  <p className="text-[9px] text-outline leading-relaxed">
                    Your key is stored in the OS Keyring and never sent to the frontend or exposed in network requests.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-surface-container-high/30 border-t border-outline-variant/10 flex gap-3">
                {agentChat.apiKeyConfigured && (
                  <button
                    onClick={() => agentChat.removeApiKey()}
                    className="px-4 py-2 bg-error/10 text-error rounded-lg text-xs font-bold hover:bg-error/20 transition-all border border-error/20"
                  >
                    Delete Key
                  </button>
                )}
                <div className="flex-1" />
                <button
                  onClick={() => setShowApiKeyModal(false)}
                  className="px-4 py-2 bg-surface-container-highest text-on-surface rounded-lg text-xs font-bold hover:bg-surface-variant transition-all border border-outline-variant/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStoreApiKey}
                  disabled={!apiKeyInput.trim()}
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50"
                >
                  Save Key
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
