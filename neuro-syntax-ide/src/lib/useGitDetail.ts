import { useState, useCallback } from 'react';
import type { GitTag, GitCommit, GitBranch, TagDetail, TagFileChange, BranchGraphNode, BranchGraphEdge } from '../types';

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

  // Branch graph state (feat-git-branch-graph)
  const [graphNodes, setGraphNodes] = useState<BranchGraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<BranchGraphEdge[]>([]);
  const [graphLoading, setGraphLoading] = useState(false);

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

      const [tagsResult, commitsResult, branchesResult, graphResult] = await Promise.all([
        invoke<GitTag[]>('fetch_git_tags'),
        invoke<GitCommit[]>('fetch_git_log', { limit: 50 }),
        invoke<GitBranch[]>('fetch_git_branches'),
        invoke<{ nodes: BranchGraphNode[]; edges: BranchGraphEdge[] }>('fetch_branch_graph'),
      ]);

      setTags(tagsResult);
      setCommits(commitsResult);
      setBranches(branchesResult);
      setGraphNodes(graphResult.nodes);
      setGraphEdges(graphResult.edges);
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

  /** Toggle tag expansion. Fetches data on first expand, caches for subsequent. */
  const toggleTagExpand = useCallback(async (tagName: string) => {
    // If already expanded, just collapse
    if (expandedTags.has(tagName)) {
      setExpandedTags(prev => {
        const next = new Set(prev);
        next.delete(tagName);
        return next;
      });
      return;
    }

    // If already cached, just expand
    if (tagDetails.has(tagName)) {
      setExpandedTags(prev => new Set(prev).add(tagName));
      return;
    }

    // Mark as loading
    setTagLoading(prev => new Set(prev).add(tagName));

    try {
      if (!isTauri) {
        // Dev fallback: mock tag detail data
        const mockDetail: TagDetail = {
          tag_name: tagName,
          commits: Array.from({ length: 3 }, (_, i) => ({
            hash: `mock${i.toString().padStart(7, '0')}`,
            short_hash: `mock${i}`,
            message: `Commit for ${tagName} #${3 - i}`,
            author: 'developer',
            timestamp: Date.now() / 1000 - i * 3600,
            time_ago: i === 0 ? 'just now' : `${i}h ago`,
          })),
          file_changes: [
            { path: 'src/components/App.tsx', status: 'modified', additions: 12, deletions: 3 },
            { path: 'src/lib/utils.ts', status: 'added', additions: 45, deletions: 0 },
            { path: 'src/old-module.ts', status: 'removed', additions: 0, deletions: 28 },
          ],
        };
        setTagDetails(prev => new Map(prev).set(tagName, mockDetail));
        setExpandedTags(prev => new Set(prev).add(tagName));
        return;
      }

      const { invoke } = await import('@tauri-apps/api/core');

      // Fetch commits and diff in parallel
      const [commitsResult, diffResult] = await Promise.all([
        invoke<{ tag_name: string; commits: GitCommit[] }>('fetch_tag_commits', { tagName }),
        invoke<{ tag_name: string; file_changes: TagFileChange[] }>('fetch_tag_diff', { tagName }),
      ]);

      const detail: TagDetail = {
        tag_name: tagName,
        commits: commitsResult.commits,
        file_changes: diffResult.file_changes,
      };

      setTagDetails(prev => new Map(prev).set(tagName, detail));
      setExpandedTags(prev => new Set(prev).add(tagName));
    } catch (e: unknown) {
      console.error(`Failed to load tag detail for ${tagName}:`, e);
    } finally {
      setTagLoading(prev => {
        const next = new Set(prev);
        next.delete(tagName);
        return next;
      });
    }
  }, [isTauri, expandedTags, tagDetails]);

  return {
    tags, commits, branches, loading, error,
    refreshAll, loadMoreCommits,
    // Tag expand (feat-git-tag-expand)
    expandedTags, tagDetails, tagLoading, toggleTagExpand,
    // Branch graph (feat-git-branch-graph)
    graphNodes, graphEdges, graphLoading,
  };
}
