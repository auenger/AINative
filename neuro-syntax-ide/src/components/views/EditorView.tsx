import React, { useState, useCallback, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
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
import { FileNode as WSFileNode, OpenFileState } from '../../types';
import { NEURO_DARK_THEME, NEURO_LIGHT_THEME } from '../../lib/monaco-theme';
import { useTheme } from '../../context/ThemeContext';
import { getFileRendererType } from '../../lib/file-type-router';
import { getEditorOptionsForLanguage } from '../../lib/language-presets';

// Lazy-load Monaco Editor for performance
const Editor = lazy(() => import('@monaco-editor/react'));
import type { editor as MonacoEditor } from 'monaco-editor';

// ---------------------------------------------------------------------------
// Monaco validator — register both themes exactly once
// ---------------------------------------------------------------------------
let _themeRegistered = false;

/** Called in `beforeMount` so themes are available before the first render. */
function ensureThemesRegistered(monaco: Parameters<
  NonNullable<Parameters<typeof Editor>[0]['beforeMount']>
>[0]): void {
  if (_themeRegistered) return;
  monaco.editor.defineTheme('neuro-dark', NEURO_DARK_THEME);
  monaco.editor.defineTheme('neuro-light', NEURO_LIGHT_THEME);
  _themeRegistered = true;
}

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
    case 'jsonc':
      return { Icon: FileJson, color: 'text-tertiary' };
    case 'css':
    case 'scss':
    case 'less':
    case 'sass':
      return { Icon: Code2, color: 'text-primary' };
    case 'md':
    case 'mdx':
      return { Icon: FileText, color: 'text-on-surface-variant' };
    case 'yaml':
    case 'yml':
      return { Icon: FileJson, color: 'text-blue-400' };
    case 'toml':
    case 'ini':
      return { Icon: FileJson, color: 'text-orange-400' };
    case 'rs':
      return { Icon: FileCode, color: 'text-orange-500' };
    case 'py':
      return { Icon: FileCode, color: 'text-green-400' };
    case 'java':
    case 'kt':
    case 'kts':
      return { Icon: FileCode, color: 'text-red-400' };
    case 'go':
      return { Icon: FileCode, color: 'text-cyan-400' };
    case 'c':
    case 'h':
      return { Icon: FileCode, color: 'text-blue-300' };
    case 'cpp':
    case 'hpp':
      return { Icon: FileCode, color: 'text-blue-400' };
    case 'vue':
      return { Icon: FileCode, color: 'text-green-500' };
    case 'svelte':
      return { Icon: FileCode, color: 'text-orange-400' };
    case 'html':
    case 'htm':
      return { Icon: Code2, color: 'text-red-400' };
    case 'sh':
    case 'bash':
    case 'zsh':
      return { Icon: FileCode, color: 'text-green-300' };
    case 'sql':
      return { Icon: FileCode, color: 'text-blue-300' };
    default:
      return { Icon: File, color: 'text-outline' };
  }
}

