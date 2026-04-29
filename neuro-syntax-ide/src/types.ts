// ⚠️ Workflow view type reserved for future design & capability enhancement
export type ViewType = 'project' | 'editor' | 'tasks' | 'workflow' | 'mission-control' | 'settings' | 'person' | 'agents' | 'agent-pixel' | 'git';

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
export type FileRendererType = 'monaco' | 'markdown' | 'image' | 'config-tree' | 'text' | 'pdf' | 'media' | 'unsupported';

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
// Git display enhancement types (feat-git-display-enhance)
// ---------------------------------------------------------------------------

/** A single line in a unified diff output. */
export interface DiffLine {
  type: 'context' | 'add' | 'remove' | 'header';
  old_line_no: number | null;
  new_line_no: number | null;
  content: string;
}

/** Result returned by git_file_diff command. */
export interface FileDiffResult {
  path: string;
  lines: DiffLine[];
  additions: number;
  deletions: number;
}

/** File change info for a specific commit. */
export interface CommitFileChange {
  path: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
}

/** Detail for a specific commit returned by git_commit_detail command. */
export interface CommitDetailResult {
  hash: string;
  short_hash: string;
  message: string;
  author: string;
  timestamp: number;
  time_ago: string;
  file_changes: CommitFileChange[];
  total_additions: number;
  total_deletions: number;
}

// ---------------------------------------------------------------------------
// Git detail types (feat-git-modal-enhance)
// ---------------------------------------------------------------------------

/** Git tag info from fetch_git_tags command. */
export interface GitTag {
  name: string;
  date: number;
  commit_hash: string;
  message: string;
}

/** Git commit detail from fetch_git_log command. */
export interface GitCommit {
  hash: string;
  short_hash: string;
  message: string;
  author: string;
  timestamp: number;
  time_ago: string;
}

/** Git branch info from fetch_git_branches command. */
export interface GitBranch {
  name: string;
  is_current: boolean;
  latest_commit: string;
  latest_commit_hash: string;
}

/** File change info for a specific tag's diff (feat-git-tag-expand). */
export interface TagFileChange {
  path: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
}

/** Detailed information for an expanded tag (feat-git-tag-expand). */
export interface TagDetail {
  tag_name: string;
  commits: GitCommit[];
  file_changes: TagFileChange[];
}

/** Tab identifiers for the Git modal sidebar navigation. */
export type GitModalTab = 'overview' | 'branches' | 'tags' | 'history' | 'changes' | 'features' | 'graph';

// ---------------------------------------------------------------------------
// Commit graph types (git-log style timeline)
// ---------------------------------------------------------------------------

export interface CommitGraphNode {
  hash: string;
  short_hash: string;
  message: string;
  author: string;
  timestamp: number;
  time_ago: string;
  lane: number;
  is_merge: boolean;
  branch_labels: string[];
  tag_labels: string[];
}

export interface GraphConnector {
  row: number;
  from_lane: number;
  to_lane: number;
  connector_type: string;
}

export interface CommitGraphResult {
  commits: CommitGraphNode[];
  connectors: GraphConnector[];
  lane_count: number;
}

// ---------------------------------------------------------------------------
// Settings & LLM Provider types (feat-settings-llm-config)
// ---------------------------------------------------------------------------
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

/** User profile data stored in settings.yaml. */
export interface UserProfile {
  name: string;
  email: string;
  avatar_base64: string; // data:image/xxx;base64,xxx
}

/** Git user info returned by read_git_user_info command. */
export interface GitUserInfo {
  name: string | null;
  email: string | null;
}

/** Root settings object stored in settings.yaml. */
export interface AppSettings {
  providers: Record<string, ProviderConfig>;
  llm: LlmConfig;
  app: AppConfig;
  user: UserProfile;
}

// ---------------------------------------------------------------------------
// Workflow Config types (feat-settings-workflow-config)
// ---------------------------------------------------------------------------

/** Workflow parallelism settings. */
export interface WorkflowParallelism {
  max_concurrent: number;
}

/** Workflow automation settings. */
export interface WorkflowAutomation {
  auto_start: boolean;
  auto_start_next: boolean;
}

