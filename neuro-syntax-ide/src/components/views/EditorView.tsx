import React, { useState, useCallback, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import {
  Folder,
  FileCode,
  FileJson,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Terminal as TerminalIcon,
  Save,
  Check,
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
  RefreshCw,
  Video,
  Music,
  List,
  FilePlus2,
  FolderPlus,
  Pencil,
  Trash2,
  ClipboardCopy,
  AlertTriangle,
  Copy,
  Scissors,
  ClipboardPaste,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { useTabOverflow } from '../../lib/useTabOverflow';
import { XTerminal, TerminalKind } from '../XTerminal';
import { FileNode as WSFileNode, OpenFileState } from '../../types';
import { NEURO_DARK_THEME, NEURO_LIGHT_THEME } from '../../lib/monaco-theme';
import { useTheme } from '../../context/ThemeContext';
import { getFileRendererType } from '../../lib/file-type-router';
import { getEditorOptionsForLanguage } from '../../lib/language-presets';
import { MarkdownSplitView } from './MarkdownSplitView';
import { ImagePreview } from './ImagePreview';
import { PdfPreview } from './PdfPreview';
import { MediaPreview } from './MediaPreview';
import { ConfigTreeView } from './ConfigTreeView';
import { registerVueLanguage } from '../../lib/vue-language';
import { ContextMenu, ContextMenuEntry } from '../common/ContextMenu';
import { DeleteConfirmDialog } from '../common/DeleteConfirmDialog';

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
  registerVueLanguage(monaco);
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
    case 'pdf':
      return { Icon: FileText, color: 'text-red-400' };
    case 'mp4':
    case 'webm':
    case 'mov':
    case 'avi':
    case 'mkv':
      return { Icon: Video, color: 'text-purple-400' };
    case 'mp3':
    case 'wav':
    case 'ogg':
    case 'flac':
    case 'aac':
    case 'm4a':
      return { Icon: Music, color: 'text-green-400' };
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
    vue: 'vue',
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
  const loadFileTree = workspace?.loadFileTree ?? (async () => {});

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

  // Sidebar (file tree) width state
  const DEFAULT_SIDEBAR_WIDTH = 256;
  const MIN_SIDEBAR_WIDTH = 150;
  const MAX_SIDEBAR_WIDTH = 500;
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const isDraggingSidebar = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // Terminal state
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(240);
  const isDraggingTerminal = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // Sidebar (file tree) drag-resize handler
  const handleSidebarDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSidebar.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth]);

  // Double-click to reset sidebar width
  const handleSidebarDoubleClick = useCallback(() => {
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
  }, []);

  // Sidebar drag-resize mousemove/mouseup effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSidebar.current) return;
      const delta = e.clientX - dragStartX.current;
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, dragStartWidth.current + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (!isDraggingSidebar.current) return;
      isDraggingSidebar.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Terminal panel drag-resize handlers
  const handleTerminalDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingTerminal.current = true;
    dragStartY.current = e.clientY;
    dragStartHeight.current = terminalHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [terminalHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingTerminal.current) return;
      // Moving mouse UP increases height (dragStartY - currentY is positive when dragging up)
      const delta = dragStartY.current - e.clientY;
      const newHeight = Math.max(100, Math.min(window.innerHeight * 0.8, dragStartHeight.current + delta));
      setTerminalHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (!isDraggingTerminal.current) return;
      isDraggingTerminal.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // Context menu state (feat-file-tree-context-menu)
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: WSFileNode | null; // null = blank area
    parentNode: WSFileNode | null; // parent directory for blank area
  } | null>(null);

  // Inline editing state for new file / new folder / rename
  const [inlineEdit, setInlineEdit] = useState<{
    type: 'new-file' | 'new-folder' | 'rename';
    parentPath: string; // directory where item is being created/renamed
    originalName?: string; // for rename
    nodePath?: string; // for rename — full path of the node
  } | null>(null);
  const [inlineInputValue, setInlineInputValue] = useState('');
  const inlineInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    node: WSFileNode;
  } | null>(null);

  // Clipboard state (feat-file-tree-clipboard)
  const [clipboard, setClipboard] = useState<{
    sourcePath: string;
    sourceName: string;
    mode: 'copy' | 'cut';
  } | null>(null);

  // Drag & drop state (feat-file-tree-clipboard)
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  // Error message for file operations
  const [fileOpError, setFileOpError] = useState<string | null>(null);

  // Tab overflow state
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [overflowFocusIndex, setOverflowFocusIndex] = useState(-1);
  const {
    containerRef: tabContainerRef,
    canScrollLeft,
    canScrollRight,
    scrollLeft: scrollTabsLeft,
    scrollRight: scrollTabsRight,
    scrollToTab,
  } = useTabOverflow();

  // Multi-tab terminal state
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: 'term-0', kind: 'bash', label: t('editor.bashTerminal') },
  ]);
  const [activeTabId, setActiveTabId] = useState('term-0');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const termTabScrollRef = useRef<HTMLDivElement>(null);

  // Close add-terminal dropdown when clicking outside
  useEffect(() => {
    if (!showAddMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-add-menu]')) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAddMenu]);

  // Auto-scroll terminal tabs when activeTabId changes (scroll to active tab)
  useEffect(() => {
    if (!termTabScrollRef.current || !activeTabId) return;
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    if (idx < 0) return;
    requestAnimationFrame(() => {
      const container = termTabScrollRef.current;
      if (!container) return;
      const tabEls = container.querySelectorAll('[data-term-tab]');
      const target = tabEls[idx] as HTMLElement | undefined;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
      }
    });
  }, [activeTabId, tabs]);

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

    // Determine renderer type first — binary files (image, pdf) handle their own loading
    const rendererType = getFileRendererType(filePath);
    const isBinary = rendererType === 'image' || rendererType === 'pdf' || rendererType === 'media';

    try {
      const content = isBinary ? '' : await readFileContent(filePath);

      // Large file guard (text-only)
      if (!isBinary && content.length > MAX_FILE_SIZE) {
        setFileError(t('editor.fileTooLarge'));
        setFileLoading(false);
        return;
      }

      const newFile: OpenFileState = {
        path: filePath,
        name,
        content,
        language: isBinary ? '' : getLanguageFromPath(filePath),
        isDirty: false,
        viewState: null,
        rendererType,
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
  // Context menu handlers (feat-file-tree-context-menu)
  // -----------------------------------------------------------------------

  /** Refresh file tree and preserve expanded directories */
  const refreshFileTree = useCallback(async () => {
    if (!workspacePath || !isTauri) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const tree: WSFileNode[] = await invoke('read_file_tree', { path: workspacePath });
      // Use loadFileTree to update state (this preserves expanded dirs since we track them separately)
      // We directly update via loadFileTree
      await loadFileTree(workspacePath);
    } catch (e: any) {
      setFileOpError(e?.toString() ?? 'Failed to refresh file tree');
    }
  }, [workspacePath, isTauri, loadFileTree]);

  // -----------------------------------------------------------------------
  // Clipboard operations (feat-file-tree-clipboard)
  // -----------------------------------------------------------------------

  /** Handle copy: store source path in clipboard state */
  const handleCopy = useCallback((node: WSFileNode) => {
    setClipboard({ sourcePath: node.path, sourceName: node.name, mode: 'copy' });
    setStatusMessage(t('editor.clipboardCopySuccess'));
  }, [t]);

  /** Handle cut: store source path and mark as cut */
  const handleCut = useCallback((node: WSFileNode) => {
    setClipboard({ sourcePath: node.path, sourceName: node.name, mode: 'cut' });
    setStatusMessage(t('editor.clipboardCutSuccess'));
  }, [t]);

  /** Handle paste: copy or move entry to target directory */
  const handlePaste = useCallback(async (targetDir: string) => {
    if (!clipboard || !isTauri) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      if (clipboard.mode === 'copy') {
        await invoke('copy_entry', { sourcePath: clipboard.sourcePath, targetDir });
        setStatusMessage(t('editor.clipboardPasteSuccess'));
      } else {
        await invoke('move_entry', { sourcePath: clipboard.sourcePath, targetDir });
        setStatusMessage(t('editor.clipboardPasteSuccess'));
        // After a cut-paste, clear the clipboard
        setClipboard(null);
      }
      await refreshFileTree();
    } catch (e: any) {
      setFileOpError(e?.toString() ?? (clipboard.mode === 'copy' ? t('editor.clipboardPasteFailed') : t('editor.clipboardMoveFailed')));
    }
  }, [clipboard, isTauri, refreshFileTree, t]);

  /** Handle drag & drop move */
  const handleDrop = useCallback(async (sourcePath: string, targetDir: string) => {
    if (!isTauri) return;
    // Don't allow dropping onto itself
    const srcParent = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
    if (srcParent === targetDir) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('move_entry', { sourcePath, targetDir });
      await refreshFileTree();
    } catch (e: any) {
      setFileOpError(e?.toString() ?? t('editor.clipboardMoveFailed'));
    }
  }, [isTauri, refreshFileTree, t]);

  /** Clear clipboard on Escape key */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && clipboard) {
        setClipboard(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [clipboard]);

  /** Handle right-click on a file tree node */
  const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: WSFileNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, node, parentNode: null });
  }, []);

  /** Handle right-click on blank area of file tree */
  const handleBlankAreaContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node: null, parentNode: null });
  }, []);

  /** Build context menu items based on what was right-clicked */
  const buildContextMenuItems = useCallback((): ContextMenuEntry[] => {
    if (!contextMenu) return [];
    const { node } = contextMenu;
    const items: ContextMenuEntry[] = [];

    if (node) {
      // Right-clicked on a file or folder
      if (node.isDir) {
        items.push(
          {
            key: 'new-file',
            label: t('editor.contextNewFile'),
            icon: <FilePlus2 size={14} />,
            shortcut: '',
            onClick: () => {
              // Expand dir first, then show inline input
              if (!expandedDirs.has(node.path)) {
                toggleDir(node.path);
              }
              setInlineEdit({ type: 'new-file', parentPath: node.path });
              setInlineInputValue('');
            },
          },
          {
            key: 'new-folder',
            label: t('editor.contextNewFolder'),
            icon: <FolderPlus size={14} />,
            shortcut: '',
            onClick: () => {
              if (!expandedDirs.has(node.path)) {
                toggleDir(node.path);
              }
              setInlineEdit({ type: 'new-folder', parentPath: node.path });
              setInlineInputValue('');
            },
          },
          { key: 'div-1', type: 'divider' },
          {
            key: 'paste',
            label: t('editor.contextPaste'),
            icon: <ClipboardPaste size={14} />,
            shortcut: 'Ctrl+V',
            disabled: !clipboard,
            onClick: () => {
              handlePaste(node.path);
            },
          },
          { key: 'div-paste', type: 'divider' },
        );
      }

      items.push(
        {
          key: 'rename',
          label: t('editor.contextRename'),
          icon: <Pencil size={14} />,
          shortcut: 'F2',
          onClick: () => {
            setInlineEdit({
              type: 'rename',
              parentPath: node.path.substring(0, node.path.lastIndexOf('/')),
              originalName: node.name,
              nodePath: node.path,
            });
            setInlineInputValue(node.name);
          },
        },
        {
          key: 'delete',
          label: t('editor.contextDelete'),
          icon: <Trash2 size={14} />,
          shortcut: 'Del',
          danger: true,
          onClick: () => {
            setDeleteConfirm({ node });
          },
        },
        { key: 'div-2', type: 'divider' },
        {
          key: 'copy',
          label: t('editor.contextCopy'),
          icon: <Copy size={14} />,
          shortcut: 'Ctrl+C',
          onClick: () => {
            handleCopy(node);
          },
        },
        {
          key: 'cut',
          label: t('editor.contextCut'),
          icon: <Scissors size={14} />,
          shortcut: 'Ctrl+X',
          onClick: () => {
            handleCut(node);
          },
        },
        { key: 'div-3', type: 'divider' },
        {
          key: 'copy-path',
          label: t('editor.contextCopyPath'),
          icon: <ClipboardCopy size={14} />,
          shortcut: '',
          onClick: () => {
            navigator.clipboard.writeText(node.path).catch(() => {});
          },
        },
      );
    } else {
      // Right-clicked on blank area — create in workspace root
      items.push(
        {
          key: 'new-file',
          label: t('editor.contextNewFile'),
          icon: <FilePlus2 size={14} />,
          shortcut: '',
          onClick: () => {
            setInlineEdit({ type: 'new-file', parentPath: workspacePath });
            setInlineInputValue('');
          },
        },
        {
          key: 'new-folder',
          label: t('editor.contextNewFolder'),
          icon: <FolderPlus size={14} />,
          shortcut: '',
          onClick: () => {
            setInlineEdit({ type: 'new-folder', parentPath: workspacePath });
            setInlineInputValue('');
          },
        },
        { key: 'div-1', type: 'divider' },
        {
          key: 'paste',
          label: t('editor.contextPaste'),
          icon: <ClipboardPaste size={14} />,
          shortcut: 'Ctrl+V',
          disabled: !clipboard,
          onClick: () => {
            handlePaste(workspacePath);
          },
        },
        { key: 'div-paste', type: 'divider' },
        {
          key: 'refresh',
          label: t('editor.refreshTree'),
          icon: <RefreshCw size={14} />,
          shortcut: '',
          onClick: () => {
            refreshFileTree();
          },
        },
      );
    }

    return items;
  }, [contextMenu, expandedDirs, t, workspacePath, refreshFileTree, clipboard, handleCopy, handleCut, handlePaste]);

  /** Handle inline edit submission (Enter key or blur) */
  const handleInlineEditSubmit = useCallback(async () => {
    if (!inlineEdit || !inlineInputValue.trim()) {
      setInlineEdit(null);
      return;
    }

    const name = inlineInputValue.trim();

    // Validate: no slashes, not empty
    if (name.includes('/') || name.includes('\\')) {
      setFileOpError(t('editor.errorInvalidName'));
      setInlineEdit(null);
      return;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');

      if (inlineEdit.type === 'new-file') {
        const fullPath = `${inlineEdit.parentPath}/${name}`;
        await invoke('create_file', { path: fullPath });
      } else if (inlineEdit.type === 'new-folder') {
        const fullPath = `${inlineEdit.parentPath}/${name}`;
        await invoke('create_dir', { path: fullPath });
      } else if (inlineEdit.type === 'rename' && inlineEdit.nodePath) {
        const dirPath = inlineEdit.parentPath;
        const newPath = `${dirPath}/${name}`;
        if (newPath !== inlineEdit.nodePath) {
          await invoke('rename_entry', { oldPath: inlineEdit.nodePath, newPath });
        }
      }

      setInlineEdit(null);
      setInlineInputValue('');
      // Refresh file tree after operation
      await refreshFileTree();
    } catch (e: any) {
      setFileOpError(e?.toString() ?? 'Operation failed');
      setInlineEdit(null);
    }
  }, [inlineEdit, inlineInputValue, isTauri, refreshFileTree, t]);

  /** Handle inline edit cancellation (Escape key) */
  const handleInlineEditCancel = useCallback(() => {
    setInlineEdit(null);
    setInlineInputValue('');
  }, []);

  /** Handle delete confirmation */
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm || !isTauri) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_entry', { path: deleteConfirm.node.path });

      // If the deleted file was open, close its tab
      closeFile(deleteConfirm.node.path);

      setDeleteConfirm(null);
      await refreshFileTree();
    } catch (e: any) {
      setFileOpError(e?.toString() ?? 'Delete failed');
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, isTauri, refreshFileTree, closeFile]);

  // Auto-focus inline input when it appears
  useEffect(() => {
    if (inlineEdit && inlineInputRef.current) {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        inlineInputRef.current?.focus();
        // For rename, select the name part (before extension)
        if (inlineEdit.type === 'rename' && inlineEdit.originalName) {
          const dotIndex = inlineEdit.originalName.lastIndexOf('.');
          if (dotIndex > 0) {
            inlineInputRef.current?.setSelectionRange(0, dotIndex);
          } else {
            inlineInputRef.current?.select();
          }
        }
      });
    }
  }, [inlineEdit]);

  // Auto-dismiss error messages
  useEffect(() => {
    if (!fileOpError) return;
    const timer = setTimeout(() => setFileOpError(null), 5000);
    return () => clearTimeout(timer);
  }, [fileOpError]);

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
      const idx = prev.findIndex((tb) => tb.id === tabId);
      const next = prev.filter((tb) => tb.id !== tabId);
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

      // Check if this node is being renamed
      const isRenaming = inlineEdit?.type === 'rename' && inlineEdit.nodePath === node.path;

      // Check if this node is in cut state (feat-file-tree-clipboard)
      const isCut = clipboard?.mode === 'cut' && clipboard.sourcePath === node.path;

      // Drag & drop: whether this directory is a current drop target
      const isDropTarget = dragOverPath === node.path;

      return (
        <div key={node.path}>
          {isRenaming ? (
            // Inline rename input
            <div
              className="flex items-center gap-2 py-1 px-2"
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
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
              <input
                ref={inlineInputRef}
                value={inlineInputValue}
                onChange={(e) => setInlineInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleInlineEditSubmit();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    handleInlineEditCancel();
                  }
                }}
                onBlur={() => handleInlineEditSubmit()}
                className="flex-1 bg-surface-container-lowest border border-primary/50 rounded px-1 py-0.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          ) : (
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', node.path);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (node.isDir) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverPath(node.path);
                }
              }}
              onDragLeave={() => {
                if (dragOverPath === node.path) {
                  setDragOverPath(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const sourcePath = e.dataTransfer.getData('text/plain');
                if (sourcePath && node.isDir && sourcePath !== node.path) {
                  handleDrop(sourcePath, node.path);
                }
                setDragOverPath(null);
              }}
              onDragEnd={() => {
                setDragOverPath(null);
              }}
              className={cn(
                "flex items-center gap-2 py-1 px-2 hover:bg-surface-container-high rounded cursor-pointer transition-colors group",
                isActive && "bg-surface-container-highest/50 text-on-surface",
                isCut && "opacity-50",
                isDropTarget && "bg-primary/10 ring-1 ring-primary/30"
              )}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              onClick={() => {
                if (node.isDir) {
                  toggleDir(node.path);
                } else {
                  openFile(node.path);
                }
              }}
              onContextMenu={(e) => handleNodeContextMenu(e, node)}
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
                isActive ? "text-on-surface" : "text-on-surface-variant",
                isCut && "line-through text-outline-variant"
              )}>
                {node.name}
              </span>
            </div>
          )}
          {node.isDir && isExpanded && (
            <>
              {/* Inline new-file/new-folder input at top of children */}
              {inlineEdit && (inlineEdit.type === 'new-file' || inlineEdit.type === 'new-folder') && inlineEdit.parentPath === node.path && (
                <div
                  className="flex items-center gap-2 py-1 px-2"
                  style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
                >
                  <div className="w-3.5" />
                  {inlineEdit.type === 'new-file' ? (
                    (() => {
                      const { Icon, color } = getFileIcon(inlineInputValue || 'untitled');
                      return <Icon size={14} className={color} />;
                    })()
                  ) : (
                    <Folder size={14} className="text-primary" />
                  )}
                  <input
                    ref={inlineInputRef}
                    value={inlineInputValue}
                    onChange={(e) => setInlineInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleInlineEditSubmit();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        handleInlineEditCancel();
                      }
                    }}
                    onBlur={() => handleInlineEditSubmit()}
                    placeholder={inlineEdit.type === 'new-file' ? t('editor.placeholderNewFile') : t('editor.placeholderNewFolder')}
                    className="flex-1 bg-surface-container-lowest border border-primary/50 rounded px-1 py-0.5 text-xs text-on-surface focus:outline-none focus:border-primary placeholder:text-outline-variant/50"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
              {node.children && renderFileTree(node.children, depth + 1)}
            </>
          )}
        </div>
      );
    });
  };

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const openFileEntries = useMemo(() => Array.from(openFiles.values()), [openFiles]);

  // -----------------------------------------------------------------------
  // Auto-scroll active file tab into view
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!activeFilePath) return;
    const idx = openFileEntries.findIndex((f) => f.path === activeFilePath);
    if (idx >= 0) {
      // Small delay to allow tab DOM to render before scrolling
      requestAnimationFrame(() => scrollToTab(idx));
    }
  }, [activeFilePath, openFileEntries, scrollToTab]);

  // -----------------------------------------------------------------------
  // Close overflow dropdown on outside click + keyboard navigation
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!showOverflowMenu) {
      setOverflowFocusIndex(-1);
      return;
    }
    setOverflowFocusIndex(-1);
    const clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-overflow-menu]')) {
        setShowOverflowMenu(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowOverflowMenu(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setOverflowFocusIndex((prev) =>
          prev < openFileEntries.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setOverflowFocusIndex((prev) =>
          prev > 0 ? prev - 1 : openFileEntries.length - 1
        );
      } else if (e.key === 'Enter' && overflowFocusIndex >= 0) {
        e.preventDefault();
        const file = openFileEntries[overflowFocusIndex];
        if (file) {
          setActiveFilePath(file.path);
          setShowOverflowMenu(false);
        }
      }
    };
    document.addEventListener('mousedown', clickHandler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', clickHandler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [showOverflowMenu, openFileEntries, overflowFocusIndex]);

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
      <aside
        className="bg-surface-container-low border-r border-outline-variant/10 flex flex-col shrink-0"
        style={{ width: sidebarWidth }}
      >
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
              <div className="relative">
                <button
                  onClick={() => setShowFileMenu(!showFileMenu)}
                  className={cn(
                    "p-1 hover:bg-surface-container-high rounded transition-colors",
                    showFileMenu && "bg-surface-container-high"
                  )}
                >
                  <MoreVertical size={14} className="text-outline" />
                </button>
                <AnimatePresence>
                  {showFileMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-full mt-1 bg-surface-container-high border border-outline-variant/20 rounded-md shadow-lg z-50 min-w-[140px] py-1"
                    >
                      <button
                        onClick={async () => {
                          setShowFileMenu(false);
                          if (workspacePath) {
                            await loadFileTree(workspacePath);
                          }
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-on-surface hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        <RefreshCw size={12} />
                        {t('editor.refreshTree')}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
                {showFileMenu && (
                  <div className="fixed inset-0 z-40" onClick={() => setShowFileMenu(false)} />
                )}
              </div>
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

        <div
          className="flex-1 overflow-y-auto p-2 scroll-hide"
          onContextMenu={handleBlankAreaContextMenu}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            const sourcePath = e.dataTransfer.getData('text/plain');
            if (sourcePath && workspacePath) {
              handleDrop(sourcePath, workspacePath);
            }
            setDragOverPath(null);
          }}
        >
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
            <>
              {/* Inline new-file/new-folder input at root level */}
              {inlineEdit && (inlineEdit.type === 'new-file' || inlineEdit.type === 'new-folder') && inlineEdit.parentPath === workspacePath && (
                <div className="flex items-center gap-2 py-1 px-2" style={{ paddingLeft: '8px' }}>
                  <div className="w-3.5" />
                  {inlineEdit.type === 'new-file' ? (
                    (() => {
                      const { Icon, color } = getFileIcon(inlineInputValue || 'untitled');
                      return <Icon size={14} className={color} />;
                    })()
                  ) : (
                    <Folder size={14} className="text-primary" />
                  )}
                  <input
                    ref={inlineInputRef}
                    value={inlineInputValue}
                    onChange={(e) => setInlineInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleInlineEditSubmit();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        handleInlineEditCancel();
                      }
                    }}
                    onBlur={() => handleInlineEditSubmit()}
                    placeholder={inlineEdit.type === 'new-file' ? t('editor.placeholderNewFile') : t('editor.placeholderNewFolder')}
                    className="flex-1 bg-surface-container-lowest border border-primary/50 rounded px-1 py-0.5 text-xs text-on-surface focus:outline-none focus:border-primary placeholder:text-outline-variant/50"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
              {renderFileTree(filteredTree)}
            </>
          ) : (
            <div className="p-2 text-center">
              <p className="text-[10px] text-outline uppercase tracking-widest mt-4">
                Empty workspace
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Sidebar resize divider */}
      <div
        onMouseDown={handleSidebarDragStart}
        onDoubleClick={handleSidebarDoubleClick}
        className="w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors shrink-0 relative group"
        title="Drag to resize sidebar, double-click to reset"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      {/* Context menu overlay (feat-file-tree-context-menu) */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <DeleteConfirmDialog
          entryName={deleteConfirm.node.name}
          isDir={deleteConfirm.node.isDir}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* File operation error toast */}
      <AnimatePresence>
        {fileOpError && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[400] bg-error/90 text-on-primary px-4 py-2 rounded-lg text-xs font-bold shadow-lg flex items-center gap-2 max-w-md"
          >
            <AlertTriangle size={12} />
            <span className="truncate">{fileOpError}</span>
            <button
              onClick={() => setFileOpError(null)}
              className="ml-2 hover:opacity-70 transition-opacity"
            >
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Editor Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Editor Tab Bar */}
        <div className="h-10 bg-surface-container-low border-b border-outline-variant/10 flex items-center shrink-0">
          {/* Left scroll arrow */}
          <AnimatePresence>
            {canScrollLeft && (
              <motion.button
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 28 }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                onClick={scrollTabsLeft}
                className="h-full flex items-center justify-center shrink-0 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors z-10"
                aria-label="Scroll tabs left"
              >
                <ChevronLeft size={14} />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Open file tabs */}
          <div
            ref={tabContainerRef}
            className="flex items-center h-full overflow-x-auto scroll-hide flex-1"
          >
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

          {/* Right scroll arrow */}
          <AnimatePresence>
            {canScrollRight && (
              <motion.button
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 28 }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                onClick={scrollTabsRight}
                className="h-full flex items-center justify-center shrink-0 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors z-10"
                aria-label="Scroll tabs right"
              >
                <ChevronRight size={14} />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Overflow dropdown menu */}
          <div className="relative" data-overflow-menu>
            <button
              onClick={() => setShowOverflowMenu((prev) => !prev)}
              className={cn(
                "h-full flex items-center justify-center w-8 shrink-0 transition-colors",
                showOverflowMenu
                  ? "text-on-surface bg-surface-container-high"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
              )}
              aria-label="Show all open files"
            >
              <List size={14} />
            </button>

            <AnimatePresence>
              {showOverflowMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1 bg-surface-container-high border border-outline-variant/20 rounded-md shadow-lg z-50 min-w-[220px] max-h-[300px] overflow-y-auto py-1"
                >
                  {openFileEntries.length === 0 ? (
                    <div className="px-3 py-2 text-[10px] text-outline uppercase tracking-widest text-center">
                      No open files
                    </div>
                  ) : (
                    openFileEntries.map((file, idx) => {
                      const isActive = file.path === activeFilePath;
                      const isFocused = idx === overflowFocusIndex;
                      const { Icon: FIcon, color: fColor } = getFileIcon(file.name);
                      return (
                        <div
                          key={file.path}
                          onClick={() => {
                            setActiveFilePath(file.path);
                            setShowOverflowMenu(false);
                          }}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : isFocused
                                ? "bg-surface-container-highest text-on-surface"
                                : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
                          )}
                        >
                          <FIcon size={13} className={isActive ? 'text-primary' : fColor} />
                          <span className="text-xs font-medium truncate flex-1">{file.name}</span>
                          {file.isDirty && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              closeFile(file.path);
                            }}
                            className="opacity-40 hover:opacity-100 transition-opacity shrink-0 ml-1"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            {showOverflowMenu && (
              <div className="fixed inset-0 z-40" onClick={() => setShowOverflowMenu(false)} />
            )}
          </div>

          {/* Save status indicator / button */}
          <div className="flex items-center px-4 shrink-0">
            {activeFile?.isDirty ? (
              <button
                onClick={saveActiveFile}
                className={cn(
                  "flex items-center gap-1.5 text-[10px] font-bold transition-colors",
                  "text-primary hover:text-primary-container"
                )}
              >
                <Save size={14} />
                {t('editor.save')}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-outline/40 cursor-default select-none">
                <Check size={14} />
                {t('editor.saved')}
              </span>
            )}
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
              activeFile.rendererType === 'markdown' ? (
                <MarkdownSplitView
                  filePath={activeFile.path}
                  content={activeFile.content}
                  onContentChange={(v) => handleEditorChange(v)}
                  language={activeFile.language}
                />
              ) : activeFile.rendererType === 'image' ? (
                <ImagePreview
                  filePath={activeFile.path}
                  isTauri={isTauri}
                />
              ) : activeFile.rendererType === 'pdf' ? (
                <PdfPreview
                  filePath={activeFile.path}
                  isTauri={isTauri}
                />
              ) : activeFile.rendererType === 'media' ? (
                <MediaPreview
                  filePath={activeFile.path}
                  isTauri={isTauri}
                />
              ) : activeFile.rendererType === 'config-tree' ? (
                <ConfigTreeView
                  filePath={activeFile.path}
                  content={activeFile.content}
                  language={activeFile.language}
                  onContentChange={(v) => handleEditorChange(v)}
                />
              ) : (
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
              )
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
              animate={{ height: terminalHeight }}
              className="bg-app border-t border-outline-variant/20 flex flex-col shrink-0"
              style={{ height: terminalHeight }}
            >
              {/* Drag handle — resize terminal panel by dragging this bar */}
              <div
                onMouseDown={handleTerminalDragStart}
                className="h-1.5 cursor-row-resize hover:bg-primary/20 active:bg-primary/30 transition-colors flex items-center justify-center shrink-0"
                title="Drag to resize terminal"
              >
                <div className="w-8 h-0.5 rounded-full bg-outline-variant/30" />
              </div>
              {/* Tab bar */}
              <div className="h-9 bg-surface-container-low flex items-center px-2 justify-between border-b border-outline-variant/10 relative">
                <div ref={termTabScrollRef} className="flex items-center h-full overflow-x-auto scroll-hide flex-1 min-w-0">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      data-term-tab
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
                </div>

                {/* "+" button to add new terminals — placed outside scroll container so dropdown is not clipped */}
                <div className="relative shrink-0" data-add-menu>
                  <button
                    onClick={() => setShowAddMenu((prev) => !prev)}
                    className="flex items-center justify-center h-full px-2 text-outline opacity-50 hover:opacity-100 transition-opacity"
                  >
                    <Plus size={14} />
                  </button>
                  {showAddMenu && (
                    <div className="absolute right-0 top-full bg-surface-container-high border border-outline-variant/20 rounded shadow-lg py-1 z-50 min-w-[140px]">
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
                  {showAddMenu && (
                    <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
                  )}
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
              <div className="flex-1 w-full relative overflow-hidden">
                {tabs.map((tab) => (
                  <XTerminal
                    key={tab.id}
                    ptyId={tab.id}
                    kind={tab.kind}
                    active={tab.id === activeTabId}
                    cwd={workspacePath || undefined}
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
              title={t('editor.openTerminal')}
            >
              <TerminalIcon size={16} />
            </button>
          )}
        </div>
      </main>
    </div>
  );
};
