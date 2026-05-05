import React, { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { cn } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TerminalKind = 'bash' | 'claude' | 'gemini';

export interface XTerminalProps {
  /** Unique identifier for this terminal instance (the pty_id). */
  ptyId: string;
  /** What kind of terminal this is — determines shell command. */
  kind: TerminalKind;
  /** Whether this tab is currently visible. Used to skip fit when hidden. */
  active: boolean;
  /** Optional extra className on the wrapper div. */
  className?: string;
  /** Working directory for the terminal shell. In Tauri mode this is passed to create_pty as cwd. */
  cwd?: string;
}

// ---------------------------------------------------------------------------
// Shell config helper
// ---------------------------------------------------------------------------

interface DetectedShell {
  shell_type: string;
  name: string;
  path: string;
  is_default: boolean;
}

// Module-level cache so all terminal instances share the same detection result.
let detectedShellsCache: DetectedShell[] | null = null;

async function detectShells(): Promise<DetectedShell[]> {
  if (detectedShellsCache) return detectedShellsCache;
  try {
    const shells = await invoke<DetectedShell[]>('detect_shells');
    detectedShellsCache = shells;
    return shells;
  } catch (err) {
    console.warn('[XTerminal] shell detection failed, using fallback:', err);
    return [];
  }
}

async function shellForKind(kind: TerminalKind): Promise<{ shell: string; args: string[] }> {
  switch (kind) {
    case 'claude':
      return { shell: 'claude', args: [] };
    case 'gemini':
      return { shell: 'gemini', args: [] };
    case 'bash':
    default: {
      // Ask the Rust backend for the detected default shell
      const shells = await detectShells();
      const defaultShell = shells.find((s) => s.is_default);
      if (defaultShell) {
        return { shell: defaultShell.path, args: ['-l'] };
      }
      // Fallback: first detected shell
      if (shells.length > 0) {
        return { shell: shells[0].path, args: ['-l'] };
      }
      // Final fallback when detection yields nothing (e.g. browser mode)
      return { shell: '/bin/sh', args: ['-l'] };
    }
  }
}

// ---------------------------------------------------------------------------
// Tauri IPC helpers (safe no-ops when running in browser without Tauri)
// ---------------------------------------------------------------------------

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) return undefined as unknown as T;
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args);
}

async function listen<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<() => void> {
  if (!isTauri) return () => {};
  const { listen: tauriListen } = await import('@tauri-apps/api/event');
  const unlisten = await tauriListen<T>(event, (e) => handler(e.payload));
  return unlisten;
}

// ---------------------------------------------------------------------------
// Terminal theme definitions
// ---------------------------------------------------------------------------

const DARK_TERMINAL_THEME = {
  background: '#050505',
  foreground: '#dfe2eb',
  cursor: '#a2c9ff',
  cursorAccent: '#050505',
  selectionBackground: 'rgba(162, 201, 255, 0.3)',
  black: '#050505',
  red: '#ffb4ab',
  green: '#67df70',
  yellow: '#fbbf24',
  blue: '#a2c9ff',
  magenta: '#bdf4ff',
  cyan: '#58a6ff',
  white: '#dfe2eb',
  brightBlack: '#333333',
  brightRed: '#ffb4ab',
  brightGreen: '#67df70',
  brightYellow: '#fbbf24',
  brightBlue: '#a2c9ff',
  brightMagenta: '#bdf4ff',
  brightCyan: '#58a6ff',
  brightWhite: '#dfe2eb',
};

