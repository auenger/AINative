import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  FolderOpen,
  Github,
  FileText,
  Send,
  Bot,
  RefreshCw,
  X,
  Sparkles,
  CheckCircle2,
  Folder,
  Key,
  AlertTriangle,
  Loader2,
  MessageSquarePlus,
  Square,
  Radio,
  WifiOff,
  Eye,
  ChevronDown,
  ChevronRight,
  FileCheck,
  Edit3,
  Save,
  FileEdit,
  Paperclip,
  AtSign,
  FileSpreadsheet,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import ReactMarkdown from 'react-markdown';
import { useAgentStream } from '../../lib/useAgentStream';
import { useSettings } from '../../lib/useSettings';
import type { MdFileEntry, MdEditorMode } from '../../types';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { FileUploadArea, AttachButton } from '../common/FileUploadArea';
import { usePMFiles } from '../../lib/usePMFiles';
import { useMultimodalAnalyze } from '../../lib/useMultimodalAnalyze';
import { useMultimodalChat } from '../../lib/useMultimodalChat';
import type { FileReference } from '../../lib/useMultimodalChat';
import { FileReferencePicker, FileReferenceTag, FileAttachmentCard } from '../common/FileReferencePicker';
import { FileCheck as FileCheckIcon } from 'lucide-react';

interface WorkspaceHook {
  workspacePath: string;
  loading: boolean;
  error: string | null;
  selectWorkspace: () => Promise<void>;
}

interface ProjectViewProps {
  workspace: WorkspaceHook;
  onNavigateToGit?: () => void;
}


