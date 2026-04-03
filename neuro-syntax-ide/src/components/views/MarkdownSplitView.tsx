import React, { useState, useCallback, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';
import { NEURO_DARK_THEME, NEURO_LIGHT_THEME } from '../../lib/monaco-theme';
import { getEditorOptionsForLanguage } from '../../lib/language-presets';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import type { editor as MonacoEditor } from 'monaco-editor';

// Lazy-load Monaco Editor
const Editor = lazy(() => import('@monaco-editor/react'));

// ---------------------------------------------------------------------------
// Monaco theme registration guard
// ---------------------------------------------------------------------------
let _themeRegistered = false;

function ensureThemesRegistered(monaco: Parameters<
  NonNullable<Parameters<typeof Editor>[0]['beforeMount']>
>[0]): void {
  if (_themeRegistered) return;
  monaco.editor.defineTheme('neuro-dark', NEURO_DARK_THEME);
  monaco.editor.defineTheme('neuro-light', NEURO_LIGHT_THEME);
  _themeRegistered = true;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MarkdownSplitViewProps {
  /** File path (used as unique key for Monaco). */
  filePath: string;
  /** Current file content (source markdown). */
  content: string;
  /** Called when user edits the content in Monaco. */
  onContentChange: (value: string) => void;
  /** Language identifier for Monaco (always 'markdown' but kept for flexibility). */
  language: string;
}

// ---------------------------------------------------------------------------
// Resizable Split View
// ---------------------------------------------------------------------------

export const MarkdownSplitView: React.FC<MarkdownSplitViewProps> = ({
  filePath,
  content,
  onContentChange,
  language,
}) => {
  const { theme: appTheme } = useTheme();
  const [splitRatio, setSplitRatio] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  // -------------------------------------------------------------------------
  // Drag-to-resize handler
  // -------------------------------------------------------------------------
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = Math.min(0.8, Math.max(0.2, (ev.clientX - rect.left) / rect.width));
      setSplitRatio(ratio);
    };

    const handleMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // -------------------------------------------------------------------------
  // Monaco editor mount
  // -------------------------------------------------------------------------
  const handleEditorMount = useCallback((editor: MonacoEditor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    editor.focus();
  }, []);

  const handleBeforeMount = useCallback((monaco: Parameters<
    NonNullable<Parameters<typeof Editor>[0]['beforeMount']>
  >[0]) => {
    ensureThemesRegistered(monaco);
  }, []);

  // -------------------------------------------------------------------------
  // Monaco options — markdown-specific (smaller minimap, word wrap on)
  // -------------------------------------------------------------------------
  const baseEditorOptions: MonacoEditor.IStandaloneEditorConstructionOptions = useMemo(() => ({
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
    theme: appTheme === 'dark' ? 'neuro-dark' : 'neuro-light',
  }), [appTheme]);

  const editorOptions = useMemo(() => {
    return getEditorOptionsForLanguage(language, baseEditorOptions);
  }, [baseEditorOptions, language]);

  // -------------------------------------------------------------------------
  // Reactively sync Monaco theme on app theme change
  // -------------------------------------------------------------------------
  useEffect(() => {
    import('monaco-editor').then((monaco) => {
      monaco.editor.setTheme(appTheme === 'dark' ? 'neuro-dark' : 'neuro-light');
    });
  }, [appTheme]);

  // -------------------------------------------------------------------------
  // Scroll synchronization: editor -> preview
  // -------------------------------------------------------------------------
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !previewRef.current) return;

    const disposable = editor.onDidScrollChange((e) => {
      if (isSyncingScroll.current) return;
      if (!e.scrollTopChanged || !previewRef.current) return;

      isSyncingScroll.current = true;

      const maxEditorScroll = editor.getScrollHeight() - editor.getLayoutInfo().height;
      const ratio = maxEditorScroll > 0 ? e.scrollTop / maxEditorScroll : 0;

      const previewEl = previewRef.current;
      const maxPreviewScroll = previewEl.scrollHeight - previewEl.clientHeight;
      previewEl.scrollTop = ratio * maxPreviewScroll;

      // Reset flag after a frame
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    });

    return () => disposable.dispose();
  }, [content]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const monacoTheme = appTheme === 'dark' ? 'neuro-dark' : 'neuro-light';

  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden h-full">
      {/* Left panel: Monaco editor */}
      <div
        className="overflow-hidden relative"
        style={{ width: `${splitRatio * 100}%` }}
      >
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

      {/* Resizer bar */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "w-1.5 shrink-0 cursor-col-resize flex items-center justify-center group relative z-10",
          "bg-surface-container-high hover:bg-primary/30 active:bg-primary/50 transition-colors"
        )}
      >
        {/* Visual grip indicator */}
        <div className="w-0.5 h-8 rounded-full bg-outline-variant/30 group-hover:bg-primary/60 transition-colors" />
      </div>

      {/* Right panel: Markdown preview */}
      <div
        ref={previewRef}
        className="overflow-y-auto bg-surface-container-lowest"
        style={{ width: `${(1 - splitRatio) * 100}%` }}
      >
        <div className="max-w-none p-6">
          {content.trim() ? (
            <MarkdownRenderer content={content} />
          ) : (
            <p className="text-sm text-outline/40 italic">Start typing to see preview...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarkdownSplitView;
