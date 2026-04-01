import React, { useState } from 'react';
import { 
  Folder, 
  FileCode, 
  FileJson, 
  ChevronDown, 
  ChevronRight, 
  Terminal as TerminalIcon, 
  Play, 
  Save, 
  Search, 
  MoreVertical,
  Bot,
  Sparkles,
  Zap,
  Code2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  icon?: any;
  color?: string;
}

const FILE_TREE: FileNode[] = [
  {
    name: 'src',
    type: 'folder',
    children: [
      {
        name: 'components',
        type: 'folder',
        children: [
          { name: 'TopNav.tsx', type: 'file', icon: FileCode, color: 'text-secondary' },
          { name: 'SideNav.tsx', type: 'file', icon: FileCode, color: 'text-secondary' },
          { name: 'EditorView.tsx', type: 'file', icon: FileCode, color: 'text-blue-400' },
        ]
      },
      {
        name: 'lib',
        type: 'folder',
        children: [
          { name: 'utils.ts', type: 'file', icon: FileCode, color: 'text-secondary' },
        ]
      },
      { name: 'App.tsx', type: 'file', icon: FileCode, color: 'text-secondary' },
      { name: 'main.tsx', type: 'file', icon: FileCode, color: 'text-secondary' },
      { name: 'index.css', type: 'file', icon: Code2, color: 'text-primary' },
    ]
  },
  { name: 'package.json', type: 'file', icon: FileJson, color: 'text-tertiary' },
  { name: 'tsconfig.json', type: 'file', icon: FileJson, color: 'text-tertiary' },
];