export const ProjectView: React.FC<ProjectViewProps> = ({ workspace, onNavigateToGit }) => {
  const { t } = useTranslation();
  const { workspacePath, loading: workspaceLoading, error: workspaceError, selectWorkspace } = workspace;

  // --- Settings & Provider management ---
  const { settings } = useSettings();
  const defaultProvider = settings.llm.provider || 'gemini-http';

  // Independent provider overrides per agent tab (null = use settings default)
  const [pmProviderOverride, setPmProviderOverride] = useState<string | null>(null);
  const [reqProviderOverride, setReqProviderOverride] = useState<string | null>(null);

  // Derived runtime IDs
  const pmRuntimeId = pmProviderOverride ?? defaultProvider;
  const reqRuntimeId = reqProviderOverride ?? 'claude-code';

  // Build provider list from settings (for dropdown)
  const providerList = useMemo(() => {
    return Object.keys(settings.providers || {});
  }, [settings.providers]);

  const pmAgent = useAgentStream({
    runtimeId: pmRuntimeId,
    systemPrompt: `You are the Requirement Analyst for Neuro Syntax IDE, an AI-native desktop IDE. Your sole responsibility is to help users explore, clarify, and refine their project requirements through deep, focused conversation.

## Your Role — Requirement Analyst

You are NOT a feature creator. You do NOT generate feature plans or create features. Your job is pure requirement analysis:
- Understand what the user wants to build and why
- Ask probing questions to uncover hidden requirements and edge cases
- Help users think through architecture decisions and trade-offs
- Maintain context across the conversation to build a coherent understanding
- Summarize and organize requirements into clear, structured notes

## Guidelines

1. **Listen first** — Before proposing solutions, make sure you fully understand the user's intent and constraints.
2. **Ask clarifying questions** — When requirements are vague, ask specific questions to narrow scope. Prefer giving options (A vs B) over open-ended questions.
3. **Think in terms of user value** — Always relate technical decisions back to the user's actual goals.
4. **Keep context** — Reference earlier parts of the conversation to show continuity and build on previous decisions.
5. **When requirements are mature** — If the discussion has reached a clear, actionable conclusion, let the user know the requirement is well-defined and suggest: "You can now click the New Task button to create a formal Feature from this discussion."

## What You Do NOT Do

- You do NOT create features, generate task plans, or invoke feature creation workflows.
- You do NOT write or execute code.
- If a user asks you to create a feature, politely redirect them: "For creating features, please use the New Task button in the toolbar. I'm here to help you think through requirements first."

Be concise, analytical, and insightful. Use Markdown formatting for clarity.`,
    greetingMessage: "Hello! I'm your Requirement Analyst. I'll help you explore and refine your project ideas through focused discussion. Tell me — what are you thinking about building?",
  });

  const reqAgent = useAgentStream({
    runtimeId: reqRuntimeId,
    greetingMessage: t('agent.greetReqAgent'),
    useSessions: true,
    persistMessages: true,
    storageKey: 'req_agent_messages',
  });

  // Sync runtimeId changes from provider override to agent hooks
  useEffect(() => {
    pmAgent.setRuntimeId(pmRuntimeId);
  }, [pmRuntimeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    reqAgent.setRuntimeId(reqRuntimeId);
  }, [reqRuntimeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Provider dropdown open state
  const [showPmProviderDropdown, setShowPmProviderDropdown] = useState(false);
  const [showReqProviderDropdown, setShowReqProviderDropdown] = useState(false);

  /** Check if a provider has an API key configured */
  const hasProviderApiKey = useCallback((providerId: string): boolean => {
    const provider = settings.providers?.[providerId];
    return !!provider?.api_key;
  }, [settings.providers]);

  /** Check if ANY provider has an API key configured */
  const anyProviderHasApiKey = useMemo(() => {
    return Object.values(settings.providers || {}).some(p => !!p.api_key);
  }, [settings.providers]);

  /** Check if current PM agent provider has API key in settings */
  const pmProviderReady = hasProviderApiKey(pmAgent.runtimeId);

  /** Handle PM provider switch */
  const handlePmProviderSwitch = useCallback((providerId: string) => {
    setPmProviderOverride(providerId === defaultProvider ? null : providerId);
    setShowPmProviderDropdown(false);
  }, [defaultProvider]);

  /** Handle Req provider switch */
  const handleReqProviderSwitch = useCallback((providerId: string) => {
    setReqProviderOverride(providerId === 'claude-code' ? null : providerId);
    setShowReqProviderDropdown(false);
  }, []);


  // --- PMFile upload management ---
  const pmFileManager = usePMFiles(workspacePath);
  const multimodalAnalyzer = useMultimodalAnalyze(workspacePath);
  const multimodalChat = useMultimodalChat(workspacePath);
  const pmFileInputRef = useRef<HTMLInputElement>(null);

  const [chatInput, setChatInput] = useState('');
  const [reqChatInput, setReqChatInput] = useState('');
  const [activeChatTab, setActiveChatTab] = useState<'pm' | 'req'>('pm');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Project Context: dynamic file loading ---
  const [projectContext, setProjectContext] = useState<string | null>(null);
  const [pcLoading, setPcLoading] = useState(false);
  const [pcError, setPcError] = useState<string | null>(null);

  const loadProjectContext = useCallback(async () => {
    if (!workspacePath) return;
    setPcLoading(true);
    setPcError(null);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const content = await invoke<string>('read_file', {
        path: `${workspacePath}/project-context.md`,
      });
      setProjectContext(content);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPcError(msg);
      setProjectContext(null);
    } finally {
      setPcLoading(false);
    }
  }, [workspacePath]);

  useEffect(() => {
    if (workspacePath) {
      loadProjectContext();
    } else {
      setProjectContext(null);
      setPcError(null);
    }
  }, [workspacePath]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- MD Explorer state (feat-project-md-explorer) ---
  const [mdFiles, setMdFiles] = useState<MdFileEntry[]>([]);
  const [pmdmFiles, setPmdmFiles] = useState<MdFileEntry[]>([]);
  const [pmdmExpanded, setPmdmExpanded] = useState(true);
  const [mdFilesLoading, setMdFilesLoading] = useState(false);
  const [mdFilesError, setMdFilesError] = useState<string | null>(null);
  const [selectedMdFile, setSelectedMdFile] = useState<MdFileEntry | null>(null);
  const [mdFileContent, setMdFileContent] = useState<string>('');
  const [mdEditedContent, setMdEditedContent] = useState<string>('');
  const [mdContentLoading, setMdContentLoading] = useState(false);
  const [mdContentError, setMdContentError] = useState<string | null>(null);
  const [mdEditorMode, setMdEditorMode] = useState<MdEditorMode>('preview');
  const [mdIsDirty, setMdIsDirty] = useState(false);
  const [mdSaving, setMdSaving] = useState(false);
  const [mdSaveError, setMdSaveError] = useState<string | null>(null);
  const [mdSaveSuccess, setMdSaveSuccess] = useState(false);

  /** Load .md file list from workspace root + PMDM folder */
  const loadMdFiles = useCallback(async () => {
    if (!workspacePath) return;
    setMdFilesLoading(true);
    setMdFilesError(null);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const [files, pmdm] = await Promise.all([
        invoke<MdFileEntry[]>('list_md_files', { dirPath: workspacePath }),
        invoke<MdFileEntry[]>('pmdm_list', { workspacePath }).catch(() => [] as MdFileEntry[]),
      ]);
      setMdFiles(files);
      setPmdmFiles(pmdm);
      // Auto-select project-context.md if present, otherwise first file
      const allFiles = [...files, ...pmdm];
      if (allFiles.length > 0 && !selectedMdFile) {
        const projectCtx = allFiles.find(f => f.name === 'project-context.md');
        const toSelect = projectCtx || allFiles[0];
        await selectMdFileEntry(toSelect);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMdFilesError(msg);
      setMdFiles([]);
      setPmdmFiles([]);
    } finally {
      setMdFilesLoading(false);
    }
  }, [workspacePath]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Select and load a single .md file's content */
  const selectMdFileEntry = useCallback(async (file: MdFileEntry) => {
    setSelectedMdFile(file);
    setMdContentLoading(true);
    setMdContentError(null);
    setMdIsDirty(false);
    setMdSaveError(null);
    setMdSaveSuccess(false);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const content = await invoke<string>('read_file', { path: file.path });
      setMdFileContent(content);
      setMdEditedContent(content);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMdContentError(msg);
      setMdFileContent('');
      setMdEditedContent('');
    } finally {
      setMdContentLoading(false);
    }
  }, []);

  /** Save edited content back to file */
  const saveMdFile = useCallback(async () => {
    if (!selectedMdFile || !mdIsDirty) return;
    setMdSaving(true);
    setMdSaveError(null);
    setMdSaveSuccess(false);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('write_file', { path: selectedMdFile.path, content: mdEditedContent });
      setMdFileContent(mdEditedContent);
      setMdIsDirty(false);
      setMdSaveSuccess(true);
      // Auto-hide success indicator after 2s
      setTimeout(() => setMdSaveSuccess(false), 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMdSaveError(msg);
    } finally {
      setMdSaving(false);
    }
  }, [selectedMdFile, mdEditedContent, mdIsDirty]);

  /** Cmd+S handler for saving */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveMdFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveMdFile]);

  /** Load MD files when workspace changes */
  useEffect(() => {
    if (workspacePath) {
      loadMdFiles();
    } else {
      setMdFiles([]);
      setSelectedMdFile(null);
      setMdFileContent('');
      setMdEditedContent('');
    }
  }, [workspacePath]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSendMessage = async () => {
    if (!chatInput.trim() || pmAgent.isStreaming) return;

    // Enrich message with multimodal context
    const { enrichedContent, resolvedReferences } = await multimodalChat.enrichMessage(chatInput);

    pmAgent.sendMessage(enrichedContent);
    multimodalChat.clearFileReferences();
    setChatInput('');
  };

  // Close provider dropdowns when clicking outside
  useEffect(() => {
    if (!showPmProviderDropdown && !showReqProviderDropdown) return;
    const handleClick = () => {
      setShowPmProviderDropdown(false);
      setShowReqProviderDropdown(false);
    };
    // Use setTimeout to avoid closing on the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClick, { once: true });
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [showPmProviderDropdown, showReqProviderDropdown]);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [pmAgent.messages]);

  // Auto-scroll req agent chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [reqAgent.messages]);

  const handleStoreApiKey = () => {
    if (!apiKeyInput.trim()) return;
    pmAgent.configureApiKey(apiKeyInput);
    setApiKeyInput('');
    setShowApiKeyModal(false);
  };

  const handleReqAgentSend = async () => {
    if (!reqChatInput.trim() || reqAgent.isStreaming) return;

    // Enrich message with multimodal context
    const { enrichedContent, resolvedReferences } = await multimodalChat.enrichMessage(reqChatInput);

    reqAgent.sendMessage(enrichedContent);
    multimodalChat.clearFileReferences();
    setReqChatInput('');
  };

  const handleReqAgentStart = async () => {
    // Always start a fresh session — do not reuse old session IDs
    await reqAgent.startSession();
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
            onClick={() => onNavigateToGit?.()}
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

      {/* API Key prompt banner — only when NO provider has an api_key */}
      {workspacePath && !anyProviderHasApiKey && !pmAgent.isStreaming && (
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
      {workspacePath && pmAgent.error && (
        <div className="px-6 py-2 bg-error/10 border-b border-error/20 text-xs text-error flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={12} />
            {pmAgent.error}
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
                  onClick={() => { setActiveChatTab('pm'); setShowPmProviderDropdown(false); setShowReqProviderDropdown(false); }}
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
                  onClick={() => { setActiveChatTab('req'); setShowPmProviderDropdown(false); setShowReqProviderDropdown(false); }}
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
                        <span className="text-[9px] text-outline uppercase font-medium tracking-tighter">Requirement Analyst</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Provider selector dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => { setShowPmProviderDropdown(!showPmProviderDropdown); setShowReqProviderDropdown(false); }}
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter transition-all",
                            pmProviderOverride ? "bg-secondary/10 text-secondary" : "bg-outline-variant/10 text-on-surface-variant",
                            showPmProviderDropdown && "ring-1 ring-primary/30"
                          )}
                          title="Switch LLM Provider"
                        >
                          <span>{pmAgent.runtimeId}</span>
                          <ChevronDown size={8} className={cn("transition-transform", showPmProviderDropdown && "rotate-180")} />
                        </button>
                        {showPmProviderDropdown && (
                          <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-surface-container-high border border-outline-variant/20 rounded-lg shadow-xl py-1">
                            {providerList.map((pId) => {
                              const isSelected = pId === pmAgent.runtimeId;
                              const hasKey = hasProviderApiKey(pId);
                              return (
                                <button
                                  key={pId}
                                  onClick={() => handlePmProviderSwitch(pId)}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-3 py-1.5 text-[10px] transition-colors",
                                    isSelected ? "bg-primary/10 text-primary font-bold" : "text-on-surface-variant hover:bg-surface-container-highest/50"
                                  )}
                                >
                                  <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", hasKey ? "bg-tertiary" : "bg-warning")} />
                                  <span className="flex-1 text-left">{pId}</span>
                                  {!hasKey && (
                                    <AlertTriangle size={9} className="text-warning shrink-0" />
                                  )}
                                  {isSelected && (
                                    <CheckCircle2 size={9} className="text-primary shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                            {providerList.length === 0 && (
                              <div className="px-3 py-2 text-[9px] text-on-surface-variant opacity-60 text-center">No providers configured</div>
                            )}
                          </div>
                        )}
                      </div>
                      {/* API Key warning for current provider */}
                      {!pmProviderReady && settings.providers?.[pmAgent.runtimeId] && (
                        <span className="text-[8px] text-warning bg-warning/10 px-1.5 py-0.5 rounded whitespace-nowrap">No Key</span>
                      )}
                      {/* Connection status — use settings-based key check */}
                      <div className={cn(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded-full",
                        pmProviderReady
                          ? "bg-tertiary/10"
                          : "bg-outline-variant/10"
                      )}>
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          pmProviderReady ? "bg-tertiary animate-pulse" : "bg-outline-variant"
                        )}></div>
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-tighter",
                          pmProviderReady ? "text-tertiary" : "text-outline"
                        )}>
                          {pmAgent.isStreaming ? 'Thinking...' : pmProviderReady ? 'Active' : 'No Key'}
                        </span>
                      </div>
                      {/* Key settings button — only show when provider not ready */}
                      {!pmProviderReady && (
                        <button
                          onClick={() => setShowApiKeyModal(true)}
                          className="p-1 text-on-surface-variant hover:text-primary transition-colors"
                          title="API Key Settings"
                        >
                          <Key size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-hide">
                    {pmAgent.messages.map((msg, idx) => (
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
                              {idx === pmAgent.messages.length - 1 && pmAgent.isStreaming && (
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

                  <div className="border-t border-outline-variant/10 bg-surface">
                    {/* PMFile upload area */}
                    {activeChatTab === 'pm' && (
                      <FileUploadArea
                        files={pmFileManager.files}
                        uploadingFiles={pmFileManager.uploadingFiles}
                        loading={pmFileManager.loading}
                        error={pmFileManager.error}
                        onUpload={pmFileManager.uploadFiles}
                        onDelete={pmFileManager.deleteFile}
                        onClearError={() => pmFileManager.setError(null)}
                        disabled={pmAgent.isStreaming}
                        onAnalyzeFile={multimodalAnalyzer.analyzeFile}
                        onAnalyzeAll={() => multimodalAnalyzer.analyzeAll(pmFileManager.files)}
                        isFileAnalyzed={multimodalAnalyzer.isAnalyzed}
                        analyzeStates={multimodalAnalyzer.fileStates}
                        isAnalyzing={multimodalAnalyzer.status === 'analyzing'}
                        getUnanalyzedCount={multimodalAnalyzer.getUnanalyzedCount}
                      />
                    )}
                    <div className="p-4">
                      {/* File reference tags for PM Agent */}
                      {multimodalChat.referencedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {multimodalChat.referencedFiles.map((ref) => (
                            <FileReferenceTag
                              key={ref.name}
                              name={ref.name}
                              analyzed={ref.analyzed}
                              onRemove={() => multimodalChat.removeFileReference(ref.name)}
                            />
                          ))}
                        </div>
                      )}
                      <div className="relative flex flex-col gap-1">
                        {/* @ File Reference Picker */}
                        {multimodalChat.showFilePicker && (
                          <FileReferencePicker
                            files={multimodalChat.getAvailableFiles()}
                            referencedNames={multimodalChat.referencedFiles.map(f => f.name)}
                            filter={multimodalChat.filePickerFilter}
                            onFilterChange={multimodalChat.updateFilePickerFilter}
                            onSelect={multimodalChat.addFileReference}
                            onDeselect={multimodalChat.removeFileReference}
                            onClose={multimodalChat.closeFilePicker}
                            isFileAnalyzed={multimodalAnalyzer.isAnalyzed}
                            position="above"
                          />
                        )}
                        <textarea
                          value={chatInput}
                          onChange={(e) => {
                            setChatInput(e.target.value);
                            // Detect @ trigger for file picker
                            if (e.target.value.match(/@\w*$/)) {
                              multimodalChat.openFilePicker();
                            }
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                          placeholder={t('project.chatPlaceholder')}
                          disabled={pmAgent.isStreaming}
                          className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg p-3 text-xs text-on-surface focus:outline-none focus:border-primary/50 resize-none h-20 scroll-hide disabled:opacity-50"
                        />
                        {/* Action buttons row */}
                        <div className="flex items-center gap-1 px-1">
                          <button
                            onClick={() => pmFileInputRef.current?.click()}
                            disabled={pmAgent.isStreaming}
                            className={cn(
                              "p-1.5 rounded-md transition-colors",
                              pmAgent.isStreaming
                                ? "text-outline-variant cursor-not-allowed"
                                : "text-on-surface-variant hover:text-primary hover:bg-primary/10"
                            )}
                            title="Attach files"
                          >
                            <Paperclip size={14} />
                          </button>
                          <button
                            onClick={multimodalChat.openFilePicker}
                            disabled={pmAgent.isStreaming}
                            className={cn(
                              "p-1.5 rounded-md transition-colors",
                              pmAgent.isStreaming
                                ? "text-outline-variant cursor-not-allowed"
                                : multimodalChat.referencedFiles.length > 0
                                  ? "text-primary bg-primary/10"
                                  : "text-on-surface-variant hover:text-primary hover:bg-primary/10"
                            )}
                            title="Reference files (@)"
                          >
                            <AtSign size={14} />
                          </button>
                          <div className="flex-1" />
                          <button
                            onClick={handleSendMessage}
                            disabled={pmAgent.isStreaming || !chatInput.trim()}
                            className={cn(
                              "p-1.5 rounded-md transition-colors",
                              pmAgent.isStreaming || !chatInput.trim()
                                ? "text-outline-variant cursor-not-allowed"
                                : "text-primary hover:bg-primary/10"
                            )}
                          >
                            {pmAgent.isStreaming ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Send size={14} />
                            )}
                          </button>
                        </div>
                      </div>
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
                      {/* Provider selector dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => { setShowReqProviderDropdown(!showReqProviderDropdown); setShowPmProviderDropdown(false); }}
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter transition-all",
                            reqProviderOverride ? "bg-primary/15 text-primary" : "bg-outline-variant/10 text-on-surface-variant",
                            showReqProviderDropdown && "ring-1 ring-primary/30"
                          )}
                          title="Switch LLM Provider"
                        >
                          <span>{reqAgent.runtimeId}</span>
                          <ChevronDown size={8} className={cn("transition-transform", showReqProviderDropdown && "rotate-180")} />
                        </button>
                        {showReqProviderDropdown && (
                          <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-surface-container-high border border-outline-variant/20 rounded-lg shadow-xl py-1">
                            {/* Claude Code built-in option */}
                            <button
                              onClick={() => handleReqProviderSwitch('claude-code')}
                              className={cn(
                                "w-full flex items-center gap-2 px-3 py-1.5 text-[10px] transition-colors",
                                reqAgent.runtimeId === 'claude-code' ? "bg-primary/10 text-primary font-bold" : "text-on-surface-variant hover:bg-surface-container-highest/50"
                              )}
                            >
                              <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-tertiary" />
                              <span className="flex-1 text-left">claude-code</span>
                              {reqAgent.runtimeId === 'claude-code' && (
                                <CheckCircle2 size={9} className="text-primary shrink-0" />
                              )}
                            </button>
                            {/* Configured providers */}
                            {providerList.map((pId) => {
                              const isSelected = pId === reqAgent.runtimeId;
                              const hasKey = hasProviderApiKey(pId);
                              return (
                                <button
                                  key={pId}
                                  onClick={() => handleReqProviderSwitch(pId)}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-3 py-1.5 text-[10px] transition-colors",
                                    isSelected ? "bg-primary/10 text-primary font-bold" : "text-on-surface-variant hover:bg-surface-container-highest/50"
                                  )}
                                >
                                  <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", hasKey ? "bg-tertiary" : "bg-warning")} />
                                  <span className="flex-1 text-left">{pId}</span>
                                  {!hasKey && (
                                    <AlertTriangle size={9} className="text-warning shrink-0" />
                                  )}
                                  {isSelected && (
                                    <CheckCircle2 size={9} className="text-primary shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {/* API Key warning for current provider */}
                      {reqAgent.runtimeId !== 'claude-code' && !hasProviderApiKey(reqAgent.runtimeId) && settings.providers?.[reqAgent.runtimeId] && (
                        <span className="text-[8px] text-warning bg-warning/10 px-1.5 py-0.5 rounded whitespace-nowrap">No Key</span>
                      )}
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

                  {/* Feature Created Notification Banner */}
                  {reqAgent.lastCreatedFeature && (
                    <div className="px-4 py-2 bg-tertiary/10 border-b border-tertiary/20 text-[10px] text-tertiary flex items-center gap-2">
                      <FileCheck size={10} />
                      <span className="flex-1">
                        {t('project.reqAgentFeatureCreated', { id: reqAgent.lastCreatedFeature.featureId })}
                      </span>
                      <button
                        onClick={() => {
                          reqAgent.clearFeatureNotification();
                        }}
                        className="flex items-center gap-1 text-primary underline text-[9px]"
                      >
                        <CheckCircle2 size={9} />
                        {t('project.reqAgentViewFeature')}
                      </button>
                      <button
                        onClick={() => reqAgent.clearFeatureNotification()}
                        className="text-outline-variant hover:text-on-surface-variant ml-1"
                      >
                        <X size={9} />
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
                  <div className="border-t border-outline-variant/10 bg-surface">
                    {/* PMFile upload area for REQ Agent */}
                    {activeChatTab === 'req' && (
                      <FileUploadArea
                        files={pmFileManager.files}
                        uploadingFiles={pmFileManager.uploadingFiles}
                        loading={pmFileManager.loading}
                        error={pmFileManager.error}
                        onUpload={pmFileManager.uploadFiles}
                        onDelete={pmFileManager.deleteFile}
                        onClearError={() => pmFileManager.setError(null)}
                        disabled={reqAgent.isStreaming || reqAgent.connectionState === 'connecting'}
                        onAnalyzeFile={multimodalAnalyzer.analyzeFile}
                        onAnalyzeAll={() => multimodalAnalyzer.analyzeAll(pmFileManager.files)}
                        isFileAnalyzed={multimodalAnalyzer.isAnalyzed}
                        analyzeStates={multimodalAnalyzer.fileStates}
                        isAnalyzing={multimodalAnalyzer.status === 'analyzing'}
                        getUnanalyzedCount={multimodalAnalyzer.getUnanalyzedCount}
                      />
                    )}
                    <div className="p-4">
                      {/* File reference tags for REQ Agent */}
                      {multimodalChat.referencedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {multimodalChat.referencedFiles.map((ref) => (
                            <FileReferenceTag
                              key={ref.name}
                              name={ref.name}
                              analyzed={ref.analyzed}
                              onRemove={() => multimodalChat.removeFileReference(ref.name)}
                            />
                          ))}
                        </div>
                      )}
                      <div className="relative flex flex-col gap-1">
                        {/* @ File Reference Picker for REQ */}
                        {multimodalChat.showFilePicker && (
                          <FileReferencePicker
                            files={multimodalChat.getAvailableFiles()}
                            referencedNames={multimodalChat.referencedFiles.map(f => f.name)}
                            filter={multimodalChat.filePickerFilter}
                            onFilterChange={multimodalChat.updateFilePickerFilter}
                            onSelect={multimodalChat.addFileReference}
                            onDeselect={multimodalChat.removeFileReference}
                            onClose={multimodalChat.closeFilePicker}
                            isFileAnalyzed={multimodalAnalyzer.isAnalyzed}
                            position="above"
                          />
                        )}
                        <textarea
                          value={reqChatInput}
                          onChange={(e) => {
                            setReqChatInput(e.target.value);
                            // Detect @ trigger for file picker
                            if (e.target.value.match(/@\w*$/)) {
                              multimodalChat.openFilePicker();
                            }
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleReqAgentSend())}
                          placeholder={t('project.reqAgentPlaceholder')}
                          disabled={reqAgent.isStreaming || reqAgent.connectionState === 'connecting'}
                          className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg p-3 text-xs text-on-surface focus:outline-none focus:border-primary/50 resize-none h-20 scroll-hide disabled:opacity-50"
                        />
                        {/* Action buttons row */}
                        <div className="flex items-center gap-1 px-1">
                          <button
                            onClick={() => pmFileInputRef.current?.click()}
                            disabled={reqAgent.isStreaming || reqAgent.connectionState === 'connecting'}
                            className={cn(
                              "p-1.5 rounded-md transition-colors",
                              reqAgent.isStreaming || reqAgent.connectionState === 'connecting'
                                ? "text-outline-variant cursor-not-allowed"
                                : "text-on-surface-variant hover:text-primary hover:bg-primary/10"
                            )}
                            title="Attach files"
                          >
                            <Paperclip size={14} />
                          </button>
                          <button
                            onClick={multimodalChat.openFilePicker}
                            disabled={reqAgent.isStreaming || reqAgent.connectionState === 'connecting'}
                            className={cn(
                              "p-1.5 rounded-md transition-colors",
                              reqAgent.isStreaming || reqAgent.connectionState === 'connecting'
                                ? "text-outline-variant cursor-not-allowed"
                                : multimodalChat.referencedFiles.length > 0
                                  ? "text-primary bg-primary/10"
                                  : "text-on-surface-variant hover:text-primary hover:bg-primary/10"
                            )}
                            title="Reference files (@)"
                          >
                            <AtSign size={14} />
                          </button>
                          <div className="flex-1" />
                          <button
                            onClick={handleReqAgentSend}
                            disabled={reqAgent.isStreaming || !reqChatInput.trim() || reqAgent.connectionState === 'connecting'}
                            className={cn(
                              "p-1.5 rounded-md transition-colors",
                              reqAgent.isStreaming || !reqChatInput.trim() || reqAgent.connectionState === 'connecting'
                                ? "text-outline-variant cursor-not-allowed"
                                : "text-primary hover:bg-primary/10"
                            )}
                          >
                            {reqAgent.isStreaming ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Send size={14} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: MD Explorer — File List + Content Area */}
          <div className="flex-1 flex overflow-hidden">
            {/* MD File List Sidebar (~180px) */}
            <div className="w-[180px] shrink-0 border-r border-outline-variant/10 flex flex-col bg-surface-container-lowest">
              <div className="h-10 border-b border-outline-variant/10 flex items-center px-3 gap-2 bg-surface-container-low">
                <FileText size={12} className="text-primary" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">MD Files</span>
                <div className="flex-1" />
                <button
                  onClick={loadMdFiles}
                  disabled={mdFilesLoading}
                  className={cn(
                    "p-0.5 rounded transition-colors",
                    mdFilesLoading
                      ? "text-outline-variant cursor-not-allowed"
                      : "text-on-surface-variant hover:text-primary hover:bg-primary/10"
                  )}
                  title="Refresh file list"
                >
                  <RefreshCw size={10} className={cn(mdFilesLoading && "animate-spin")} />
                </button>
              </div>

              {/* File list */}
              <div className="flex-1 overflow-y-auto scroll-hide">
                {mdFilesLoading && (
                  <div className="p-3 space-y-2">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-6 bg-outline-variant/10 rounded animate-pulse" />
                    ))}
                  </div>
                )}

                {!mdFilesLoading && mdFilesError && (
                  <div className="p-3 text-center">
                    <AlertTriangle size={14} className="text-warning mx-auto mb-1" />
                    <p className="text-[9px] text-on-surface-variant">{mdFilesError}</p>
                  </div>
                )}

                {!mdFilesLoading && !mdFilesError && mdFiles.length === 0 && pmdmFiles.length === 0 && (
                  <div className="p-3 text-center">
                    <FileText size={16} className="text-outline-variant mx-auto mb-2 opacity-40" />
                    <p className="text-[9px] text-on-surface-variant opacity-60">No .md files found</p>
                  </div>
                )}

                {/* Root MD files */}
                {!mdFilesLoading && mdFiles.map((file) => (
                  <button
                    key={file.path}
                    onClick={() => selectMdFileEntry(file)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-[11px] transition-colors text-left group",
                      selectedMdFile?.path === file.path
                        ? "bg-primary/10 text-primary font-bold border-r-2 border-primary"
                        : "text-on-surface-variant hover:bg-surface-container-high/40 hover:text-on-surface"
                    )}
                    title={file.path}
                  >
                    <FileText size={12} className={cn(
                      "shrink-0",
                      selectedMdFile?.path === file.path ? "text-primary" : "text-outline-variant group-hover:text-on-surface-variant"
                    )} />
                    <span className="truncate flex-1">{file.name}</span>
                    {selectedMdFile?.path === file.path && mdIsDirty && (
                      <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
                    )}
                  </button>
                ))}

                {/* PMDM folder section */}
                {!mdFilesLoading && pmdmFiles.length > 0 && (
                  <>
                    {/* PMDM folder header */}
                    <button
                      onClick={() => setPmdmExpanded(!pmdmExpanded)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:bg-surface-container-high/30 transition-colors border-t border-outline-variant/10"
                    >
                      {pmdmExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                      <Folder size={10} className="text-tertiary" />
                      <span className="flex-1 text-left">PMDM</span>
                      <span className="text-[8px] text-outline-variant font-normal">{pmdmFiles.length}</span>
                    </button>
                    {/* PMDM files */}
                    {pmdmExpanded && pmdmFiles.map((file) => (
                      <button
                        key={file.path}
                        onClick={() => selectMdFileEntry(file)}
                        className={cn(
                          "w-full flex items-center gap-2 pl-6 pr-3 py-1.5 text-[10px] transition-colors text-left group",
                          selectedMdFile?.path === file.path
                            ? "bg-primary/10 text-primary font-bold border-r-2 border-primary"
                            : "text-on-surface-variant hover:bg-surface-container-high/40 hover:text-on-surface"
                        )}
                        title={file.path}
                      >
                        <FileText size={10} className={cn(
                          "shrink-0",
                          selectedMdFile?.path === file.path ? "text-primary" : "text-outline-variant group-hover:text-on-surface-variant"
                        )} />
                        <span className="truncate flex-1">{file.name}</span>
                        {selectedMdFile?.path === file.path && mdIsDirty && (
                          <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
                        )}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col bg-surface overflow-hidden">
              {/* Toolbar: file name + Edit/Preview toggle + save */}
              <div className="h-10 border-b border-outline-variant/10 flex items-center px-4 justify-between bg-surface-container-low">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={14} className="text-primary shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant truncate">
                    {selectedMdFile ? selectedMdFile.name : 'MD Explorer'}
                  </span>
                  {/* Dirty indicator */}
                  {mdIsDirty && (
                    <span className="text-[8px] font-bold text-warning bg-warning/10 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">
                      Modified
                    </span>
                  )}
                  {/* Save success indicator */}
                  {mdSaveSuccess && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="text-[8px] font-bold text-tertiary bg-tertiary/10 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0 flex items-center gap-1"
                    >
                      <CheckCircle2 size={8} />
                      Saved
                    </motion.span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Edit/Preview toggle */}
                  {selectedMdFile && (
                    <div className="flex items-center bg-surface-container-high/50 rounded-md border border-outline-variant/10 overflow-hidden">
                      <button
                        onClick={() => setMdEditorMode('preview')}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors",
                          mdEditorMode === 'preview'
                            ? "bg-primary/15 text-primary"
                            : "text-on-surface-variant hover:text-on-surface"
                        )}
                      >
                        <Eye size={10} />
                        Preview
                      </button>
                      <button
                        onClick={() => setMdEditorMode('edit')}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors",
                          mdEditorMode === 'edit'
                            ? "bg-primary/15 text-primary"
                            : "text-on-surface-variant hover:text-on-surface"
                        )}
                      >
                        <Edit3 size={10} />
                        Edit
                      </button>
                    </div>
                  )}
                  {/* Save button */}
                  {selectedMdFile && mdIsDirty && (
                    <button
                      onClick={saveMdFile}
                      disabled={mdSaving}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold transition-colors",
                        mdSaving
                          ? "text-outline-variant cursor-not-allowed"
                          : "text-tertiary hover:bg-tertiary/10"
                      )}
                    >
                      {mdSaving ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Save size={10} />
                      )}
                      Save
                    </button>
                  )}
                </div>
              </div>

              {/* Content: loading / error / empty / content */}
              <div className="flex-1 overflow-y-auto scroll-hide">
                {/* No file selected — empty state */}
                {!selectedMdFile && !mdFilesLoading && !mdFilesError && mdFiles.length > 0 && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-3 max-w-xs">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                        <FileText size={20} className="text-primary" />
                      </div>
                      <p className="text-xs text-on-surface-variant">Select a Markdown file from the sidebar to view its content.</p>
                    </div>
                  </div>
                )}

                {/* No .md files at all */}
                {!mdFilesLoading && !mdFilesError && mdFiles.length === 0 && pmdmFiles.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-3 max-w-xs">
                      <div className="w-12 h-12 bg-outline-variant/10 rounded-full flex items-center justify-center mx-auto">
                        <FileText size={20} className="text-outline-variant opacity-40" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-on-surface">No Markdown Files</p>
                        <p className="text-[10px] text-on-surface-variant leading-relaxed">
                          Add <code className="text-primary bg-primary/10 px-1 rounded text-[9px]">.md</code> files to your project root to browse them here.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* File loading skeleton */}
                {mdContentLoading && (
                  <div className="p-8 space-y-4 max-w-3xl mx-auto">
                    <div className="h-6 w-48 bg-outline-variant/10 rounded animate-pulse" />
                    <div className="h-4 w-full bg-outline-variant/10 rounded animate-pulse" />
                    <div className="h-4 w-5/6 bg-outline-variant/10 rounded animate-pulse" />
                    <div className="h-4 w-4/6 bg-outline-variant/10 rounded animate-pulse" />
                    <div className="mt-6 h-5 w-32 bg-outline-variant/10 rounded animate-pulse" />
                    <div className="h-4 w-full bg-outline-variant/10 rounded animate-pulse" />
                    <div className="h-4 w-3/4 bg-outline-variant/10 rounded animate-pulse" />
                  </div>
                )}

                {/* File content error */}
                {!mdContentLoading && mdContentError && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-3 max-w-sm">
                      <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center mx-auto">
                        <AlertTriangle size={20} className="text-error" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-error">Failed to Load File</p>
                        <p className="text-[10px] text-on-surface-variant">{mdContentError}</p>
                      </div>
                      <button
                        onClick={() => selectedMdFile && selectMdFileEntry(selectedMdFile)}
                        className="bg-primary text-on-primary px-3 py-1.5 rounded-lg text-[10px] font-bold hover:brightness-110 transition-all flex items-center gap-1.5 mx-auto"
                      >
                        <RefreshCw size={10} />
                        Retry
                      </button>
                    </div>
                  </div>
                )}

                {/* Save error */}
                {mdSaveError && (
                  <div className="px-4 py-2 bg-error/10 border-b border-error/20 text-[10px] text-error flex items-center gap-2">
                    <AlertTriangle size={10} className="shrink-0" />
                    <span>Save failed: {mdSaveError}</span>
                    <button onClick={() => setMdSaveError(null)} className="ml-auto text-on-surface-variant hover:text-on-surface">
                      <X size={10} />
                    </button>
                  </div>
                )}

                {/* Preview mode: MarkdownRenderer */}
                {!mdContentLoading && !mdContentError && selectedMdFile && mdEditorMode === 'preview' && (
                  <div className="p-8 max-w-3xl mx-auto">
                    <MarkdownRenderer content={mdFileContent} />
                  </div>
                )}

                {/* Edit mode: textarea */}
                {!mdContentLoading && !mdContentError && selectedMdFile && mdEditorMode === 'edit' && (
                  <textarea
                    value={mdEditedContent}
                    onChange={(e) => {
                      setMdEditedContent(e.target.value);
                      setMdIsDirty(e.target.value !== mdFileContent);
                    }}
                    className="w-full h-full bg-transparent text-sm text-on-surface font-mono p-6 resize-none focus:outline-none leading-relaxed"
                    placeholder="Start writing Markdown..."
                    spellCheck={false}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
                  pmAgent.apiKeyConfigured
                    ? "bg-tertiary/10 border-tertiary/20"
                    : "bg-warning/10 border-warning/20"
                )}>
                  {pmAgent.apiKeyConfigured ? (
                    <CheckCircle2 size={16} className="text-tertiary" />
                  ) : (
                    <AlertTriangle size={16} className="text-warning" />
                  )}
                  <span className="text-xs text-on-surface-variant">
                    {pmAgent.apiKeyConfigured
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
                {pmAgent.apiKeyConfigured && (
                  <button
                    onClick={() => pmAgent.removeApiKey()}
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

      {/* Hidden file input for PMFile uploads (shared by PM and REQ Agent) */}
      <input
        ref={pmFileInputRef}
        type="file"
        multiple
        onChange={async (e) => {
          if (e.target.files && e.target.files.length > 0) {
            await pmFileManager.uploadFiles(e.target.files);
            e.target.value = '';
          }
        }}
        className="hidden"
        accept=".png,.jpg,.jpeg,.gif,.bmp,.svg,.webp,.avif,.ico,.wav,.mp3,.ogg,.flac,.aac,.m4a,.wma,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.md,.mdx,.txt,.csv,.json,.yaml,.yml,.xml,.html,.css,.ts,.tsx,.js,.jsx,.py,.rs,.go,.java"
      />
    </div>
  );
};