/** Workflow git behavior settings. */
export interface WorkflowGitBehavior {
  auto_push: boolean;
  push_tags: boolean;
}

/** Workflow archive settings. */
export interface WorkflowArchive {
  create_tag: boolean;
}

/** Workflow cleanup settings. */
export interface WorkflowCleanup {
  delete_worktree: boolean;
  delete_branch: boolean;
}

/** Workflow completion settings. */
export interface WorkflowCompletion {
  archive: WorkflowArchive;
  cleanup: WorkflowCleanup;
}

/** Full workflow configuration matching feature-workflow/config.yaml. */
export interface WorkflowConfig {
  parallelism: WorkflowParallelism;
  workflow: WorkflowAutomation;
  git: WorkflowGitBehavior;
  completion: WorkflowCompletion;
}

// ---------------------------------------------------------------------------
// Agent Runtime types (feat-agent-runtime-core)
// ---------------------------------------------------------------------------

/** Status of an agent runtime. */
export type AgentRuntimeStatusType = 'available' | 'not-installed' | 'unhealthy' | 'busy';

/** Capabilities that an agent runtime supports. */
export type AgentCapabilityType = 'streaming' | 'sessions' | 'tool-use' | 'structured-output';

/** Info about a detected agent runtime. */
export interface AgentRuntimeInfo {
  id: string;
  name: string;
  type: string;
  status: AgentRuntimeStatusType;
  version: string | null;
  install_path: string | null;
  capabilities: AgentCapabilityType[];
  install_hint: string;
}

// ---------------------------------------------------------------------------
// Smart Router types (feat-agent-runtime-router)
// ---------------------------------------------------------------------------

/** Task categories the router can classify. */
export type TaskCategoryType =
  | 'code_generation'
  | 'code_review'
  | 'requirements'
  | 'testing'
  | 'general';

/** A single routing rule mapping a category to a runtime. */
export interface RoutingRule {
  category: TaskCategoryType;
  runtime_id: string;
  priority: number;
  fallback_chain: string[];
}

/** Result of a routing decision. */
export interface RoutingDecision {
  decision_id: string;
  category: TaskCategoryType;
  category_label: string;
  selected_runtime: string;
  fallback_used: boolean;
  original_preference: string | null;
  reason: string;
  timestamp: string;
}

/** Routing configuration. */
export interface RoutingConfig {
  rules: RoutingRule[];
  default_runtime: string;
  default_fallback_chain: string[];
}