export const EditorView: React.FC = () => {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState('EditorView.tsx');
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [activeTerminal, setActiveTerminal] = useState<'bash' | 'claude' | 'gemini'>('bash');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => (
      <div key={node.name}>
        <div 
          className={cn(
            "flex items-center gap-2 py-1 px-2 hover:bg-surface-container-high rounded cursor-pointer transition-colors group",
            selectedFile === node.name && "bg-surface-container-highest/50 text-on-surface"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => node.type === 'file' && setSelectedFile(node.name)}
        >
          {node.type === 'folder' ? (
            <ChevronDown size={14} className="text-outline" />
          ) : (
            <div className="w-3.5" />
          )}
          {node.type === 'folder' ? (
            <Folder size={14} className="text-primary" />
          ) : (
            <node.icon size={14} className={node.color || "text-outline"} />
          )}
          <span className={cn(
            "text-xs font-medium",
            selectedFile === node.name ? "text-on-surface" : "text-on-surface-variant"
          )}>
            {node.name}
          </span>
        </div>
        {node.type === 'folder' && node.children && renderFileTree(node.children, depth + 1)}
      </div>
    ));
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-surface">
      {/* File Explorer Sidebar */}
      <aside className="w-64 bg-surface-container-low border-r border-outline-variant/10 flex flex-col shrink-0">
        <div className="p-4 border-b border-outline-variant/10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              {t('editor.explorer')}
            </h2>
            <div className="flex gap-1">
              <button 
                onClick={() => setShowSearch(!showSearch)}
                className={cn(
                  "p-1 hover:bg-surface-container-high rounded transition-colors",
                  showSearch && "text-primary bg-primary/10"
                )}
              >
                <Search size={14} />
              </button>
              <button className="p-1 hover:bg-surface-container-high rounded"><MoreVertical size={14} className="text-outline" /></button>
            </div>
          </div>
          
          <AnimatePresence>
            {showSearch && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="relative">
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('editor.searchPlaceholder')}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/50"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex-1 overflow-y-auto p-2 scroll-hide">
          {showSearch && searchQuery ? (
            <div className="p-2 text-center">
              <p className="text-[10px] text-outline uppercase tracking-widest mt-4">
                Searching for "{searchQuery}"...
              </p>
            </div>
          ) : (
            renderFileTree(FILE_TREE)
          )}
        </div>
      </aside>

      {/* Main Editor Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Tab Bar */}
        <div className="h-10 bg-surface-container-low border-b border-outline-variant/10 flex items-center shrink-0">
          <div className="flex items-center h-full">
            <div className="flex items-center gap-2 px-4 h-full bg-surface border-t-2 border-primary text-xs font-medium text-on-surface">
              <FileCode size={14} className="text-blue-400" />
              <span>{selectedFile}</span>
              <button className="ml-2 opacity-50 hover:opacity-100">×</button>
            </div>
            <div className="flex items-center gap-2 px-4 h-full hover:bg-surface-container-high text-xs font-medium text-on-surface-variant cursor-pointer">
              <FileCode size={14} className="text-secondary" />
              <span>App.tsx</span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3 px-4">
            <button className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:text-primary-container transition-colors">
              <Save size={14} />
              {t('editor.save')}
            </button>
            <button className="flex items-center gap-1.5 text-[10px] font-bold text-tertiary hover:text-tertiary-container transition-colors">
              <Play size={14} />
              {t('editor.run')}
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 bg-surface-container-lowest p-6 font-mono text-[13px] leading-relaxed overflow-y-auto scroll-hide relative">
            <div className="absolute left-0 top-0 w-12 h-full bg-surface-container-low/30 border-r border-outline-variant/5 flex flex-col items-center py-6 text-outline/40 select-none">
              {Array.from({ length: 40 }).map((_, i) => (
                <div key={i} className="h-6">{i + 1}</div>
              ))}
            </div>
            <div className="pl-10">
              <pre className="text-on-surface">
                <code className="block">
                  <span className="text-secondary">import</span> React, &#123; useState &#125; <span className="text-secondary">from</span> <span className="text-tertiary">'react'</span>;{'\n'}
                  <span className="text-secondary">import</span> &#123; Folder, FileCode &#125; <span className="text-secondary">from</span> <span className="text-tertiary">'lucide-react'</span>;{'\n'}
                  {'\n'}
                  <span className="text-primary">export const</span> <span className="text-blue-400">EditorView</span>: React.FC = () =&gt; &#123;{'\n'}
                  {'  '}<span className="text-secondary">const</span> [selectedFile, setSelectedFile] = useState(<span className="text-tertiary">'EditorView.tsx'</span>);{'\n'}
                  {'\n'}
                  {'  '}<span className="text-secondary">return</span> ({'\n'}
                  {'    '}&lt;<span className="text-primary">div</span> className=<span className="text-tertiary">"flex-1 flex overflow-hidden"</span>&gt;{'\n'}
                  {'      '}&lt;<span className="text-primary">aside</span> className=<span className="text-tertiary">"w-64 bg-surface-container-low"</span>&gt;{'\n'}
                  {'        '}&#123;renderFileTree(FILE_TREE)&#125;{'\n'}
                  {'      '}&lt;/<span className="text-primary">aside</span>&gt;{'\n'}
                  {'    '}&lt;/<span className="text-primary">div</span>&gt;{'\n'}
                  {'  '});{'\n'}
                  &#125;;
                </code>
              </pre>
            </div>
          </div>

          {/* Terminal Section */}
          {terminalOpen && (
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: 240 }}
              className="bg-[#020617] border-t border-outline-variant/20 flex flex-col shrink-0"
            >
              <div className="h-9 bg-surface-container-low flex items-center px-4 justify-between border-b border-outline-variant/10">
                <div className="flex items-center gap-4 h-full">
                  <button 
                    onClick={() => setActiveTerminal('bash')}
                    className={cn(
                      "flex items-center gap-2 h-full px-3 text-[10px] font-bold uppercase tracking-widest transition-all",
                      activeTerminal === 'bash' ? "text-primary border-b-2 border-primary" : "text-outline opacity-50 hover:opacity-100"
                    )}
                  >
                    <TerminalIcon size={12} />
                    <span>{t('editor.bashTerminal')}</span>
                  </button>
                  <button 
                    onClick={() => setActiveTerminal('claude')}
                    className={cn(
                      "flex items-center gap-2 h-full px-3 text-[10px] font-bold uppercase tracking-widest transition-all",
                      activeTerminal === 'claude' ? "text-secondary border-b-2 border-secondary" : "text-outline opacity-50 hover:opacity-100"
                    )}
                  >
                    <Bot size={12} />
                    <span>{t('editor.claudeCode')}</span>
                  </button>
                  <button 
                    onClick={() => setActiveTerminal('gemini')}
                    className={cn(
                      "flex items-center gap-2 h-full px-3 text-[10px] font-bold uppercase tracking-widest transition-all",
                      activeTerminal === 'gemini' ? "text-blue-400 border-b-2 border-blue-400" : "text-outline opacity-50 hover:opacity-100"
                    )}
                  >
                    <Sparkles size={12} />
                    <span>{t('editor.geminiCli')}</span>
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-outline font-mono">{t('editor.quickConnect')}:</span>
                    <button className="p-1 hover:bg-surface-container-high rounded text-secondary" title={t('editor.claudeCode')}><Zap size={12} /></button>
                    <button className="p-1 hover:bg-surface-container-high rounded text-blue-400" title={t('editor.geminiCli')}><Bot size={12} /></button>
                  </div>
                  <button onClick={() => setTerminalOpen(false)} className="text-outline hover:text-on-surface">×</button>
                </div>
              </div>
              <div className="flex-1 p-4 font-mono text-[12px] overflow-y-auto scroll-hide">
                {activeTerminal === 'bash' && (
                  <div className="space-y-1">
                    <div className="flex gap-2">
                      <span className="text-emerald-400">neuro@syntax:~/workspace$</span>
                      <span className="text-on-surface">npm run dev</span>
                    </div>
                    <div className="text-outline opacity-70">
                      &gt; neuro-syntax@1.0.4 dev{'\n'}
                      &gt; vite{'\n'}
                      {'\n'}
                      VITE v5.1.4  ready in 242 ms{'\n'}
                      {'\n'}
                      ➜  Local:   http://localhost:3000/{'\n'}
                      ➜  Network: use --host to expose{'\n'}
                    </div>
                    <div className="flex gap-2 animate-pulse">
                      <span className="text-emerald-400">neuro@syntax:~/workspace$</span>
                      <span className="w-2 h-4 bg-on-surface"></span>
                    </div>
                  </div>
                )}
                {activeTerminal === 'claude' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-secondary font-bold">
                      <Bot size={14} />
                      <span>CLAUDE CODE v0.8.2</span>
                    </div>
                    <div className="text-on-surface-variant italic">
                      "I'm ready to help you code. What would you like to build today?"
                    </div>
                    <div className="flex gap-2">
                      <span className="text-secondary">claude &gt;</span>
                      <span className="text-on-surface">Refactor the EditorView component to use a recursive file tree.</span>
                    </div>
                    <div className="text-outline opacity-70">
                      Analyzing workspace...{'\n'}
                      Found 12 files related to "EditorView".{'\n'}
                      Generating diff...
                    </div>
                  </div>
                )}
                {activeTerminal === 'gemini' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-blue-400 font-bold">
                      <Sparkles size={14} />
                      <span>GEMINI CLI v2.1.0</span>
                    </div>
                    <div className="text-on-surface-variant italic">
                      "Gemini-3.1-Pro-Preview connected. Multimodal context active."
                    </div>
                    <div className="flex gap-2">
                      <span className="text-blue-400">gemini &gt;</span>
                      <span className="text-on-surface">Analyze the performance of the current rendering loop.</span>
                    </div>
                    <div className="text-outline opacity-70">
                      Scanning memory profile...{'\n'}
                      Latency detected in: WorkflowEditor.tsx (Line 142){'\n'}
                      Recommendation: Memoize the node connection paths.
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
};
