import { useState, useCallback, useRef, useEffect } from 'react';
import type { PMFileEntry } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status of an individual file analysis. */
export type AnalyzeFileStatus = 'pending' | 'analyzing' | 'done' | 'error';

/** State for a single file being analyzed. */
export interface AnalyzeFileState {
  /** File name. */
  name: string;
  /** Current status. */
  status: AnalyzeFileStatus;
  /** Progress percentage (0-100). */
  progress: number;
  /** Error message if status is 'error'. */
  error?: string;
  /** Partial analysis text streamed so far. */
  streamedText?: string;
  /** Output MD file name when done. */
  mdFileName?: string;
  /** Output MD file path when done. */
  mdFilePath?: string;
}

/** Overall analysis status. */
export type AnalyzeStatus = 'idle' | 'analyzing' | 'done' | 'error';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMultimodalAnalyze(workspacePath: string) {
  const [status, setStatus] = useState<AnalyzeStatus>('idle');
  const [fileStates, setFileStates] = useState<Map<string, AnalyzeFileState>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [analyzedFiles, setAnalyzedFiles] = useState<Set<string>>(new Set());
  const streamingTextRef = useRef<Map<string, string>>(new Map());
  const chunkUnlistenRef = useRef<(() => void) | null>(null);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      if (chunkUnlistenRef.current) {
        chunkUnlistenRef.current();
        chunkUnlistenRef.current = null;
      }
    };
  }, []);

  /** Check which files have already been analyzed by checking PMDM directory. */
  const checkAnalyzedFiles = useCallback(async () => {
    if (!isTauri || !workspacePath) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const mdFiles: { name: string; path: string }[] = await invoke('pmdm_list', {
        workspacePath,
      });

      // Extract original file names from analysis MD file names (pattern: {stem}-analysis.md)
      const analyzed = new Set<string>();
      for (const md of mdFiles) {
        const match = md.name.match(/^(.+)-analysis\.md$/);
        if (match) {
          analyzed.add(match[1]);
        }
      }
      setAnalyzedFiles(analyzed);
    } catch {
      // Silently ignore - PMDM directory may not exist yet
    }
  }, [workspacePath]);

  // Auto-check on mount and when workspace changes
  useEffect(() => {
    checkAnalyzedFiles();
  }, [checkAnalyzedFiles]);

  /** Register event listeners for analysis events. */
  const registerListeners = useCallback(async () => {
    // Remove any previous listeners
    if (chunkUnlistenRef.current) {
      chunkUnlistenRef.current();
      chunkUnlistenRef.current = null;
    }

    const { listen } = await import('@tauri-apps/api/event');

    const unlistenChunk = await listen<{ file_name: string; text: string; is_done: boolean }>(
      'analyze://chunk',
      (event) => {
        const { file_name, text } = event.payload;
        // Accumulate streaming text
        const current = streamingTextRef.current.get(file_name) || '';
        streamingTextRef.current.set(file_name, current + text);

        setFileStates((prev) => {
          const next = new Map(prev);
          const state = next.get(file_name);
          if (state) {
            next.set(file_name, {
              ...state,
              streamedText: current + text,
            });
          }
          return next;
        });
      },
    );

    const unlistenComplete = await listen<{
      file_name: string;
      md_name: string;
      md_path: string;
      content_length: number;
    }>('analyze://complete', (event) => {
      const { file_name, md_name, md_path } = event.payload;

      setFileStates((prev) => {
        const next = new Map(prev);
        next.set(file_name, {
          name: file_name,
          status: 'done',
          progress: 100,
          mdFileName: md_name,
          mdFilePath: md_path,
          streamedText: streamingTextRef.current.get(file_name) || '',
        });
        return next;
      });

      // Add to analyzed files
      setAnalyzedFiles((prev) => {
        const next = new Set(prev);
        const stem = file_name.split('.').slice(0, -1).join('.') || file_name;
        next.add(stem);
        return next;
      });

      streamingTextRef.current.delete(file_name);
    });

    const unlistenError = await listen<{ file_name: string; error: string }>(
      'analyze://error',
      (event) => {
        const { file_name, error: errMsg } = event.payload;

        setFileStates((prev) => {
          const next = new Map(prev);
          next.set(file_name, {
            name: file_name,
            status: 'error',
            progress: 0,
            error: errMsg,
          });
          return next;
        });

        streamingTextRef.current.delete(file_name);
      },
    );

    // Combined unlisten function
    chunkUnlistenRef.current = () => {
      unlistenChunk();
      unlistenComplete();
      unlistenError();
    };
  }, []);

  /** Analyze a single file. */
  const analyzeFile = useCallback(
    async (fileName: string) => {
      if (!isTauri || !workspacePath) return;

      // Set file state to analyzing
      setFileStates((prev) => {
        const next = new Map(prev);
        next.set(fileName, {
          name: fileName,
          status: 'analyzing',
          progress: 50,
        });
        return next;
      });

      setStatus('analyzing');
      setError(null);
      streamingTextRef.current.delete(fileName);

      try {
        const { invoke } = await import('@tauri-apps/api/core');

        // Register listeners before invoking
        await registerListeners();

        // Call the backend analyze command
        await invoke('pmfile_analyze', {
          workspacePath,
          fileName,
          analysisPrompt: null,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setFileStates((prev) => {
          const next = new Map(prev);
          next.set(fileName, {
            name: fileName,
            status: 'error',
            progress: 0,
            error: msg,
          });
          return next;
        });
      }
    },
    [workspacePath, registerListeners],
  );

  /** Analyze multiple files sequentially (batch analysis). */
  const analyzeAll = useCallback(
    async (files: PMFileEntry[]) => {
      if (!isTauri || !workspacePath || files.length === 0) return;

      setStatus('analyzing');
      setError(null);

      try {
        const { invoke } = await import('@tauri-apps/api/core');

        // Register listeners once for the entire batch
        await registerListeners();

        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          setFileStates((prev) => {
            const next = new Map(prev);
            next.set(file.name, {
              name: file.name,
              status: 'analyzing',
              progress: 0,
            });
            return next;
          });

          streamingTextRef.current.delete(file.name);

          try {
            await invoke('pmfile_analyze', {
              workspacePath,
              fileName: file.name,
              analysisPrompt: null,
            });

            // Update progress
            setFileStates((prev) => {
              const next = new Map(prev);
              const state = next.get(file.name);
              if (state) {
                next.set(file.name, { ...state, progress: 100, status: 'done' });
              }
              return next;
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setFileStates((prev) => {
              const next = new Map(prev);
              next.set(file.name, {
                name: file.name,
                status: 'error',
                progress: 0,
                error: msg,
              });
              return next;
            });
          }

          // Small delay between files to avoid rate limiting
          if (i < files.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }

      setStatus('done');
    },
    [workspacePath, registerListeners],
  );

  /** Reset analysis state. */
  const reset = useCallback(() => {
    setStatus('idle');
    setFileStates(new Map());
    setError(null);
    streamingTextRef.current.clear();
    if (chunkUnlistenRef.current) {
      chunkUnlistenRef.current();
      chunkUnlistenRef.current = null;
    }
  }, []);

  /** Check if a specific file has been analyzed. */
  const isAnalyzed = useCallback(
    (fileName: string): boolean => {
      const stem = fileName.split('.').slice(0, -1).join('.') || fileName;
      return analyzedFiles.has(stem);
    },
    [analyzedFiles],
  );

  /** Get the overall progress (0-100). */
  const overallProgress = useCallback((): number => {
    if (fileStates.size === 0) return 0;
    let total = 0;
    fileStates.forEach((state) => {
      total += state.status === 'done' ? 100 : state.status === 'error' ? 100 : state.progress;
    });
    return Math.round(total / fileStates.size);
  }, [fileStates]);

  return {
    status,
    fileStates,
    error,
    analyzedFiles,
    analyzeFile,
    analyzeAll,
    reset,
    isAnalyzed,
    checkAnalyzedFiles,
    overallProgress,
  };
}