/** Fallback log entry. */
export interface FallbackLogEntry {
  task_summary: string;
  from_runtime: string;
  to_runtime: string;
  reason: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Pipeline types (feat-agent-runtime-pipeline)
// ---------------------------------------------------------------------------

/** Execution status of a pipeline or individual stage. */
export type PipelineStatusType = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

/** A single stage in a pipeline definition. */
export interface PipelineStageConfig {
  /** Unique stage id within the pipeline (e.g. "req-analysis"). */
  id: string;
  /** Display name. */
  name: string;
  /** The agent runtime this stage binds to (references AgentRuntimeInfo.id). */
  runtime_id: string;
  /** Prompt template. Use {{input}} for initial input, {{prev_output}} for previous stage output. */
  prompt_template: string;
  /** Mapping of variable names to values for the prompt template. */
  input_mapping?: Record<string, string>;
  /** Max retries on failure (default 0). */
  max_retries?: number;
  /** Timeout in seconds (0 = no timeout). */
  timeout_seconds?: number;
}

/** Pipeline configuration persisted as YAML. */
export interface PipelineConfig {
  /** Unique pipeline id (kebab-case). */
  id: string;
  /** Display name. */
  name: string;
  /** Human-readable description. */
  description?: string;
  /** Ordered list of stages. */
  stages: PipelineStageConfig[];
  /** Global variables available in all stage prompt templates. */
  variables?: Record<string, string>;
  /** Default max retries for any stage that doesn't specify its own. */
  default_max_retries?: number;
}

/** Runtime execution state of a single stage. */
export interface PipelineStageExecution {
  stage_id: string;
  status: PipelineStatusType;
  /** The input text that was fed to this stage. */
  input: string;
  /** The output text produced by this stage. */
  output: string;
  /** Error message if the stage failed. */
  error: string | null;
  /** Number of attempts so far (including retries). */
  attempts: number;
  /** Timestamp (ISO string) when the stage started. */
  started_at: string | null;
  /** Timestamp (ISO string) when the stage finished. */
  finished_at: string | null;
}

/** Runtime execution state of a pipeline. */
export interface PipelineExecution {
  /** Execution id (unique per run). */
  id: string;
  /** The pipeline config id. */
  pipeline_id: string;
  /** Overall status. */
  status: PipelineStatusType;
  /** Index of the currently executing stage (-1 = not started). */
  current_stage_index: number;
  /** Per-stage execution records. */
  stages: PipelineStageExecution[];
  /** The original user input that kicked off the pipeline. */
  initial_input: string;
  /** Timestamp (ISO string) when execution started. */
  started_at: string | null;
  /** Timestamp (ISO string) when execution finished. */
  finished_at: string | null;
  /** Error message if the pipeline failed overall. */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Pipeline Tauri event payloads (feat-agent-runtime-pipeline)
// ---------------------------------------------------------------------------

/** Payload for pipeline://stage-start event. */
export interface PipelineStageStartEvent {
  execution_id: string;
  pipeline_id: string;
  stage_index: number;
  stage_id: string;
}

/** Payload for pipeline://stage-output event. */
export interface PipelineStageOutputEvent {
  execution_id: string;
  pipeline_id: string;
  stage_index: number;
  stage_id: string;
  text: string;
  is_done: boolean;
  error?: string;
}

/** Payload for pipeline://stage-complete event. */
export interface PipelineStageCompleteEvent {
  execution_id: string;
  pipeline_id: string;
  stage_index: number;
  stage_id: string;
  status: PipelineStatusType;
  output: string;
  error: string | null;
}

/** Payload for pipeline://pipeline-complete event. */
export interface PipelineCompleteEvent {
  execution_id: string;
  pipeline_id: string;
  status: PipelineStatusType;
  final_output: string;
  stages: PipelineStageExecution[];
}

// ---------------------------------------------------------------------------
// Agent configuration (feat-agent-runtime-ui)
// ---------------------------------------------------------------------------

/** Orchestration mode for an agent. */
export type AgentOrchestrationMode = 'pipeline' | 'route';

/** A user-created agent configuration. */
export interface AgentConfig {
  /** Unique agent id (kebab-case). */
  id: string;
  /** Display name. */
  name: string;
  /** Orchestration mode: pipeline runs stages sequentially; route uses smart routing. */
  mode: AgentOrchestrationMode;
  /** For pipeline mode: the pipeline config id to run. */
  pipeline_id?: string;
  /** For route mode: preferred runtime id. */
  preferred_runtime?: string;
  /** Description. */
  description?: string;
  /** Default prompt template prefix prepended to user input. */
  system_prompt?: string;
  /** Whether the agent is active and usable. */
  enabled: boolean;
  /** Creation timestamp (ISO string). */
  created_at: string;
}

// ---------------------------------------------------------------------------
// MD Explorer types (feat-project-md-explorer)
// ---------------------------------------------------------------------------

/** A single .md file entry returned by list_md_files command. */
export interface MdFileEntry {
  name: string;
  path: string;
}

/** Editor mode for the MD Explorer content area. */
export type MdEditorMode = 'preview' | 'edit';

// ---------------------------------------------------------------------------
// Agent Conversation types (feat-agent-conversation)
// ---------------------------------------------------------------------------

/** Agent action types for Feature Detail Modal Agent tab. */
export type AgentActionType = 'review' | 'modify' | 'develop';

// ---------------------------------------------------------------------------
// PMFile types (feat-agent-multimodal-upload)
// ---------------------------------------------------------------------------

/** Metadata for a file in the PMFile directory. */
export interface PMFileEntry {
  name: string;
  path: string;
  size: number;
  /** Category type: "image" | "audio" | "pdf" | "document" | "markdown" | etc. */
  file_type: string;
  /** Last modified time as formatted string. */
  modified: string;
}

/** Upload status for a file being uploaded. */
export type PMFileUploadStatus = 'uploading' | 'uploaded' | 'error';

/** A file in the process of being uploaded. */
export interface PMFileUploading {
  /** Original file name. */
  name: string;
  /** Upload progress (0-100). */
  progress: number;
  status: PMFileUploadStatus;
  /** Error message if status is 'error'. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Multimodal Chat types (feat-agent-multimodal-chat)
// ---------------------------------------------------------------------------

/** A file reference attached to a chat message. */
export interface FileReference {
  /** File name. */
  name: string;
  /** Full file path in PMFile directory. */
  path: string;
  /** File type category. */
  fileType: string;
  /** Whether the file has been analyzed (has PMDM report). */
  analyzed: boolean;
  /** PMDM analysis MD file path, if analyzed. */
  analysisPath?: string;
}

// ---------------------------------------------------------------------------
// Runtime Process Monitor types (feat-claude-code-runtime-monitor)
// ---------------------------------------------------------------------------

/** Info about a detected runtime process (e.g. Claude Code CLI). */
export interface RuntimeProcessInfo {
  /** Runtime identifier (e.g. "claude-code") */
  runtime_id: string;
  /** Human-readable name */
  name: string;
  /** Process ID */
  pid: number;
  /** Process status: "running" | "idle" */
  status: 'running' | 'idle';
  /** Working directory of the process */
  working_dir: string;
  /** CPU usage percentage */
  cpu_usage: number;
  /** Memory usage in bytes */
  memory_bytes: number;
  /** Process start time as unix timestamp (seconds) */
  started_at: number | null;
}

/** Claude Code session detail read from ~/.claude/ session files. */
export interface ClaudeSessionDetail {
  /** Session ID */
  session_id: string;
  /** Session status */
  status: 'active' | 'idle' | 'error';
  /** Model being used */
  model: string | null;
  /** Token usage statistics */
  token_count: { input: number; output: number } | null;
  /** Current task description */
  current_task: string | null;
  /** Session start time (ISO string) */
  started_at: string | null;
}

// ---------------------------------------------------------------------------
// Session Output types (feat-runtime-session-output)
// ---------------------------------------------------------------------------

/** Information about the currently active session's output. */
export interface ActiveSessionInfo {
  /** The active session ID */
  session_id: string;
  /** Concatenated output text from all buffered StreamEvents */
  output_text: string;
  /** Whether the session execution is complete */
  is_done: boolean;
  /** Number of buffered chunks */
  chunk_count: number;
}

/** A streaming event produced by an AgentRuntime (matches Rust StreamEvent). */
export interface StreamEventChunk {
  /** Text content of the event */
  text: string;
  /** Whether this is the final event */
  is_done: boolean;
  /** Error message if something went wrong */
  error?: string;
  /** The type of this event: "assistant", "result", "system", "tool_use", "raw", "stderr", "timeout", "idle_warning" */
  type?: string;
  /** Session ID from the CLI */
  session_id?: string;
  /** Idle seconds (only set for idle_warning events) */
  idle_seconds?: number;
}

// ---------------------------------------------------------------------------
// Modal Session Store types (feat-modal-session-store)
// ---------------------------------------------------------------------------

/** State persisted for a Feature Detail Modal Agent tab session. */
export interface TaskSessionState {
  featureId: string;
  agentOutput: string;
  agentAction: AgentActionType;
  agentDone: boolean;
  agentError: string | null;
  lastActiveTab: 'spec' | 'tasks' | 'checklist' | 'agent';
  savedAt: number; // timestamp for expiration detection
}

/** State persisted for the NewTask Modal session. */
export interface NewTaskSessionState {
  step: 'select-agent' | 'input-requirement' | 'executing' | 'result';
  selectedAgentId: string | null;
  pmMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  extMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  chatInput: string;
  extChatInput: string;
  savedAt: number;
}

/** API exposed by the SessionStore Context. */
export interface SessionStoreAPI {
  // Task session (Feature Detail Modal)
  saveTaskSession: (state: TaskSessionState) => void;
  loadTaskSession: (featureId: string) => TaskSessionState | null;
  clearTaskSession: (featureId: string) => void;