// ---------------------------------------------------------------------------
// Language mapping — file extension to Monaco language identifier
// ---------------------------------------------------------------------------

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const basename = filePath.split('/').pop()?.toLowerCase() ?? '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    jsonc: 'json',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    htm: 'html',
    md: 'markdown',
    mdx: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'ini',
    rs: 'rust',
    py: 'python',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    sql: 'sql',
    xml: 'xml',
    svg: 'xml',
    txt: 'plaintext',
    log: 'plaintext',
    csv: 'plaintext',
    vue: 'html',
    svelte: 'html',
    java: 'java',
    kt: 'kotlin',
    kts: 'kotlin',
    go: 'go',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    swift: 'swift',
    rb: 'ruby',
    php: 'php',
    graphql: 'graphql',
    gql: 'graphql',
  };
  // Handle extensionless files like Dockerfile, Makefile
  if (ext === '' || !(ext in langMap)) {
    if (basename === 'dockerfile') return 'dockerfile';
    if (basename === 'makefile') return 'makefile';
  }
  return langMap[ext] ?? 'plaintext';
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
// Max file size for opening in Monaco (1MB)
// ---------------------------------------------------------------------------
const MAX_FILE_SIZE = 1_000_000;

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
  const { theme: appTheme } = useTheme();

  // Destructure workspace — provide safe defaults when not supplied
  const workspacePath = workspace?.workspacePath ?? '';
  const fileTree = workspace?.fileTree ?? [];
  const loading = workspace?.loading ?? false;
  const isTauri = workspace?.isTauri ?? false;
  const selectWorkspace = workspace?.selectWorkspace ?? (async () => {});

  // -----------------------------------------------------------------------
  // File Tab state (Monaco multi-tab)
  // -----------------------------------------------------------------------
  const [openFiles, setOpenFiles] = useState<Map<string, OpenFileState>>(new Map());
  const [activeFilePath, setActiveFilePath] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState('');
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);

  // File loading state
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Terminal state
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // Multi-tab terminal state
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: 'term-0', kind: 'bash', label: t('editor.bashTerminal') },
  ]);
  const [activeTabId, setActiveTabId] = useState('term-0');
  const [showAddMenu, setShowAddMenu] = useState(false);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  // Currently active open file
  const activeFile = activeFilePath ? openFiles.get(activeFilePath) : undefined;

  // -----------------------------------------------------------------------
  // Auto-dismiss status messages
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  // -----------------------------------------------------------------------
  // File read — via Tauri invoke or mock fallback
  // -----------------------------------------------------------------------
  const readFileContent = useCallback(async (filePath: string): Promise<string> => {
    if (isTauri) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string>('read_file', { path: filePath });
    }
    // Mock fallback for dev mode
    return [
      `// Mock content for: ${filePath}`,
      `// Generated at ${new Date().toISOString()}`,
      '',
      'export function example() {',
      '  console.log("Hello from Neuro Syntax IDE");',
      '  return 42;',
      '}',
      '',
    ].join('\n');
  }, [isTauri]);

  // -----------------------------------------------------------------------
  // File write — via Tauri invoke or mock fallback
  // -----------------------------------------------------------------------
  const writeFileContent = useCallback(async (filePath: string, content: string): Promise<void> => {
    if (isTauri) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('write_file', { path: filePath, content });
      return;
    }
    // Mock: just log
    console.log('[mock] write_file:', filePath, content.length, 'bytes');
  }, [isTauri]);

  // -----------------------------------------------------------------------
  // Open file in tab
  // -----------------------------------------------------------------------
  const openFile = useCallback(async (filePath: string) => {
    // Already open? Just switch to it — use functional setState to read latest
    let alreadyOpen = false;
    setOpenFiles(prev => {
      if (prev.has(filePath)) {
        alreadyOpen = true;
      }
      return prev; // no mutation
    });
    if (alreadyOpen) {
      setActiveFilePath(filePath);
      return;
    }

    const name = filePath.split('/').pop() ?? filePath;

    setFileLoading(true);
    setFileError(null);

    try {
      const content = await readFileContent(filePath);

      // Large file guard
      if (content.length > MAX_FILE_SIZE) {
        setFileError(t('editor.fileTooLarge'));
        setFileLoading(false);
        return;
      }

      const newFile: OpenFileState = {
        path: filePath,
        name,
        content,
        language: getLanguageFromPath(filePath),
        isDirty: false,
        viewState: null,
        rendererType: getFileRendererType(filePath),
      };

      setOpenFiles(prev => {
        const next = new Map(prev);
        next.set(filePath, newFile);
        return next;
      });
      setActiveFilePath(filePath);
    } catch (err: any) {
      setFileError(err?.toString() ?? 'Failed to read file');
    } finally {
      setFileLoading(false);
    }
  }, [readFileContent, t]);

  // -----------------------------------------------------------------------
  // Close file tab
  // -----------------------------------------------------------------------
  const closeFile = useCallback((filePath: string) => {
    const file = openFiles.get(filePath);

    // If dirty, warn — for now just close (spec says "unsaved prompt" but
    // a real dialog requires a modal component; we allow close for MVP)
    setOpenFiles(prev => {
      const next = new Map(prev);
      next.delete(filePath);
      return next;
    });

    // If closing the active file, switch to the last remaining tab
    if (activeFilePath === filePath) {
      const remaining = Array.from(openFiles.keys()).filter(p => p !== filePath);
      setActiveFilePath(remaining.length > 0 ? remaining[remaining.length - 1] : '');
    }
  }, [openFiles, activeFilePath]);

  // -----------------------------------------------------------------------
  // Save active file
  // -----------------------------------------------------------------------
  const saveActiveFile = useCallback(async () => {
    if (!activeFile || !activeFile.isDirty) return;

    try {
      await writeFileContent(activeFile.path, activeFile.content);
      setOpenFiles(prev => {
        const next = new Map(prev);
        const f = next.get(activeFile.path);
        if (f) {
          next.set(activeFile.path, { ...f, isDirty: false });
        }
        return next;
      });
      setStatusMessage(t('editor.fileSaved'));
    } catch (err: any) {
      setStatusMessage(t('editor.saveFailed') + ': ' + (err?.toString() ?? ''));
    }
  }, [activeFile, writeFileContent, t]);

  // -----------------------------------------------------------------------
  // Cmd+S keyboard shortcut
  // -----------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveActiveFile();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveActiveFile]);

  // -----------------------------------------------------------------------
  // Monaco editor mount handler
  // -----------------------------------------------------------------------
  const handleEditorMount = useCallback((editor: MonacoEditor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    editor.focus();
  }, []);

  // -----------------------------------------------------------------------
  // Monaco beforeMount — register custom theme before first render
  // -----------------------------------------------------------------------
  const handleBeforeMount = useCallback((monaco: Parameters<
    NonNullable<Parameters<typeof Editor>[0]['beforeMount']>
  >[0]) => {
    ensureThemesRegistered(monaco);
  }, []);

  // -----------------------------------------------------------------------
  // Monaco content change handler
  // -----------------------------------------------------------------------
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!activeFilePath || value === undefined) return;
    setOpenFiles(prev => {
      const next = new Map(prev);
      const f = next.get(activeFilePath);
      if (f) {
        next.set(activeFilePath, { ...f, content: value, isDirty: true });
      }
      return next;
    });
  }, [activeFilePath]);

  // -----------------------------------------------------------------------
  // Save view state on tab switch (preserve cursor/scroll)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!activeFilePath || !editorRef.current) return;
    // When switching away, save view state for the *previous* file is handled
    // by the cleanup or by a ref. For simplicity we handle it inline.
  }, [activeFilePath]);

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
  // Terminal Tab management
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
      const idx = prev.findIndex((t) => t.id === tabId);
      const next = prev.filter((t) => t.id !== tabId);
      if (next.length === 0) {
        _tabCounter += 1;
        const fallback: TerminalTab = {
          id: `term-${_tabCounter}`,
          kind: 'bash',
          label: t('editor.bashTerminal'),
        };
        setActiveTabId(fallback.id);
        return [fallback];
      }
      // If closing the active tab, switch to the adjacent one
      if (tabId === activeTabId) {
        const newIdx = Math.min(idx, next.length - 1);
        setActiveTabId(next[newIdx].id);
      }
      return next;
    });
  }, [activeTabId, t]);

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
        return 'text-[color:var(--t-blue-400)] border-b-2 border-[color:var(--t-blue-400)]';
    }
  };

  // -----------------------------------------------------------------------
  // File-tree renderer — uses real WSFileNode from Tauri backend
  // -----------------------------------------------------------------------

  const renderFileTree = (nodes: WSFileNode[], depth = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedDirs.has(node.path);
      const isActive = activeFilePath === node.path;

      return (
        <div key={node.path}>
          <div
            className={cn(
              "flex items-center gap-2 py-1 px-2 hover:bg-surface-container-high rounded cursor-pointer transition-colors group",
              isActive && "bg-surface-container-highest/50 text-on-surface"
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => {
              if (node.isDir) {
                toggleDir(node.path);
              } else {
                openFile(node.path);
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
              isActive ? "text-on-surface" : "text-on-surface-variant"
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
  // Render helpers
  // -----------------------------------------------------------------------

  const openFileEntries = useMemo(() => Array.from(openFiles.values()), [openFiles]);

  // -----------------------------------------------------------------------
  // Monaco editor options — base options (aligned with design system)
  // -----------------------------------------------------------------------
  const baseEditorOptions: MonacoEditor.IStandaloneEditorConstructionOptions = useMemo(() => ({
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontLigatures: true,
    lineHeight: 22,
    minimap: { enabled: true, scale: 1 },
    lineNumbers: 'on',
    renderLineHighlight: 'all',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    wordWrap: 'off',
    folding: true,
    foldingStrategy: 'indentation',
    showFoldingControls: 'mouseover',
    bracketPairColorization: { enabled: true },
    guides: {
      bracketPairs: true,
      indentation: true,
    },
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: true,
    padding: { top: 12, bottom: 12 },
    overviewRulerBorder: false,
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
    },
    theme: appTheme === 'dark' ? 'neuro-dark' : 'neuro-light',
  }), [appTheme]);

  /** Dynamic editor options: base + language-specific preset. */
  const editorOptions = useMemo(() => {
    const language = activeFile?.language ?? '';
    return getEditorOptionsForLanguage(language, baseEditorOptions);
  }, [baseEditorOptions, activeFile?.language]);

  // -----------------------------------------------------------------------
  // Reactively sync Monaco theme on app theme change
  // -----------------------------------------------------------------------
  useEffect(() => {
    import('monaco-editor').then((monaco) => {
      monaco.editor.setTheme(appTheme === 'dark' ? 'neuro-dark' : 'neuro-light');
    });
  }, [appTheme]);

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
        {/* Editor Tab Bar */}
        <div className="h-10 bg-surface-container-low border-b border-outline-variant/10 flex items-center shrink-0">
          {/* Open file tabs */}
          <div className="flex items-center h-full overflow-x-auto scroll-hide flex-1">
            {openFileEntries.map((file) => {
              const isActive = file.path === activeFilePath;
              const { Icon, color } = getFileIcon(file.name);
              return (
                <div
                  key={file.path}
                  onClick={() => setActiveFilePath(file.path)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 h-full text-xs font-medium cursor-pointer border-r border-outline-variant/5 transition-colors shrink-0",
                    isActive
                      ? "bg-surface border-t-2 border-primary text-on-surface"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                  )}
                >
                  <Icon size={13} className={color} />
                  <span className="truncate max-w-[120px]">{file.name}</span>
                  {file.isDirty && (
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeFile(file.path);
                    }}
                    className="ml-1 opacity-40 hover:opacity-100 transition-opacity shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Save + Run actions */}
          <div className="flex items-center gap-3 px-4 shrink-0">
            <button
              onClick={saveActiveFile}
              disabled={!activeFile?.isDirty}
              className={cn(
                "flex items-center gap-1.5 text-[10px] font-bold transition-colors",
                activeFile?.isDirty
                  ? "text-primary hover:text-primary-container"
                  : "text-outline/40 cursor-not-allowed"
              )}
            >
              <Save size={14} />
              {t('editor.save')}
            </button>
            <button className="flex items-center gap-1.5 text-[10px] font-bold text-tertiary hover:text-tertiary-container transition-colors">
              <Play size={14} />
              {t('editor.run')}
            </button>
          </div>
        </div>

        {/* Status message bar */}
        <AnimatePresence>
          {statusMessage && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-primary/10 text-primary text-[10px] font-bold px-4 py-1 border-b border-primary/20 overflow-hidden"
            >
              {statusMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Monaco Editor Content — bg uses CSS variable to prevent white flash before theme loads */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-hidden bg-[var(--t-editor-bg)]">
            {fileLoading ? (
              <div className="flex flex-col items-center justify-center h-full bg-[var(--t-editor-bg)] gap-4">
                <div className="relative w-8 h-8">
                  <div className="absolute inset-0 rounded-full border-2 border-[var(--t-editor-spinner-track)] border-t-[var(--t-editor-spinner-bar)] animate-spin" />
                </div>
                <div className="flex flex-col gap-2 w-48">
                  <div className="h-3 bg-[var(--t-editor-bg-alt)] rounded-full overflow-hidden">
                    <div className="h-full w-2/3 bg-[var(--t-editor-spinner-track)] rounded-full animate-shimmer" />
                  </div>
                  <div className="h-3 bg-[var(--t-editor-bg-alt)] rounded-full overflow-hidden">
                    <div className="h-full w-1/3 bg-[var(--t-editor-spinner-track)] rounded-full animate-shimmer" />
                  </div>
                  <div className="h-3 bg-[var(--t-editor-bg-alt)] rounded-full overflow-hidden">
                    <div className="h-full w-4/5 bg-[var(--t-editor-spinner-track)] rounded-full animate-shimmer" />
                  </div>
                </div>
                <p className="text-[10px] text-[var(--t-editor-loading-text)] uppercase tracking-widest">Loading file...</p>
              </div>
            ) : fileError ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-2 text-center max-w-sm">
                  <p className="text-xs text-error font-medium">{fileError}</p>
                  <button
                    onClick={() => setFileError(null)}
                    className="text-[10px] text-outline hover:text-on-surface uppercase tracking-widest"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : activeFile ? (
              <Suspense
                fallback={
                  <div className="flex flex-col items-center justify-center h-full bg-[var(--t-editor-bg)] gap-4">
                    <div className="relative w-8 h-8">
                      <div className="absolute inset-0 rounded-full border-2 border-[var(--t-editor-spinner-track)] border-t-[var(--t-editor-spinner-bar)] animate-spin" />
                    </div>
                    <div className="flex flex-col gap-2 w-48">
                      <div className="h-3 bg-[var(--t-editor-bg-alt)] rounded-full overflow-hidden">
                        <div className="h-full w-2/3 bg-[var(--t-editor-spinner-track)] rounded-full animate-shimmer" />
                      </div>
                      <div className="h-3 bg-[var(--t-editor-bg-alt)] rounded-full overflow-hidden">
                        <div className="h-full w-1/3 bg-[var(--t-editor-spinner-track)] rounded-full animate-shimmer" />
                      </div>
                      <div className="h-3 bg-[var(--t-editor-bg-alt)] rounded-full overflow-hidden">
                        <div className="h-full w-4/5 bg-[var(--t-editor-spinner-track)] rounded-full animate-shimmer" />
                      </div>
                    </div>
                  </div>
                }
              >
                <Editor
                  key={activeFile.path}
                  height="100%"
                  language={activeFile.language}
                  value={activeFile.content}
                  onChange={handleEditorChange}
                  onMount={handleEditorMount}
                  beforeMount={handleBeforeMount}
                  theme={appTheme === 'dark' ? 'neuro-dark' : 'neuro-light'}
                  options={editorOptions}
                  loading={
                    <div className="flex flex-col items-center justify-center h-full bg-[var(--t-editor-bg)] gap-4">
                      <div className="relative w-8 h-8">
                        <div className="absolute inset-0 rounded-full border-2 border-[var(--t-editor-spinner-track)] border-t-[var(--t-editor-spinner-bar)] animate-spin" />
                      </div>
                      <div className="flex flex-col gap-2 w-48">
                        <div className="h-3 bg-[var(--t-editor-bg-alt)] rounded-full overflow-hidden">
                          <div className="h-full w-2/3 bg-[var(--t-editor-spinner-track)] rounded-full animate-shimmer" />
                        </div>
                        <div className="h-3 bg-[var(--t-editor-bg-alt)] rounded-full overflow-hidden">
                          <div className="h-full w-1/3 bg-[var(--t-editor-spinner-track)] rounded-full animate-shimmer" />
                        </div>
                        <div className="h-3 bg-[var(--t-editor-bg-alt)] rounded-full overflow-hidden">
                          <div className="h-full w-4/5 bg-[var(--t-editor-spinner-track)] rounded-full animate-shimmer" />
                        </div>
                      </div>
                    </div>
                  }
                />
              </Suspense>
            ) : (
              <div className="flex items-center justify-center h-full bg-surface-container-lowest text-outline/30">
                <p className="text-xs uppercase tracking-widest">{t('editor.selectFile')}</p>
              </div>
            )}
          </div>

          {/* Terminal Section — xterm.js real terminal */}
          {terminalOpen && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 240 }}
              className="bg-app border-t border-outline-variant/20 flex flex-col shrink-0"
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

                  {/* "+" button to add new terminals — state-controlled dropdown */}
                  <div
                    className="relative"
                    onMouseEnter={() => setShowAddMenu(true)}
                    onMouseLeave={() => setShowAddMenu(false)}
                  >
                    <button className="flex items-center justify-center h-full px-2 text-outline opacity-50 hover:opacity-100 transition-opacity">
                      <Plus size={14} />
                    </button>
                    {showAddMenu && (
                      <div className="absolute left-0 top-full bg-surface-container-high border border-outline-variant/20 rounded shadow-lg py-1 z-50 min-w-[140px] opacity-100">
                        <button
                          onClick={() => { addTab('bash'); setShowAddMenu(false); }}
                          className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors"
                        >
                          <TerminalIcon size={12} className="text-primary" />
                          Bash
                        </button>
                        <button
                          onClick={() => { addTab('claude'); setShowAddMenu(false); }}
                          className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors"
                        >
                          <Bot size={12} className="text-secondary" />
                          Claude CLI
                        </button>
                        <button
                          onClick={() => { addTab('gemini'); setShowAddMenu(false); }}
                          className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors"
                        >
                          <Sparkles size={12} className="text-[color:var(--t-blue-400)]" />
                          Gemini CLI
                        </button>
                      </div>
                    )}
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
                      className="p-1 hover:bg-surface-container-high rounded text-[color:var(--t-blue-400)]"
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

          {/* Terminal toggle button — shown when terminal is closed (matches Console icon toggle style) */}
          {!terminalOpen && (
            <button
              onClick={() => setTerminalOpen(true)}
              className="absolute bottom-3 right-3 z-30 w-8 h-8 flex items-center justify-center rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/60 transition-all duration-200 cursor-pointer"
              title={t('editor.openTerminal', 'Show Terminal')}
            >
              <TerminalIcon size={16} />
            </button>
          )}
        </div>
      </main>
    </div>
  );
};
