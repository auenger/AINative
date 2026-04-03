import React, { useState, useCallback, useMemo, useRef, lazy, Suspense, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';
import { NEURO_DARK_THEME, NEURO_LIGHT_THEME } from '../../lib/monaco-theme';
import { getEditorOptionsForLanguage } from '../../lib/language-presets';
import {
  ChevronDown,
  ChevronRight,
  Braces,
  FileJson,
  Code2,
  Eye,
  PenLine,
} from 'lucide-react';
import type { editor as MonacoEditor } from 'monaco-editor';

// Lazy-load Monaco Editor
const Editor = lazy(() => import('@monaco-editor/react'));

// ---------------------------------------------------------------------------
// Monaco theme registration guard (separate from other modules)
// ---------------------------------------------------------------------------
let _configThemeRegistered = false;

function ensureThemesRegistered(monaco: Parameters<
  NonNullable<Parameters<typeof Editor>[0]['beforeMount']>
>[0]): void {
  if (_configThemeRegistered) return;
  monaco.editor.defineTheme('neuro-dark', NEURO_DARK_THEME);
  monaco.editor.defineTheme('neuro-light', NEURO_LIGHT_THEME);
  _configThemeRegistered = true;
}

// ---------------------------------------------------------------------------
// Types for tree nodes
// ---------------------------------------------------------------------------

type TreeNodeType = 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object';

interface TreeNode {
  key: string;
  type: TreeNodeType;
  value: unknown;
  children?: TreeNode[];
}

// ---------------------------------------------------------------------------
// Parsers — convert raw text to structured data, then to TreeNodes
// ---------------------------------------------------------------------------

function parseContent(raw: string, language: string): unknown {
  try {
    if (language === 'json' || language === 'jsonc') {
      // Strip single-line comments for jsonc
      const stripped = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      return JSON.parse(stripped);
    }
    // YAML / TOML / INI — for simplicity, try JSON first (may be JSON5),
    // then attempt basic YAML parsing. For full YAML/TOML support in browser,
    // we'd need a library, but we provide a best-effort text tree view.
    // For now, we attempt JSON.parse and fall back to line-based tree.
    try {
      return JSON.parse(raw);
    } catch {
      return parseLineBasedTree(raw);
    }
  } catch {
    return parseLineBasedTree(raw);
  }
}

/**
 * Basic line-based tree parser for YAML/INI/TOML-like files.
 * Uses indentation to determine nesting.
 */
function parseLineBasedTree(raw: string): Record<string, unknown> {
  const lines = raw.split('\n');
  const result: Record<string, unknown> = {};
  const stack: { indent: number; obj: Record<string, unknown> }[] = [{ indent: -1, obj: result }];

  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith('#') || line.trimStart().startsWith('//')) {
      continue;
    }

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    // INI-style [section]
    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      const section: Record<string, unknown> = {};
      result[sectionMatch[1]] = section;
      stack.length = 1;
      stack.push({ indent: 0, obj: section });
      continue;
    }

    // key = value or key: value
    const kvMatch = trimmed.match(/^["']?([^"':=]+)["']?\s*[:=]\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      let value: unknown = kvMatch[2].trim();

      // Try to parse value types
      if (value === 'null' || value === '~' || value === '') {
        value = null;
      } else if (value === 'true' || value === 'false') {
        value = value === 'true';
      } else if (/^-?\d+(\.\d+)?$/.test(value as string)) {
        value = Number(value);
      } else {
        // Strip surrounding quotes
        if (
          ((value as string).startsWith('"') && (value as string).endsWith('"')) ||
          ((value as string).startsWith("'") && (value as string).endsWith("'"))
        ) {
          value = (value as string).slice(1, -1);
        }
      }

      // Pop stack to find parent
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      const parent = stack[stack.length - 1].obj;
      if (typeof value === 'object' && value !== null) {
        const child: Record<string, unknown> = {};
        parent[key] = child;
        stack.push({ indent, obj: child });
      } else {
        parent[key] = value;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Convert parsed data to TreeNode[]
// ---------------------------------------------------------------------------

function dataToNodes(data: unknown, parentKey = ''): TreeNode[] {
  if (data === null || data === undefined) {
    return [];
  }

  if (Array.isArray(data)) {
    return data.map((item, idx) => {
      const key = `${parentKey}[${idx}]`;
      if (item !== null && typeof item === 'object') {
        return {
          key,
          type: Array.isArray(item) ? 'array' : 'object',
          value: null,
          children: dataToNodes(item, key),
        };
      }
      return {
        key: String(idx),
        type: getSimpleType(item),
        value: item,
      };
    });
  }

  if (typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>).map(([k, v]) => {
      if (v !== null && typeof v === 'object') {
        return {
          key: k,
          type: Array.isArray(v) ? 'array' : 'object',
          value: null,
          children: dataToNodes(v, k),
        };
      }
      return {
        key: k,
        type: getSimpleType(v),
        value: v,
      };
    });
  }

  return [];
}

function getSimpleType(v: unknown): TreeNodeType {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return 'string';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  return 'string';
}

// ---------------------------------------------------------------------------
// Tree Node Icon helper
// ---------------------------------------------------------------------------

function getNodeIcon(type: TreeNodeType): { Icon: React.ElementType; color: string } {
  switch (type) {
    case 'string':
      return { Icon: Code2, color: 'text-green-400' };
    case 'number':
      return { Icon: Braces, color: 'text-blue-400' };
    case 'boolean':
      return { Icon: Eye, color: 'text-yellow-400' };
    case 'null':
      return { Icon: FileJson, color: 'text-outline' };
    case 'array':
      return { Icon: Braces, color: 'text-purple-400' };
    case 'object':
      return { Icon: Braces, color: 'text-orange-400' };
    default:
      return { Icon: FileJson, color: 'text-on-surface-variant' };
  }
}

// ---------------------------------------------------------------------------
// Value display helper
// ---------------------------------------------------------------------------

function formatValue(type: TreeNodeType, value: unknown): string {
  switch (type) {
    case 'string':
      return `"${value as string}"`;
    case 'number':
    case 'boolean':
      return String(value);
    case 'null':
      return 'null';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// TreeRow — recursive tree node renderer
// ---------------------------------------------------------------------------

interface TreeRowProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (key: string) => void;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

const TreeRow: React.FC<TreeRowProps> = ({ node, depth, expanded, toggle, selectedKey, onSelect }) => {
  const isExpandable = node.type === 'object' || node.type === 'array';
  const isExpanded = expanded.has(node.key);
  const isSelected = selectedKey === node.key;
  const { Icon, color } = getNodeIcon(node.type);

  const childCount = node.children?.length ?? 0;

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-1.5 py-1 px-2 hover:bg-surface-container-high rounded cursor-pointer transition-colors",
          isSelected && "bg-primary/10 text-on-surface",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          if (isExpandable) {
            toggle(node.key);
          }
          onSelect(node.key);
        }}
      >
        {/* Expand/collapse indicator */}
        <div className="w-4 shrink-0 flex items-center justify-center">
          {isExpandable ? (
            isExpanded ? (
              <ChevronDown size={12} className="text-outline" />
            ) : (
              <ChevronRight size={12} className="text-outline" />
            )
          ) : (
            <span className="w-3" />
          )}
        </div>

        {/* Type icon */}
        <Icon size={12} className={cn(color, 'shrink-0')} />

        {/* Key name */}
        <span className="text-xs font-medium text-on-surface truncate">{node.key}</span>

        {/* Value or child count */}
        {isExpandable ? (
          <span className="text-[10px] text-outline ml-1">
            {childCount} {node.type === 'array' ? 'items' : 'keys'}
          </span>
        ) : (
          <span className={cn(
            "text-xs ml-1 truncate",
            node.type === 'string' ? 'text-green-400' :
            node.type === 'number' ? 'text-blue-400' :
            node.type === 'boolean' ? 'text-yellow-400' :
            'text-outline',
          )}>
            {formatValue(node.type, node.value)}
          </span>
        )}
      </div>

      {/* Children */}
      {isExpandable && isExpanded && node.children?.map((child) => (
        <TreeRow
          key={child.key}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          toggle={toggle}
          selectedKey={selectedKey}
          onSelect={onSelect}
        />
      ))}
    </>
  );
};

