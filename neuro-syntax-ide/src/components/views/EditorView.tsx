import React, { useState, useCallback, useMemo } from 'react';
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
  X,
  Plus,
  FolderOpen,
  File,
  FileText,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { XTerminal, TerminalKind } from '../XTerminal';
import { FileNode as WSFileNode } from '../../types';

// ---------------------------------------------------------------------------
// File-icon helper — maps filename extensions to lucide icons + colours
// ---------------------------------------------------------------------------

function getFileIcon(name: string): { Icon: React.ElementType; color: string } {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';

  switch (ext) {
    case 'tsx':
    case 'ts':
      return { Icon: FileCode, color: 'text-secondary' };
    case 'jsx':
    case 'js':
      return { Icon: FileCode, color: 'text-yellow-400' };
    case 'json':
      return { Icon: FileJson, color: 'text-tertiary' };
    case 'css':
    case 'scss':
    case 'less':
      return { Icon: Code2, color: 'text-primary' };
    case 'md':
    case 'mdx':
      return { Icon: FileText, color: 'text-on-surface-variant' };
    case 'yaml':
    case 'yml':
      return { Icon: FileJson, color: 'text-blue-400' };
    case 'toml':
      return { Icon: FileJson, color: 'text-orange-400' };
    case 'rs':
      return { Icon: FileCode, color: 'text-orange-500' };
    case 'html':
      return { Icon: Code2, color: 'text-red-400' };
    default:
      return { Icon: File, color: 'text-outline' };
  }
}

// ---------------------------------------------------------------------------
// Terminal tab descriptor
// ---------------------------------------------------------------------------

interface TerminalTab {
  id: string;
  kind: TerminalKind;
  label: string;
}

let _tabCounter = 0;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EditorViewProps {
  workspace?: {
    workspacePath: string;
    fileTree: WSFileNode[];
    loading: boolean;
    error: string | null;
    selectWorkspace: () => Promise<void>;
    loadFileTree: (path: string) => Promise<void>;
    isTauri: boolean;
  };
}

// ===========================================================================
// Component
// ===========================================================================

