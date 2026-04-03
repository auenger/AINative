import { useState, useCallback } from 'react';
import type { GitTag, GitCommit, GitBranch } from '../types';

/**
 * Hook that fetches extended Git repository details: tags, commit log, branches.
 * Used by the enhanced Git modal (feat-git-modal-enhance).
 */
export function useGitDetail() {
  const [tags, setTags] = useState<GitTag[]>([]);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  const refreshAll = useCallback(async () => {
    if (!isTauri) {
      // Dev fallback: populate mock data so the UI is testable
      setTags([
        { name: 'feat-agent-runtime-router-20260403', date: Date.now() / 1000 - 86400, commit_hash: 'abc1234', message: 'Feature tag' },
        { name: 'feat-agent-runtime-pipeline-20260405', date: Date.now() / 1000 - 3600, commit_hash: 'def5678', message: 'Feature tag' },
        { name: 'feat-settings-llm-config-20260403', date: Date.now() / 1000 - 172800, commit_hash: 'ghi9012', message: 'Feature tag' },
        { name: 'v0.1.0', date: Date.now() / 1000 - 604800, commit_hash: 'aaa0000', message: 'Initial release' },
      ]);
      setCommits(
        Array.from({ length: 20 }, (_, i) => ({
          hash: `hash${i.toString().padStart(7, '0')}`,
          short_hash: `hash${i}`,
          message: `Sample commit message #${20 - i}`,
          author: 'developer',
          timestamp: Date.now() / 1000 - i * 3600,
          time_ago: i === 0 ? 'just now' : i < 24 ? `${i}h ago` : `${Math.floor(i / 24)}d ago`,
        }))
      );
      setBranches([
        { name: 'main', is_current: true, latest_commit: 'Sample commit message #1', latest_commit_hash: 'hash0' },
        { name: 'feature/sample-feature', is_current: false, latest_commit: 'Work in progress', latest_commit_hash: 'abc1234' },
      ]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { invoke } = await import('@tauri-apps/api/core');

      const [tagsResult, commitsResult, branchesResult] = await Promise.all([
        invoke<GitTag[]>('fetch_git_tags'),
        invoke<GitCommit[]>('fetch_git_log', { limit: 50 }),
        invoke<GitBranch[]>('fetch_git_branches'),
      ]);

      setTags(tagsResult);
      setCommits(commitsResult);
      setBranches(branchesResult);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [isTauri]);

  /** Load more commits (appends to existing list). */
  const loadMoreCommits = useCallback(async (skip: number) => {
    if (!isTauri) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // fetch_git_log always starts from HEAD, so we just request more
      const more = await invoke<GitCommit[]>('fetch_git_log', { limit: skip + 20 });
      setCommits(more);
    } catch {
      // Silently fail — the user can try again
    }
  }, [isTauri]);

  return { tags, commits, branches, loading, error, refreshAll, loadMoreCommits };
}