// ---------------------------------------------------------------------------
// Props for ConfigTreeView
// ---------------------------------------------------------------------------

export interface ConfigTreeViewProps {
  /** File path. */
  filePath: string;
  /** Raw text content of the config file. */
  content: string;
  /** Monaco language identifier. */
  language: string;
  /** Called when user edits content in the Monaco editor pane. */
  onContentChange: (value: string) => void;
}

// ---------------------------------------------------------------------------
// ConfigTreeView component
// ---------------------------------------------------------------------------

export const ConfigTreeView: React.FC<ConfigTreeViewProps> = ({
  filePath,
  content,
  language,
  onContentChange,
}) => {
  const { theme: appTheme } = useTheme();
  const [viewMode, setViewMode] = useState<'tree' | 'editor'>('tree');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [allExpanded, setAllExpanded] = useState(false);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);

  // -------------------------------------------------------------------------
  // Parse content into tree nodes
  // -------------------------------------------------------------------------
  const treeNodes = useMemo(() => {
    try {
      const parsed = parseContent(content, language);
      return dataToNodes(parsed);
    } catch {
      return [];
    }
  }, [content, language]);

  // -------------------------------------------------------------------------
  // Collect all keys for expand all
  // -------------------------------------------------------------------------
  const allKeys = useMemo(() => {
    const keys: string[] = [];
    function collect(nodes: TreeNode[]) {
      for (const node of nodes) {
        if (node.type === 'object' || node.type === 'array') {
          keys.push(node.key);
          if (node.children) collect(node.children);
        }
      }
    }
    collect(treeNodes);
    return keys;
  }, [treeNodes]);

  // -------------------------------------------------------------------------
  // Toggle expand/collapse
  // -------------------------------------------------------------------------
  const toggle = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Expand / Collapse all
  const expandAll = useCallback(() => {
    setExpanded(new Set(allKeys));
    setAllExpanded(true);
  }, [allKeys]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
    setAllExpanded(false);
  }, []);

  // Auto-expand root level on content change
  useEffect(() => {
    const rootKeys = treeNodes
      .filter(n => n.type === 'object' || n.type === 'array')
      .map(n => n.key);
    setExpanded(new Set(rootKeys));
  }, [treeNodes]);

  // -------------------------------------------------------------------------
  // Monaco editor setup
  // -------------------------------------------------------------------------
  const handleEditorMount = useCallback((editor: MonacoEditor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
  }, []);

  const handleBeforeMount = useCallback((monaco: Parameters<
    NonNullable<Parameters<typeof Editor>[0]['beforeMount']>
  >[0]) => {
    ensureThemesRegistered(monaco);
  }, []);

  useEffect(() => {
    import('monaco-editor').then((monaco) => {
      monaco.editor.setTheme(appTheme === 'dark' ? 'neuro-dark' : 'neuro-light');
    });
  }, [appTheme]);

  const monacoTheme = appTheme === 'dark' ? 'neuro-dark' : 'neuro-light';

  const baseEditorOptions = useMemo<MonacoEditor.IStandaloneEditorConstructionOptions>(() => ({
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontLigatures: true,
    lineHeight: 22,
    minimap: { enabled: false },
    lineNumbers: 'on',
    renderLineHighlight: 'all',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    wordWrap: 'on',
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
    theme: monacoTheme,
  }), [monacoTheme]);

  const editorOptions = useMemo(() => {
    return getEditorOptionsForLanguage(language, baseEditorOptions);
  }, [baseEditorOptions, language]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const fileName = filePath.split('/').pop() ?? filePath;

  return (
    <div className="flex flex-col h-full bg-surface-container-lowest overflow-hidden">
      {/* Toolbar with view mode toggle */}
      <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-low border-b border-outline-variant/10 shrink-0">
        {/* View mode toggle buttons */}
        <div className="flex items-center bg-surface-container-high rounded overflow-hidden">
          <button
            onClick={() => setViewMode('tree')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors",
              viewMode === 'tree'
                ? "bg-primary/20 text-primary"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            <Eye size={12} />
            Tree
          </button>
          <button
            onClick={() => setViewMode('editor')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors",
              viewMode === 'editor'
                ? "bg-primary/20 text-primary"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            <PenLine size={12} />
            Editor
          </button>
        </div>

        <span className="text-[10px] text-outline font-mono">{fileName}</span>

        {/* Tree controls */}
        {viewMode === 'tree' && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={expandAll}
              className="text-[10px] text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Expand All
            </button>
            <span className="text-outline/30">|</span>
            <button
              onClick={collapseAll}
              className="text-[10px] text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Collapse All
            </button>
          </div>
        )}
      </div>

      {/* Content area */}
      {viewMode === 'tree' ? (
        <div className="flex-1 overflow-auto p-2">
          {treeNodes.length > 0 ? (
            treeNodes.map((node) => (
              <TreeRow
                key={node.key}
                node={node}
                depth={0}
                expanded={expanded}
                toggle={toggle}
                selectedKey={selectedKey}
                onSelect={setSelectedKey}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
              <FileJson size={24} className="text-outline/40" />
              <p className="text-xs text-outline">Unable to parse file as structured data</p>
              <button
                onClick={() => setViewMode('editor')}
                className="text-[10px] text-primary hover:underline"
              >
                Switch to editor view
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full bg-[var(--t-editor-bg)]">
                <div className="relative w-8 h-8">
                  <div className="absolute inset-0 rounded-full border-2 border-[var(--t-editor-spinner-track)] border-t-[var(--t-editor-spinner-bar)] animate-spin" />
                </div>
              </div>
            }
          >
            <Editor
              key={filePath}
              height="100%"
              language={language}
              value={content}
              onChange={(v) => onContentChange(v ?? '')}
              onMount={handleEditorMount}
              beforeMount={handleBeforeMount}
              theme={monacoTheme}
              options={editorOptions}
              loading={
                <div className="flex items-center justify-center h-full bg-[var(--t-editor-bg)]">
                  <div className="relative w-8 h-8">
                    <div className="absolute inset-0 rounded-full border-2 border-[var(--t-editor-spinner-track)] border-t-[var(--t-editor-spinner-bar)] animate-spin" />
                  </div>
                </div>
              }
            />
          </Suspense>
        </div>
      )}
    </div>
  );
};

export default ConfigTreeView;