export const EditorView: React.FC<EditorViewProps> = ({ workspace }) => {
  const { t } = useTranslation();

  // Destructure workspace — provide safe defaults when not supplied
  const workspacePath = workspace?.workspacePath ?? '';
  const fileTree = workspace?.fileTree ?? [];
  const loading = workspace?.loading ?? false;
  const selectWorkspace = workspace?.selectWorkspace ?? (async () => {});

  const [selectedFile, setSelectedFile] = useState('');
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // Multi-tab terminal state
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: 'term-0', kind: 'bash', label: t('editor.bashTerminal') },
  ]);
  const [activeTabId, setActiveTabId] = useState('term-0');

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  // -----------------------------------------------------------------------
  // Search filtering
  // -----------------------------------------------------------------------

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return fileTree;
    return filterTree(fileTree, searchQuery.toLowerCase());
  }, [fileTree, searchQuery]);

  function filterTree(nodes: WSFileNode[], query: string): WSFileNode[] {
    const result: WSFileNode[] = [];
    for (const node of nodes) {
      if (node.isDir) {
        const filteredChildren = node.children ? filterTree(node.children, query) : [];
        if (filteredChildren.length > 0) {
          result.push({ ...node, children: filteredChildren });
        }
      } else {
        if (node.name.toLowerCase().includes(query)) {
          result.push(node);
        }
      }
    }
    return result;
  }

  // -----------------------------------------------------------------------
  // Directory expand / collapse
  // -----------------------------------------------------------------------

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // -----------------------------------------------------------------------
  // Tab management
  // -----------------------------------------------------------------------
  const addTab = useCallback((kind: TerminalKind) => {
    _tabCounter += 1;
    const id = `term-${_tabCounter}`;
    const labelMap: Record<TerminalKind, string> = {
      bash: t('editor.bashTerminal'),
      claude: t('editor.claudeCode'),
      gemini: t('editor.geminiCli'),
    };
    setTabs((prev) => [...prev, { id, kind, label: labelMap[kind] }]);
    setActiveTabId(id);
  }, [t]);

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId);
      if (next.length === 0) {
        _tabCounter += 1;
        const fallback: TerminalTab = {
          id: `term-${_tabCounter}`,
          kind: 'bash',
          label: 'Bash Terminal',
        };
        setActiveTabId(fallback.id);
        return [fallback];
      }
      return next;
    });
    setActiveTabId((prev) => {
      if (prev === tabId) {
        const remaining = tabs.filter((t) => t.id !== tabId);
        return remaining.length > 0 ? remaining[remaining.length - 1].id : prev;
      }
      return prev;
    });
  }, [tabs]);

  const tabIcon = (kind: TerminalKind, size = 12) => {
    switch (kind) {
      case 'bash':
        return <TerminalIcon size={size} />;
      case 'claude':
        return <Bot size={size} />;
      case 'gemini':
        return <Sparkles size={size} />;
    }
  };

  const tabActiveColor = (kind: TerminalKind) => {
    switch (kind) {
      case 'bash':
        return 'text-primary border-b-2 border-primary';
      case 'claude':
        return 'text-secondary border-b-2 border-secondary';
      case 'gemini':
        return 'text-blue-400 border-b-2 border-blue-400';
    }
  };

  // -----------------------------------------------------------------------
  // File-tree renderer — uses real WSFileNode from Tauri backend
  // -----------------------------------------------------------------------

  const renderFileTree = (nodes: WSFileNode[], depth = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedDirs.has(node.path);

      return (
        <div key={node.path}>
          <div
            className={cn(
              "flex items-center gap-2 py-1 px-2 hover:bg-surface-container-high rounded cursor-pointer transition-colors group",
              selectedFile === node.path && "bg-surface-container-highest/50 text-on-surface"
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => {
              if (node.isDir) {
                toggleDir(node.path);
              } else {
                setSelectedFile(node.path);
              }
            }}
          >
            {node.isDir ? (
              isExpanded ? (
                <ChevronDown size={14} className="text-outline" />
              ) : (
                <ChevronRight size={14} className="text-outline" />
              )
            ) : (
              <div className="w-3.5" />
            )}
            {node.isDir ? (
              <Folder size={14} className="text-primary" />
            ) : (
              (() => {
                const { Icon, color } = getFileIcon(node.name);
                return <Icon size={14} className={color} />;
              })()
            )}
            <span className={cn(
              "text-xs font-medium truncate",
              selectedFile === node.path ? "text-on-surface" : "text-on-surface-variant"
            )}>
              {node.name}
            </span>
          </div>
          {node.isDir && isExpanded && node.children && renderFileTree(node.children, depth + 1)}
        </div>
      );
    });
  };

  // -----------------------------------------------------------------------
  // Display helpers
  // -----------------------------------------------------------------------

  const selectedFileName = selectedFile.split('/').pop() ?? selectedFile;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

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
          {!workspacePath ? (
            <div className="p-4 flex flex-col items-center justify-center gap-4 text-center min-h-[200px]">
              <FolderOpen size={32} className="text-outline opacity-40" />
              <p className="text-[10px] text-outline uppercase tracking-widest">
                {t('editor.noWorkspace')}
              </p>
              <button
                onClick={selectWorkspace}
                className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded text-xs font-bold hover:bg-primary/20 transition-all border border-primary/20"
              >
                <FolderOpen size={14} />
                {t('editor.openProject')}
              </button>
            </div>
          ) : loading ? (
            <div className="p-4 flex flex-col items-center gap-3">
              <RefreshCw size={20} className="text-primary animate-spin" />
              <p className="text-[10px] text-outline uppercase tracking-widest">Loading...</p>
            </div>
          ) : showSearch && searchQuery ? (
            filteredTree.length > 0 ? (
              renderFileTree(filteredTree)
            ) : (
              <div className="p-2 text-center">
                <p className="text-[10px] text-outline uppercase tracking-widest mt-4">
                  No files matching &quot;{searchQuery}&quot;
                </p>
              </div>
            )
          ) : fileTree.length > 0 ? (
            renderFileTree(filteredTree)
          ) : (
            <div className="p-2 text-center">
              <p className="text-[10px] text-outline uppercase tracking-widest mt-4">
                Empty workspace
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Editor Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Tab Bar */}
        <div className="h-10 bg-surface-container-low border-b border-outline-variant/10 flex items-center shrink-0">
          <div className="flex items-center h-full">
            {selectedFile && (
              <div className="flex items-center gap-2 px-4 h-full bg-surface border-t-2 border-primary text-xs font-medium text-on-surface">
                {(() => {
                  const { Icon, color } = getFileIcon(selectedFileName);
                  return <Icon size={14} className={color} />;
                })()}
                <span>{selectedFileName}</span>
                <button
                  onClick={() => setSelectedFile('')}
                  className="ml-2 opacity-50 hover:opacity-100"
                >
                  x
                </button>
              </div>
            )}
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
            {selectedFile ? (
              <>
                <div className="absolute left-0 top-0 w-12 h-full bg-surface-container-low/30 border-r border-outline-variant/5 flex flex-col items-center py-6 text-outline/40 select-none">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div key={i} className="h-6">{i + 1}</div>
                  ))}
                </div>
                <div className="pl-10">
                  <pre className="text-on-surface">
                    <code className="block">
                      <span className="text-outline italic">-- File content will load here via Tauri FS --</span>{'\n'}
                      <span className="text-outline/40">-- {selectedFile} --</span>
                    </code>
                  </pre>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-outline/30">
                <p className="text-xs uppercase tracking-widest">Select a file to view</p>
              </div>
            )}
          </div>

          {/* Terminal Section — xterm.js real terminal */}
          {terminalOpen && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 240 }}
              className="bg-[#020617] border-t border-outline-variant/20 flex flex-col shrink-0"
            >
              {/* Tab bar */}
              <div className="h-9 bg-surface-container-low flex items-center px-2 justify-between border-b border-outline-variant/10">
                <div className="flex items-center h-full overflow-x-auto scroll-hide">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTabId(tab.id)}
                      className={cn(
                        "relative flex items-center gap-1.5 h-full px-3 text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                        activeTabId === tab.id
                          ? tabActiveColor(tab.kind)
                          : "text-outline opacity-50 hover:opacity-100"
                      )}
                    >
                      {tabIcon(tab.kind)}
                      <span>{tab.label}</span>
                      {tabs.length > 1 && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            closeTab(tab.id);
                          }}
                          className="ml-1 opacity-40 hover:opacity-100 transition-opacity"
                        >
                          <X size={10} />
                        </span>
                      )}
                    </button>
                  ))}

                  {/* "+" button to add new terminals */}
                  <div className="relative group">
                    <button className="flex items-center justify-center h-full px-2 text-outline opacity-50 hover:opacity-100 transition-opacity">
                      <Plus size={14} />
                    </button>
                    <div className="absolute left-0 top-full mt-0 bg-surface-container-high border border-outline-variant/20 rounded shadow-lg py-1 z-50 hidden group-hover:block min-w-[140px]">
                      <button
                        onClick={() => addTab('bash')}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-highest transition-colors"
                      >
                        <TerminalIcon size={12} className="text-primary" />
                        Bash
                      </button>
                      <button
                        onClick={() => addTab('claude')}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-highest transition-colors"
                      >
                        <Bot size={12} className="text-secondary" />
                        Claude CLI
                      </button>
                      <button
                        onClick={() => addTab('gemini')}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-highest transition-colors"
                      >
                        <Sparkles size={12} className="text-blue-400" />
                        Gemini CLI
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 pl-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-outline font-mono">{t('editor.quickConnect')}:</span>
                    <button
                      onClick={() => addTab('claude')}
                      className="p-1 hover:bg-surface-container-high rounded text-secondary"
                      title={t('editor.claudeCode')}
                    >
                      <Zap size={12} />
                    </button>
                    <button
                      onClick={() => addTab('gemini')}
                      className="p-1 hover:bg-surface-container-high rounded text-blue-400"
                      title={t('editor.geminiCli')}
                    >
                      <Bot size={12} />
                    </button>
                  </div>
                  <button onClick={() => setTerminalOpen(false)} className="text-outline hover:text-on-surface text-sm leading-none">
                    &times;
                  </button>
                </div>
              </div>

              {/* xterm.js terminal instances — all mounted but only active visible */}
              <div className="flex-1 relative overflow-hidden">
                {tabs.map((tab) => (
                  <XTerminal
                    key={tab.id}
                    ptyId={tab.id}
                    kind={tab.kind}
                    active={tab.id === activeTabId}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
};
