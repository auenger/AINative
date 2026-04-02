import { useState, useCallback } from 'react';
import type { GitStatusResult } from '../types';

/**
 * Hook that fetches real Git status (branch, remote, changed files) via the
 * Tauri `fetch_git_status` command.
 *
 * Falls back to a no-op stub when running outside of Tauri (plain browser / vite dev).
 */
export function useGitStatus(workspacePath: string) {
  const [data, setData] = useState<GitStatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  const refresh = useCallback(async () => {
    if (!isTauri || !workspacePath) {
      // Dev fallback: return mock data so the UI is testable
      setData({
        current_branch: 'feature/pm-agent',
        remote_url: 'https://github.com/neuro/syntax-ide.git',
        files: [
          {
            path: 'src/components/ProjectView.tsx',
            status: 'unstaged',
            additions: 12,
            deletions: 4,
          },
        ],
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result: GitStatusResult = await invoke('fetch_git_status');
      setData(result);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [isTauri, workspacePath]);

  return { data, loading, error, refresh };
}