const LIGHT_TERMINAL_THEME = {
  background: '#ffffff',
  foreground: '#1a1c1e',
  cursor: '#0b57d0',
  cursorAccent: '#ffffff',
  selectionBackground: 'rgba(11, 87, 208, 0.2)',
  black: '#ffffff',
  red: '#ba1a1a',
  green: '#1b7d34',
  yellow: '#b45309',
  blue: '#0b57d0',
  magenta: '#00639e',
  cyan: '#1a73e8',
  white: '#1a1c1e',
  brightBlack: '#74777f',
  brightRed: '#ba1a1a',
  brightGreen: '#1b7d34',
  brightYellow: '#b45309',
  brightBlue: '#0b57d0',
  brightMagenta: '#00639e',
  brightCyan: '#1a73e8',
  brightWhite: '#1a1c1e',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const XTerminal: React.FC<XTerminalProps> = ({
  ptyId,
  kind,
  active,
  className,
  cwd,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const unlistenClosedRef = useRef<(() => void) | null>(null);
  const { theme: appTheme } = useTheme();

  // -----------------------------------------------------------------------
  // Initialise xterm + pty (once per mount)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = appTheme === 'dark';
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
      lineHeight: 1.4,
      theme: isDark ? DARK_TERMINAL_THEME : LIGHT_TERMINAL_THEME,
      allowProposedApi: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Defer first fit so the container has its final dimensions
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch {
        // Container may not be visible yet — safe to ignore
      }
    });

    // -------------------------------------------------------------------
    // Create pty on the Rust side
    // -------------------------------------------------------------------
    const cols = term.cols;
    const rows = term.rows;

    // Shell detection is async — resolve the shell config before creating the pty.
    shellForKind(kind).then(({ shell, args }) => {
      invoke('create_pty', {
        config: { shell, args, cols, rows, cwd: cwd || undefined },
      })
      .then((returnedId) => {
        // The returned pty_id should match our prop; we pass ptyId via the
        // event filter below. The Rust side generates its own UUID.
        console.log('[XTerminal] pty created, id =', returnedId);

        // --- Listen for pty output ---
        listen<{ pty_id: string; data: string }>('pty-out', (payload) => {
          // Filter events for this specific pty instance
          if (payload.pty_id === returnedId && payload.data) {
            term.write(payload.data);
          }
        }).then((unlisten) => {
          unlistenRef.current = unlisten;
        });

        // --- Listen for pty closure ---
        listen<{ pty_id: string; data: string }>('pty-closed', (payload) => {
          if (payload.pty_id === returnedId) {
            term.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n');
          }
        }).then((unlisten) => {
          unlistenClosedRef.current = unlisten;
        });

        // --- Forward user input to pty stdin ---
        const dataDisposable = term.onData((data) => {
          invoke('write_to_pty', {
            ptyId: returnedId,
            data,
          }).catch(console.error);
        });

        // Store disposable for cleanup
        (term as unknown as Record<string, unknown>).__dataDisposable = dataDisposable;
        (term as unknown as Record<string, unknown>).__resolvedPtyId = returnedId;
      })
      .catch((err) => {
        console.error('[XTerminal] failed to create pty:', err);
        // Fallback: show error in terminal
        term.writeln('\x1b[31mFailed to create terminal process.\x1b[0m');
        if (!isTauri) {
          term.writeln('\x1b[90m(Running in browser — Tauri backend not available)\x1b[0m');
          // Echo mode for demo
          term.onData((data) => {
            if (data === '\r') {
              term.write('\r\n');
            } else {
              term.write(data);
            }
          });
        }
      });
    }).catch((err) => {
      console.error('[XTerminal] failed to detect shell:', err);
      term.writeln('\x1b[31mFailed to detect shell.\x1b[0m');
    });

    // -------------------------------------------------------------------
    // Cleanup on unmount
    // -------------------------------------------------------------------
    return () => {
      // Kill the pty process on the Rust side
      const resolvedId = (term as unknown as Record<string, unknown>).__resolvedPtyId;
      if (typeof resolvedId === 'string') {
        invoke('kill_pty', { ptyId: resolvedId }).catch(console.error);
      }

      // Dispose event listener
      const disposable = (term as unknown as Record<string, unknown>).__dataDisposable;
      if (disposable && typeof (disposable as { dispose: () => void }).dispose === 'function') {
        (disposable as { dispose: () => void }).dispose();
      }

      unlistenRef.current?.();
      unlistenClosedRef.current?.();

      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------------
  // Sync terminal theme with app theme
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!termRef.current) return;
    const isDark = appTheme === 'dark';
    termRef.current.options.theme = isDark ? DARK_TERMINAL_THEME : LIGHT_TERMINAL_THEME;
  }, [appTheme]);

  // -----------------------------------------------------------------------
  // Re-fit when the tab becomes active
  // Uses double-RAF to ensure CSS changes (visibility/position) have taken
  // effect before measuring and fitting.
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!active || !fitAddonRef.current || !termRef.current) return;
    // Double-RAF: first frame lets CSS changes apply, second frame fits
    let raf1: number;
    let raf2: number;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        try {
          fitAddonRef.current!.fit();
        } catch {
          // Container may not be ready yet — safe to ignore
        }
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [active]);

  // -----------------------------------------------------------------------
  // Re-fit when the container is resized (e.g. terminal panel drag-resize)
  // Uses ResizeObserver for reliable detection of parent dimension changes.
  // -----------------------------------------------------------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (fitAddonRef.current && active) {
          try {
            fitAddonRef.current.fit();
          } catch {
            // Container may not be ready yet
          }
        }
      });
    });

    observer.observe(el);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [active]);

  // -----------------------------------------------------------------------
  // Sync resize to Rust pty when terminal dimensions change
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!termRef.current) return;
    const term = termRef.current;

    const handler = () => {
      const resolvedId = (term as unknown as Record<string, unknown>).__resolvedPtyId;
      if (typeof resolvedId !== 'string') return;
      invoke('resize_pty', {
        ptyId: resolvedId,
        cols: term.cols,
        rows: term.rows,
      }).catch(console.error);
    };

    // xterm fires 'resize' when the terminal dimensions change after fit
    const disposable = term.onResize(handler);
    return () => disposable.dispose();
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      className={cn(
        'w-full h-full',
        active ? 'relative' : 'absolute inset-0 invisible pointer-events-none',
        // Ensure xterm fills its container
        '[&_.xterm]:h-full [&_.xterm]:w-full',
        // xterm v6 scrollable wrapper must also fill height
        '[&_.xterm-scrollable-element]:h-full [&_.xterm-scrollable-element]:w-full',
        '[&_.xterm-viewport]:!overflow-y-auto',
        className,
      )}
    />
  );
};
