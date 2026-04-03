export type ViewType = 'project' | 'editor' | 'tasks' | 'workflow' | 'mission-control' | 'settings' | 'person';

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
}

export interface WorkspaceResult {
  path: string;
  valid: boolean;
  error?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'in-review' | 'completed';
  type: 'business' | 'development';
  parentId?: string;
  derivedFromId?: string;
  dependencies?: string[];
  module?: string;
  tags: string[];
  aiStatus?: string;
  progress?: number;
  assignee?: string;
  time?: string;
  startDate?: string;
  endDate?: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'SUCCESS' | 'INFO' | 'DEBUG' | 'WARN' | 'EXEC' | 'ACTIVE' | 'BUSY' | 'ERROR';
  message: string;
}

/** Renderer type for file type routing. */
export type FileRendererType = 'monaco' | 'markdown' | 'image' | 'config-tree' | 'text' | 'unsupported';

/** State for a single open file tab in the editor. */
export interface OpenFileState {
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
  /** Monaco view state to preserve cursor & scroll on tab switch */
  viewState: unknown | null;
  /** Renderer type determined by file extension for type-based routing. */
  rendererType: FileRendererType;
}

/** Hardware stats payload from sys-hardware-tick event. */
export interface HardwareStats {
  cpu_usage: number;
  memory_total: number;
  memory_used: number;
  memory_percent: number;
  uptime: number;
}

/** Git statistics from fetch_git_stats command. */
export interface GitStats {
  commits_7d: number;
  changed_files: number;
  contributors: ContributorInfo[];
  current_branch: string;
  recent_commits: RecentCommit[];
}

export interface ContributorInfo {
  name: string;
  commits: number;
}

export interface RecentCommit {
  short_hash: string;
  message: string;
  author: string;
  time_ago: string;
}

/** Detailed Git status from fetch_git_status command (feat-git-status-read). */
export interface FileDiffInfo {
  path: string;
  status: 'staged' | 'unstaged' | 'untracked';
  additions: number;
  deletions: number;
}

export interface GitStatusResult {
  current_branch: string;
  remote_url: string | null;
  files: FileDiffInfo[];
}

// ---------------------------------------------------------------------------
// Settings & LLM Provider types (feat-settings-llm-config)
// ---------------------------------------------------------------------------

/** A single LLM provider configuration (OpenAI-compatible). */
export interface ProviderConfig {
  api_key: string;
  api_base: string;
}

/** LLM model selection and parameters. */
export interface LlmConfig {
  provider: string;
  model: string;
  max_tokens: number;
  temperature: number;
  context_window_tokens: number;
}

/** Application-level settings. */
export interface AppConfig {
  auto_refresh_interval: number;
}

/** Root settings object stored in settings.yaml. */
export interface AppSettings {
  providers: Record<string, ProviderConfig>;
  llm: LlmConfig;
  app: AppConfig;
}
