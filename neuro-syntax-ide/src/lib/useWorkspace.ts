import { useState, useEffect, useCallback } from 'react';
import { FileNode, WorkspaceResult } from '../types';

/**
 * Custom hook that wraps all Tauri IPC calls for workspace management.
 *
 * In a non-Tauri environment (plain browser / `vite dev`) the hook falls back
 * to no-op stubs so the UI still renders without crashing.
 */
export function useWorkspace() {
  const [workspacePath, setWorkspacePath] = useState<string>('');
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check whether we are running inside Tauri
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  /** Open the native folder picker and set the workspace. */
  const selectWorkspace = useCallback(async () => {
    if (!isTauri) {
      // Dev fallback: use a mock path so the UI is testable
      setWorkspacePath('/mock/workspace');
      setFileTree([
        {
          name: 'src',
          path: '/mock/workspace/src',
          isDir: true,
          children: [
            {
              name: 'App.tsx',
              path: '/mock/workspace/src/App.tsx',
              isDir: false,
            },
            {
              name: 'main.tsx',
              path: '/mock/workspace/src/main.tsx',
              isDir: false,
            },
          ],
        },
        {
          name: 'package.json',
          path: '/mock/workspace/package.json',
          isDir: false,
        },
      ]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result: WorkspaceResult = await invoke('pick_workspace');

      if (result.error && !result.path) {
        // User cancelled or error
        setLoading(false);
        return;
      }

      setWorkspacePath(result.path);

      if (result.valid && result.path) {
        const tree: FileNode[] = await invoke('read_file_tree', { path: result.path });
        setFileTree(tree);
      }

      if (result.error) {
        setError(result.error);
      }
    } catch (e: any) {
      setError(e?.toString() ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [isTauri]);

  /** Load file tree for a given path (used for lazy-expand later). */
  const loadFileTree = useCallback(
    async (path: string) => {
      if (!isTauri) return;

      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const tree: FileNode[] = await invoke('read_file_tree', { path });
        setFileTree(tree);
      } catch (e: any) {
        setError(e?.toString() ?? 'Failed to load file tree');
      }
    },
    [isTauri],
  );

  /** On mount, try to restore the previously stored workspace. */
  useEffect(() => {
    if (!isTauri) return;

    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const stored: WorkspaceResult = await invoke('get_stored_workspace');

        if (stored.valid && stored.path) {
          setWorkspacePath(stored.path);
          setLoading(true);
          const tree: FileNode[] = await invoke('read_file_tree', { path: stored.path });
          setFileTree(tree);
        }
      } catch {
        // Silently ignore — first launch with no stored workspace
      } finally {
        setLoading(false);
      }
    })();
  }, [isTauri]);

  return {
    workspacePath,
    fileTree,
    loading,
    error,
    selectWorkspace,
    loadFileTree,
    isTauri,
  };
}
