import { useState, useCallback } from 'react';
import type { GitTag, GitCommit, GitBranch, TagDetail, CommitGraphResult } from '../types';

/**
 * Hook that fetches extended Git repository details: tags, commit log, branches.
 * Used by the enhanced Git modal (feat-git-modal-enhance).
 * Extended with tag detail expand (feat-git-tag-expand).
 */
export function useGitDetail() {
  const [tags, setTags] = useState<GitTag[]>([]);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tag expand state (feat-git-tag-expand)
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const [tagDetails, setTagDetails] = useState<Map<string, TagDetail>>(new Map());
  const [tagLoading, setTagLoading] = useState<Set<string>>(new Set());

  // Commit graph state
  const [commitGraph, setCommitGraph] = useState<CommitGraphResult>({ commits: [], connectors: [], lane_count: 0 });

  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  const refreshAll = useCallback(async () => {
    if (!isTauri) {
      setTags([
        { name: 'feat-agent-runtime-router-20260403', date: Date.now() / 1000 - 86400, commit_hash: 'abc1234', message: 'Feature tag' },
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
      setCommitGraph({
        commits: [
          { hash: 'a0b1c2d', short_hash: 'a0b1c2d', message: 'Merge feature/sample-feature into main', author: 'dev', timestamp: Date.now() / 1000, time_ago: 'just now', lane: 0, is_merge: true, branch_labels: ['main'], tag_labels: [] },
          { hash: 'e3f4g5h', short_hash: 'e3f4g5h', message: 'Add new feature component', author: 'dev', timestamp: Date.now() / 1000 - 3600, time_ago: '1h ago', lane: 1, is_merge: false, branch_labels: ['feature/sample-feature'], tag_labels: [] },
          { hash: 'i6j7k8l', short_hash: 'i6j7k8l', message: 'Refactor settings module', author: 'dev', timestamp: Date.now() / 1000 - 1800, time_ago: '30m ago', lane: 0, is_merge: false, branch_labels: [], tag_labels: [] },
          { hash: 'm9n0o1p', short_hash: 'm9n0o1p', message: 'Start feature branch work', author: 'dev', timestamp: Date.now() / 1000 - 5400, time_ago: '1.5h ago', lane: 0, is_merge: false, branch_labels: [], tag_labels: [] },
          { hash: 'q2r3s4t', short_hash: 'q2r3s4t', message: 'Fix terminal theme colors', author: 'dev', timestamp: Date.now() / 1000 - 7200, time_ago: '2h ago', lane: 0, is_merge: false, branch_labels: [], tag_labels: [] },
          { hash: 'u5v6w7x', short_hash: 'u5v6w7x', message: 'Initial commit', author: 'dev', timestamp: Date.now() / 1000 - 86400, time_ago: '1d ago', lane: 0, is_merge: false, branch_labels: [], tag_labels: ['v0.1.0'] },
        ],
        connectors: [
          { row: 0, from_lane: 1, to_lane: 0, connector_type: 'merge' },
          { row: 1, from_lane: 1, to_lane: 1, connector_type: 'straight' },
          { row: 2, from_lane: 0, to_lane: 0, connector_type: 'straight' },
          { row: 3, from_lane: 0, to_lane: 0, connector_type: 'straight' },
        ],
        lane_count: 2,
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { invoke } = await import('@tauri-apps/api/core');

      const [tagsResult, commitsResult, branchesResult, graphResult] = await Promise.all([
        invoke<GitTag[]>('fetch_git_tags'),
        invoke<GitCommit[]>('fetch_git_log', { limit: 50 }),
        invoke<GitBranch[]>('fetch_git_branches'),
        invoke<CommitGraphResult>('fetch_commit_graph'),
      ]);

      setTags(tagsResult);
      setCommits(commitsResult);
      setBranches(branchesResult);
      setCommitGraph(graphResult);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [isTauri]);

  const loadMoreCommits = useCallback(async (skip: number) => {
    if (!isTauri) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const more = await invoke<GitCommit[]>('fetch_git_log', { limit: skip + 20 });
      setCommits(more);
    } catch { /* silently fail */ }
  }, [isTauri]);

  const toggleTagExpand = useCallback(async (tagName: string) => {
    if (expandedTags.has(tagName)) {
      setExpandedTags(prev => { const n = new Set(prev); n.delete(tagName); return n; });
      return;
    }
    if (tagDetails.has(tagName)) {
      setExpandedTags(prev => new Set(prev).add(tagName));
      return;
    }
    setTagLoading(prev => new Set(prev).add(tagName));

    try {
      if (!isTauri) {
        const mockDetail: TagDetail = {
          tag_name: tagName,
          commits: Array.from({ length: 3 }, (_, i) => ({
            hash: `mock${i.toString().padStart(7, '0')}`, short_hash: `mock${i}`,
            message: `Commit for ${tagName} #${3 - i}`, author: 'developer',
            timestamp: Date.now() / 1000 - i * 3600, time_ago: i === 0 ? 'just now' : `${i}h ago`,
          })),
          file_changes: [
            { path: 'src/components/App.tsx', status: 'modified', additions: 12, deletions: 3 },
          ],
        };
        setTagDetails(prev => new Map(prev).set(tagName, mockDetail));
        setExpandedTags(prev => new Set(prev).add(tagName));
        return;
      }

      const { invoke } = await import('@tauri-apps/api/core');
      const [commitsResult, diffResult] = await Promise.all([
        invoke<{ tag_name: string; commits: GitCommit[] }>('fetch_tag_commits', { tagName }),
        invoke<{ tag_name: string; file_changes: any[] }>('fetch_tag_diff', { tagName }),
      ]);
      setTagDetails(prev => new Map(prev).set(tagName, { tag_name: tagName, commits: commitsResult.commits, file_changes: diffResult.file_changes }));
      setExpandedTags(prev => new Set(prev).add(tagName));
    } catch (e: unknown) {
      console.error(`Failed to load tag detail for ${tagName}:`, e);
    } finally {
      setTagLoading(prev => { const n = new Set(prev); n.delete(tagName); return n; });
    }
  }, [isTauri, expandedTags, tagDetails]);

  return {
    tags, commits, branches, loading, error,
    refreshAll, loadMoreCommits,
    expandedTags, tagDetails, tagLoading, toggleTagExpand,
    commitGraph,
  };
}
