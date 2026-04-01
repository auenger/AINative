import React, { useState } from 'react';
import { 
  FolderOpen, 
  Github, 
  MessageSquare, 
  FileText, 
  Send, 
  Bot,
  ChevronRight,
  Globe,
  Search,
  GitBranch,
  GitCommit,
  GitPullRequest,
  ArrowUpRight,
  RefreshCw,
  X,
  Sparkles,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import ReactMarkdown from 'react-markdown';

export const ProjectView: React.FC = () => {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useState('/home/user/neuro-syntax-ide');
  const [gitRemote, setGitRemote] = useState('https://github.com/neuro/syntax-ide.git');
  const [chatInput, setChatInput] = useState('');
  const [showGitModal, setShowGitModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello! I'm your PM Agent. I'll help you define and maintain the project context. What are we building today?" }
  ]);
  
  const [projectContext, setProjectContext] = useState(`
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
    if (!chatInput.trim()) return;
    
    const newMessages = [...messages, { role: 'user', content: chatInput }];
    setMessages(newMessages);
    setChatInput('');
    
    // Simulate PM Agent response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I've updated the project context based on our discussion. I've added the new requirements to the roadmap." 
      }]);
      setProjectContext(prev => prev + "\n- [ ] New Requirement: " + chatInput);
    }, 1000);
  };

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setShowGitModal(false);
    }, 2000);
  };

  const handleGenerateTasks = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
    }, 3000);
  };

  const MOCK_GENERATED_TASKS = [
    { module: 'Core Architecture', tasks: ['Define Plugin System', 'Implement IPC Bridge'] },
    { module: 'UI/UX', tasks: ['Design Theme Engine', 'Responsive Layout System'] },
    { module: 'AI Integration', tasks: ['Gemini API Connector', 'Context Window Manager'] }
  ];

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden relative">
      <header className="h-14 bg-surface-container-low flex items-center justify-between px-6 border-b border-outline-variant/10 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="font-headline text-lg font-bold tracking-tight text-on-surface">{t('project.title')}</h1>
          <div className="h-4 w-px bg-outline-variant/30"></div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface-container-high/50 px-2 py-1 rounded border border-outline-variant/10">
            <FolderOpen size={14} className="text-primary" />
            <span className="font-mono opacity-80">{workspace}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
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

      <div className="flex-1 flex overflow-hidden">
        {/* Left: PM Chat (Purely for discussion) */}
        <div className="w-[400px] border-r border-outline-variant/10 flex flex-col bg-surface-container-lowest shrink-0">
          {/* PM Agent Chat */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-secondary/10 rounded-lg">
                  <Bot size={18} className="text-secondary" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold uppercase tracking-widest">{t('project.pmAgent')}</span>
                  <span className="text-[9px] text-outline uppercase font-medium tracking-tighter">Context Architect</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-tertiary/10 px-2 py-0.5 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></div>
                <span className="text-[9px] text-tertiary font-bold uppercase tracking-tighter">Active</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-hide">
              {messages.map((msg, idx) => (
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
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-outline-variant/10 bg-surface">
              <div className="relative">
                <textarea 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                  placeholder={t('project.chatPlaceholder')}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg p-3 pr-10 text-xs text-on-surface focus:outline-none focus:border-primary/50 resize-none h-20 scroll-hide"
                />
                <button 
                  onClick={handleSendMessage}
                  className="absolute right-2 bottom-2 p-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
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
                    <p className="text-[10px] text-outline font-mono">{gitRemote}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowGitModal(false)}
                  className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Branch Visualization Mock */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-outline">{t('project.branch')}</span>
                    <span className="text-[10px] font-mono bg-secondary/10 text-secondary px-2 py-0.5 rounded">feature/pm-agent</span>
                  </div>
                  <div className="relative h-20 bg-surface-container-lowest rounded-lg border border-outline-variant/5 p-4 flex items-center">
                    <div className="absolute left-4 right-4 h-0.5 bg-outline-variant/20 top-1/2 -translate-y-1/2"></div>
                    <div className="flex justify-between w-full relative z-10">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-outline-variant border-2 border-surface"></div>
                        <span className="text-[8px] font-mono text-outline">main</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 -mt-8">
                        <div className="w-3 h-3 rounded-full bg-secondary border-2 border-surface shadow-[0_0_8px_rgba(var(--secondary),0.5)]"></div>
                        <span className="text-[8px] font-mono text-secondary">current</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-outline-variant border-2 border-surface"></div>
                        <span className="text-[8px] font-mono text-outline">origin/main</span>
                      </div>
                    </div>
                    {/* Merge Line Mock */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
                      <path d="M 40 40 Q 100 10 200 40" fill="none" stroke="currentColor" strokeWidth="1" className="text-secondary" strokeDasharray="4 2" />
                    </svg>
                  </div>
                </div>

                {/* Document Changes Detected */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-outline">{t('project.changesDetected')}</span>
                    <span className="text-[10px] font-bold text-tertiary">1 File Modified</span>
                  </div>
                  <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/10 overflow-hidden">
                    <div className="flex items-center gap-3 p-3 bg-surface-container-high/20">
                      <FileText size={16} className="text-primary" />
                      <div className="flex-1">
                        <p className="text-xs font-bold">project-context.md</p>
                        <p className="text-[10px] text-outline">Updated roadmap and core features</p>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-mono text-tertiary">
                        <span className="text-emerald-400">+12</span>
                        <span className="text-error">-4</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-surface-container-high/30 border-t border-outline-variant/10 flex gap-3">
                <button 
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-on-primary py-2.5 rounded-lg text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {isSyncing ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <ArrowUpRight size={14} />
                  )}
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
              onClick={() => setShowTaskModal(false)}
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
                  onClick={() => setShowTaskModal(false)}
                  className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
                {!isGenerating ? (
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
                ) : (
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
                    
                    <div className="space-y-4">
                      {MOCK_GENERATED_TASKS.map((module, idx) => (
                        <motion.div 
                          key={idx}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: idx * 0.5 }}
                          className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 size={14} className="text-tertiary" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                              {module.module}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {module.tasks.map((task, tIdx) => (
                              <span key={tIdx} className="text-[10px] bg-surface-container-high px-2 py-1 rounded border border-outline-variant/10">
                                {task}
                              </span>
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-surface-container-high/30 border-t border-outline-variant/10 flex justify-end">
                <button 
                  onClick={() => setShowTaskModal(false)}
                  className="px-6 py-2 bg-surface-container-highest text-on-surface rounded-lg text-xs font-bold hover:bg-surface-variant transition-all border border-outline-variant/10"
                >
                  {isGenerating ? 'Cancel' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