  // NewTask session
  saveNewTaskSession: (state: NewTaskSessionState) => void;
  loadNewTaskSession: () => NewTaskSessionState | null;
  clearNewTaskSession: () => void;
}

// ---------------------------------------------------------------------------
// Claude Session History types (feat-claude-session-history)
// ---------------------------------------------------------------------------

/** A single session entry from .session_cache.json index. */
export interface ClaudeSessionListItem {
  /** Session ID (UUID) */
  session_id: string;
  /** Session file path (relative to project dir) */
  file_path: string;
  /** Summary text (first assistant text) */
  summary: string | null;
  /** First user message content */
  first_user_content: string | null;
  /** Last user message content */
  last_user_content: string | null;
  /** Project name */
  project_name: string | null;
  /** Total message count */
  message_count: number;
  /** First message timestamp (ISO string) */
  first_message_time: string | null;
  /** Last message timestamp (ISO string) */
  last_message_time: string | null;
  /** Whether the session used tools */
  has_tool_use: boolean;
  /** Whether the session had errors */
  has_errors: boolean;
  /** Git branch at session start */
  git_branch: string | null;
  /** Model used */
  model: string | null;
  /** Session entrypoint: "cli" | "print" */
  entrypoint: string | null;
}

/** A single message in a Claude Code session (parsed from JSONL). */
export interface ClaudeSessionMessage {
  /** Entry UUID */
  uuid: string;
  /** Parent entry UUID */
  parent_uuid: string | null;
  /** Message type: "user" | "assistant" | "system" | "tool_result" | ... */
  type: string;
  /** Timestamp (ISO string) */
  timestamp: string | null;
  /** Session ID */
  session_id: string | null;
  /** Git branch */
  git_branch: string | null;
  /** Whether this is a sidechain entry */
  is_sidechain: boolean;
  /** User type: "external" | "internal" */
  user_type: string | null;
  /** The message content */
  message: ClaudeMessageContent | null;
}

/** Message content from a Claude session entry. */
export interface ClaudeMessageContent {
  /** Role: "user" | "assistant" | ... */
  role: string;
  /** Content blocks */
  content: ClaudeContentBlock[];
}

/** A content block within a message. */
export interface ClaudeContentBlock {
  /** Block type: "text" | "tool_use" | "tool_result" | "thinking" */
  type: string;
  /** Text content (for text blocks) */
  text?: string;
  /** Tool ID (for tool_use / tool_result) */
  id?: string;
  /** Tool name (for tool_use) */
  name?: string;
  /** Tool input (for tool_use) */
  input?: unknown;
  /** Tool result content (for tool_result) */
  content?: string | ClaudeContentBlock[];
  /** Thinking text (for thinking blocks) */
  thinking?: string;
}

/** Metadata for a session detail view. */
export interface ClaudeSessionMetadata {
  /** Session ID */
  session_id: string;
  /** Session file path */
  file_path: string;
  /** First message timestamp */
  first_message_time: string | null;
  /** Last message timestamp */
  last_message_time: string | null;
  /** Duration in seconds */
  duration_seconds: number;
  /** Total message count */
  total_messages: number;
  /** Input token count */
  input_tokens: number;
  /** Output token count */
  output_tokens: number;
  /** Model used */
  model: string | null;
  /** Git branch */
  git_branch: string | null;
  /** Whether tools were used */
  has_tool_use: boolean;
  /** Whether errors occurred */
  has_errors: boolean;
}

/** Detailed view of a Claude session with messages and metadata. */
export interface ClaudeHistorySessionDetail {
  /** Session metadata */
  metadata: ClaudeSessionMetadata;
  /** Paginated messages */
  messages: ClaudeSessionMessage[];
  /** Total message count (for pagination) */
  total_count: number;
  /** Current page offset */
  offset: number;
  /** Page size */
  limit: number;
  /** Whether there are more messages to load */
  has_more: boolean;
}
