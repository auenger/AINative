use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, BufWriter, Read as IoRead, Write as IoWrite};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;
use notify::{RecommendedWatcher, RecursiveMode, Watcher, Config as NotifyConfig, Event as NotifyEvent};
use sysinfo::{System, ProcessesToUpdate};
use futures::StreamExt;

// ===========================================================================
// Data types shared with the frontend - File system
// ===========================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    #[serde(rename = "isDir")]
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceResult {
    pub path: String,
    pub valid: bool,
    pub error: Option<String>,
}

// ===========================================================================
// Data types - Pty terminal
// ===========================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PtyConfig {
    pub shell: String,
    #[serde(default)]
    pub args: Vec<String>,
    pub cols: u16,
    pub rows: u16,
    /// Working directory for the spawned shell process. When empty/None the shell
    /// uses its default (usually the user's home directory).
    #[serde(default)]
    pub cwd: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PtyOutputEvent {
    pub pty_id: String,
    pub data: String,
}

// ===========================================================================
// Data types - FS-as-Database (Queue & Feature)
// ===========================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FeatureNode {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub priority: i32,
    #[serde(default)]
    pub size: String,
    #[serde(default)]
    pub dependencies: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<FeatureDetails>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FeatureDetails {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plan: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ParentEntry {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub features: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct QueueMeta {
    #[serde(default)]
    pub last_updated: String,
    #[serde(default)]
    pub version: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QueueYaml {
    #[serde(default)]
    pub meta: QueueMeta,
    #[serde(default)]
    pub parents: Vec<ParentEntry>,
    #[serde(default)]
    pub active: Vec<FeatureNode>,
    #[serde(default)]
    pub pending: Vec<FeatureNode>,
    #[serde(default)]
    pub blocked: Vec<FeatureNode>,
    #[serde(default)]
    pub completed: Vec<FeatureNode>,
}

#[derive(Debug, Serialize, Clone)]
pub struct QueueState {
    pub meta: QueueMeta,
    pub parents: Vec<ParentEntry>,
    pub active: Vec<FeatureNode>,
    pub pending: Vec<FeatureNode>,
    pub blocked: Vec<FeatureNode>,
    pub completed: Vec<FeatureNode>,
}

#[derive(Debug, Serialize, Clone)]
pub struct FsChangeEvent {
    pub paths: Vec<String>,
    pub kind: String,
}

// ===========================================================================
// Data types - Hardware monitoring
// ===========================================================================

#[derive(Debug, Serialize, Clone)]
pub struct HardwareStats {
    pub cpu_usage: f32,
    pub memory_total: u64,
    pub memory_used: u64,
    pub memory_percent: f32,
    pub uptime: u64,
}

#[derive(Debug, Serialize, Clone)]
pub struct GitStats {
    pub commits_7d: u32,
    pub changed_files: u32,
    pub contributors: Vec<ContributorInfo>,
    pub current_branch: String,
    pub recent_commits: Vec<RecentCommit>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ContributorInfo {
    pub name: String,
    pub commits: u32,
}

#[derive(Debug, Serialize, Clone)]
pub struct RecentCommit {
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub time_ago: String,
}

// ===========================================================================
// Data types - Runtime process monitor (feat-claude-code-runtime-monitor)
// ===========================================================================

/// Info about a detected runtime process (e.g. Claude Code CLI).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RuntimeProcessInfo {
    /// Runtime identifier (e.g. "claude-code")
    pub runtime_id: String,
    /// Human-readable name (e.g. "Claude Code")
    pub name: String,
    /// Process ID
    pub pid: u32,
    /// Process status: "running" | "idle"
    pub status: String,
    /// Working directory of the process
    pub working_dir: String,
    /// CPU usage percentage
    pub cpu_usage: f32,
    /// Memory usage in bytes
    pub memory_bytes: u64,
    /// Process start time as unix timestamp (seconds)
    pub started_at: Option<u64>,
}

/// Payload emitted via `runtime://status-changed` event.
#[derive(Debug, Serialize, Clone)]
pub struct RuntimeStatusPayload {
    /// List of detected runtime processes
    pub runtimes: Vec<RuntimeProcessInfo>,
    /// Timestamp of this scan
    pub timestamp: u64,
}

/// Claude Code session info read from `~/.claude/` session files.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClaudeSessionInfo {
    /// Session ID
    pub session_id: String,
    /// Session status: "active" | "idle" | "error"
    pub status: String,
    /// Model being used
    pub model: Option<String>,
    /// Token usage statistics
    pub token_count: Option<TokenCount>,
    /// Current task description (if available)
    pub current_task: Option<String>,
    /// Session start time (ISO string)
    pub started_at: Option<String>,
}

/// Token usage for a Claude session.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TokenCount {
    pub input: u64,
    pub output: u64,
}

// ===========================================================================
// Data types - Git status (feat-git-status-read)
// ===========================================================================

#[derive(Debug, Serialize, Clone)]
pub struct FileDiffInfo {
    pub path: String,
    pub status: String, // "staged" | "unstaged" | "untracked"
    pub additions: usize,
    pub deletions: usize,
}

#[derive(Debug, Serialize, Clone)]
pub struct GitStatusResult {
    pub current_branch: String,
    pub remote_url: Option<String>,
    pub files: Vec<FileDiffInfo>,
}

// ===========================================================================
// Data types - Git detail (feat-git-modal-enhance)
// ===========================================================================

#[derive(Debug, Serialize, Clone)]
pub struct GitTag {
    pub name: String,
    pub date: i64,
    pub commit_hash: String,
    pub message: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct GitCommitDetail {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64,
    pub time_ago: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct GitBranchInfo {
    pub name: String,
    pub is_current: bool,
    pub latest_commit: String,
    pub latest_commit_hash: String,
}

// ===========================================================================
// Data types - AI Agent Service
// ===========================================================================

#[derive(Debug, Serialize, Clone)]
pub struct AgentChunkEvent {
    pub text: String,
    pub is_done: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct AgentChatRequest {
    pub messages: Vec<ChatMessage>,
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default)]
    pub context: Option<String>,
}

fn default_model() -> String {
    "gemini-2.0-flash".to_string()
}

/// Schema for structured output: a Feature plan returned by the Agent.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FeaturePlanOutput {
    pub id: String,
    pub name: String,
    pub priority: i32,
    pub size: String,
    pub dependencies: Vec<String>,
    pub description: String,
    pub value_points: Vec<String>,
    pub tasks: Vec<TaskGroup>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskGroup {
    pub group_name: String,
    pub items: Vec<String>,
}

/// Payload for creating a feature from the Agent's structured output.
#[derive(Debug, Deserialize)]
pub struct CreateFeatureRequest {
    pub parent_id: String,
    pub plan: FeaturePlanOutput,
}

// ===========================================================================
// Data types - Settings & LLM Provider (feat-settings-llm-config)
// ===========================================================================

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ProviderConfig {
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub api_base: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct LlmConfig {
    #[serde(default = "default_llm_provider")]
    pub provider: String,
    #[serde(default = "default_llm_model")]
    pub model: String,
    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,
    #[serde(default = "default_temperature")]
    pub temperature: f32,
    #[serde(default = "default_context_window")]
    pub context_window_tokens: u32,
}

fn default_llm_provider() -> String { String::new() }
fn default_llm_model() -> String { String::new() }
fn default_max_tokens() -> u32 { 2000 }
fn default_temperature() -> f32 { 0.7 }
fn default_context_window() -> u32 { 128000 }

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct AppConfigYaml {
    #[serde(default = "default_auto_refresh")]
    pub auto_refresh_interval: u32,
}

fn default_auto_refresh() -> u32 { 30 }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    #[serde(default)]
    pub providers: HashMap<String, ProviderConfig>,
    #[serde(default)]
    pub llm: LlmConfig,
    #[serde(default)]
    pub app: AppConfigYaml,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            providers: HashMap::new(),
            llm: LlmConfig {
                provider: default_llm_provider(),
                model: default_llm_model(),
                max_tokens: default_max_tokens(),
                temperature: default_temperature(),
                context_window_tokens: default_context_window(),
            },
            app: AppConfigYaml {
                auto_refresh_interval: default_auto_refresh(),
            },
        }
    }
}

// ===========================================================================
// Data types - ReqAgent (Claude Code CLI Bridge)
// ===========================================================================

/// Chunk event emitted to the frontend via Tauri event system.
/// Reuses the same shape as AgentChunkEvent for frontend compatibility.
#[derive(Debug, Serialize, Clone)]
pub struct ReqAgentChunkEvent {
    pub text: String,
    pub is_done: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// The stream-json message type from Claude CLI (e.g. "assistant", "result", "system")
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub msg_type: Option<String>,
    /// Session ID from the CLI
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
}

/// Status response for req_agent_status command.
#[derive(Debug, Serialize, Clone)]
pub struct ReqAgentStatus {
    pub running: bool,
    pub session_id: Option<String>,
}

/// Internal state for the ReqAgent subprocess manager.
struct ReqAgentState {
    /// The Claude CLI child process
    process: Option<Child>,
    /// Current session ID (UUID)
    session_id: Option<String>,
    /// Writer to the child's stdin (BufWriter for efficient writes)
    stdin: Option<BufWriter<std::process::ChildStdin>>,
}

impl ReqAgentState {
    fn new() -> Self {
        Self {
            process: None,
            session_id: None,
            stdin: None,
        }
    }
}

/// Keyring service name constant.
const KEYRING_SERVICE: &str = "neuro-syntax-ide";
const KEYRING_ACCOUNT: &str = "ai-api-key";

// ===========================================================================
// Data types - Agent Runtime System (feat-agent-runtime-core)
// ===========================================================================

/// Status of an agent runtime.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum AgentRuntimeStatus {
    /// CLI tool detected and working
    Available,
    /// CLI tool not found on the system
    NotInstalled,
    /// CLI tool found but health check failed
    Unhealthy,
    /// Currently processing a request
    Busy,
}

/// Capabilities that an agent runtime supports.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "kebab-case")]
pub enum AgentCapability {
    /// Streaming text output
    Streaming,
    /// Session management (resume conversations)
    Sessions,
    /// Tool use (file read/write, bash, etc.)
    ToolUse,
    /// Structured output (JSON mode)
    StructuredOutput,
}

/// Info about a detected agent runtime, returned to the frontend.
#[derive(Debug, Serialize, Clone)]
pub struct AgentRuntimeInfo {
    /// Unique identifier (e.g. "claude-code", "codex")
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// Runtime type identifier
    #[serde(rename = "type")]
    pub runtime_type: String,
    /// Current status
    pub status: AgentRuntimeStatus,
    /// Detected version string (if available)
    pub version: Option<String>,
    /// Installation path (if detected)
    pub install_path: Option<String>,
    /// Supported capabilities
    pub capabilities: Vec<AgentCapability>,
    /// Install hint command (shown when not-installed)
    pub install_hint: String,
}

// ===========================================================================
// Agent execution types (feat-agent-runtime-execute)
// ===========================================================================

/// Parameters for executing a message on an AgentRuntime.
#[derive(Debug, Clone)]
pub struct ExecuteParams {
    /// The user message to send to the agent
    pub message: String,
    /// Optional session ID for resuming a conversation
    pub session_id: Option<String>,
    /// Optional workspace directory for the agent to operate in
    pub workspace: Option<String>,
    /// Optional system prompt to append
    pub system_prompt: Option<String>,
    /// Maximum execution time in seconds before timeout
    pub timeout_secs: u64,
}

/// A streaming event produced by an AgentRuntime during execution.
#[derive(Debug, Clone, Serialize)]
pub struct StreamEvent {
    /// Text content of the event (assistant text, system message, raw output)
    pub text: String,
    /// Whether this is the final event for this execution
    pub is_done: bool,
    /// Error message if something went wrong
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// The type of this event: "assistant", "result", "system", "tool_use", "raw", "stderr", "timeout"
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub msg_type: Option<String>,
    /// Session ID from the CLI
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
}

/// Trait that all agent runtimes must implement.
/// Each runtime wraps a specific AI coding CLI tool.
pub trait AgentRuntime: Send + Sync {
    /// Unique runtime identifier (e.g. "claude-code")
    fn id(&self) -> &str;
    /// Human-readable name
    fn name(&self) -> &str;
    /// Runtime type (e.g. "cli")
    fn runtime_type(&self) -> &str;
    /// List of capabilities this runtime supports
    fn capabilities(&self) -> Vec<AgentCapability>;
    /// Install hint command for this runtime
    fn install_hint(&self) -> String;
    /// Detect whether the CLI is available and return (path, version)
    fn detect(&self) -> Result<Option<(String, String)>, String>;
    /// Perform a health check (e.g. run --version)
    fn health_check(&self) -> AgentRuntimeStatus;
    /// Get the current runtime info (id, name, status, version, etc.)
    fn info(&self) -> AgentRuntimeInfo;

    /// Execute a message and return a receiver for streaming events.
    /// The caller reads events from the channel until is_done is received.
    fn execute(&self, params: ExecuteParams) -> Result<std::sync::mpsc::Receiver<StreamEvent>, String>;

    /// Check if the runtime is ready for execution (CLI detected & available).
    fn is_ready(&self) -> bool;
}

// ===========================================================================
// Constants
// ===========================================================================

const MAX_DEPTH: u32 = 8;
const STORE_FILENAME: &str = "workspace-store.json";
const STORE_KEY_WORKSPACE: &str = "workspace_path";

const SKIP_NAMES: &[&str] = &[
    "node_modules", ".git", "target", "dist", ".next", ".nuxt",
    "__pycache__", ".DS_Store", ".cache", ".turbo", ".parcel-cache",
    "build", ".build",
];

// ===========================================================================
// Runtime Registry & Detector (feat-agent-runtime-core)
// ===========================================================================

/// Registry that manages all discovered agent runtimes.
/// Thread-safe via Arc<Mutex<...>>.
struct RuntimeRegistry {
    runtimes: Vec<Box<dyn AgentRuntime>>,
    /// Cached detection results: runtime_id -> (path, version)
    detected: HashMap<String, (String, String)>,
}

impl RuntimeRegistry {
    fn new() -> Self {
        Self {
            runtimes: Vec::new(),
            detected: HashMap::new(),
        }
    }

    /// Register a runtime implementation.
    fn register(&mut self, runtime: Box<dyn AgentRuntime>) {
        self.runtimes.push(runtime);
    }

    /// Scan all registered runtimes, detect their presence on the system.
    /// Returns info for each runtime.
    fn scan_all(&mut self) -> Vec<AgentRuntimeInfo> {
        self.detected.clear();
        let mut results = Vec::new();

        for runtime in &self.runtimes {
            let rt_id = runtime.id().to_string();
            match runtime.detect() {
                Ok(Some((path, version))) => {
                    self.detected.insert(rt_id.clone(), (path.clone(), version.clone()));
                    results.push(AgentRuntimeInfo {
                        id: runtime.id().to_string(),
                        name: runtime.name().to_string(),
                        runtime_type: runtime.runtime_type().to_string(),
                        status: AgentRuntimeStatus::Available,
                        version: Some(version),
                        install_path: Some(path),
                        capabilities: runtime.capabilities(),
                        install_hint: runtime.install_hint(),
                    });
                }
                Ok(None) => {
                    results.push(AgentRuntimeInfo {
                        id: runtime.id().to_string(),
                        name: runtime.name().to_string(),
                        runtime_type: runtime.runtime_type().to_string(),
                        status: AgentRuntimeStatus::NotInstalled,
                        version: None,
                        install_path: None,
                        capabilities: runtime.capabilities(),
                        install_hint: runtime.install_hint(),
                    });
                }
                Err(_) => {
                    results.push(AgentRuntimeInfo {
                        id: runtime.id().to_string(),
                        name: runtime.name().to_string(),
                        runtime_type: runtime.runtime_type().to_string(),
                        status: AgentRuntimeStatus::NotInstalled,
                        version: None,
                        install_path: None,
                        capabilities: runtime.capabilities(),
                        install_hint: runtime.install_hint(),
                    });
                }
            }
        }

        results
    }

    /// Get runtime info for all registered runtimes (using cached detection data).
    fn list_all(&self) -> Vec<AgentRuntimeInfo> {
        self.runtimes.iter().map(|rt| {
            let rt_id = rt.id().to_string();
            if let Some((path, version)) = self.detected.get(&rt_id) {
                AgentRuntimeInfo {
                    id: rt.id().to_string(),
                    name: rt.name().to_string(),
                    runtime_type: rt.runtime_type().to_string(),
                    status: AgentRuntimeStatus::Available,
                    version: Some(version.clone()),
                    install_path: Some(path.clone()),
                    capabilities: rt.capabilities(),
                    install_hint: rt.install_hint(),
                }
            } else {
                AgentRuntimeInfo {
                    id: rt.id().to_string(),
                    name: rt.name().to_string(),
                    runtime_type: rt.runtime_type().to_string(),
                    status: AgentRuntimeStatus::NotInstalled,
                    version: None,
                    install_path: None,
                    capabilities: rt.capabilities(),
                    install_hint: rt.install_hint(),
                }
            }
        }).collect()
    }

    /// Get info for a single runtime by id.
    fn get_runtime(&self, id: &str) -> Option<AgentRuntimeInfo> {
        self.runtimes.iter()
            .find(|rt| rt.id() == id)
            .map(|rt| {
                let rt_id = rt.id().to_string();
                if let Some((path, version)) = self.detected.get(&rt_id) {
                    AgentRuntimeInfo {
                        id: rt.id().to_string(),
                        name: rt.name().to_string(),
                        runtime_type: rt.runtime_type().to_string(),
                        status: AgentRuntimeStatus::Available,
                        version: Some(version.clone()),
                        install_path: Some(path.clone()),
                        capabilities: rt.capabilities(),
                        install_hint: rt.install_hint(),
                    }
                } else {
                    AgentRuntimeInfo {
                        id: rt.id().to_string(),
                        name: rt.name().to_string(),
                        runtime_type: rt.runtime_type().to_string(),
                        status: AgentRuntimeStatus::NotInstalled,
                        version: None,
                        install_path: None,
                        capabilities: rt.capabilities(),
                        install_hint: rt.install_hint(),
                    }
                }
            })
    }

    /// Run health checks on all detected runtimes.
    fn health_check_all(&mut self) -> Vec<AgentRuntimeInfo> {
        let mut results = Vec::new();
        for runtime in &self.runtimes {
            let status = runtime.health_check();
            let rt_id = runtime.id().to_string();
            let (version, install_path) = self.detected.get(&rt_id)
                .map(|(p, v)| (Some(v.clone()), Some(p.clone())))
                .unwrap_or((None, None));

            // If health check says unhealthy, update detected map
            if status == AgentRuntimeStatus::Unhealthy {
                self.detected.remove(&rt_id);
            }

            results.push(AgentRuntimeInfo {
                id: rt_id,
                name: runtime.name().to_string(),
                runtime_type: runtime.runtime_type().to_string(),
                status,
                version,
                install_path,
                capabilities: runtime.capabilities(),
                install_hint: runtime.install_hint(),
            });
        }
        results
    }

    /// Count available (detected & healthy) runtimes.
    fn available_count(&self) -> usize {
        self.detected.len()
    }

    /// Get a reference to a registered runtime instance by id.
    /// Returns a reference to the trait object for calling execute() etc.
    fn get_runtime_instance(&self, id: &str) -> Result<&dyn AgentRuntime, String> {
        self.runtimes.iter()
            .find(|rt| rt.id() == id)
            .map(|rt| rt.as_ref())
            .ok_or_else(|| format!("Runtime '{}' not found in registry", id))
    }
}

/// Detector utility: checks if a CLI command exists on PATH and gets its version.
struct RuntimeDetector;

impl RuntimeDetector {
    /// Check if a command exists on the system PATH.
    /// Returns the full path if found.
    fn find_command(cmd: &str) -> Option<String> {
        #[cfg(unix)]
        {
            Command::new("which")
                .arg(cmd)
                .output()
                .ok()
                .filter(|o| o.status.success())
                .and_then(|o| {
                    let path = String::from_utf8_lossy(&o.stdout).trim().to_string();
                    if path.is_empty() { None } else { Some(path) }
                })
        }
        #[cfg(windows)]
        {
            Command::new("where")
                .arg(cmd)
                .output()
                .ok()
                .filter(|o| o.status.success())
                .and_then(|o| {
                    let path = String::from_utf8_lossy(&o.stdout).trim().to_string();
                    if path.is_empty() { None } else { Some(path) }
                })
        }
    }

    /// Get the version of a CLI tool by running `cmd --version`.
    fn get_version(cmd: &str) -> Option<String> {
        Command::new(cmd)
            .arg("--version")
            .output()
            .ok()
            .filter(|o| o.status.success())
            .map(|o| {
                let ver = String::from_utf8_lossy(&o.stdout).trim().to_string();
                // Take only the first line of version output
                ver.lines().next().unwrap_or(&ver).to_string()
            })
    }
}

// ===========================================================================
// Runtime Implementations (feat-agent-runtime-core)
// ===========================================================================

/// Claude Code CLI runtime implementation.
struct ClaudeCodeRuntime;

impl ClaudeCodeRuntime {
    fn new() -> Self {
        Self
    }
}

impl AgentRuntime for ClaudeCodeRuntime {
    fn id(&self) -> &str { "claude-code" }
    fn name(&self) -> &str { "Claude Code" }
    fn runtime_type(&self) -> &str { "cli" }

    fn capabilities(&self) -> Vec<AgentCapability> {
        vec![
            AgentCapability::Streaming,
            AgentCapability::Sessions,
            AgentCapability::ToolUse,
            AgentCapability::StructuredOutput,
        ]
    }

    fn install_hint(&self) -> String {
        "npm install -g @anthropic-ai/claude-code".to_string()
    }

    fn detect(&self) -> Result<Option<(String, String)>, String> {
        let path = RuntimeDetector::find_command("claude");
        match path {
            Some(p) => {
                let version = RuntimeDetector::get_version("claude")
                    .unwrap_or_else(|| "unknown".to_string());
                Ok(Some((p, version)))
            }
            None => Ok(None),
        }
    }

    fn health_check(&self) -> AgentRuntimeStatus {
        match self.detect() {
            Ok(Some(_)) => AgentRuntimeStatus::Available,
            _ => AgentRuntimeStatus::Unhealthy,
        }
    }

    fn info(&self) -> AgentRuntimeInfo {
        match self.detect() {
            Ok(Some((path, version))) => AgentRuntimeInfo {
                id: self.id().to_string(),
                name: self.name().to_string(),
                runtime_type: self.runtime_type().to_string(),
                status: AgentRuntimeStatus::Available,
                version: Some(version),
                install_path: Some(path),
                capabilities: self.capabilities(),
                install_hint: self.install_hint(),
            },
            _ => AgentRuntimeInfo {
                id: self.id().to_string(),
                name: self.name().to_string(),
                runtime_type: self.runtime_type().to_string(),
                status: AgentRuntimeStatus::NotInstalled,
                version: None,
                install_path: None,
                capabilities: self.capabilities(),
                install_hint: self.install_hint(),
            },
        }
    }

    fn is_ready(&self) -> bool {
        matches!(self.health_check(), AgentRuntimeStatus::Available)
    }

    fn execute(&self, params: ExecuteParams) -> Result<std::sync::mpsc::Receiver<StreamEvent>, String> {
        use std::time::Duration;

        // Pre-flight: verify CLI is available
        if !self.is_ready() {
            return Err(
                "Claude Code CLI not found or not healthy. Please install: npm install -g @anthropic-ai/claude-code".to_string()
            );
        }

        // Build CLI arguments
        let mut args: Vec<String> = vec![
            "--print".to_string(),
            "--output-format".to_string(),
            "stream-json".to_string(),
            "--verbose".to_string(),
            "--dangerously-skip-permissions".to_string(),
        ];

        if let Some(ref sid) = params.session_id {
            args.push("--resume".to_string());
            args.push(sid.clone());  // session-id as positional arg after --resume
        }

        if let Some(ref sp) = params.system_prompt {
            args.push("--append-system-prompt".to_string());
            args.push(sp.clone());
        }

        if let Some(ref ws) = params.workspace {
            if !ws.is_empty() {
                args.push("--add-dir".to_string());
                args.push(ws.clone());
            }
        }

        args.push("--".to_string());
        args.push(params.message.clone());

        // Spawn CLI process — set working directory to workspace so relative paths work correctly
        let mut cmd = Command::new("claude");
        if let Some(ref ws) = params.workspace {
            if !ws.is_empty() {
                cmd.current_dir(ws);
            }
        }
        let mut child = cmd
            .args(&args)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn Claude CLI: {}", e))?;

        let stdout_handle = child.stdout.take()
            .ok_or_else(|| "Failed to get stdout handle".to_string())?;
        let stderr_handle = child.stderr.take()
            .ok_or_else(|| "Failed to get stderr handle".to_string())?;

        let (tx, rx) = std::sync::mpsc::channel();

        // Shared state for idle watchdog
        let last_active = Arc::new(AtomicU64::new(
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
        ));
        let process_done = Arc::new(AtomicBool::new(false));

        // --- stdout reader thread ---
        let tx_stdout = tx.clone();
        let last_active_stdout = last_active.clone();
        let process_done_stdout = process_done.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout_handle);
            let mut got_result = false; // Track if we received a "result" message
            for line in reader.lines() {
                match line {
                    Ok(text) => {
                        // Update activity timestamp for idle watchdog
                        last_active_stdout.store(
                            SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs(),
                            Ordering::Relaxed,
                        );

                        let trimmed = text.trim();
                        if trimmed.is_empty() { continue; }

                        // Try to parse as JSON (stream-json format)
                        match serde_json::from_str::<serde_json::Value>(trimmed) {
                            Ok(json_obj) => {
                                let msg_type = json_obj.get("type")
                                    .and_then(|t| t.as_str())
                                    .unwrap_or("unknown")
                                    .to_string();

                                let response_session_id = json_obj.get("session_id")
                                    .and_then(|s| s.as_str())
                                    .map(|s| s.to_string());

                                let is_result = msg_type == "result";
                                if is_result { got_result = true; }

                                // Extract text content based on message type
                                // --verbose stream-json format:
                                //   assistant: {"type":"assistant","message":{"content":[{"type":"text","text":"..."}]}}
                                //   result:    {"type":"result","subtype":"success","result":"..."}
                                //   system:    {"type":"system","subtype":"init",...}
                                // Non-verbose format:
                                //   assistant: {"type":"assistant","content":"..."}
                                fn extract_content_blocks(val: &serde_json::Value) -> String {
                                    if let Some(s) = val.as_str() {
                                        s.to_string()
                                    } else if let Some(arr) = val.as_array() {
                                        arr.iter()
                                            .filter_map(|item| {
                                                let item_type = item.get("type").and_then(|t| t.as_str()).unwrap_or("");
                                                match item_type {
                                                    "text" => {
                                                        item.get("text").and_then(|t| t.as_str()).map(|s| s.to_string())
                                                    }
                                                    "tool_use" => {
                                                        let name = item.get("name").and_then(|n| n.as_str()).unwrap_or("unknown");
                                                        let input_preview = item.get("input")
                                                            .and_then(|i| serde_json::to_string(i).ok())
                                                            .map(|s| {
                                                                let s = s.replace('\n', " ");
                                                                if s.len() > 100 { format!("{}...", &s[..100]) } else { s }
                                                            })
                                                            .unwrap_or_default();
                                                        Some(format!("[tool: {}] {}", name, input_preview))
                                                    }
                                                    _ => None
                                                }
                                            })
                                            .collect::<Vec<_>>()
                                            .join("\n")
                                    } else {
                                        String::new()
                                    }
                                }

                                let text = if msg_type == "assistant" {
                                    // --verbose: content is nested under "message" key
                                    if let Some(msg_obj) = json_obj.get("message") {
                                        msg_obj.get("content")
                                            .map(extract_content_blocks)
                                            .unwrap_or_default()
                                    } else {
                                        // non-verbose: content at top level
                                        json_obj.get("content")
                                            .map(extract_content_blocks)
                                            .unwrap_or_default()
                                    }
                                } else if is_result {
                                    String::new()
                                } else if msg_type == "system" {
                                    // Extract meaningful info from system messages
                                    let subtype = json_obj.get("subtype")
                                        .and_then(|s| s.as_str())
                                        .unwrap_or("");
                                    let tools_count = json_obj.get("tools")
                                        .and_then(|t| t.as_array())
                                        .map(|a| a.len())
                                        .unwrap_or(0);
                                    let model = json_obj.get("model")
                                        .and_then(|m| m.as_str())
                                        .unwrap_or("");
                                    if subtype == "init" && tools_count > 0 {
                                        format!("init — {} tools available{}", tools_count,
                                            if model.is_empty() { String::new() } else { format!(", model: {}", model) })
                                    } else if !subtype.is_empty() {
                                        format!("{}{}", subtype,
                                            if model.is_empty() { String::new() } else { format!(" — model: {}", model) })
                                    } else {
                                        String::new()
                                    }
                                } else {
                                    trimmed.to_string()
                                };

                                // Check for error in result messages
                                let error = if is_result {
                                    let subtype = json_obj.get("subtype")
                                        .and_then(|s| s.as_str())
                                        .unwrap_or("");
                                    if subtype == "error" {
                                        json_obj.get("error")
                                            .and_then(|e| e.as_str())
                                            .map(|s| s.to_string())
                                    } else {
                                        None
                                    }
                                } else {
                                    None
                                };

                                let event = StreamEvent {
                                    text,
                                    is_done: is_result,
                                    error,
                                    msg_type: Some(msg_type),
                                    session_id: response_session_id,
                                };

                                if tx_stdout.send(event).is_err() { break; }
                            }
                            Err(_) => {
                                // Non-JSON line, emit as raw text
                                let event = StreamEvent {
                                    text: trimmed.to_string(),
                                    is_done: false,
                                    error: None,
                                    msg_type: Some("raw".to_string()),
                                    session_id: None,
                                };
                                if tx_stdout.send(event).is_err() { break; }
                            }
                        }
                    }
                    Err(_) => break, // EOF
                }
            }

            // Mark process as done for idle watchdog
            process_done_stdout.store(true, Ordering::Relaxed);

            // Process exited — only send process_exit is_done if we never received a result.
            // If a result was received, the forwarding thread already broke on is_done=true,
            // and sending another is_done here would be a stale event for the next request.
            if !got_result {
                let _ = tx_stdout.send(StreamEvent {
                    text: String::new(),
                    is_done: true,
                    error: None,
                    msg_type: Some("process_exit".to_string()),
                    session_id: None,
                });
            }
        });

        // --- stderr reader thread ---
        let tx_stderr = tx.clone();
        let last_active_stderr = last_active.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr_handle);
            for line in reader.lines() {
                match line {
                    Ok(text) => {
                        let trimmed = text.trim();
                        if !trimmed.is_empty() {
                            // Update activity timestamp for idle watchdog
                            last_active_stderr.store(
                                SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs(),
                                Ordering::Relaxed,
                            );
                            // Log to server-side console for debugging
                            eprintln!("[ClaudeCodeRuntime] stderr: {}", trimmed);
                            let event = StreamEvent {
                                text: String::new(),
                                is_done: false,
                                error: Some(format!("CLI stderr: {}", trimmed)),
                                msg_type: Some("stderr".to_string()),
                                session_id: None,
                            };
                            if tx_stderr.send(event).is_err() { break; }
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        // --- idle watchdog thread ---
        // Instead of a fixed wall-clock timeout, uses an activity-based idle timeout.
        // As long as stdout/stderr keep producing data, the timer keeps resetting.
        // Only triggers timeout after `timeout_secs` of continuous silence.
        let idle_timeout_secs = params.timeout_secs;
        std::thread::spawn(move || {
            loop {
                std::thread::sleep(Duration::from_secs(5));

                // If process already exited, stop watchdog
                if process_done.load(Ordering::Relaxed) {
                    break;
                }

                let last = last_active.load(Ordering::Relaxed);
                let now_secs = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();

                if now_secs.saturating_sub(last) > idle_timeout_secs {
                    let _ = tx.send(StreamEvent {
                        text: String::new(),
                        is_done: true,
                        error: Some(format!(
                            "Timeout: no CLI output for {} seconds (idle timeout)",
                            idle_timeout_secs
                        )),
                        msg_type: Some("timeout".to_string()),
                        session_id: None,
                    });
                    break;
                }
            }
        });

        Ok(rx)
    }
}

/// OpenAI Codex CLI runtime implementation.
struct CodexRuntime;

impl CodexRuntime {
    fn new() -> Self {
        Self
    }
}

impl AgentRuntime for CodexRuntime {
    fn id(&self) -> &str { "codex" }
    fn name(&self) -> &str { "OpenAI Codex CLI" }
    fn runtime_type(&self) -> &str { "cli" }

    fn capabilities(&self) -> Vec<AgentCapability> {
        vec![
            AgentCapability::Streaming,
            AgentCapability::ToolUse,
            AgentCapability::StructuredOutput,
        ]
    }

    fn install_hint(&self) -> String {
        "npm install -g @openai/codex".to_string()
    }

    fn detect(&self) -> Result<Option<(String, String)>, String> {
        let path = RuntimeDetector::find_command("codex");
        match path {
            Some(p) => {
                let version = RuntimeDetector::get_version("codex")
                    .unwrap_or_else(|| "unknown".to_string());
                Ok(Some((p, version)))
            }
            None => Ok(None),
        }
    }

    fn health_check(&self) -> AgentRuntimeStatus {
        match self.detect() {
            Ok(Some(_)) => AgentRuntimeStatus::Available,
            _ => AgentRuntimeStatus::Unhealthy,
        }
    }

    fn info(&self) -> AgentRuntimeInfo {
        match self.detect() {
            Ok(Some((path, version))) => AgentRuntimeInfo {
                id: self.id().to_string(),
                name: self.name().to_string(),
                runtime_type: self.runtime_type().to_string(),
                status: AgentRuntimeStatus::Available,
                version: Some(version),
                install_path: Some(path),
                capabilities: self.capabilities(),
                install_hint: self.install_hint(),
            },
            _ => AgentRuntimeInfo {
                id: self.id().to_string(),
                name: self.name().to_string(),
                runtime_type: self.runtime_type().to_string(),
                status: AgentRuntimeStatus::NotInstalled,
                version: None,
                install_path: None,
                capabilities: self.capabilities(),
                install_hint: self.install_hint(),
            },
        }
    }

    fn is_ready(&self) -> bool {
        matches!(self.health_check(), AgentRuntimeStatus::Available)
    }

    fn execute(&self, _params: ExecuteParams) -> Result<std::sync::mpsc::Receiver<StreamEvent>, String> {
        Err("Codex runtime execute() is not yet implemented".to_string())
    }
}

// ===========================================================================
// GeminiHttpRuntime (feat-agent-gemini-bridge)
// ===========================================================================

const GEMINI_API_URL: &str = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_DEFAULT_MODEL: &str = "gemini-2.0-flash";

/// HTTP-based runtime that calls the Google Gemini API directly via SSE streaming.
/// Used by the PM Agent (and any other agent that needs Gemini without a local CLI).
struct GeminiHttpRuntime {
    model: String,
}

impl GeminiHttpRuntime {
    fn new() -> Self {
        Self {
            model: GEMINI_DEFAULT_MODEL.to_string(),
        }
    }

    fn new_with_model(model: String) -> Self {
        Self { model }
    }
}

impl AgentRuntime for GeminiHttpRuntime {
    fn id(&self) -> &str { "gemini-http" }
    fn name(&self) -> &str { "Gemini HTTP" }
    fn runtime_type(&self) -> &str { "http" }

    fn capabilities(&self) -> Vec<AgentCapability> {
        vec![
            AgentCapability::Streaming,
            AgentCapability::StructuredOutput,
        ]
    }

    fn install_hint(&self) -> String {
        "Configure Gemini API Key in Settings".to_string()
    }

    /// Detect: check if a Gemini API key is configured in the keyring.
    fn detect(&self) -> Result<Option<(String, String)>, String> {
        match get_api_key_inner() {
            Ok(_) => Ok(Some(("keyring".to_string(), "configured".to_string()))),
            Err(_) => Ok(None),
        }
    }

    /// Health check: verify the API key is present and valid by making a lightweight request.
    fn health_check(&self) -> AgentRuntimeStatus {
        match get_api_key_inner() {
            Ok(_) => {
                // Key exists — mark as Available.
                // A full health check would call the API, but we keep it lightweight
                // to avoid unnecessary network latency during scan_all().
                AgentRuntimeStatus::Available
            }
            Err(_) => AgentRuntimeStatus::NotInstalled,
        }
    }

    fn info(&self) -> AgentRuntimeInfo {
        let has_key = get_api_key_inner().is_ok();
        AgentRuntimeInfo {
            id: self.id().to_string(),
            name: self.name().to_string(),
            runtime_type: self.runtime_type().to_string(),
            status: if has_key { AgentRuntimeStatus::Available } else { AgentRuntimeStatus::NotInstalled },
            version: None,
            install_path: None,
            capabilities: self.capabilities(),
            install_hint: self.install_hint(),
        }
    }

    fn is_ready(&self) -> bool {
        matches!(self.health_check(), AgentRuntimeStatus::Available)
    }

    /// Execute: send a message to the Gemini API and stream the response back
    /// via a std::sync::mpsc channel as StreamEvents.
    fn execute(&self, params: ExecuteParams) -> Result<std::sync::mpsc::Receiver<StreamEvent>, String> {
        let api_key = get_api_key_inner()
            .map_err(|e| format!("API Key 未配置: {}. 请在 Settings 中设置 Gemini API Key。", e))?;

        let (tx, rx) = std::sync::mpsc::channel();

        let model = self.model.clone();
        let system_prompt_text = params.system_prompt.clone();
        let user_message = params.message.clone();

        std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();

            rt.block_on(async move {
                let client = reqwest::Client::new();

                // Build messages payload
                let mut messages_payload = Vec::new();

                // System prompt (from params or default PM system prompt)
                if let Some(sp) = &system_prompt_text {
                    if !sp.is_empty() {
                        messages_payload.push(serde_json::json!({
                            "role": "system",
                            "content": sp
                        }));
                    }
                }

                // Parse user message — it may contain a JSON-encoded messages array
                // from the PM Agent frontend, or it may be a plain string.
                // We try to parse as Vec<ChatMessage> first, then fall back to single message.
                if let Ok(chat_msgs) = serde_json::from_str::<Vec<ChatMessage>>(&user_message) {
                    for msg in &chat_msgs {
                        messages_payload.push(serde_json::json!({
                            "role": msg.role,
                            "content": msg.content
                        }));
                    }
                } else {
                    messages_payload.push(serde_json::json!({
                        "role": "user",
                        "content": user_message
                    }));
                }

                let body = serde_json::json!({
                    "model": model,
                    "messages": messages_payload,
                    "stream": true
                });

                let response = match client
                    .post(GEMINI_API_URL)
                    .header("Authorization", format!("Bearer {}", api_key))
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
                    .await
                {
                    Ok(r) => r,
                    Err(e) => {
                        let _ = tx.send(StreamEvent {
                            text: String::new(),
                            is_done: true,
                            error: Some(format!("连接 AI API 失败: {}", e)),
                            msg_type: Some("error".to_string()),
                            session_id: None,
                        });
                        return;
                    }
                };

                if !response.status().is_success() {
                    let status = response.status();
                    let error_body = response.text().await.unwrap_or_else(|_| "Unknown error".into());
                    let _ = tx.send(StreamEvent {
                        text: String::new(),
                        is_done: true,
                        error: Some(format!("AI API 错误 ({}): {}", status, error_body)),
                        msg_type: Some("error".to_string()),
                        session_id: None,
                    });
                    return;
                }

                let mut stream = response.bytes_stream();
                let mut buffer = String::new();

                while let Some(chunk_result) = stream.next().await {
                    match chunk_result {
                        Ok(bytes) => {
                            let text = String::from_utf8_lossy(&bytes);
                            buffer.push_str(&text);

                            // Process complete SSE lines
                            while let Some(pos) = buffer.find('\n') {
                                let line = buffer[..pos].trim().to_string();
                                buffer = buffer[pos + 1..].to_string();

                                if line.starts_with("data: ") {
                                    let data = &line[6..];
                                    if data == "[DONE]" {
                                        let _ = tx.send(StreamEvent {
                                            text: String::new(),
                                            is_done: true,
                                            error: None,
                                            msg_type: Some("assistant".to_string()),
                                            session_id: None,
                                        });
                                        return;
                                    }

                                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                                        if let Some(choices) = parsed.get("choices") {
                                            if let Some(first_choice) = choices.as_array().and_then(|a| a.first()) {
                                                if let Some(delta) = first_choice.get("delta") {
                                                    if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                                                        let _ = tx.send(StreamEvent {
                                                            text: content.to_string(),
                                                            is_done: false,
                                                            error: None,
                                                            msg_type: Some("assistant".to_string()),
                                                            session_id: None,
                                                        });
                                                    }
                                                }
                                                if let Some(finish) = first_choice.get("finish_reason") {
                                                    if finish.as_str() == Some("stop") {
                                                        let _ = tx.send(StreamEvent {
                                                            text: String::new(),
                                                            is_done: true,
                                                            error: None,
                                                            msg_type: Some("assistant".to_string()),
                                                            session_id: None,
                                                        });
                                                        return;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            let _ = tx.send(StreamEvent {
                                text: String::new(),
                                is_done: true,
                                error: Some(format!("Stream 错误: {}", e)),
                                msg_type: Some("error".to_string()),
                                session_id: None,
                            });
                            return;
                        }
                    }
                }

                // Stream ended without [DONE] marker
                let _ = tx.send(StreamEvent {
                    text: String::new(),
                    is_done: true,
                    error: None,
                    msg_type: Some("assistant".to_string()),
                    session_id: None,
                });
            });
        });

        Ok(rx)
    }
}

/// Helper to create the default registry with all known runtimes registered.
fn create_default_registry() -> RuntimeRegistry {
    let mut registry = RuntimeRegistry::new();
    registry.register(Box::new(ClaudeCodeRuntime::new()));
    registry.register(Box::new(CodexRuntime::new()));
    registry.register(Box::new(GeminiHttpRuntime::new()));
    registry
}

// ===========================================================================
// Smart Routing Engine (feat-agent-runtime-router)
// ===========================================================================

/// Categories of tasks the router can classify.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum TaskCategory {
    CodeGeneration,
    CodeReview,
    Requirements,
    Testing,
    General,
}

impl TaskCategory {
    fn label(&self) -> &str {
        match self {
            TaskCategory::CodeGeneration => "代码生成",
            TaskCategory::CodeReview => "代码审查",
            TaskCategory::Requirements => "需求分析",
            TaskCategory::Testing => "测试编写",
            TaskCategory::General => "通用",
        }
    }
}

/// A single routing rule mapping a task category to a preferred runtime.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RoutingRule {
    /// The task category this rule applies to.
    pub category: TaskCategory,
    /// Preferred runtime id (e.g. "claude-code", "codex").
    pub runtime_id: String,
    /// Priority for this rule (lower = higher priority within same category).
    #[serde(default)]
    pub priority: u32,
    /// Ordered list of fallback runtime ids.
    #[serde(default)]
    pub fallback_chain: Vec<String>,
}

/// Result of a routing decision for a submitted task.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RoutingDecision {
    /// Unique id for this routing decision.
    pub decision_id: String,
    /// The classified task category.
    pub category: TaskCategory,
    /// Category label in Chinese.
    pub category_label: String,
    /// The selected runtime id.
    pub selected_runtime: String,
    /// Whether a fallback was applied.
    pub fallback_used: bool,
    /// If fallback was used, the original preferred runtime.
    pub original_preference: Option<String>,
    /// Reason for the routing choice.
    pub reason: String,
    /// Timestamp of the decision.
    pub timestamp: String,
}

/// Configuration file for routing rules (stored as YAML).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RoutingConfig {
    /// List of routing rules.
    pub rules: Vec<RoutingRule>,
    /// Default runtime id when no rule matches.
    pub default_runtime: String,
    /// Default fallback chain when no rule-specific fallback is defined.
    #[serde(default)]
    pub default_fallback_chain: Vec<String>,
}

/// Log entry for fallback events.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FallbackLogEntry {
    /// Task description (truncated).
    pub task_summary: String,
    /// Original preferred runtime.
    pub from_runtime: String,
    /// Fallback target runtime.
    pub to_runtime: String,
    /// Reason for fallback.
    pub reason: String,
    /// Timestamp.
    pub timestamp: String,
}

// ---------------------------------------------------------------------------
// Task Classifier
// ---------------------------------------------------------------------------

/// Classifies a task description into a TaskCategory using keyword matching.
struct TaskClassifier;

impl TaskClassifier {
    /// Classify a task description into a category.
    fn classify(task_description: &str) -> TaskCategory {
        let lower = task_description.to_lowercase();

        // Code generation patterns
        let code_gen_patterns = [
            "写", "实现", "生成", "创建", "添加", "编写", "开发",
            "build", "write", "create", "implement", "generate", "add",
            "code", "function", "class", "module", "component",
            "排序", "算法", "帮我写", "帮我做",
        ];
        if code_gen_patterns.iter().any(|p| lower.contains(p)) {
            // Distinguish testing tasks
            let test_patterns = ["测试", "test", "spec", "unit test", "集成测试"];
            if test_patterns.iter().any(|p| lower.contains(p)) {
                return TaskCategory::Testing;
            }
            return TaskCategory::CodeGeneration;
        }

        // Code review patterns
        let review_patterns = [
            "审查", "review", "检查", "优化", "重构", "改进", "改善",
            "refactor", "optimize", "improve", "check", "inspect",
            "代码质量", "performance",
        ];
        if review_patterns.iter().any(|p| lower.contains(p)) {
            return TaskCategory::CodeReview;
        }

        // Requirements analysis patterns
        let req_patterns = [
            "需求", "requirement", "分析", "analyze", "规划", "plan",
            "设计", "design", "架构", "architecture", "方案", "方案",
        ];
        if req_patterns.iter().any(|p| lower.contains(p)) {
            return TaskCategory::Requirements;
        }

        // Testing patterns
        let test_patterns = [
            "测试", "test", "spec", "单元测试", "e2e", "集成测试",
            "覆盖率", "coverage", "mock", "stub",
        ];
        if test_patterns.iter().any(|p| lower.contains(p)) {
            return TaskCategory::Testing;
        }

        TaskCategory::General
    }
}

// ---------------------------------------------------------------------------
// Router Engine
// ---------------------------------------------------------------------------

/// The smart routing engine that classifies tasks and selects the best runtime.
struct RouterEngine {
    /// The loaded routing configuration.
    config: RoutingConfig,
    /// History of routing decisions.
    decision_history: Vec<RoutingDecision>,
    /// Fallback event log.
    fallback_log: Vec<FallbackLogEntry>,
}

impl RouterEngine {
    fn new(config: RoutingConfig) -> Self {
        Self {
            config,
            decision_history: Vec::new(),
            fallback_log: Vec::new(),
        }
    }

    /// Create with sensible default routing rules.
    fn with_defaults() -> Self {
        Self::new(Self::default_config())
    }

    /// Generate the default routing configuration.
    fn default_config() -> RoutingConfig {
        RoutingConfig {
            rules: vec![
                RoutingRule {
                    category: TaskCategory::CodeGeneration,
                    runtime_id: "codex".to_string(),
                    priority: 1,
                    fallback_chain: vec!["claude-code".to_string()],
                },
                RoutingRule {
                    category: TaskCategory::CodeReview,
                    runtime_id: "claude-code".to_string(),
                    priority: 1,
                    fallback_chain: vec!["codex".to_string()],
                },
                RoutingRule {
                    category: TaskCategory::Requirements,
                    runtime_id: "claude-code".to_string(),
                    priority: 1,
                    fallback_chain: vec!["codex".to_string()],
                },
                RoutingRule {
                    category: TaskCategory::Testing,
                    runtime_id: "codex".to_string(),
                    priority: 1,
                    fallback_chain: vec!["claude-code".to_string()],
                },
                RoutingRule {
                    category: TaskCategory::General,
                    runtime_id: "claude-code".to_string(),
                    priority: 1,
                    fallback_chain: vec!["codex".to_string()],
                },
            ],
            default_runtime: "claude-code".to_string(),
            default_fallback_chain: vec!["codex".to_string()],
        }
    }

    /// Route a task: classify it and select the best available runtime.
    /// Returns a RoutingDecision with the chosen runtime.
    fn route(
        &mut self,
        task_description: &str,
        available_runtimes: &[AgentRuntimeInfo],
    ) -> RoutingDecision {
        let category = TaskClassifier::classify(task_description);
        let timestamp = chrono::Utc::now().to_rfc3339();

        // Build a set of available runtime ids for quick lookup
        let available_ids: std::collections::HashSet<&str> = available_runtimes
            .iter()
            .filter(|r| r.status == AgentRuntimeStatus::Available)
            .map(|r| r.id.as_str())
            .collect();

        // Find the matching rule
        let rule = self.config.rules.iter()
            .filter(|r| r.category == category)
            .min_by_key(|r| r.priority);

        let (selected, fallback_used, original_pref, reason) = if let Some(rule) = rule {
            // Try the primary runtime first
            if available_ids.contains(rule.runtime_id.as_str()) {
                (rule.runtime_id.clone(), false, None,
                 format!("任务分类为「{}」，按规则首选 {}", category.label(), rule.runtime_id))
            } else {
                // Try fallback chain
                let mut found = None;
                for fb_id in &rule.fallback_chain {
                    if available_ids.contains(fb_id.as_str()) {
                        found = Some(fb_id.clone());
                        break;
                    }
                }
                if let Some(fb) = found {
                    // Log fallback
                    self.fallback_log.push(FallbackLogEntry {
                        task_summary: Self::truncate_task(task_description),
                        from_runtime: rule.runtime_id.clone(),
                        to_runtime: fb.clone(),
                        reason: format!("{} 不可用", rule.runtime_id),
                        timestamp: timestamp.clone(),
                    });
                    (fb.clone(), true, Some(rule.runtime_id.clone()),
                     format!("任务分类为「{}」，首选 {} 不可用，fallback 到 {}",
                             category.label(), rule.runtime_id, fb))
                } else {
                    // Last resort: try any available runtime
                    if let Some(any) = available_ids.iter().next() {
                        (any.to_string(), true, Some(rule.runtime_id.clone()),
                         format!("任务分类为「{}」，首选和备选均不可用，随机选择可用 runtime {}",
                                 category.label(), any))
                    } else {
                        (rule.runtime_id.clone(), false, None,
                         format!("任务分类为「{}」，无可用 runtime，返回首选 {}（将失败）",
                                 category.label(), rule.runtime_id))
                    }
                }
            }
        } else {
            // No matching rule, use default runtime
            if available_ids.contains(self.config.default_runtime.as_str()) {
                (self.config.default_runtime.clone(), false, None,
                 format!("任务分类为「{}」，无匹配规则，使用默认 runtime {}",
                         category.label(), self.config.default_runtime))
            } else {
                // Try default fallback chain
                let mut found = None;
                for fb_id in &self.config.default_fallback_chain {
                    if available_ids.contains(fb_id.as_str()) {
                        found = Some(fb_id.clone());
                        break;
                    }
                }
                if let Some(fb) = found {
                    (fb.clone(), true, Some(self.config.default_runtime.clone()),
                     format!("任务分类为「{}」，默认 runtime 不可用，fallback 到 {}",
                             category.label(), fb))
                } else {
                    (self.config.default_runtime.clone(), false, None,
                     format!("任务分类为「{}」，无可用 runtime", category.label()))
                }
            }
        };

        let decision = RoutingDecision {
            decision_id: Uuid::new_v4().to_string(),
            category: category.clone(),
            category_label: category.label().to_string(),
            selected_runtime: selected,
            fallback_used,
            original_preference: original_pref,
            reason,
            timestamp,
        };

        self.decision_history.push(decision.clone());
        decision
    }

    /// Validate routing config against registered runtimes.
    /// Returns a list of warnings for rules referencing unknown runtimes.
    fn validate_config(&self, config: &RoutingConfig, known_runtime_ids: &[String]) -> Vec<String> {
        let known: std::collections::HashSet<&str> = known_runtime_ids.iter()
            .map(|s| s.as_str())
            .collect();
        let mut warnings = Vec::new();

        for rule in &config.rules {
            if !known.contains(rule.runtime_id.as_str()) {
                warnings.push(format!(
                    "规则「{:?}」引用了未注册的 runtime: {}",
                    rule.category, rule.runtime_id
                ));
            }
            for fb in &rule.fallback_chain {
                if !known.contains(fb.as_str()) {
                    warnings.push(format!(
                        "规则「{:?}」的 fallback 链引用了未注册的 runtime: {}",
                        rule.category, fb
                    ));
                }
            }
        }
        if !known.contains(config.default_runtime.as_str()) {
            warnings.push(format!(
                "默认 runtime 未注册: {}", config.default_runtime
            ));
        }

        warnings
    }

    /// Update the routing configuration.
    fn update_config(&mut self, config: RoutingConfig) {
        self.config = config;
    }

    /// Get the current routing config.
    fn get_config(&self) -> &RoutingConfig {
        &self.config
    }

    /// Get recent routing decisions.
    fn get_decisions(&self, limit: usize) -> &[RoutingDecision] {
        let start = self.decision_history.len().saturating_sub(limit);
        &self.decision_history[start..]
    }

    /// Get fallback log entries.
    fn get_fallback_log(&self, limit: usize) -> &[FallbackLogEntry] {
        let start = self.fallback_log.len().saturating_sub(limit);
        &self.fallback_log[start..]
    }

    /// Truncate task description for logging.
    fn truncate_task(task: &str) -> String {
        if task.len() > 80 {
            format!("{}...", &task[..80])
        } else {
            task.to_string()
        }
    }
}

// ---------------------------------------------------------------------------
// Routing config persistence (YAML)
// ---------------------------------------------------------------------------

/// File name for routing config.
const ROUTING_CONFIG_FILENAME: &str = "routing-config.yaml";

/// Load routing config from the workspace directory, or return defaults.
fn load_routing_config(workspace_path: &str) -> RoutingConfig {
    let config_path = PathBuf::from(workspace_path).join(".neuro").join(ROUTING_CONFIG_FILENAME);
    if config_path.exists() {
        match fs::read_to_string(&config_path) {
            Ok(content) => {
                match serde_yaml::from_str::<RoutingConfig>(&content) {
                    Ok(config) => return config,
                    Err(e) => {
                        eprintln!("Failed to parse routing config: {}, using defaults", e);
                    }
                }
            }
            Err(e) => {
                eprintln!("Failed to read routing config: {}, using defaults", e);
            }
        }
    }
    RouterEngine::default_config()
}

/// Save routing config to the workspace directory.
fn save_routing_config(workspace_path: &str, config: &RoutingConfig) -> Result<(), String> {
    let neuro_dir = PathBuf::from(workspace_path).join(".neuro");
    fs::create_dir_all(&neuro_dir).map_err(|e| format!("Failed to create .neuro dir: {}", e))?;
    let config_path = neuro_dir.join(ROUTING_CONFIG_FILENAME);
    let yaml = serde_yaml::to_string(config).map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&config_path, yaml).map_err(|e| format!("Failed to write config: {}", e))?;
    Ok(())
}

// ===========================================================================
// Pty management
// ===========================================================================

struct PtyInstance {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn IoWrite + Send>,
}

struct PtyManager {
    instances: HashMap<String, PtyInstance>,
}

impl PtyManager {
    fn new() -> Self {
        Self { instances: HashMap::new() }
    }

    fn create(
        &mut self,
        pty_id: String,
        config: &PtyConfig,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let pty_system = native_pty_system();
        let size = PtySize {
            rows: config.rows,
            cols: config.cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = pty_system
            .openpty(size)
            .map_err(|e| format!("Failed to open pty: {}", e))?;

        let mut cmd = CommandBuilder::new(&config.shell);
        if !config.args.is_empty() {
            cmd.args(&config.args);
        }

        // Set working directory if provided
        if let Some(ref cwd) = config.cwd {
            if !cwd.is_empty() {
                let cwd_path = PathBuf::from(cwd);
                if cwd_path.is_dir() {
                    cmd.cwd(cwd_path);
                }
            }
        }

        let _child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn command: {}", e))?;

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone reader: {}", e))?;

        // Take the writer once and store it persistently — `take_writer()` can
        // only be called once per portable-pty instance, so we must keep it alive.
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to get writer: {}", e))?;

        let emit_id = pty_id.clone();
        let ah = app_handle.clone();
        std::thread::spawn(move || {
            // Use BufReader for efficient buffering, but read raw chunks via
            // `read()` instead of `lines()`.  The old `lines()` iterator only
            // yields on `\n`, which means prompts, spinners, and other
            // interactive output that doesn't end with a newline get stuck in
            // the buffer and never reach the frontend.
            let mut reader = BufReader::new(reader);
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break, // EOF — child process exited
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]);
                        let payload = PtyOutputEvent {
                            pty_id: emit_id.clone(),
                            data: data.to_string(),
                        };
                        let _ = ah.emit("pty-out", &payload);
                    }
                    Err(_) => break,
                }
            }
            let payload = PtyOutputEvent {
                pty_id: emit_id.clone(),
                data: String::new(),
            };
            let _ = ah.emit("pty-closed", &payload);
        });

        self.instances.insert(pty_id, PtyInstance { master: pair.master, writer });
        Ok(())
    }

    fn write(&mut self, pty_id: &str, data: &str) -> Result<(), String> {
        if let Some(instance) = self.instances.get_mut(pty_id) {
            instance.writer.write_all(data.as_bytes())
                .map_err(|e| format!("Failed to write: {}", e))?;
            instance.writer.flush()
                .map_err(|e| format!("Failed to flush: {}", e))?;
            Ok(())
        } else {
            Err(format!("Pty '{}' not found", pty_id))
        }
    }

    fn resize(&mut self, pty_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        if let Some(instance) = self.instances.get_mut(pty_id) {
            instance.master
                .resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
                .map_err(|e| format!("Failed to resize: {}", e))?;
            Ok(())
        } else {
            Err(format!("Pty '{}' not found", pty_id))
        }
    }

    fn kill(&mut self, pty_id: &str) -> Result<(), String> {
        self.instances
            .remove(pty_id)
            .ok_or_else(|| format!("Pty '{}' not found", pty_id))?;
        Ok(())
    }
}

// ===========================================================================
// Application state
// ===========================================================================

struct AppState {
    pty_manager: Mutex<PtyManager>,
    workspace_path: Mutex<String>,
    fs_watcher: Mutex<Option<RecommendedWatcher>>,
    hw_monitor_stop: Mutex<Option<std::sync::mpsc::Sender<()>>>,
    /// Runtime process monitor stop channel (feat-claude-code-runtime-monitor)
    runtime_monitor_stop: Mutex<Option<std::sync::mpsc::Sender<()>>>,
    req_agent: Mutex<ReqAgentState>,
    /// Agent runtime registry (feat-agent-runtime-core)
    agent_runtime_registry: Mutex<RuntimeRegistry>,
    /// Smart routing engine (feat-agent-runtime-router)
    router_engine: Mutex<RouterEngine>,
    /// Session output buffer: session_id -> Vec<StreamEvent> (feat-runtime-session-output)
    session_output: Arc<Mutex<HashMap<String, Vec<StreamEvent>>>>,
    /// Currently active session id (feat-runtime-session-output)
    /// Kept for backward compatibility; active_sessions is the primary source (feat-runtime-output-polish)
    active_session_id: Mutex<Option<String>>,
    /// Per-runtime active session tracking: runtime_id -> session_id (feat-runtime-output-polish)
    active_sessions: Mutex<HashMap<String, String>>,
}

// ===========================================================================
// Tauri commands - File system
// ===========================================================================

#[tauri::command]
async fn pick_workspace(app: AppHandle, state: tauri::State<'_, AppState>) -> Result<WorkspaceResult, String> {
    use tauri_plugin_dialog::DialogExt;
    let picked = app
        .dialog()
        .file()
        .set_title("Select Project Workspace")
        .blocking_pick_folder();

    match picked {
        Some(file_path) => {
            let path_str = file_path.to_string();
            let dir = PathBuf::from(&path_str);
            let valid = dir.is_dir();

            // Store workspace path in app state for FS-as-Database commands
            *state.workspace_path.lock().map_err(|e| e.to_string())? = path_str.clone();

            if let Err(e) = persist_workspace(&app, &path_str) {
                return Ok(WorkspaceResult {
                    path: path_str,
                    valid,
                    error: Some(format!("Failed to persist workspace: {}", e)),
                });
            }

            // Auto-start FS watcher for the new workspace
            if valid {
                let _ = start_fs_watcher(tauri::State::clone(&state), app.clone()).await;
            }

            Ok(WorkspaceResult { path: path_str, valid, error: None })
        }
        None => Ok(WorkspaceResult {
            path: String::new(),
            valid: false,
            error: Some("User cancelled folder selection".into()),
        }),
    }
}

#[tauri::command]
async fn get_stored_workspace(app: AppHandle, state: tauri::State<'_, AppState>) -> Result<WorkspaceResult, String> {
    let store = get_store(&app)?;

    if let Some(value) = store.get(STORE_KEY_WORKSPACE) {
        let path_str = value.as_str().unwrap_or_default().to_string();
        if path_str.is_empty() {
            return Ok(WorkspaceResult { path: String::new(), valid: false, error: None });
        }

        let dir = PathBuf::from(&path_str);
        let valid = dir.exists() && dir.is_dir();

        // Restore workspace path in app state
        if valid {
            *state.workspace_path.lock().map_err(|e| e.to_string())? = path_str.clone();
            let _ = start_fs_watcher(tauri::State::clone(&state), app.clone()).await;
        }

        Ok(WorkspaceResult {
            path: path_str,
            valid,
            error: if valid { None } else { Some("Stored workspace path no longer exists".into()) },
        })
    } else {
        Ok(WorkspaceResult { path: String::new(), valid: false, error: None })
    }
}

#[tauri::command]
async fn read_file_tree(path: String) -> Result<Vec<FileNode>, String> {
    let root = PathBuf::from(&path);
    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !root.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }
    scan_dir(&root, 0).map_err(|e| format!("Failed to read file tree: {}", e))
}

// ===========================================================================
// Tauri commands - Pty terminal
// ===========================================================================

#[tauri::command]
fn create_pty(
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>,
    config: PtyConfig,
) -> Result<String, String> {
    let pty_id = Uuid::new_v4().to_string();
    let mut manager = state.pty_manager.lock().map_err(|e| e.to_string())?;
    manager.create(pty_id.clone(), &config, app_handle)?;
    Ok(pty_id)
}

#[tauri::command]
fn write_to_pty(
    state: tauri::State<'_, AppState>,
    pty_id: String,
    data: String,
) -> Result<(), String> {
    let mut manager = state.pty_manager.lock().map_err(|e| e.to_string())?;
    manager.write(&pty_id, &data)
}

#[tauri::command]
fn resize_pty(
    state: tauri::State<'_, AppState>,
    pty_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let mut manager = state.pty_manager.lock().map_err(|e| e.to_string())?;
    manager.resize(&pty_id, cols, rows)
}

#[tauri::command]
fn kill_pty(
    state: tauri::State<'_, AppState>,
    pty_id: String,
) -> Result<(), String> {
    let mut manager = state.pty_manager.lock().map_err(|e| e.to_string())?;
    manager.kill(&pty_id)
}

// ===========================================================================
// Tauri commands - FS-as-Database
// ===========================================================================

/// Fetch the full queue state by parsing queue.yaml + scanning features/ dir.
#[tauri::command]
async fn fetch_queue_state(
    state: tauri::State<'_, AppState>,
) -> Result<QueueState, String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded. Please select a workspace first.".into());
    }

    let queue_yaml_path = PathBuf::from(&workspace)
        .join("feature-workflow")
        .join("queue.yaml");

    let content = fs::read_to_string(&queue_yaml_path)
        .map_err(|e| format!("Failed to read queue.yaml: {}", e))?;

    let mut queue: QueueYaml = serde_yaml::from_str(&content)
        .map_err(|e| format!("Failed to parse queue.yaml: {}", e))?;

    // Enrich each feature node with details from its directory
    let features_dir = PathBuf::from(&workspace).join("features");

    let enrich = |node: &mut FeatureNode| {
        let dir_name = format!("pending-{}", node.id);
        // Check both pending- and active- prefixes, plus bare id
        let candidates = [
            dir_name.clone(),
            format!("active-{}", node.id),
            node.id.clone(),
        ];
        for candidate in &candidates {
            let feat_dir = features_dir.join(candidate);
            if feat_dir.is_dir() {
                // Read spec.md as description
                let spec_path = feat_dir.join("spec.md");
                if spec_path.exists() {
                    if let Ok(spec_content) = fs::read_to_string(&spec_path) {
                        // Extract first paragraph as description
                        let desc = spec_content
                            .lines()
                            .skip_while(|l| l.trim().is_empty() || l.starts_with('#'))
                            .take_while(|l| !l.trim().is_empty())
                            .collect::<Vec<_>>()
                            .join(" ");
                        node.details = Some(FeatureDetails {
                            status: "loaded".into(),
                            description: if desc.is_empty() { None } else { Some(desc) },
                            plan: Some(spec_content),
                        });
                    }
                }
                // Read task.md for status
                let task_path = feat_dir.join("task.md");
                if task_path.exists() {
                    if let Ok(task_content) = fs::read_to_string(&task_path) {
                        let completed = task_content.lines().filter(|l| l.starts_with("- [x]")).count();
                        let total = task_content.lines().filter(|l| l.starts_with("- [") && (l.contains("[x]") || l.contains("[ ]"))).count();
                        if total > 0 {
                            if let Some(ref mut details) = node.details {
                                details.status = format!("{}/{}", completed, total);
                            } else {
                                node.details = Some(FeatureDetails {
                                    status: format!("{}/{}", completed, total),
                                    description: None,
                                    plan: None,
                                });
                            }
                        }
                    }
                }
                break;
            }
        }
    };

    for node in &mut queue.active { enrich(node); }
    for node in &mut queue.pending { enrich(node); }
    for node in &mut queue.blocked { enrich(node); }
    for node in &mut queue.completed { enrich(node); }

    Ok(QueueState {
        meta: queue.meta,
        parents: queue.parents,
        active: queue.active,
        pending: queue.pending,
        blocked: queue.blocked,
        completed: queue.completed,
    })
}

/// Update a feature's queue status by modifying queue.yaml.
#[tauri::command]
async fn update_task_status(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
    task_id: String,
    target_queue: String,
) -> Result<(), String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let queue_yaml_path = PathBuf::from(&workspace)
        .join("feature-workflow")
        .join("queue.yaml");

    let content = fs::read_to_string(&queue_yaml_path)
        .map_err(|e| format!("Failed to read queue.yaml: {}", e))?;

    let mut queue: QueueYaml = serde_yaml::from_str(&content)
        .map_err(|e| format!("Failed to parse queue.yaml: {}", e))?;

    // Find and remove from current queue
    let mut found: Option<FeatureNode> = None;

    let queues: Vec<&mut Vec<FeatureNode>> = vec![
        &mut queue.active,
        &mut queue.pending,
        &mut queue.blocked,
        &mut queue.completed,
    ];

    for q in queues {
        if let Some(pos) = q.iter().position(|n| n.id == task_id) {
            found = Some(q.remove(pos));
            break;
        }
    }

    let mut node = found.ok_or_else(|| format!("Feature '{}' not found in any queue", task_id))?;

    // Update timestamps for completed
    if target_queue == "completed" {
        node.completed_at = Some(chrono::Utc::now().to_rfc3339());
        node.tag = Some(format!("{}-{}", node.id, chrono::Utc::now().format("%Y%m%d")));
    }

    // Insert into target queue
    match target_queue.as_str() {
        "active" => queue.active.push(node),
        "pending" => queue.pending.push(node),
        "blocked" => queue.blocked.push(node),
        "completed" => queue.completed.push(node),
        other => return Err(format!("Unknown target queue: {}", other)),
    }

    // Update meta timestamp
    queue.meta.last_updated = chrono::Utc::now().to_rfc3339();

    // Atomic write: write to temp file then rename
    let temp_path = queue_yaml_path.with_extension("yaml.tmp");
    let yaml_str = serde_yaml::to_string(&queue)
        .map_err(|e| format!("Failed to serialize queue.yaml: {}", e))?;

    fs::write(&temp_path, &yaml_str)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    fs::rename(&temp_path, &queue_yaml_path)
        .map_err(|e| format!("Failed to rename temp to queue.yaml: {}", e))?;

    // Broadcast change
    let _ = app.emit("fs://workspace-changed", FsChangeEvent {
        paths: vec![queue_yaml_path.to_string_lossy().to_string()],
        kind: "queue-update".into(),
    });

    Ok(())
}

/// Read a single feature's detail (spec.md, task.md, checklist.md).
#[tauri::command]
async fn read_feature_detail(
    state: tauri::State<'_, AppState>,
    feature_id: String,
) -> Result<HashMap<String, String>, String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let features_dir = PathBuf::from(&workspace).join("features");

    // Search for the feature directory
    let candidates = [
        format!("pending-{}", feature_id),
        format!("active-{}", feature_id),
        feature_id.clone(),
    ];

    let mut feat_dir: Option<PathBuf> = None;
    for candidate in &candidates {
        let d = features_dir.join(candidate);
        if d.is_dir() {
            feat_dir = Some(d);
            break;
        }
    }

    // Fallback: search archive directory for done-{id}-* pattern or exact {id} match
    if feat_dir.is_none() {
        let archive_dir = features_dir.join("archive");
        if archive_dir.is_dir() {
            if let Ok(entries) = fs::read_dir(&archive_dir) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.starts_with(&format!("done-{}", feature_id)) || name == *feature_id {
                        feat_dir = Some(entry.path());
                        break;
                    }
                }
            }
        }
    }

    let dir = feat_dir.ok_or_else(|| format!("Feature directory for '{}' not found", feature_id))?;

    let mut result = HashMap::new();

    for filename in &["spec.md", "task.md", "checklist.md"] {
        let path = dir.join(filename);
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                result.insert(filename.to_string(), content);
            }
        }
    }

    Ok(result)
}

/// Start watching the feature-workflow/ and features/ directories for changes.
#[tauri::command]
async fn start_fs_watcher(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    // Stop existing watcher first
    stop_fs_watcher_inner(&state)?;

    let watch_paths = vec![
        PathBuf::from(&workspace).join("feature-workflow"),
        PathBuf::from(&workspace).join("features"),
    ];

    let app_handle = app.clone();
    let mut watcher = RecommendedWatcher::new(
        move |res: Result<NotifyEvent, notify::Error>| {
            match res {
                Ok(event) => {
                    let paths: Vec<String> = event.paths
                        .iter()
                        .map(|p| p.to_string_lossy().to_string())
                        .collect();

                    if !paths.is_empty() {
                        let kind_str = format!("{:?}", event.kind);
                        let _ = app_handle.emit("fs://workspace-changed", FsChangeEvent {
                            paths,
                            kind: kind_str,
                        });
                    }
                }
                Err(_) => {}
            }
        },
        NotifyConfig::default(),
    ).map_err(|e| format!("Failed to create file watcher: {}", e))?;

    for watch_path in &watch_paths {
        if watch_path.exists() {
            watcher.watch(watch_path, RecursiveMode::Recursive)
                .map_err(|e| format!("Failed to watch {:?}: {}", watch_path, e))?;
        }
    }

    *state.fs_watcher.lock().map_err(|e| e.to_string())? = Some(watcher);

    Ok(())
}

/// Stop the file system watcher.
#[tauri::command]
async fn stop_fs_watcher(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    stop_fs_watcher_inner(&state)
}

fn stop_fs_watcher_inner(state: &tauri::State<'_, AppState>) -> Result<(), String> {
    let mut watcher_opt = state.fs_watcher.lock().map_err(|e| e.to_string())?;
    // Dropping the watcher stops it
    *watcher_opt = None;
    Ok(())
}

/// Set the workspace path (called when workspace is loaded).
#[tauri::command]
async fn set_workspace_path(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<(), String> {
    *state.workspace_path.lock().map_err(|e| e.to_string())? = path.clone();

    // Reload routing config from workspace if available (feat-agent-runtime-router)
    let config = load_routing_config(&path);
    let mut router = state.router_engine.lock().map_err(|e| e.to_string())?;
    router.update_config(config);

    Ok(())
}

// ===========================================================================
// Tauri commands - Hardware monitoring
// ===========================================================================

/// Start the hardware monitoring background thread.
/// Spawns a thread that polls CPU/RAM every 1s and emits "sys-hardware-tick".
#[tauri::command]
async fn start_hardware_monitor(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    // Stop any existing monitor
    stop_hardware_monitor_inner(&state)?;

    let (tx, rx) = std::sync::mpsc::channel::<()>();
    *state.hw_monitor_stop.lock().map_err(|e| e.to_string())? = Some(tx);

    let app_handle = app.clone();
    std::thread::spawn(move || {
        let mut sys = System::new_all();
        // Initial refresh
        sys.refresh_cpu_all();
        sys.refresh_memory();

        loop {
            // Check if we should stop
            if rx.try_recv().is_ok() {
                break;
            }

            // Refresh data
            sys.refresh_cpu_all();
            sys.refresh_memory();

            // Calculate aggregate CPU usage across all cores
            let cpu_usage: f32 = sys.cpus().iter()
                .map(|c| c.cpu_usage())
                .sum::<f32>()
                / sys.cpus().len().max(1) as f32;

            let memory_total = sys.total_memory();
            let memory_used = sys.used_memory();
            let memory_percent = if memory_total > 0 {
                (memory_used as f32 / memory_total as f32) * 100.0
            } else {
                0.0
            };

            let uptime = System::uptime();

            let stats = HardwareStats {
                cpu_usage,
                memory_total,
                memory_used,
                memory_percent,
                uptime,
            };

            let _ = app_handle.emit("sys-hardware-tick", &stats);

            // Sleep 1 second, checking for stop signal every 100ms
            for _ in 0..10 {
                std::thread::sleep(std::time::Duration::from_millis(100));
                if rx.try_recv().is_ok() {
                    return;
                }
            }
        }
    });

    Ok(())
}

/// Stop the hardware monitoring background thread.
#[tauri::command]
async fn stop_hardware_monitor(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    stop_hardware_monitor_inner(&state)
}

fn stop_hardware_monitor_inner(state: &tauri::State<'_, AppState>) -> Result<(), String> {
    let mut stop = state.hw_monitor_stop.lock().map_err(|e| e.to_string())?;
    if let Some(tx) = stop.take() {
        let _ = tx.send(());
    }
    Ok(())
}

/// Fetch Git statistics for the current workspace.
#[tauri::command]
async fn fetch_git_stats(
    state: tauri::State<'_, AppState>,
) -> Result<GitStats, String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let repo_path = PathBuf::from(&workspace);
    let repo = git2::Repository::discover(&repo_path)
        .map_err(|e| format!("Failed to open git repository: {}", e))?;

    // Current branch
    let head = repo.head()
        .map_err(|e| format!("Failed to read HEAD: {}", e))?;
    let current_branch = head.shorthand()
        .unwrap_or("unknown")
        .to_string();

    // Count commits in last 7 days
    let seven_days_ago = chrono::Utc::now() - chrono::Duration::days(7);
    let since_time = git2::Time::new(seven_days_ago.timestamp(), 0);

    let mut commits_7d: u32 = 0;
    let mut revwalk = repo.revwalk()
        .map_err(|e| format!("Failed to create revwalk: {}", e))?;
    revwalk.push_head()
        .map_err(|e| format!("Failed to push HEAD: {}", e))?;

    let mut contributor_map: HashMap<String, u32> = HashMap::new();
    let mut recent_commits: Vec<RecentCommit> = Vec::new();

    for oid in revwalk {
        let oid = oid.map_err(|e| format!("Revwalk error: {}", e))?;
        let commit = repo.find_commit(oid)
            .map_err(|e| format!("Failed to find commit: {}", e))?;

        let commit_time = commit.time();
        if commit_time.seconds() < since_time.seconds() {
            continue;
        }

        commits_7d += 1;

        // Track contributor
        let author_name = commit.author().name().unwrap_or("unknown").to_string();
        *contributor_map.entry(author_name.clone()).or_insert(0) += 1;

        // Collect recent commits (up to 10)
        if recent_commits.len() < 10 {
            let short_hash = format!("{}", &oid.to_string()[..7]);
            let message = commit.message()
                .unwrap_or("(no message)")
                .lines()
                .next()
                .unwrap_or("")
                .to_string();
            let time_ago = format_time_ago(commit_time.seconds());
            recent_commits.push(RecentCommit {
                short_hash,
                message,
                author: author_name,
                time_ago,
            });
        }
    }

    // Count changed files (diff HEAD vs index + workdir)
    let mut changed_files: u32 = 0;
    if let Ok(head_tree) = repo.head().and_then(|r| r.peel_to_tree()) {
        if let Ok(diff) = repo.diff_tree_to_workdir_with_index(Some(&head_tree), None) {
            changed_files = diff.deltas().count() as u32;
        }
    }

    // Build contributor list sorted by commit count
    let mut contributors: Vec<ContributorInfo> = contributor_map
        .into_iter()
        .map(|(name, commits)| ContributorInfo { name, commits })
        .collect();
    contributors.sort_by(|a, b| b.commits.cmp(&a.commits));
    contributors.truncate(5);

    Ok(GitStats {
        commits_7d,
        changed_files,
        contributors,
        current_branch,
        recent_commits,
    })
}

fn format_time_ago(timestamp: i64) -> String {
    let now = chrono::Utc::now().timestamp();
    let diff = now - timestamp;
    if diff < 60 {
        "just now".to_string()
    } else if diff < 3600 {
        format!("{}m ago", diff / 60)
    } else if diff < 86400 {
        format!("{}h ago", diff / 3600)
    } else {
        format!("{}d ago", diff / 86400)
    }
}

/// Fetch detailed Git status for the current workspace (branch, remote, changed files with diff stats).
#[tauri::command]
async fn fetch_git_status(
    state: tauri::State<'_, AppState>,
) -> Result<GitStatusResult, String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let repo_path = PathBuf::from(&workspace);
    let repo = git2::Repository::discover(&repo_path)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    // Current branch
    let head = repo.head()
        .map_err(|e| format!("Failed to read HEAD: {}", e))?;
    let current_branch = head.shorthand()
        .unwrap_or("unknown")
        .to_string();

    // Remote URL
    let remote_url = repo.find_remote("origin")
        .ok()
        .and_then(|r| r.url().map(|u| u.to_string()));

    // Collect changed files
    let mut files: Vec<FileDiffInfo> = Vec::new();

    // Helper: extract file list with per-file diff stats from a diff
    let extract_files_from_diff = |diff: &git2::Diff, status_label: &str, skip_paths: &[String]| -> Vec<FileDiffInfo> {
        let mut result: Vec<FileDiffInfo> = Vec::new();
        let mut current_idx: Option<usize> = None;
        let mut current_adds: usize = 0;
        let mut current_dels: usize = 0;

        // First pass: collect delta paths
        let deltas: Vec<String> = diff.deltas()
            .filter_map(|d| {
                let p = d.new_file().path()
                    .or_else(|| d.old_file().path())
                    .map(|pp| pp.to_string_lossy().to_string())
                    .unwrap_or_default();
                if p.is_empty() || skip_paths.contains(&p) { None } else { Some(p) }
            })
            .collect();

        // Second pass: count lines per delta using print callback
        let deltas_ref = &deltas;
        let _ = diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
            let origin = line.origin();
            // Determine which file this line belongs to
            let path = _delta.new_file().path()
                .or_else(|| _delta.old_file().path())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            if let Some(pos) = deltas_ref.iter().position(|p| *p == path) {
                if current_idx != Some(pos) {
                    // Flush previous
                    if let Some(idx) = current_idx {
                        if idx < result.len() {
                            result[idx].additions += current_adds;
                            result[idx].deletions += current_dels;
                        }
                    }
                    // Start new file tracking
                    if result.len() <= pos {
                        result.resize_with(pos + 1, || FileDiffInfo {
                            path: String::new(),
                            status: status_label.to_string(),
                            additions: 0,
                            deletions: 0,
                        });
                    }
                    result[pos].path = path.clone();
                    current_idx = Some(pos);
                    current_adds = 0;
                    current_dels = 0;
                }
                if origin == '+' {
                    current_adds += 1;
                } else if origin == '-' {
                    current_dels += 1;
                }
            }
            true
        });

        // Flush last
        if let Some(idx) = current_idx {
            if idx < result.len() {
                result[idx].additions += current_adds;
                result[idx].deletions += current_dels;
            }
        }

        // Fill in any deltas that had no line-level changes (binary, etc.)
        for (i, path) in deltas_ref.iter().enumerate() {
            if i >= result.len() {
                result.push(FileDiffInfo {
                    path: path.clone(),
                    status: status_label.to_string(),
                    additions: 0,
                    deletions: 0,
                });
            } else if result[i].path.is_empty() {
                result[i].path = path.clone();
            }
        }

        result
    };

    let staged_paths: Vec<String> = Vec::new();

    // --- Staged changes (index vs HEAD) ---
    if let Ok(head_tree) = repo.head().and_then(|r| r.peel_to_tree()) {
        if let Ok(diff) = repo.diff_tree_to_index(Some(&head_tree), None, None) {
            files = extract_files_from_diff(&diff, "staged", &staged_paths);
        }
    }

    // --- Unstaged changes (workdir vs index) ---
    let staged_file_paths: Vec<String> = files.iter().map(|f| f.path.clone()).collect();
    if let Ok(diff) = repo.diff_index_to_workdir(None, None) {
        let unstaged = extract_files_from_diff(&diff, "unstaged", &staged_file_paths);
        files.extend(unstaged);
    }

    // --- Untracked files ---
    let mut status_opts = git2::StatusOptions::new();
    status_opts.include_untracked(true);
    status_opts.exclude_submodules(true);
    status_opts.recurse_untracked_dirs(true);

    if let Ok(statuses) = repo.statuses(Some(&mut status_opts)) {
        for entry in statuses.iter() {
            let s = entry.status();
            if s.is_wt_new() {
                if let Some(path) = entry.path() {
                    // Skip if already listed
                    if files.iter().any(|f| f.path == path) { continue; }
                    files.push(FileDiffInfo {
                        path: path.to_string(),
                        status: "untracked".to_string(),
                        additions: 0,
                        deletions: 0,
                    });
                }
            }
        }
    }

    Ok(GitStatusResult {
        current_branch,
        remote_url,
        files,
    })
}

// ===========================================================================
// Tauri commands - Git detail queries (feat-git-modal-enhance)
// ===========================================================================

/// Fetch all Git tags (name, date, commit hash, message).
#[tauri::command]
async fn fetch_git_tags(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<GitTag>, String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let repo_path = PathBuf::from(&workspace);
    let repo = git2::Repository::discover(&repo_path)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    let mut tags: Vec<GitTag> = Vec::new();

    repo.tag_foreach(|oid, name_bytes| {
        let name = String::from_utf8_lossy(name_bytes)
            .strip_prefix("refs/tags/")
            .unwrap_or("")
            .to_string();

        // Try to peel to commit for date/message
        let date = repo.find_tag(oid).ok().and_then(|tag| {
            let target_id = tag.target_id();
            repo.find_commit(target_id).ok().map(|c| c.time().seconds())
        }).or_else(|| {
            // Lightweight tag: try to peel the object directly to a commit
            repo.find_object(oid, None).ok().and_then(|obj| {
                obj.peel_to_commit().ok().map(|c| c.time().seconds())
            })
        });

        let commit_hash = repo.find_tag(oid).ok().and_then(|tag| {
            Some(tag.target_id().to_string())
        }).or_else(|| {
            repo.find_object(oid, None).ok().and_then(|obj| {
                obj.peel_to_commit().ok().map(|c| c.id().to_string())
            })
        });

        let message = repo.find_tag(oid).ok().and_then(|tag| {
            tag.message().map(|m| m.lines().next().unwrap_or("").to_string())
        }).or_else(|| {
            // For lightweight tags, get the commit message
            repo.find_object(oid, None).ok().and_then(|obj| {
                obj.peel_to_commit().ok().and_then(|c| {
                    c.message().map(|m| m.lines().next().unwrap_or("").to_string())
                })
            })
        });

        tags.push(GitTag {
            name,
            date: date.unwrap_or(0),
            commit_hash: commit_hash.unwrap_or_default(),
            message: message.unwrap_or_default(),
        });

        true
    }).map_err(|e| format!("Failed to iterate tags: {}", e))?;

    // Sort by date descending (newest first)
    tags.sort_by(|a, b| b.date.cmp(&a.date));

    Ok(tags)
}

/// Fetch recent Git commit log (most recent N commits).
#[tauri::command]
async fn fetch_git_log(
    state: tauri::State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<GitCommitDetail>, String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let repo_path = PathBuf::from(&workspace);
    let repo = git2::Repository::discover(&repo_path)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    let max = limit.unwrap_or(50);
    let mut commits: Vec<GitCommitDetail> = Vec::new();

    let mut revwalk = repo.revwalk()
        .map_err(|e| format!("Failed to create revwalk: {}", e))?;
    revwalk.push_head()
        .map_err(|e| format!("Failed to push HEAD: {}", e))?;

    for oid in revwalk.take(max) {
        let oid = oid.map_err(|e| format!("Revwalk error: {}", e))?;
        let commit = repo.find_commit(oid)
            .map_err(|e| format!("Failed to find commit: {}", e))?;

        let hash = oid.to_string();
        let short_hash = format!("{}", &hash[..7]);
        let message = commit.message()
            .unwrap_or("(no message)")
            .lines()
            .next()
            .unwrap_or("")
            .to_string();
        let author = commit.author().name().unwrap_or("unknown").to_string();
        let timestamp = commit.time().seconds();
        let time_ago = format_time_ago(timestamp);

        commits.push(GitCommitDetail {
            hash,
            short_hash,
            message,
            author,
            timestamp,
            time_ago,
        });
    }

    Ok(commits)
}

/// Fetch all local Git branches with current-branch indicator and latest commit.
#[tauri::command]
async fn fetch_git_branches(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<GitBranchInfo>, String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let repo_path = PathBuf::from(&workspace);
    let repo = git2::Repository::discover(&repo_path)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    // Get current branch name
    let current_branch = repo.head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()))
        .unwrap_or_default();

    let mut branches: Vec<GitBranchInfo> = Vec::new();

    let branch_iter = repo.branches(Some(git2::BranchType::Local))
        .map_err(|e| format!("Failed to list branches: {}", e))?;

    for branch_result in branch_iter {
        let (branch, _branch_type) = branch_result.map_err(|e| format!("Branch iteration error: {}", e))?;
        let name = branch.name()
            .ok()
            .flatten()
            .unwrap_or("(unknown)")
            .to_string();

        let is_current = name == current_branch;

        let (latest_commit, latest_commit_hash) = branch.get().target()
            .and_then(|oid| repo.find_commit(oid).ok())
            .map(|c| {
                let msg = c.message()
                    .unwrap_or("(no message)")
                    .lines()
                    .next()
                    .unwrap_or("")
                    .to_string();
                let hash = format!("{}", &c.id().to_string()[..7]);
                (msg, hash)
            })
            .unwrap_or_else(|| (String::new(), String::new()));

        branches.push(GitBranchInfo {
            name,
            is_current,
            latest_commit,
            latest_commit_hash,
        });
    }

    // Sort: current branch first, then alphabetical
    branches.sort_by(|a, b| {
        if a.is_current { std::cmp::Ordering::Less }
        else if b.is_current { std::cmp::Ordering::Greater }
        else { a.name.cmp(&b.name) }
    });

    Ok(branches)
}

// ===========================================================================
// Tauri commands - Commit graph (git-log style timeline)
// ===========================================================================

/// A single commit in the DAG timeline graph, pre-laid-out with lane assignments.
#[derive(Debug, Serialize, Clone)]
pub struct CommitGraphNode {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64,
    pub time_ago: String,
    pub lane: usize,
    pub is_merge: bool,
    pub branch_labels: Vec<String>,
    pub tag_labels: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct GraphConnector {
    pub row: usize,
    pub from_lane: usize,
    pub to_lane: usize,
    pub connector_type: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct CommitGraphResult {
    pub commits: Vec<CommitGraphNode>,
    pub connectors: Vec<GraphConnector>,
    pub lane_count: usize,
}

#[tauri::command]
async fn fetch_commit_graph(
    state: tauri::State<'_, AppState>,
) -> Result<CommitGraphResult, String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let repo_path = PathBuf::from(&workspace);
    let repo = git2::Repository::discover(&repo_path)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    // 1. Build branch-tip map: commit OID -> [branch_name, ...]
    let mut branch_tips: std::collections::HashMap<git2::Oid, Vec<String>> = std::collections::HashMap::new();
    for btype in [git2::BranchType::Local, git2::BranchType::Remote] {
        if let Ok(iter) = repo.branches(Some(btype)) {
            for branch_result in iter {
                if let Ok((branch, _bt)) = branch_result {
                    let name = branch.name().ok().flatten().unwrap_or("(unknown)").to_string();
                    if let Some(oid) = branch.get().target() {
                        branch_tips.entry(oid).or_default().push(name);
                    }
                }
            }
        }
    }

    // 2. Build tag-tip map
    let mut tag_tips: std::collections::HashMap<git2::Oid, Vec<String>> = std::collections::HashMap::new();
    let _ = repo.tag_foreach(|oid, name_bytes| {
        let name = String::from_utf8_lossy(name_bytes)
            .strip_prefix("refs/tags/")
            .unwrap_or("")
            .to_string();
        let commit_oid = repo.find_object(oid, None).ok()
            .and_then(|obj| obj.peel_to_commit().ok())
            .map(|c| c.id());
        if let Some(cid) = commit_oid {
            tag_tips.entry(cid).or_default().push(name);
        }
        true
    });

    // 3. Revwalk all commits
    let mut revwalk = repo.revwalk()
        .map_err(|e| format!("Revwalk error: {}", e))?;
    revwalk.push_glob("*").map_err(|e| format!("Push glob error: {}", e))?;
    revwalk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)
        .map_err(|e| format!("Sort error: {}", e))?;

    let mut commit_list: Vec<(git2::Oid, Vec<git2::Oid>)> = Vec::new();
    let mut node_map: std::collections::HashMap<git2::Oid, (String, String, String, String, i64, bool)> =
        std::collections::HashMap::new();

    for oid_result in revwalk.take(100) {
        let oid = oid_result.map_err(|e| format!("Revwalk error: {}", e))?;
        let commit = repo.find_commit(oid).map_err(|e| format!("Find commit error: {}", e))?;
        let short_hash = format!("{:.7}", oid);
        let message = commit.message().unwrap_or("(no message)").lines().next().unwrap_or("").to_string();
        let author = commit.author().name().unwrap_or("unknown").to_string();
        let timestamp = commit.time().seconds();
        let time_ago = format_time_ago(timestamp);
        let is_merge = commit.parent_count() > 1;
        let parents: Vec<git2::Oid> = commit.parent_ids().collect();
        node_map.insert(oid, (short_hash, message, author, time_ago, timestamp, is_merge));
        commit_list.push((oid, parents));
    }

    // 4. Lane assignment
    let mut active_lanes: Vec<Option<git2::Oid>> = Vec::new();
    let mut oid_to_lane: std::collections::HashMap<git2::Oid, usize> = std::collections::HashMap::new();
    let mut connectors: Vec<GraphConnector> = Vec::new();
    let mut max_lane: usize = 0;

    for (row_idx, (oid, parents)) in commit_list.iter().enumerate() {
        let commit_lane = if let Some(&lane) = oid_to_lane.get(oid) {
            lane
        } else {
            let lane = active_lanes.iter().position(|l| l.is_none()).unwrap_or(active_lanes.len());
            if lane >= active_lanes.len() { active_lanes.push(None); }
            lane
        };
        max_lane = max_lane.max(commit_lane);

        if commit_lane < active_lanes.len() { active_lanes[commit_lane] = None; }

        // Pass-through for other active lanes
        for (i, slot) in active_lanes.iter().enumerate() {
            if slot.is_some() && i != commit_lane {
                connectors.push(GraphConnector { row: row_idx, from_lane: i, to_lane: i, connector_type: "straight".to_string() });
            }
        }

        if parents.is_empty() {
            // Root commit
        } else {
            let first_parent = parents[0];
            if let Some(&existing_lane) = oid_to_lane.get(&first_parent) {
                if existing_lane != commit_lane {
                    connectors.push(GraphConnector { row: row_idx, from_lane: existing_lane, to_lane: commit_lane, connector_type: "merge".to_string() });
                    active_lanes[commit_lane] = None;
                } else {
                    active_lanes[commit_lane] = Some(first_parent);
                }
            } else {
                active_lanes[commit_lane] = Some(first_parent);
                oid_to_lane.insert(first_parent, commit_lane);
            }

            for &parent_oid in &parents[1..] {
                if let Some(&existing_lane) = oid_to_lane.get(&parent_oid) {
                    connectors.push(GraphConnector { row: row_idx, from_lane: existing_lane, to_lane: commit_lane, connector_type: "merge".to_string() });
                } else {
                    let new_lane = active_lanes.iter().position(|l| l.is_none()).unwrap_or(active_lanes.len());
                    if new_lane >= active_lanes.len() { active_lanes.push(None); }
                    max_lane = max_lane.max(new_lane);
                    active_lanes[new_lane] = Some(parent_oid);
                    oid_to_lane.insert(parent_oid, new_lane);
                    connectors.push(GraphConnector { row: row_idx, from_lane: new_lane, to_lane: commit_lane, connector_type: "merge".to_string() });
                }
            }
        }
        oid_to_lane.insert(*oid, commit_lane);
    }

    // 5. Build result
    let commits: Vec<CommitGraphNode> = commit_list.iter().map(|(oid, _)| {
        let lane = oid_to_lane.get(oid).copied().unwrap_or(0);
        let (short_hash, message, author, time_ago, timestamp, is_merge) = node_map.get(oid)
            .cloned().unwrap_or_default();
        CommitGraphNode {
            hash: oid.to_string(),
            short_hash, message, author, timestamp, time_ago, lane, is_merge,
            branch_labels: branch_tips.get(oid).cloned().unwrap_or_default(),
            tag_labels: tag_tips.get(oid).cloned().unwrap_or_default(),
        }
    }).collect();

    Ok(CommitGraphResult { commits, connectors, lane_count: max_lane + 1 })
}

// ===========================================================================
// Tauri commands - Tag detail expand (feat-git-tag-expand)
// ===========================================================================

/// File change entry for tag diff results.
#[derive(Debug, Serialize, Clone)]
pub struct TagFileChangeInfo {
    pub path: String,
    pub status: String, // "added" | "modified" | "removed" | "renamed"
    pub additions: usize,
    pub deletions: usize,
}

/// Result for fetch_tag_commits: commits between two tags.
#[derive(Debug, Serialize, Clone)]
pub struct TagCommitsResult {
    pub tag_name: String,
    pub commits: Vec<GitCommitDetail>,
}

/// Result for fetch_tag_diff: file changes for a tag.
#[derive(Debug, Serialize, Clone)]
pub struct TagDiffResult {
    pub tag_name: String,
    pub file_changes: Vec<TagFileChangeInfo>,
}

/// Helper: resolve a tag name to its target commit OID.
fn resolve_tag_to_commit_oid(repo: &git2::Repository, tag_name: &str) -> Result<git2::Oid, String> {
    // Try refs/tags/<name> first (annotated tags)
    if let Ok(ref_name) = repo.find_reference(&format!("refs/tags/{}", tag_name)) {
        if let Ok(commit) = ref_name.peel_to_commit() {
            return Ok(commit.id());
        }
        // If peel_to_commit fails, try the target directly
        if let Some(target) = ref_name.target() {
            // Could be a tag object pointing to a commit
            if let Ok(obj) = repo.find_object(target, None) {
                if let Ok(commit) = obj.peel_to_commit() {
                    return Ok(commit.id());
                }
            }
        }
    }

    Err(format!("Tag '{}' not found or cannot be resolved to a commit", tag_name))
}

/// Fetch commits between a tag and the previous tag (or repo root if first tag).
/// Returns the commit list in reverse chronological order (newest first).
#[tauri::command]
async fn fetch_tag_commits(
    state: tauri::State<'_, AppState>,
    tag_name: String,
) -> Result<TagCommitsResult, String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let repo_path = PathBuf::from(&workspace);
    let repo = git2::Repository::discover(&repo_path)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    // Resolve the target tag to a commit OID
    let tag_oid = resolve_tag_to_commit_oid(&repo, &tag_name)?;

    // Collect all tags sorted by date (ascending) to find the previous tag
    let mut all_tags: Vec<(String, git2::Oid, i64)> = Vec::new();
    repo.tag_foreach(|oid, name_bytes| {
        let name = String::from_utf8_lossy(name_bytes)
            .strip_prefix("refs/tags/")
            .unwrap_or("")
            .to_string();

        let date = repo.find_tag(oid).ok().and_then(|tag| {
            let target_id = tag.target_id();
            repo.find_commit(target_id).ok().map(|c| c.time().seconds())
        }).or_else(|| {
            repo.find_object(oid, None).ok().and_then(|obj| {
                obj.peel_to_commit().ok().map(|c| c.time().seconds())
            })
        }).unwrap_or(0);

        // Resolve each tag to its commit OID
        let commit_oid = repo.find_tag(oid).ok().and_then(|tag| {
            Some(tag.target_id())
        }).or_else(|| {
            repo.find_object(oid, None).ok().and_then(|obj| {
                obj.peel_to_commit().ok().map(|c| c.id())
            })
        });

        if let Some(c_oid) = commit_oid {
            all_tags.push((name, c_oid, date));
        }
        true
    }).map_err(|e| format!("Failed to iterate tags: {}", e))?;

    // Sort by date ascending (oldest first)
    all_tags.sort_by(|a, b| a.2.cmp(&b.2));

    // Find the index of our target tag
    let target_idx = all_tags.iter().position(|(n, oid, _)| *n == tag_name && *oid == tag_oid)
        .ok_or_else(|| format!("Tag '{}' not found in tag list", tag_name))?;

    // Previous tag OID (if exists)
    let prev_oid = if target_idx > 0 {
        Some(all_tags[target_idx - 1].1)
    } else {
        None
    };

    // Walk commits from tag_oid back to prev_oid (exclusive)
    let mut commits: Vec<GitCommitDetail> = Vec::new();
    let mut revwalk = repo.revwalk()
        .map_err(|e| format!("Failed to create revwalk: {}", e))?;
    revwalk.push(tag_oid)
        .map_err(|e| format!("Failed to push tag ref: {}", e))?;

    if let Some(prev) = prev_oid {
        // Hide the previous tag so we stop at it (exclusive)
        let _ = revwalk.hide(prev);
    }

    for oid in revwalk {
        let oid = oid.map_err(|e| format!("Revwalk error: {}", e))?;
        let commit = repo.find_commit(oid)
            .map_err(|e| format!("Failed to find commit: {}", e))?;

        let hash = oid.to_string();
        let short_hash = format!("{}", &hash[..7]);
        let message = commit.message()
            .unwrap_or("(no message)")
            .lines()
            .next()
            .unwrap_or("")
            .to_string();
        let author = commit.author().name().unwrap_or("unknown").to_string();
        let timestamp = commit.time().seconds();
        let time_ago = format_time_ago(timestamp);

        commits.push(GitCommitDetail {
            hash,
            short_hash,
            message,
            author,
            timestamp,
            time_ago,
        });
    }

    Ok(TagCommitsResult {
        tag_name,
        commits,
    })
}

/// Fetch file changes (diff stat) for a tag compared to the previous tag.
/// If no previous tag exists, compares against an empty tree.
#[tauri::command]
async fn fetch_tag_diff(
    state: tauri::State<'_, AppState>,
    tag_name: String,
) -> Result<TagDiffResult, String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let repo_path = PathBuf::from(&workspace);
    let repo = git2::Repository::discover(&repo_path)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    // Resolve the target tag to a commit OID
    let tag_oid = resolve_tag_to_commit_oid(&repo, &tag_name)?;
    let tag_commit = repo.find_commit(tag_oid)
        .map_err(|e| format!("Failed to find commit for tag '{}': {}", tag_name, e))?;
    let tag_tree = tag_commit.tree()
        .map_err(|e| format!("Failed to get tree for tag commit: {}", e))?;

    // Collect all tags sorted by date to find the previous tag
    let mut all_tags: Vec<(String, git2::Oid, i64)> = Vec::new();
    repo.tag_foreach(|oid, name_bytes| {
        let name = String::from_utf8_lossy(name_bytes)
            .strip_prefix("refs/tags/")
            .unwrap_or("")
            .to_string();

        let date = repo.find_tag(oid).ok().and_then(|tag| {
            let target_id = tag.target_id();
            repo.find_commit(target_id).ok().map(|c| c.time().seconds())
        }).or_else(|| {
            repo.find_object(oid, None).ok().and_then(|obj| {
                obj.peel_to_commit().ok().map(|c| c.time().seconds())
            })
        }).unwrap_or(0);

        let commit_oid = repo.find_tag(oid).ok().and_then(|tag| {
            Some(tag.target_id())
        }).or_else(|| {
            repo.find_object(oid, None).ok().and_then(|obj| {
                obj.peel_to_commit().ok().map(|c| c.id())
            })
        });

        if let Some(c_oid) = commit_oid {
            all_tags.push((name, c_oid, date));
        }
        true
    }).map_err(|e| format!("Failed to iterate tags: {}", e))?;

    all_tags.sort_by(|a, b| a.2.cmp(&b.2));

    let target_idx = all_tags.iter().position(|(n, oid, _)| *n == tag_name && *oid == tag_oid)
        .ok_or_else(|| format!("Tag '{}' not found in tag list", tag_name))?;

    // Get previous tag's tree (or empty tree for the first tag)
    let diff = if target_idx > 0 {
        let prev_oid = all_tags[target_idx - 1].1;
        let prev_commit = repo.find_commit(prev_oid)
            .map_err(|e| format!("Failed to find previous tag commit: {}", e))?;
        let prev_tree = prev_commit.tree()
            .map_err(|e| format!("Failed to get previous tag tree: {}", e))?;
        repo.diff_tree_to_tree(Some(&prev_tree), Some(&tag_tree), None)
            .map_err(|e| format!("Failed to diff trees: {}", e))?
    } else {
        // First tag: diff against empty tree
        let empty_tree = repo.find_tree(
            repo.treebuilder(None).and_then(|tb| tb.write())
                .map_err(|e| format!("Failed to create empty tree: {}", e))?
        ).map_err(|e| format!("Failed to find empty tree: {}", e))?;
        repo.diff_tree_to_tree(Some(&empty_tree), Some(&tag_tree), None)
            .map_err(|e| format!("Failed to diff against empty tree: {}", e))?
    };

    // Extract file changes with stats
    let mut file_changes: Vec<TagFileChangeInfo> = Vec::new();

    for delta in diff.deltas() {
        let path = delta.new_file().path()
            .or_else(|| delta.old_file().path())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        let status = match delta.status() {
            git2::Delta::Added => "added",
            git2::Delta::Deleted => "removed",
            git2::Delta::Modified => "modified",
            git2::Delta::Renamed => "renamed",
            git2::Delta::Copied => "modified",
            _ => "modified",
        }.to_string();

        file_changes.push(TagFileChangeInfo {
            path,
            status,
            additions: 0,
            deletions: 0,
        });
    }

    // Count line additions/deletions per file using diff print
    let file_count = file_changes.len();
    let additions_map: Arc<Mutex<HashMap<usize, (usize, usize)>>> = Arc::new(Mutex::new(HashMap::new()));
    let additions_map_clone = Arc::clone(&additions_map);
    let mut current_file_idx: Option<usize> = None;
    let mut current_adds: usize = 0;
    let mut current_dels: usize = 0;

    let _ = diff.print(git2::DiffFormat::Patch, |delta, _hunk, line| {
        let path = delta.new_file().path()
            .or_else(|| delta.old_file().path())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        // Find file index
        if let Some(idx) = (0..file_count).find(|&i| file_changes[i].path == path) {
            if current_file_idx != Some(idx) {
                // Flush previous
                if let Some(prev_idx) = current_file_idx {
                    additions_map_clone.lock().unwrap().insert(prev_idx, (current_adds, current_dels));
                }
                current_file_idx = Some(idx);
                current_adds = 0;
                current_dels = 0;
            }
            let origin = line.origin();
            if origin == '+' {
                current_adds += 1;
            } else if origin == '-' {
                current_dels += 1;
            }
        }
        true
    });

    // Flush last
    if let Some(idx) = current_file_idx {
        additions_map.lock().unwrap().insert(idx, (current_adds, current_dels));
    }

    let stats_map = additions_map.lock().unwrap();
    for (idx, (adds, dels)) in stats_map.iter() {
        if *idx < file_changes.len() {
            file_changes[*idx].additions = *adds;
            file_changes[*idx].deletions = *dels;
        }
    }

    Ok(TagDiffResult {
        tag_name,
        file_changes,
    })
}

// ===========================================================================
// Tauri commands - Git stage & commit (feat-git-stage-commit)
// ===========================================================================

/// Stage (add) a single file to the Git index. Equivalent to `git add <path>`.
#[tauri::command]
async fn git_stage_file(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<(), String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let repo = git2::Repository::discover(&workspace)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    let mut index = repo.index()
        .map_err(|e| format!("Failed to get index: {}", e))?;

    index.add_path(std::path::Path::new(&path))
        .map_err(|e| format!("Failed to stage '{}': {}", path, e))?;

    index.write()
        .map_err(|e| format!("Failed to write index: {}", e))?;

    Ok(())
}

/// Stage all changes (tracked + untracked). Equivalent to `git add -A`.
#[tauri::command]
async fn git_stage_all(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let repo = git2::Repository::discover(&workspace)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    let mut index = repo.index()
        .map_err(|e| format!("Failed to get index: {}", e))?;

    index.add_all(["*"], git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| format!("Failed to stage all files: {}", e))?;

    index.write()
        .map_err(|e| format!("Failed to write index: {}", e))?;

    Ok(())
}

/// Unstage a single file (reset from index to HEAD). Equivalent to `git reset HEAD -- <path>`.
#[tauri::command]
async fn git_unstage_file(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<(), String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let repo = git2::Repository::discover(&workspace)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    // Get HEAD tree for resetting
    let head = repo.head()
        .map_err(|e| format!("Failed to read HEAD: {}", e))?;
    let head_tree = head.peel_to_tree()
        .map_err(|e| format!("Failed to peel HEAD to tree: {}", e))?;

    // Reset the single path in the index to match HEAD
    let mut index = repo.index()
        .map_err(|e| format!("Failed to get index: {}", e))?;

    index.read_tree(&head_tree)
        .map_err(|e| format!("Failed to read HEAD tree into index: {}", e))?;

    // Now we need to only reset the specified path.
    // Approach: use diff to figure out the right state, or simpler: use
    // repo.reset_default which resets specific paths.
    drop(index);

    let path_obj = std::path::Path::new(&path);
    repo.reset_default(Some(&head_tree.into_object()), &[path_obj])
        .map_err(|e| format!("Failed to unstage '{}': {}", path, e))?;

    Ok(())
}

/// Create a commit with the given message using currently staged files.
#[tauri::command]
async fn git_commit(
    state: tauri::State<'_, AppState>,
    message: String,
) -> Result<String, String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let repo = git2::Repository::discover(&workspace)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    // Get the index and write a tree from it
    let mut index = repo.index()
        .map_err(|e| format!("Failed to get index: {}", e))?;

    let tree_id = index.write_tree()
        .map_err(|e| format!("Failed to write tree: {}", e))?;

    let tree = repo.find_tree(tree_id)
        .map_err(|e| format!("Failed to find tree: {}", e))?;

    // Determine parent commit (HEAD)
    let head = repo.head().ok();
    let parent_commit = head.as_ref().and_then(|h| h.target()).and_then(|oid| repo.find_commit(oid).ok());

    // Build signature
    let sig = repo.signature()
        .map_err(|e| format!("Failed to get signature: {}", e))?;

    // Create the commit
    let commit_id = if let Some(parent) = parent_commit {
        repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &[&parent])
            .map_err(|e| format!("Failed to commit: {}", e))?
    } else {
        repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &[])
            .map_err(|e| format!("Failed to commit: {}", e))?
    };

    Ok(format!("{}", commit_id))
}

// ===========================================================================
// Tauri commands - Git push & pull (feat-git-push-pull)
// ===========================================================================

/// Result returned by git_push / git_pull to the frontend.
#[derive(Debug, Serialize, Clone)]
pub struct GitSyncResult {
    /// Whether the operation succeeded
    pub success: bool,
    /// Human-readable summary (e.g. "Everything up-to-date", "Pushed 3 commits")
    pub message: String,
}

/// Build authentication callbacks for git2 remote operations.
/// Tries SSH agent first, then falls back to default credential helper.
fn make_remote_callbacks<'a>() -> git2::RemoteCallbacks<'a> {
    let mut callbacks = git2::RemoteCallbacks::new();

    callbacks.credentials(|_url, username_from_url, allowed_types| {
        // Try SSH key authentication first
        if allowed_types.contains(git2::CredentialType::SSH_KEY) {
            if let Ok(cred) = git2::Cred::ssh_key_from_agent(
                username_from_url.unwrap_or("git"),
            ) {
                return Ok(cred);
            }
        }

        // Try default credential (for HTTPS with stored credentials)
        if allowed_types.contains(git2::CredentialType::DEFAULT) {
            if let Ok(cred) = git2::Cred::default() {
                return Ok(cred);
            }
        }

        Err(git2::Error::from_str("No authentication method available. Please configure SSH keys or HTTPS credentials."))
    });

    callbacks
}

/// Push the current branch to origin. Equivalent to `git push origin <branch>`.
#[tauri::command]
async fn git_push(
    state: tauri::State<'_, AppState>,
) -> Result<GitSyncResult, String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let repo = git2::Repository::discover(&workspace)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    // Get current branch name
    let head = repo.head()
        .map_err(|e| format!("Failed to read HEAD: {}", e))?;
    let branch_name = head.shorthand()
        .ok_or_else(|| "Detached HEAD — cannot push".to_string())?
        .to_string();

    // Get the remote
    let mut remote = repo.find_remote("origin")
        .map_err(|e| format!("No 'origin' remote configured: {}", e))?;

    // Build refspec: push current branch to same name on remote
    let refspec = format!("refs/heads/{branch}:refs/heads/{branch}", branch = branch_name);

    let mut callbacks = make_remote_callbacks();

    // Track what gets pushed
    let push_result = Arc::new(Mutex::new(String::new()));
    let push_result_clone = Arc::clone(&push_result);
    callbacks.push_update_reference(move |refname, status| {
        let mut result = push_result_clone.lock().unwrap();
        if let Some(s) = status {
            *result = format!("Rejected: {} ({})", refname, s);
        } else {
            *result = format!("Pushed {}", refname);
        }
        Ok(())
    });

    let mut push_options = git2::PushOptions::new();
    push_options.remote_callbacks(callbacks);

    remote.push(&[&refspec], Some(&mut push_options))
        .map_err(|e| {
            let err_str = e.to_string();
            if err_str.contains("authentication") || err_str.contains("credentials") {
                "Authentication failed. Please configure SSH keys or HTTPS credentials for this repository.".to_string()
            } else if err_str.contains("Couldn't resolve host") || err_str.contains("network") {
                format!("Network error: {}", err_str)
            } else {
                format!("Push failed: {}", err_str)
            }
        })?;

    let push_msg = push_result.lock().map_err(|e| e.to_string())?.clone();
    let message = if push_msg.is_empty() {
        "Everything up-to-date".to_string()
    } else {
        push_msg
    };

    Ok(GitSyncResult {
        success: true,
        message,
    })
}

/// Pull (fetch + merge) from origin for the current branch. Equivalent to `git pull origin <branch>`.
#[tauri::command]
async fn git_pull(
    state: tauri::State<'_, AppState>,
) -> Result<GitSyncResult, String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let repo = git2::Repository::discover(&workspace)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    // Get current branch name
    let head = repo.head()
        .map_err(|e| format!("Failed to read HEAD: {}", e))?;
    let branch_name = head.shorthand()
        .ok_or_else(|| "Detached HEAD — cannot pull".to_string())?
        .to_string();

    // Get the remote
    let mut remote = repo.find_remote("origin")
        .map_err(|e| format!("No 'origin' remote configured: {}", e))?;

    // Build refspec for fetching
    let refspec = format!("refs/heads/{branch}:refs/remotes/origin/{branch}", branch = branch_name);

    let callbacks = make_remote_callbacks();

    let mut fetch_options = git2::FetchOptions::new();
    fetch_options.remote_callbacks(callbacks);

    // Fetch from remote
    remote.fetch(&[&refspec], Some(&mut fetch_options), None)
        .map_err(|e| {
            let err_str = e.to_string();
            if err_str.contains("authentication") || err_str.contains("credentials") {
                "Authentication failed. Please configure SSH keys or HTTPS credentials for this repository.".to_string()
            } else if err_str.contains("Couldn't resolve host") || err_str.contains("network") {
                format!("Network error: {}", err_str)
            } else {
                format!("Fetch failed: {}", err_str)
            }
        })?;

    // Get the fetch HEAD (the remote branch tip)
    let fetch_head = repo.find_reference("FETCH_HEAD")
        .map_err(|e| format!("Failed to find FETCH_HEAD: {}", e))?;

    let fetch_commit = fetch_head.peel_to_commit()
        .map_err(|e| format!("Failed to peel FETCH_HEAD to commit: {}", e))?;

    // Check if we're already up-to-date
    let head_oid = head.target()
        .ok_or_else(|| "HEAD has no target".to_string())?;

    if head_oid == fetch_commit.id() {
        return Ok(GitSyncResult {
            success: true,
            message: "Already up-to-date".to_string(),
        });
    }

    // Perform merge: analyze, then merge
    let head_commit = repo.find_commit(head_oid)
        .map_err(|e| format!("Failed to find HEAD commit: {}", e))?;

    // Get the ancestor (merge base)
    let ancestor = repo.merge_base(head_oid, fetch_commit.id())
        .map_err(|e| format!("Failed to find merge base: {}", e))?;

    let _ancestor_commit = repo.find_commit(ancestor)
        .map_err(|e| format!("Failed to find ancestor commit: {}", e))?;

    // Check if fast-forward is possible
    if ancestor == head_oid {
        // Fast-forward: just move HEAD forward
        // Count how many commits we're pulling
        let mut count = 0u32;
        let mut walk_oid = fetch_commit.id();
        loop {
            if walk_oid == head_oid { break; }
            let c = repo.find_commit(walk_oid)
                .map_err(|e| format!("Failed to walk commits: {}", e))?;
            count += 1;
            walk_oid = c.parent(0)
                .map(|p| p.id())
                .unwrap_or_else(|_| head_oid);
        }

        // Set HEAD to the fetched commit (fast-forward)
        repo.reference(&format!("refs/heads/{}", branch_name), fetch_commit.id(), true, "Fast-forward pull")
            .map_err(|e| format!("Failed to update branch: {}", e))?;

        // Checkout the updated files
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
            .map_err(|e| format!("Failed to checkout after pull: {}", e))?;

        Ok(GitSyncResult {
            success: true,
            message: format!("Fast-forward: {} commit{} pulled", count, if count != 1 { "s" } else { "" }),
        })
    } else {
        // Non-fast-forward: perform a real merge
        let fetch_annotated = repo.find_annotated_commit(fetch_commit.id())
            .map_err(|e| format!("Failed to create annotated commit: {}", e))?;

        let (analysis, _) = repo.merge_analysis(&[&fetch_annotated])
            .map_err(|e| format!("Merge analysis failed: {}", e))?;

        if analysis.is_up_to_date() {
            return Ok(GitSyncResult {
                success: true,
                message: "Already up-to-date".to_string(),
            });
        }

        // Do the merge
        let mut merge_opts = git2::MergeOptions::new();
        repo.merge(&[&fetch_annotated], Some(&mut merge_opts), None)
            .map_err(|e| format!("Merge failed: {}", e))?;

        // Check for conflicts
        let mut index = repo.index()
            .map_err(|e| format!("Failed to get index after merge: {}", e))?;

        if index.has_conflicts() {
            // Abort merge and report conflicts
            repo.cleanup_state()
                .unwrap_or_else(|_| ());

            return Ok(GitSyncResult {
                success: false,
                message: "Merge conflicts detected. Please resolve conflicts manually and commit.".to_string(),
            });
        }

        // No conflicts — auto-commit the merge
        let tree_id = index.write_tree()
            .map_err(|e| format!("Failed to write merge tree: {}", e))?;

        let tree = repo.find_tree(tree_id)
            .map_err(|e| format!("Failed to find merge tree: {}", e))?;

        let sig = repo.signature()
            .map_err(|e| format!("Failed to get signature: {}", e))?;

        let merge_commit_id = repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            &format!("Merge branch '{}' of origin", branch_name),
            &tree,
            &[&head_commit, &fetch_commit],
        ).map_err(|e| format!("Failed to create merge commit: {}", e))?;

        // Cleanup merge state
        repo.cleanup_state()
            .unwrap_or_else(|_| ());

        Ok(GitSyncResult {
            success: true,
            message: format!("Merged {} commit{} (merge commit: {:.7})",
                if merge_commit_id.is_zero() { 0 } else { 1 },
                if merge_commit_id.is_zero() { "s" } else { "" },
                merge_commit_id
            ),
        })
    }
}

// ===========================================================================
// Tauri commands - AI Agent Service
// ===========================================================================

/// Send a prompt to the AI and stream the response back via SSE events.
/// Emits `pm_agent_chunk` events to the frontend.
#[tauri::command]
async fn agent_chat_stream(
    app: AppHandle,
    _state: tauri::State<'_, AppState>,
    request: AgentChatRequest,
) -> Result<(), String> {
    // Retrieve API key from keyring
    let api_key = get_api_key_inner()
        .map_err(|e| format!("API key not configured: {}. Please set your API key in Settings.", e))?;

    let client = reqwest::Client::new();

    // Build the request body for Google Gemini API (OpenAI-compatible endpoint)
    let mut messages_payload = Vec::new();

    // If context is provided, prepend it as a system instruction
    if let Some(ctx) = &request.context {
        messages_payload.push(serde_json::json!({
            "role": "system",
            "content": ctx
        }));
    }

    for msg in &request.messages {
        messages_payload.push(serde_json::json!({
            "role": msg.role,
            "content": msg.content
        }));
    }

    let body = serde_json::json!({
        "model": request.model,
        "messages": messages_payload,
        "stream": true
    });

    let url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

    let response = client
        .post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to AI API: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_body = response.text().await.unwrap_or_else(|_| "Unknown error".into());
        let err_msg = format!("AI API error ({}): {}", status, error_body);
        let _ = app.emit("pm_agent_chunk", AgentChunkEvent {
            text: String::new(),
            is_done: false,
            error: Some(err_msg.clone()),
        });
        return Err(err_msg);
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                buffer.push_str(&text);

                // Process complete SSE lines
                while let Some(pos) = buffer.find('\n') {
                    let line = buffer[..pos].trim().to_string();
                    buffer = buffer[pos + 1..].to_string();

                    if line.starts_with("data: ") {
                        let data = &line[6..];
                        if data == "[DONE]" {
                            let _ = app.emit("pm_agent_chunk", AgentChunkEvent {
                                text: String::new(),
                                is_done: true,
                                error: None,
                            });
                            return Ok(());
                        }

                        // Parse the SSE data as JSON
                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                            if let Some(choices) = parsed.get("choices") {
                                if let Some(first_choice) = choices.as_array().and_then(|a| a.first()) {
                                    if let Some(delta) = first_choice.get("delta") {
                                        if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                                            let _ = app.emit("pm_agent_chunk", AgentChunkEvent {
                                                text: content.to_string(),
                                                is_done: false,
                                                error: None,
                                            });
                                        }
                                    }
                                    // Check for finish_reason
                                    if let Some(finish) = first_choice.get("finish_reason") {
                                        if finish.as_str() == Some("stop") {
                                            let _ = app.emit("pm_agent_chunk", AgentChunkEvent {
                                                text: String::new(),
                                                is_done: true,
                                                error: None,
                                            });
                                            return Ok(());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => {
                let err_msg = format!("Stream error: {}", e);
                let _ = app.emit("pm_agent_chunk", AgentChunkEvent {
                    text: String::new(),
                    is_done: false,
                    error: Some(err_msg.clone()),
                });
                return Err(err_msg);
            }
        }
    }

    // Stream ended without [DONE] marker
    let _ = app.emit("pm_agent_chunk", AgentChunkEvent {
        text: String::new(),
        is_done: true,
        error: None,
    });

    Ok(())
}

/// Store an API key in the OS keyring.
#[tauri::command]
fn store_api_key(key: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    entry.set_password(&key)
        .map_err(|e| format!("Failed to store API key: {}", e))?;
    Ok(())
}/// Check if an API key is stored in the OS keyring (returns true/false, never the key itself).
#[tauri::command]
fn has_api_key() -> Result<bool, String> {
    match get_api_key_inner() {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// Delete the stored API key from the OS keyring.
#[tauri::command]
fn delete_api_key() -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    entry.delete_credential()
        .map_err(|e| format!("Failed to delete API key: {}", e))?;
    Ok(())
}

/// Read the active LLM provider config from workspace settings.yaml.
/// Returns (api_key, api_base, model) if a provider with HTTP API is configured.
fn get_llm_provider_from_settings(workspace: &str) -> Option<(String, String, String)> {
    let settings_path = PathBuf::from(workspace)
        .join(".neuro")
        .join("settings.yaml");

    if !settings_path.exists() {
        return None;
    }

    let content = fs::read_to_string(&settings_path).ok()?;
    let settings: AppSettings = serde_yaml::from_str(&content).ok()?;

    let provider_name = &settings.llm.provider;
    if provider_name.is_empty() {
        return None;
    }

    // Claude Code is a CLI bridge, not a direct HTTP API — skip it
    if provider_name == "claude-code" {
        // Try to find any other provider with api_key and api_base configured
        for (name, config) in &settings.providers {
            if name != "claude-code" && !config.api_key.is_empty() && !config.api_base.is_empty() {
                let model = if settings.llm.model.is_empty() {
                    "default".to_string()
                } else {
                    settings.llm.model.clone()
                };
                return Some((config.api_key.clone(), config.api_base.clone(), model));
            }
        }
        return None;
    }

    let provider_config = settings.providers.get(provider_name)?;
    if provider_config.api_key.is_empty() || provider_config.api_base.is_empty() {
        return None;
    }

    let model = if settings.llm.model.is_empty() {
        "default".to_string()
    } else {
        settings.llm.model.clone()
    };

    Some((provider_config.api_key.clone(), provider_config.api_base.clone(), model))
}

/// Internal helper to retrieve the API key (never exposed to frontend).
fn get_api_key_inner() -> Result<String, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    entry.get_password()
        .map_err(|e| format!("Key not found: {}", e))
}

/// Create a new Feature from an Agent's structured output.
/// Creates the directory, writes spec.md / task.md / checklist.md, and updates queue.yaml.
#[tauri::command]
async fn create_feature_from_agent(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
    request: CreateFeatureRequest,
) -> Result<String, String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let plan = &request.plan;
    let feature_id = &plan.id;
    let dir_name = format!("pending-{}", feature_id);
    let features_dir = PathBuf::from(&workspace).join("features");
    let feat_dir = features_dir.join(&dir_name);

    // Check if the feature directory already exists
    if feat_dir.exists() {
        return Err(format!("Feature '{}' already exists", feature_id));
    }

    // Create the feature directory
    fs::create_dir_all(&feat_dir)
        .map_err(|e| format!("Failed to create feature directory: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();
    let deps_str = plan.dependencies.join(", ");

    // Generate spec.md
    let spec_content = format!(
r#"# Feature: {} {}

## Basic Information
- **ID**: {}
- **Name**: {}
- **Priority**: {}
- **Size**: {}
- **Dependencies**: {}
- **Parent**: {}
- **Created**: {}

## Description
{}

## User Value Points
{}

## Technical Solution

### Architecture
```rust
// To be defined during development
```

## Acceptance Criteria (Gherkin)

```gherkin
Scenario: Basic functionality
  Given the feature is implemented
  When the user interacts with it
  Then the expected behavior occurs
```
"#,
        feature_id,
        plan.name,
        feature_id,
        plan.name,
        plan.priority,
        plan.size,
        deps_str,
        request.parent_id,
        now,
        plan.description,
        plan.value_points.iter().enumerate().map(|(i, vp)| format!("{}. {}", i + 1, vp)).collect::<Vec<_>>().join("\n")
    );

    fs::write(feat_dir.join("spec.md"), &spec_content)
        .map_err(|e| format!("Failed to write spec.md: {}", e))?;

    // Generate task.md
    let mut task_content = format!("# Tasks: {}\n\n## Task Breakdown\n\n", feature_id);
    for (idx, group) in plan.tasks.iter().enumerate() {
        task_content.push_str(&format!("### {}. {}\n", idx + 1, group.group_name));
        for item in &group.items {
            task_content.push_str(&format!("- [ ] {}\n", item));
        }
        task_content.push('\n');
    }
    task_content.push_str(&format!(
        "## Progress Log\n| Date | Progress | Notes |\n|------|----------|-------|\n| {} | Created | Feature created by AI Agent |\n",
        chrono::Utc::now().format("%Y-%m-%d")
    ));

    fs::write(feat_dir.join("task.md"), &task_content)
        .map_err(|e| format!("Failed to write task.md: {}", e))?;

    // Generate checklist.md
    let checklist_content = format!(
r#"# Checklist: {}

## Completion Checklist

### Development
- [ ] All tasks in task.md completed
- [ ] Code has been self-tested

### Code Quality
- [ ] Code style follows conventions
- [ ] No obvious code smells
- [ ] Necessary comments added

### Testing
- [ ] Unit tests written (if needed)
- [ ] Tests pass

### Documentation
- [ ] spec.md technical solution filled in
- [ ] Related docs updated
"#,
        feature_id
    );

    fs::write(feat_dir.join("checklist.md"), &checklist_content)
        .map_err(|e| format!("Failed to write checklist.md: {}", e))?;

    // Update queue.yaml: add to pending list
    let queue_yaml_path = PathBuf::from(&workspace)
        .join("feature-workflow")
        .join("queue.yaml");

    let content = fs::read_to_string(&queue_yaml_path)
        .map_err(|e| format!("Failed to read queue.yaml: {}", e))?;

    let mut queue: QueueYaml = serde_yaml::from_str(&content)
        .map_err(|e| format!("Failed to parse queue.yaml: {}", e))?;

    // Add the new feature to the pending list
    queue.pending.push(FeatureNode {
        id: feature_id.clone(),
        name: plan.name.clone(),
        priority: plan.priority,
        size: plan.size.clone(),
        dependencies: plan.dependencies.clone(),
        completed_at: None,
        tag: None,
        details: None,
    });

    // Add the feature ID to the parent's features list
    for parent in &mut queue.parents {
        if parent.id == request.parent_id {
            if !parent.features.contains(&feature_id.clone()) {
                parent.features.push(feature_id.clone());
            }
        }
    }

    // Update meta timestamp
    queue.meta.last_updated = chrono::Utc::now().to_rfc3339();

    // Atomic write
    let temp_path = queue_yaml_path.with_extension("yaml.tmp");
    let yaml_str = serde_yaml::to_string(&queue)
        .map_err(|e| format!("Failed to serialize queue.yaml: {}", e))?;

    fs::write(&temp_path, &yaml_str)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    fs::rename(&temp_path, &queue_yaml_path)
        .map_err(|e| format!("Failed to rename temp to queue.yaml: {}", e))?;

    // Broadcast change so the TaskBoard auto-refreshes
    let _ = app.emit("fs://workspace-changed", FsChangeEvent {
        paths: vec![
            queue_yaml_path.to_string_lossy().to_string(),
            feat_dir.to_string_lossy().to_string(),
        ],
        kind: "agent-feature-created".into(),
    });

    Ok(feature_id.clone())
}

/// Ask the AI to generate a Feature plan as structured JSON output.
/// Returns the parsed plan so the frontend can confirm before creating files.
#[tauri::command]
async fn agent_generate_feature_plan(
    request: AgentChatRequest,
) -> Result<FeaturePlanOutput, String> {
    let api_key = get_api_key_inner()
        .map_err(|e| format!("API key not configured: {}", e))?;

    let client = reqwest::Client::new();

    let system_prompt = r#"You are a PM Agent that plans software features. The user will describe a feature they want to build.

You MUST respond with ONLY a valid JSON object (no markdown, no code fences) with this exact schema:
{
  "id": "feat-<short-kebab-case-name>",
  "name": "<Human-readable feature name>",
  "priority": <number 1-100>,
  "size": "<S|M|L|XL>",
  "dependencies": ["<list of feature IDs this depends on>"],
  "description": "<detailed description of the feature>",
  "value_points": ["<value point 1>", "<value point 2>", "<value point 3>"],
  "tasks": [
    {
      "group_name": "<Task group name>",
      "items": ["<task item 1>", "<task item 2>"]
    }
  ]
}

Rules:
- id must start with "feat-" and use kebab-case
- size must be one of: S, M, L, XL
- priority should be 1-100 (higher = more important)
- Provide 2-5 task groups, each with 2-5 specific task items
- Include 3 user value points
- Respond ONLY with the JSON object, nothing else"#;

    let mut messages_payload = vec![serde_json::json!({
        "role": "system",
        "content": system_prompt
    })];

    for msg in &request.messages {
        messages_payload.push(serde_json::json!({
            "role": msg.role,
            "content": msg.content
        }));
    }

    let body = serde_json::json!({
        "model": request.model,
        "messages": messages_payload,
        "temperature": 0.7,
        "response_format": { "type": "json_object" }
    });

    let url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

    let response = client
        .post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to AI API: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_body = response.text().await.unwrap_or_else(|_| "Unknown error".into());
        return Err(format!("AI API error ({}): {}", status, error_body));
    }

    let response_json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API response: {}", e))?;

    let content_str = response_json
        .get("choices")
        .and_then(|c| c.as_array())
        .and_then(|a| a.first())
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .ok_or_else(|| "Failed to extract content from API response".to_string())?;

    let plan: FeaturePlanOutput = serde_json::from_str(content_str)
        .map_err(|e| format!("Failed to parse feature plan JSON: {}. Raw content: {}", e, content_str))?;

    Ok(plan)
}

// ===========================================================================
// Tauri commands - ReqAgent (Claude Code CLI Bridge)
// ===========================================================================

/// Check if Claude CLI is available on the system PATH.
fn check_claude_cli() -> Result<(), String> {
    let output = Command::new("which")
        .arg("claude")
        .output()
        .map_err(|_| "Failed to check for Claude CLI".to_string())?;

    if !output.status.success() {
        return Err(
            "Claude Code CLI not found. Please install it: npm install -g @anthropic-ai/claude-code".to_string()
        );
    }
    Ok(())
}

/// System prompt for the requirements analysis agent.
/// Shared between req_agent_start and req_agent_send_message.
const REQ_AGENT_SYSTEM_PROMPT: &str = r#"你是需求分析专家。当用户的需求分析完成后：

1. 使用 Glob/Read 工具了解项目现有结构
2. 使用 Write 工具将分析结果写入 features/pending-{feature-id}/ 目录
3. 遵循项目的 feature 文档规范：
   - spec.md — 需求规格（包含 Gherkin 验收标准）
   - task.md — 任务分解
   - checklist.md — 完成检查清单
4. 使用 Read/Edit 工具更新 feature-workflow/queue.yaml 的 pending 列表

## 文档格式规范

### spec.md 格式
```
# Feature: {id} {name}

## Basic Information
* **ID**: {id}
* **Name**: {name}
* **Priority**: {number 1-100}
* **Size**: S/M/L/XL
* **Dependencies**: [list of feature IDs]
* **Parent**: null or parent-id
* **Children**: []
* **Created**: {date}

## Description
{detailed description}

## User Value Points
1. **{title}** — {description}

## Technical Solution
{architecture and implementation approach}

## Acceptance Criteria (Gherkin)
```gherkin
Scenario: ...
  Given ...
  When ...
  Then ...
```

### task.md 格式
```
# Tasks: {id}

## Task Breakdown

### 1. {Group Name}
- [ ] {task item}

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
```

### checklist.md 格式
```
# Checklist: {id}

## Completion Checklist

### Development
- [ ] All tasks in task.md completed
- [ ] Code has been self-tested

### Code Quality
- [ ] Code style follows conventions

### Testing
- [ ] Unit tests written (if needed)

### Documentation
- [ ] spec.md technical solution filled in
```

## queue.yaml 更新规则
在 pending 列表中添加：
```yaml
  - id: {feature-id}
    name: "{feature name}"
    priority: {number}
    dependencies:
      - {dep-id}
```

## 重要规则
- feature ID 必须以 "feat-" 开头，使用 kebab-case
- 检查 features/ 目录下是否已存在同名 feature，避免冲突
- 如果 ID 冲突，提示用户并建议替代 ID
- 用户取消时不创建任何文件"#;

/// Initialize a ReqAgent session.
/// Only performs CLI availability check and generates a session ID.
/// No long-lived process is started; each message spawns its own process.
#[tauri::command]
async fn req_agent_start(
    state: tauri::State<'_, AppState>,
    session_id: Option<String>,
) -> Result<String, String> {
    // session_id parameter is accepted for API compatibility but always generates a new session
    let _ = session_id;
    // Pre-flight: check CLI exists
    check_claude_cli()?;

    // Stop any existing session first
    {
        let mut agent = state.req_agent.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut child) = agent.process {
            let _ = child.kill();
            let _ = child.wait();
        }
        agent.process = None;
        agent.stdin = None;
        agent.session_id = None;
    }

    // Generate new session ID (always fresh, ignore provided session_id for safety)
    let sid = Uuid::new_v4().to_string();

    // Store only the session ID (no process spawned)
    {
        let mut agent = state.req_agent.lock().map_err(|e| e.to_string())?;
        agent.session_id = Some(sid.clone());
    }

    Ok(sid)
}

/// Send a user message to Claude Code CLI using a per-message process model.
/// Each call spawns a new `claude --print --resume --session-id <id>` process,
/// passes the user message as a command-line argument, reads stdout until EOF,
/// emits streaming events, and lets the process exit naturally.
#[tauri::command]
async fn req_agent_send_message(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    message: String,
) -> Result<(), String> {
    // Retrieve the current session ID
    let sid = {
        let agent = state.req_agent.lock().map_err(|e| e.to_string())?;
        agent.session_id.clone()
            .ok_or_else(|| "No active agent session. Call req_agent_start first.".to_string())?
    };

    // Get workspace path for --add-dir
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();

    // Build CLI arguments: --print --resume <session-id> to continue the conversation context
    let mut args = vec![
        "--print".to_string(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--verbose".to_string(),
        "--resume".to_string(),
        sid.clone(),  // session-id as positional arg after --resume
        "--append-system-prompt".to_string(),
        REQ_AGENT_SYSTEM_PROMPT.to_string(),
        "--permission-mode".to_string(),
        "acceptEdits".to_string(),
        "--allowedTools".to_string(),
        "Read Write Glob Grep Bash Edit".to_string(),
        "--".to_string(),
        message.clone(),
    ];

    // Add workspace directory for file access
    if !workspace.is_empty() {
        args.push("--add-dir".to_string());
        args.push(workspace);
    }

    // Spawn a temporary CLI process for this single message
    let mut child = Command::new("claude")
        .args(&args)
        .stdin(Stdio::null())  // No stdin needed — message is in args
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn Claude CLI: {}", e))?;

    let stdout_handle = child.stdout.take()
        .ok_or_else(|| "Failed to get stdout handle".to_string())?;
    let stderr_handle = child.stderr.take()
        .ok_or_else(|| "Failed to get stderr handle".to_string())?;

    // Store the child process so req_agent_stop can kill it if needed
    {
        let mut agent = state.req_agent.lock().map_err(|e| e.to_string())?;
        // Clean up any previous leftover process
        if let Some(ref mut old_child) = agent.process {
            let _ = old_child.kill();
            let _ = old_child.wait();
        }
        agent.process = Some(child);
    }

    // Spawn background thread to read stdout and emit events
    let app_handle = app.clone();
    let emit_sid = sid.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout_handle);
        for line in reader.lines() {
            match line {
                Ok(text) => {
                    let trimmed = text.trim();
                    if trimmed.is_empty() {
                        continue;
                    }

                    // Try to parse as JSON
                    match serde_json::from_str::<serde_json::Value>(trimmed) {
                        Ok(json_obj) => {
                            let msg_type = json_obj.get("type")
                                .and_then(|t| t.as_str())
                                .unwrap_or("unknown")
                                .to_string();

                            let response_session_id = json_obj.get("session_id")
                                .and_then(|s| s.as_str())
                                .map(|s| s.to_string());

                            // Check if this is a result (completion) message
                            let is_result = msg_type == "result";

                            // Extract text content from assistant messages
                            // --verbose: {"type":"assistant","message":{"content":[{"type":"text","text":"..."}]}}
                            // non-verbose: {"type":"assistant","content":"..."}
                            fn extract_content_blocks(val: &serde_json::Value) -> String {
                                if let Some(s) = val.as_str() {
                                    s.to_string()
                                } else if let Some(arr) = val.as_array() {
                                    arr.iter()
                                        .filter_map(|item| {
                                            let item_type = item.get("type").and_then(|t| t.as_str()).unwrap_or("");
                                            match item_type {
                                                "text" => {
                                                    item.get("text").and_then(|t| t.as_str()).map(|s| s.to_string())
                                                }
                                                "tool_use" => {
                                                    let name = item.get("name").and_then(|n| n.as_str()).unwrap_or("unknown");
                                                    let input_preview = item.get("input")
                                                        .and_then(|i| serde_json::to_string(i).ok())
                                                        .map(|s| {
                                                            let s = s.replace('\n', " ");
                                                            if s.len() > 100 { format!("{}...", &s[..100]) } else { s }
                                                        })
                                                        .unwrap_or_default();
                                                    Some(format!("[tool: {}] {}", name, input_preview))
                                                }
                                                _ => None
                                            }
                                        })
                                        .collect::<Vec<_>>()
                                        .join("\n")
                                } else {
                                    String::new()
                                }
                            }

                            let text = if msg_type == "assistant" {
                                if let Some(msg_obj) = json_obj.get("message") {
                                    msg_obj.get("content")
                                        .map(extract_content_blocks)
                                        .unwrap_or_default()
                                } else {
                                    json_obj.get("content")
                                        .map(extract_content_blocks)
                                        .unwrap_or_default()
                                }
                            } else if is_result {
                                String::new()
                            } else if msg_type == "system" {
                                // Extract meaningful info from system messages
                                let subtype = json_obj.get("subtype")
                                    .and_then(|s| s.as_str())
                                    .unwrap_or("");
                                let tools_count = json_obj.get("tools")
                                    .and_then(|t| t.as_array())
                                    .map(|a| a.len())
                                    .unwrap_or(0);
                                let model = json_obj.get("model")
                                    .and_then(|m| m.as_str())
                                    .unwrap_or("");
                                if subtype == "init" && tools_count > 0 {
                                    format!("init — {} tools available{}", tools_count,
                                        if model.is_empty() { String::new() } else { format!(", model: {}", model) })
                                } else if !subtype.is_empty() {
                                    format!("{}{}", subtype,
                                        if model.is_empty() { String::new() } else { format!(" — model: {}", model) })
                                } else {
                                    String::new()
                                }
                            } else {
                                trimmed.to_string()
                            };

                            // Check for error in result
                            let error = if is_result {
                                let subtype = json_obj.get("subtype")
                                    .and_then(|s| s.as_str())
                                    .unwrap_or("");
                                if subtype == "error" {
                                    json_obj.get("error")
                                        .and_then(|e| e.as_str())
                                        .map(|s| s.to_string())
                                } else {
                                    None
                                }
                            } else {
                                None
                            };

                            let event = ReqAgentChunkEvent {
                                text,
                                is_done: is_result,
                                error,
                                msg_type: Some(msg_type),
                                session_id: response_session_id,
                            };

                            let _ = app_handle.emit("req_agent_chunk", &event);

                            // Do NOT break on result — keep reading until EOF
                            // The process will exit naturally after producing the result message
                        }
                        Err(_) => {
                            // Non-JSON line, emit as raw text
                            let event = ReqAgentChunkEvent {
                                text: trimmed.to_string(),
                                is_done: false,
                                error: None,
                                msg_type: Some("raw".to_string()),
                                session_id: None,
                            };
                            let _ = app_handle.emit("req_agent_chunk", &event);
                        }
                    }
                }
                Err(_) => break, // EOF — process exited naturally
            }
        }
        // No disconnect event emitted here — process exit is expected (per-message model).
        // The frontend's persistent listener handles the is_done from the result message.
        let _ = emit_sid; // suppress unused warning
    });

    // Spawn background thread to read stderr (for error diagnostics)
    let app_handle_stderr = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr_handle);
        for line in reader.lines() {
            match line {
                Ok(text) => {
                    if !text.trim().is_empty() {
                        let event = ReqAgentChunkEvent {
                            text: String::new(),
                            is_done: false,
                            error: Some(format!("CLI stderr: {}", text)),
                            msg_type: Some("stderr".to_string()),
                            session_id: None,
                        };
                        let _ = app_handle_stderr.emit("req_agent_chunk", &event);
                    }
                }
                Err(_) => break,
            }
        }
    });

    Ok(())
}

/// Stop the ReqAgent session.
/// Kills any running message process and clears session state.
#[tauri::command]
fn req_agent_stop(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut agent = state.req_agent.lock().map_err(|e| e.to_string())?;

    if let Some(ref mut child) = agent.process {
        let _ = child.kill();
        let _ = child.wait();
    }

    agent.process = None;
    agent.stdin = None;
    agent.session_id = None;

    Ok(())
}

/// Query the current status of the ReqAgent session.
#[tauri::command]
fn req_agent_status(
    state: tauri::State<'_, AppState>,
) -> Result<ReqAgentStatus, String> {
    let mut agent = state.req_agent.lock().map_err(|e| e.to_string())?;

    let running = if let Some(ref mut child) = agent.process {
        match child.try_wait() {
            Ok(None) => true,   // still running (processing a message)
            Ok(Some(_)) => {
                // Process exited — clean up
                agent.process = None;
                false
            }
            Err(_) => false,
        }
    } else {
        false
    };

    Ok(ReqAgentStatus {
        running,
        session_id: agent.session_id.clone(),
    })
}

// ===========================================================================
// Tauri commands - Agent Runtime (feat-agent-runtime-core)
// ===========================================================================

/// List all registered agent runtimes and their status.
/// Uses cached detection data if available (call scan_agent_runtimes to refresh).
#[tauri::command]
fn list_agent_runtimes(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<AgentRuntimeInfo>, String> {
    let registry = state.agent_runtime_registry.lock().map_err(|e| e.to_string())?;
    Ok(registry.list_all())
}

/// Trigger a re-scan of all agent runtimes.
/// Detects CLI presence and version for each registered runtime.
#[tauri::command]
fn scan_agent_runtimes(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<AgentRuntimeInfo>, String> {
    let mut registry = state.agent_runtime_registry.lock().map_err(|e| e.to_string())?;
    Ok(registry.scan_all())
}

/// Get the status of a single agent runtime by id.
#[tauri::command]
fn get_runtime_status(
    state: tauri::State<'_, AppState>,
    runtime_id: String,
) -> Result<AgentRuntimeInfo, String> {
    let registry = state.agent_runtime_registry.lock().map_err(|e| e.to_string())?;
    registry.get_runtime(&runtime_id)
        .ok_or_else(|| format!("Runtime '{}' not found", runtime_id))
}

// ===========================================================================
// Tauri commands - Runtime Execute (feat-agent-runtime-execute)
// ===========================================================================

/// Execute a message on a specific runtime.
/// Spawns the CLI process, reads stdout/stderr in background threads,
/// and emits `agent://chunk` events to the frontend as StreamEvents arrive.
#[tauri::command]
async fn runtime_execute(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    runtime_id: String,
    message: String,
    session_id: Option<String>,
    system_prompt: Option<String>,
) -> Result<(), String> {
    // Get runtime instance
    let workspace = {
        let registry = state.agent_runtime_registry.lock().map_err(|e| e.to_string())?;
        let _instance = registry.get_runtime_instance(&runtime_id)?;
        let ws = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
        // We can't hold the mutex lock across threads, so drop it here.
        // The runtime instances are static (boxed trait objects) and won't be removed,
        // so we re-acquire in the spawned thread.
        let _ = _instance;
        ws
    };

    // Build execution parameters
    let params = ExecuteParams {
        message,
        session_id: session_id.clone(),
        workspace: if workspace.is_empty() { None } else { Some(workspace) },
        system_prompt,
        timeout_secs: 120,
    };

    // Diagnostic log for debugging multi-turn issues
    eprintln!("[runtime_execute] runtimeId={}, has_session_id={}, session_id={:?}",
        runtime_id,
        session_id.is_some(),
        session_id.as_deref().map(|s| if s.len() > 8 { &s[..8] } else { s })
    );

    // We need to call execute() while holding the registry lock briefly
    let receiver = {
        let registry = state.agent_runtime_registry.lock().map_err(|e| e.to_string())?;
        let runtime = registry.get_runtime_instance(&runtime_id)?;
        runtime.execute(params)?
    };

    // Spawn thread to forward events to frontend via Tauri events
    // Also buffer events into session_output (feat-runtime-session-output, feat-runtime-output-polish)
    let session_output = state.session_output.clone();
    // Prefer per-runtime session tracking, fall back to global active_session_id
    let active_session_id = {
        let sessions = state.active_sessions.lock().map_err(|e| e.to_string())?;
        if let Some(sid) = sessions.get(&runtime_id) {
            Some(sid.clone())
        } else {
            let sid = state.active_session_id.lock().map_err(|e| e.to_string())?;
            sid.clone()
        }
    };
    std::thread::spawn(move || {
        while let Ok(event) = receiver.recv() {
            let _ = app.emit("agent://chunk", &event);
            // Buffer the event for session output (feat-runtime-session-output)
            if let Some(ref sid) = active_session_id {
                if let Ok(mut buf) = session_output.lock() {
                    if let Some(events) = buf.get_mut(sid) {
                        events.push(event.clone());
                    }
                }
            }
            if event.is_done { break; }
        }
    });

    Ok(())
}

/// Start a new runtime session (creates a fresh session ID).
#[tauri::command]
async fn runtime_session_start(
    state: tauri::State<'_, AppState>,
    runtime_id: String,
) -> Result<String, String> {
    // Verify the runtime exists and is ready
    {
        let registry = state.agent_runtime_registry.lock().map_err(|e| e.to_string())?;
        let runtime = registry.get_runtime_instance(&runtime_id)?;
        if !runtime.is_ready() {
            return Err(format!("Runtime '{}' is not ready (CLI not found or unhealthy)", runtime_id));
        }
    }

    // Generate a new session ID
    let session_id = Uuid::new_v4().to_string();

    // Store the session ID in req_agent state for backward compatibility
    {
        let mut agent = state.req_agent.lock().map_err(|e| e.to_string())?;
        agent.session_id = Some(session_id.clone());
    }

    // Store as active session and initialize output buffer (feat-runtime-session-output)
    {
        *state.active_session_id.lock().map_err(|e| e.to_string())? = Some(session_id.clone());
        let mut buf = state.session_output.lock().map_err(|e| e.to_string())?;
        buf.insert(session_id.clone(), Vec::new());
    }

    // Store per-runtime active session (feat-runtime-output-polish)
    {
        let mut sessions = state.active_sessions.lock().map_err(|e| e.to_string())?;
        sessions.insert(runtime_id, session_id.clone());
    }

    Ok(session_id)
}

/// Stop a runtime session (kills any running process and clears state).
#[tauri::command]
fn runtime_session_stop(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut agent = state.req_agent.lock().map_err(|e| e.to_string())?;

    // Kill any running CLI process
    if let Some(ref mut child) = agent.process {
        let _ = child.kill();
        let _ = child.wait();
    }

    agent.process = None;
    agent.stdin = None;
    agent.session_id = None;

    Ok(())
}

// ===========================================================================
// Tauri commands - Session Output (feat-runtime-session-output)
// ===========================================================================

/// Information about the currently active session (feat-runtime-session-output)
#[derive(Debug, Clone, Serialize)]
pub struct ActiveSessionInfo {
    /// The active session ID
    pub session_id: String,
    /// Concatenated output text from all buffered StreamEvents
    pub output_text: String,
    /// Whether the session execution is complete (last event had is_done=true)
    pub is_done: bool,
    /// Number of buffered chunks
    pub chunk_count: usize,
}

/// Get the currently active session's buffered output (feat-runtime-session-output, feat-runtime-output-polish)
/// Accepts optional runtime_id to look up per-runtime session; falls back to global active session.
#[tauri::command]
fn get_active_session(
    state: tauri::State<'_, AppState>,
    runtime_id: Option<String>,
) -> Result<Option<ActiveSessionInfo>, String> {
    // Prefer per-runtime session lookup (feat-runtime-output-polish)
    let active_id = if let Some(rid) = &runtime_id {
        let sessions = state.active_sessions.lock().map_err(|e| e.to_string())?;
        sessions.get(rid).cloned()
    } else {
        None
    };

    // Fall back to global active session for backward compatibility
    let active_id = active_id.or_else(|| {
        let sid = state.active_session_id.lock().ok()?;
        sid.clone()
    });

    let Some(session_id) = active_id else {
        return Ok(None);
    };

    let buf = state.session_output.lock().map_err(|e| e.to_string())?;
    let events = match buf.get(&session_id) {
        Some(evts) => evts,
        None => return Ok(None),
    };

    // Build output text from events
    let output_text = events.iter().map(|e| e.text.clone()).collect::<Vec<_>>().join("");
    let is_done = events.last().map_or(false, |e| e.is_done);
    let chunk_count = events.len();

    Ok(Some(ActiveSessionInfo {
        session_id,
        output_text,
        is_done,
        chunk_count,
    }))
}

/// Get the full list of StreamEvent chunks for a session (fix-runtime-output-render)
/// Returns structured chunk data so the frontend can render each chunk with its type/color.
/// Accepts optional runtime_id to look up per-runtime session; falls back to global active session.
#[tauri::command]
fn get_session_chunks(
    state: tauri::State<'_, AppState>,
    runtime_id: Option<String>,
) -> Result<Vec<StreamEvent>, String> {
    // Prefer per-runtime session lookup
    let active_id = if let Some(rid) = &runtime_id {
        let sessions = state.active_sessions.lock().map_err(|e| e.to_string())?;
        sessions.get(rid).cloned()
    } else {
        None
    };

    // Fall back to global active session for backward compatibility
    let active_id = active_id.or_else(|| {
        let sid = state.active_session_id.lock().ok()?;
        sid.clone()
    });

    let Some(session_id) = active_id else {
        return Ok(Vec::new());
    };

    let buf = state.session_output.lock().map_err(|e| e.to_string())?;
    match buf.get(&session_id) {
        Some(evts) => Ok(evts.clone()),
        None => Ok(Vec::new()),
    }
}

/// Clear session output buffer and active session (feat-runtime-session-output, feat-runtime-output-polish)
/// Accepts optional runtime_id to clear a specific runtime's session.
#[tauri::command]
fn clear_session_output(
    state: tauri::State<'_, AppState>,
    runtime_id: Option<String>,
) -> Result<(), String> {
    // Clear per-runtime session (feat-runtime-output-polish)
    if let Some(rid) = &runtime_id {
        let mut sessions = state.active_sessions.lock().map_err(|e| e.to_string())?;
        if let Some(session_id) = sessions.remove(rid) {
            let mut buf = state.session_output.lock().map_err(|e| e.to_string())?;
            buf.remove(&session_id);
        }
    }

    // Also clear the global active session for backward compatibility
    let mut sid = state.active_session_id.lock().map_err(|e| e.to_string())?;
    if let Some(ref session_id) = *sid {
        let mut buf = state.session_output.lock().map_err(|e| e.to_string())?;
        buf.remove(session_id);
    }
    *sid = None;
    Ok(())
}

// ===========================================================================
// Tauri commands - Smart Router (feat-agent-runtime-router)
// ===========================================================================

/// Submit a task for automatic routing.
/// Classifies the task, selects the best available runtime, returns the routing decision.
/// Emits `router://task-routed` and optionally `router://fallback` events.
#[tauri::command]
async fn submit_task(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    task_description: String,
) -> Result<RoutingDecision, String> {
    // Get available runtimes
    let runtimes = {
        let registry = state.agent_runtime_registry.lock().map_err(|e| e.to_string())?;
        registry.list_all()
    };

    // Route the task
    let decision = {
        let mut router = state.router_engine.lock().map_err(|e| e.to_string())?;
        router.route(&task_description, &runtimes)
    };

    // Emit routing event
    let _ = app.emit("router://task-routed", &decision);

    // If fallback was used, emit fallback event
    if decision.fallback_used {
        if let Some(original) = &decision.original_preference {
            let _ = app.emit("router://fallback", serde_json::json!({
                "task_summary": RouterEngine::truncate_task(&task_description),
                "from_runtime": original,
                "to_runtime": decision.selected_runtime,
                "reason": decision.reason,
                "timestamp": decision.timestamp,
            }));
        }
    }

    Ok(decision)
}

/// Get the current routing rules configuration.
#[tauri::command]
fn get_routing_rules(
    state: tauri::State<'_, AppState>,
) -> Result<RoutingConfig, String> {
    let router = state.router_engine.lock().map_err(|e| e.to_string())?;
    Ok(router.get_config().clone())
}

/// Update routing rules configuration.
/// Validates against known runtimes before applying.
/// Persists the new config to the workspace directory.
#[tauri::command]
async fn update_routing_rules(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    config: RoutingConfig,
) -> Result<Vec<String>, String> {
    // Get known runtime ids for validation
    let known_ids: Vec<String> = {
        let registry = state.agent_runtime_registry.lock().map_err(|e| e.to_string())?;
        registry.list_all().iter().map(|r| r.id.clone()).collect()
    };

    // Validate
    let mut router = state.router_engine.lock().map_err(|e| e.to_string())?;
    let warnings = router.validate_config(&config, &known_ids);

    // Apply the new config
    router.update_config(config.clone());

    // Persist to workspace
    let workspace_path = state.workspace_path.lock().map_err(|e| e.to_string())?;
    if !workspace_path.is_empty() {
        if let Err(e) = save_routing_config(&workspace_path, &config) {
            // Log but don't fail - the in-memory config is still updated
            let _ = app.emit("router://config-save-error", serde_json::json!({
                "error": e.to_string(),
            }));
        }
    }

    Ok(warnings)
}

/// Get the routing decision history for a specific task or recent decisions.
#[tauri::command]
fn get_task_routing_decision(
    state: tauri::State<'_, AppState>,
    decision_id: Option<String>,
) -> Result<Vec<RoutingDecision>, String> {
    let router = state.router_engine.lock().map_err(|e| e.to_string())?;
    if let Some(id) = decision_id {
        // Find specific decision
        let found = router.get_decisions(1000)
            .iter()
            .filter(|d| d.decision_id == id)
            .cloned()
            .collect();
        Ok(found)
    } else {
        // Return recent decisions (last 50)
        Ok(router.get_decisions(50).to_vec())
    }
}

// ===========================================================================
// Tauri commands - Runtime process monitor (feat-claude-code-runtime-monitor)
// ===========================================================================

/// Keywords used to match Claude-related processes.
const CLAUDE_PROCESS_KEYWORDS: &[&str] = &["claude", "claude-code"];

/// Scan the system for runtime processes matching Claude-related keywords
/// whose working directory is within (or related to) the given workspace path.
#[tauri::command]
async fn scan_runtime_processes(
    state: tauri::State<'_, AppState>,
    workspace_path: String,
) -> Result<Vec<RuntimeProcessInfo>, String> {
    Ok(scan_runtime_processes_inner(&workspace_path))
}

/// Inner implementation that performs the actual process scan.
fn scan_runtime_processes_inner(workspace_path: &str) -> Vec<RuntimeProcessInfo> {
    let mut sys = System::new_all();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let mut results = Vec::new();

    for (pid, process) in sys.processes() {
        let name = process.name().to_string_lossy().to_lowercase();
        let exe = process.exe().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();

        // Check if this process matches any Claude-related keyword
        let is_match = CLAUDE_PROCESS_KEYWORDS.iter().any(|kw| {
            name.contains(kw) || exe.contains(kw)
        });

        // Also match node processes that have "claude" in their command line
        let cmdline = process.cmd().iter()
            .map(|s| s.to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join(" ")
            .to_lowercase();

        let is_node_claude = (name.contains("node") || name.contains("node")) &&
            CLAUDE_PROCESS_KEYWORDS.iter().any(|kw| cmdline.contains(kw));

        if !is_match && !is_node_claude {
            continue;
        }

        let working_dir = process.cwd()
            .map(|d| d.to_string_lossy().to_string())
            .unwrap_or_default();

        // Check if process cwd is within the workspace path (or if we can't determine, still include it)
        let in_workspace = if workspace_path.is_empty() {
            true
        } else if working_dir.is_empty() {
            true // Include if we can't determine cwd
        } else {
            working_dir.starts_with(workspace_path) || workspace_path.starts_with(&working_dir)
        };

        if !in_workspace {
            continue;
        }

        let cpu = process.cpu_usage();
        let memory = process.memory();

        // Determine runtime_id and display name
        let (runtime_id, display_name) = if is_match {
            ("claude-code".to_string(), "Claude Code".to_string())
        } else {
            ("claude-code".to_string(), "Claude Code (node)".to_string())
        };

        // Try to get start time
        let started_at = process.start_time();

        results.push(RuntimeProcessInfo {
            runtime_id,
            name: display_name,
            pid: pid.as_u32(),
            status: if cpu > 0.1 { "running".to_string() } else { "idle".to_string() },
            working_dir,
            cpu_usage: cpu,
            memory_bytes: memory,
            started_at: Some(started_at),
        });
    }

    results
}

// ===========================================================================
// Tauri commands - Kill process by PID (feat-runtime-process-stop)
// ===========================================================================

/// Kill a process by its PID.
/// Sends SIGTERM on Unix, uses TerminateProcess on Windows.
/// Returns Ok(()) if the kill signal was sent successfully or the process no longer exists.
#[tauri::command]
fn kill_process_by_pid(
    state: tauri::State<'_, AppState>,
    pid: u32,
) -> Result<(), String> {
    // Use sysinfo to verify the process exists before attempting to kill
    let mut sys = System::new_all();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let pid_obj = sysinfo::Pid::from_u32(pid);
    let process = sys.process(pid_obj);

    if process.is_none() {
        // Check if this PID belongs to an app-spawned process; if so, clean up session state
        cleanup_session_for_pid(&state, pid);
        return Err("Process not found or already terminated".to_string());
    }

    let proc = process.unwrap();

    // Attempt to kill the process
    let killed = proc.kill();
    if !killed {
        return Err(format!("Failed to kill process with PID {}", pid));
    }

    // Clean up any app-spawned session state associated with this PID
    cleanup_session_for_pid(&state, pid);

    Ok(())
}

/// Clean up session state for a terminated process.
/// If the killed PID matches a runtime session managed by the app, clear its session output.
fn cleanup_session_for_pid(state: &AppState, pid: u32) {
    // Clean up active_sessions: find any runtime whose spawned process had this PID
    if let Ok(mut sessions) = state.active_sessions.lock() {
        // We don't have a direct PID->runtime_id mapping in active_sessions,
        // but runtime_session_stop uses the agent.process PID.
        // For externally detected processes, just let the next scan refresh.
        let _ = sessions; // Hold lock briefly for consistency
    }
}

/// Start the runtime process monitor background thread.
/// Polls every 2 seconds and emits `runtime://status-changed` events.
#[tauri::command]
async fn start_runtime_monitor(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    workspace_path: String,
) -> Result<(), String> {
    // Stop any existing monitor
    stop_runtime_monitor_inner(&state)?;

    let (tx, rx) = std::sync::mpsc::channel::<()>();
    *state.runtime_monitor_stop.lock().map_err(|e| e.to_string())? = Some(tx);

    let app_handle = app.clone();
    std::thread::spawn(move || {
        loop {
            // Check stop signal
            if rx.try_recv().is_ok() {
                break;
            }

            // Scan processes
            let runtimes = scan_runtime_processes_inner(&workspace_path);
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();

            let payload = RuntimeStatusPayload {
                runtimes,
                timestamp,
            };

            let _ = app_handle.emit("runtime://status-changed", &payload);

            // Sleep 2 seconds, checking for stop signal every 100ms
            for _ in 0..20 {
                std::thread::sleep(Duration::from_millis(100));
                if rx.try_recv().is_ok() {
                    return;
                }
            }
        }
    });

    Ok(())
}

/// Stop the runtime process monitor.
#[tauri::command]
async fn stop_runtime_monitor(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    stop_runtime_monitor_inner(&state)
}

fn stop_runtime_monitor_inner(state: &tauri::State<'_, AppState>) -> Result<(), String> {
    let mut stop = state.runtime_monitor_stop.lock().map_err(|e| e.to_string())?;
    if let Some(tx) = stop.take() {
        let _ = tx.send(());
    }
    Ok(())
}

/// Read Claude Code session info from ~/.claude/ directory.
/// Looks for session files under the project directory matching the workspace.
#[tauri::command]
async fn read_claude_session(
    session_id: String,
) -> Result<Option<ClaudeSessionInfo>, String> {
    let home = dirs_home()?;
    let claude_dir = PathBuf::from(home).join(".claude");

    if !claude_dir.exists() {
        return Ok(None);
    }

    // Look for session files under projects/*/sessions/{session_id}.json
    let projects_dir = claude_dir.join("projects");
    if !projects_dir.exists() {
        return Ok(None);
    }

    // Search all project directories for the session
    if let Ok(entries) = fs::read_dir(&projects_dir) {
        for entry in entries.flatten() {
            let sessions_dir = entry.path().join("sessions");
            if !sessions_dir.is_dir() { continue; }

            let session_file = sessions_dir.join(format!("{}.json", session_id));
            if !session_file.exists() { continue; }

            match fs::read_to_string(&session_file) {
                Ok(content) => {
                    match serde_json::from_str::<serde_json::Value>(&content) {
                        Ok(json) => {
                            let status = json.get("status")
                                .and_then(|s| s.as_str())
                                .unwrap_or("unknown")
                                .to_string();

                            let model = json.get("model")
                                .and_then(|m| m.as_str())
                                .map(|s| s.to_string());

                            let current_task = json.get("current_task")
                                .and_then(|t| t.as_str())
                                .map(|s| s.to_string());

                            let started_at = json.get("started_at")
                                .and_then(|t| t.as_str())
                                .map(|s| s.to_string());

                            let token_count = if let Some(tc) = json.get("token_count") {
                                Some(TokenCount {
                                    input: tc.get("input").and_then(|v| v.as_u64()).unwrap_or(0),
                                    output: tc.get("output").and_then(|v| v.as_u64()).unwrap_or(0),
                                })
                            } else {
                                None
                            };

                            return Ok(Some(ClaudeSessionInfo {
                                session_id,
                                status,
                                model,
                                token_count,
                                current_task,
                                started_at,
                            }));
                        }
                        Err(_) => continue,
                    }
                }
                Err(_) => continue,
            }
        }
    }

    Ok(None)
}

/// Helper: get the user's home directory.
fn dirs_home() -> Result<String, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|e| format!("Cannot determine home directory: {}", e))
}

// ===========================================================================
// Misc commands
// ===========================================================================

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Neuro Syntax IDE.", name)
}

// ===========================================================================
// Internal helpers
// ===========================================================================

fn persist_workspace(app: &AppHandle, path: &str) -> Result<(), String> {
    let store = get_store(app)?;
    store.set(STORE_KEY_WORKSPACE, serde_json::Value::String(path.to_string()));
    store.save().map_err(|e: tauri_plugin_store::Error| e.to_string())
}

fn get_store(app: &AppHandle) -> Result<std::sync::Arc<tauri_plugin_store::Store<tauri::Wry>>, String> {
    tauri_plugin_store::StoreBuilder::new(app, STORE_FILENAME)
        .build()
        .map_err(|e| e.to_string())
}

fn scan_dir(dir: &PathBuf, depth: u32) -> std::io::Result<Vec<FileNode>> {
    if depth >= MAX_DEPTH {
        return Ok(vec![]);
    }

    let mut entries: Vec<std::fs::DirEntry> = fs::read_dir(dir)?
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            !SKIP_NAMES.contains(&name.as_str())
        })
        .collect();

    entries.sort_by(|a, b| {
        let a_dir = a.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
        let b_dir = b.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
        match (a_dir, b_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.file_name().cmp(&b.file_name()),
        }
    });

    let mut nodes = Vec::new();
    for entry in entries {
        let name = entry.file_name().to_string_lossy().to_string();
        let path = entry.path().to_string_lossy().to_string();
        let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
        let children = if is_dir {
            Some(scan_dir(&entry.path(), depth + 1)?)
        } else {
            None
        };
        nodes.push(FileNode { name, path, is_dir, children });
    }
    Ok(nodes)
}

// ===========================================================================
// File read / write commands (used by EditorView.tsx)
// ===========================================================================

/// List all .md files in the given directory (non-recursive, filters hidden/dirs).
/// Returns a list of { name, path } objects sorted alphabetically.
#[derive(Debug, Serialize, Clone)]
pub struct MdFileEntry {
    pub name: String,
    pub path: String,
}

#[tauri::command]
async fn list_md_files(dir_path: String) -> Result<Vec<MdFileEntry>, String> {
    let dir = PathBuf::from(&dir_path);
    if !dir.exists() {
        return Err(format!("Directory does not exist: {}", dir_path));
    }
    if !dir.is_dir() {
        return Err(format!("Path is not a directory: {}", dir_path));
    }

    let mut entries: Vec<MdFileEntry> = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            // Skip hidden files and directories
            if name.starts_with('.') { return false; }
            // Only files
            e.file_type().map(|ft| ft.is_file()).unwrap_or(false)
        })
        .filter(|e| {
            // Only .md files
            e.path().extension()
                .map(|ext| ext == "md")
                .unwrap_or(false)
        })
        .map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let path = e.path().to_string_lossy().to_string();
            MdFileEntry { name, path }
        })
        .collect();

    // Sort alphabetically by name
    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(entries)
}

#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file '{}': {}", path, e))
}

/// Read a file as base64-encoded string. Used for binary files like images.
#[tauri::command]
async fn read_file_base64(path: String) -> Result<String, String> {
    let bytes = fs::read(&path)
        .map_err(|e| format!("Failed to read file '{}': {}", path, e))?;
    Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes))
}

// ===========================================================================
// Tauri commands - Image metadata (feat-file-preview-image-enhance)
// ===========================================================================

/// Image metadata returned by read_image_meta command.
#[derive(Debug, Serialize, Clone)]
pub struct ImageMetadata {
    /// Image width in pixels (0 if unknown).
    pub width: u32,
    /// Image height in pixels (0 if unknown).
    pub height: u32,
    /// File size in bytes.
    pub file_size: u64,
    /// Human-readable file size string.
    pub file_size_str: String,
    /// File format / extension (e.g. "jpg", "png").
    pub format: String,
    /// MIME type (e.g. "image/jpeg").
    pub mime_type: String,
    /// Bit depth if detected (8, 16, etc.).
    pub bit_depth: Option<u8>,
    /// Color space name (e.g. "sRGB", "Adobe RGB", "Unknown").
    pub color_space: String,
    /// EXIF data fields (camera-related metadata).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exif: Option<ExifData>,
}

/// EXIF metadata extracted from image file headers.
#[derive(Debug, Serialize, Clone)]
pub struct ExifData {
    /// Camera make / manufacturer.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub camera_make: Option<String>,
    /// Camera model.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub camera_model: Option<String>,
    /// Lens model.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lens_model: Option<String>,
    /// F-number (aperture), e.g. "f/2.8".
    #[serde(skip_serializing_if = "Option::is_none")]
    pub f_number: Option<String>,
    /// Exposure time (shutter speed), e.g. "1/125".
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exposure_time: Option<String>,
    /// ISO speed rating.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iso: Option<u32>,
    /// Focal length in mm, e.g. "50mm".
    #[serde(skip_serializing_if = "Option::is_none")]
    pub focal_length: Option<String>,
    /// Date/time the photo was taken.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date_time_original: Option<String>,
    /// Software used.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub software: Option<String>,
    /// Image orientation (e.g. "Horizontal (normal)").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub orientation: Option<String>,
    /// GPS coordinates (latitude, longitude).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gps: Option<GpsInfo>,
}

/// GPS coordinate information.
#[derive(Debug, Serialize, Clone)]
pub struct GpsInfo {
    pub latitude: f64,
    pub longitude: f64,
    pub altitude: Option<f64>,
}

/// Helper: format file size as human-readable string.
fn format_file_size(bytes: u64) -> String {
    if bytes < 1024 {
        format!("{} B", bytes)
    } else if bytes < 1024 * 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else if bytes < 1024 * 1024 * 1024 {
        format!("{:.2} MB", bytes as f64 / (1024.0 * 1024.0))
    } else {
        format!("{:.2} GB", bytes as f64 / (1024.0 * 1024.0 * 1024.0))
    }
}

/// Helper: determine MIME type from file extension.
fn image_mime_type(ext: &str) -> String {
    match ext {
        "png" => "image/png",
        "jpg" | "jpeg" | "jfif" | "pjpeg" | "pjp" => "image/jpeg",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "heic" | "heif" => "image/heic",
        "tiff" | "tif" => "image/tiff",
        _ => "application/octet-stream",
    }.to_string()
}

/// Parse EXIF-like data from JPEG/TIFF file headers.
/// Reads the first 64KB of the file to extract EXIF IFD entries.
fn parse_exif_from_header(data: &[u8]) -> Option<ExifData> {
    // Check for JPEG SOI marker
    if data.len() < 4 { return None; }

    // JPEG EXIF parsing
    if data[0] == 0xFF && data[1] == 0xD8 {
        // Find APP1 marker (0xFFE1)
        let mut offset = 2;
        while offset + 4 < data.len() {
            if data[offset] != 0xFF { break; }
            let marker = data[offset + 1];
            if marker == 0xE1 {
                // APP1 found — check for "Exif\0\0" header
                let seg_start = offset + 4;
                if seg_start + 6 > data.len() { break; }
                let header = &data[seg_start..seg_start + 6];
                if header == b"Exif\x00\x00" {
                    let exif_start = seg_start + 6;
                    return Some(parse_tiff_ifd(data, exif_start));
                }
            }
            // Skip to next marker
            if offset + 2 < data.len() {
                let seg_len = ((data[offset + 2] as usize) << 8) | (data[offset + 3] as usize);
                offset += 2 + seg_len;
            } else {
                break;
            }
        }
    }

    // TIFF files — starts with byte order mark (II or MM)
    if (data[0] == b'I' && data[1] == b'I') || (data[0] == b'M' && data[1] == b'M') {
        return Some(parse_tiff_ifd(data, 0));
    }

    // WebP files — "RIFF....WEBP" header, check for EXIF chunk
    if data.len() > 12 && &data[0..4] == b"RIFF" && &data[8..12] == b"WEBP" {
        let mut offset = 12;
        while offset + 8 < data.len() {
            let chunk_id = &data[offset..offset + 4];
            let chunk_size = (data[offset + 4] as u32)
                | ((data[offset + 5] as u32) << 8)
                | ((data[offset + 6] as u32) << 16)
                | ((data[offset + 7] as u32) << 24);
            if chunk_id == b"EXIF" {
                let exif_start = offset + 8;
                let exif_end = exif_start + chunk_size as usize;
                if exif_end <= data.len() {
                    // Try to find the TIFF header within the EXIF chunk
                    // Skip any leading padding/exif header
                    if exif_start + 6 <= data.len() && &data[exif_start..exif_start + 6] == b"Exif\x00\x00" {
                        return Some(parse_tiff_ifd(data, exif_start + 6));
                    } else if exif_start + 4 <= data.len() {
                        // May contain TIFF data directly
                        let bo = &data[exif_start..exif_start + 2];
                        if bo == b"II" || bo == b"MM" {
                            return Some(parse_tiff_ifd(data, exif_start));
                        }
                    }
                }
            }
            offset += 8 + chunk_size as usize;
            // Chunks are padded to even size
            if chunk_size % 2 == 1 { offset += 1; }
        }
    }

    None
}

/// Parse TIFF IFD (Image File Directory) to extract EXIF tags.
fn parse_tiff_ifd(data: &[u8], tiff_start: usize) -> ExifData {
    let mut exif = ExifData {
        camera_make: None,
        camera_model: None,
        lens_model: None,
        f_number: None,
        exposure_time: None,
        iso: None,
        focal_length: None,
        date_time_original: None,
        software: None,
        orientation: None,
        gps: None,
    };

    if tiff_start + 8 > data.len() { return exif; }

    // Determine byte order
    let little_endian = data[tiff_start] == b'I' && data[tiff_start + 1] == b'I';

    let read_u16 = |d: &[u8], off: usize| -> u16 {
        if little_endian {
            (d[off] as u16) | ((d[off + 1] as u16) << 8)
        } else {
            ((d[off] as u16) << 8) | (d[off + 1] as u16)
        }
    };
    let read_u32 = |d: &[u8], off: usize| -> u32 {
        if little_endian {
            (d[off] as u32) | ((d[off + 1] as u32) << 8) | ((d[off + 2] as u32) << 16) | ((d[off + 3] as u32) << 24)
        } else {
            ((d[off] as u32) << 24) | ((d[off + 1] as u32) << 16) | ((d[off + 2] as u32) << 8) | (d[off + 3] as u32)
        }
    };
    let read_rational = |d: &[u8], off: usize| -> (u32, u32) {
        (read_u32(d, off), read_u32(d, off + 4))
    };

    // Read TIFF header
    let ifd0_offset = read_u32(data, tiff_start + 4) as usize;
    if tiff_start + ifd0_offset + 2 > data.len() { return exif; }

    let num_entries = read_u16(data, tiff_start + ifd0_offset) as usize;
    let entries_start = tiff_start + ifd0_offset + 2;

    // Helper: read ASCII tag value
    let read_ascii = |d: &[u8], entry_off: usize, count: usize| -> Option<String> {
        if count <= 4 {
            if entry_off + 8 <= d.len() {
                let val = d[entry_off + 8..entry_off + 8 + count as usize].to_vec();
                Some(String::from_utf8_lossy(&val).trim_end_matches('\0').trim().to_string())
            } else { None }
        } else {
            let data_offset = read_u32(d, entry_off + 8) as usize;
            if tiff_start + data_offset + count <= d.len() {
                let val = d[tiff_start + data_offset..tiff_start + data_offset + count].to_vec();
                Some(String::from_utf8_lossy(&val).trim_end_matches('\0').trim().to_string())
            } else { None }
        }
    };

    // Helper: read rational tag value
    let read_rational_tag = |d: &[u8], entry_off: usize| -> Option<(u32, u32)> {
        let data_offset = read_u32(d, entry_off + 8) as usize;
        if tiff_start + data_offset + 8 <= d.len() {
            Some(read_rational(d, tiff_start + data_offset))
        } else { None }
    };

    // Parse IFD0 entries
    let mut exif_ifd_offset: Option<usize> = None;
    let mut gps_ifd_offset: Option<usize> = None;

    for i in 0..num_entries {
        let entry_off = entries_start + i * 12;
        if entry_off + 12 > data.len() { break; }

        let tag = read_u16(data, entry_off);
        let count = read_u32(data, entry_off + 4) as usize;

        match tag {
            // Orientation
            0x0112 => {
                if count == 1 {
                    let val = read_u16(data, entry_off + 8);
                    exif.orientation = Some(match val {
                        1 => "Horizontal (normal)".into(),
                        2 => "Mirrored horizontal".into(),
                        3 => "Rotated 180°".into(),
                        4 => "Mirrored vertical".into(),
                        5 => "Mirrored horizontal then rotated 90° CCW".into(),
                        6 => "Rotated 90° CW".into(),
                        7 => "Mirrored horizontal then rotated 90° CW".into(),
                        8 => "Rotated 90° CCW".into(),
                        _ => format!("Unknown ({})", val),
                    });
                }
            }
            // Make
            0x010F => { exif.camera_make = read_ascii(data, entry_off, count); }
            // Model
            0x0110 => { exif.camera_model = read_ascii(data, entry_off, count); }
            // Software
            0x0131 => { exif.software = read_ascii(data, entry_off, count); }
            // EXIF IFD offset
            0x8769 => { exif_ifd_offset = Some(read_u32(data, entry_off + 8) as usize); }
            // GPS IFD offset
            0x8825 => { gps_ifd_offset = Some(read_u32(data, entry_off + 8) as usize); }
            _ => {}
        }
    }

    // Parse EXIF sub-IFD
    if let Some(exif_off) = exif_ifd_offset {
        if tiff_start + exif_off + 2 <= data.len() {
            let exif_num = read_u16(data, tiff_start + exif_off) as usize;
            let exif_entries = tiff_start + exif_off + 2;

            for i in 0..exif_num {
                let entry_off = exif_entries + i * 12;
                if entry_off + 12 > data.len() { break; }

                let tag = read_u16(data, entry_off);
                let count = read_u32(data, entry_off + 4) as usize;

                match tag {
                    // ExposureTime
                    0x829A => {
                        if let Some((num, den)) = read_rational_tag(data, entry_off) {
                            if den > 0 {
                                if num == 1 {
                                    exif.exposure_time = Some(format!("1/{}", den));
                                } else {
                                    exif.exposure_time = Some(format!("{}/{}", num, den));
                                }
                            }
                        }
                    }
                    // FNumber
                    0x829D => {
                        if let Some((num, den)) = read_rational_tag(data, entry_off) {
                            if den > 0 {
                                exif.f_number = Some(format!("f/{:.1}", num as f64 / den as f64));
                            }
                        }
                    }
                    // ISO
                    0x8827 => {
                        if count == 1 {
                            exif.iso = Some(read_u16(data, entry_off + 8) as u32);
                        }
                    }
                    // DateTimeOriginal
                    0x9003 => { exif.date_time_original = read_ascii(data, entry_off, count); }
                    // FocalLength
                    0x920A => {
                        if let Some((num, den)) = read_rational_tag(data, entry_off) {
                            if den > 0 {
                                exif.focal_length = Some(format!("{:.1}mm", num as f64 / den as f64));
                            }
                        }
                    }
                    // LensModel
                    0xA432 => { exif.lens_model = read_ascii(data, entry_off, count); }
                    _ => {}
                }
            }
        }
    }

    // Parse GPS IFD
    if let Some(gps_off) = gps_ifd_offset {
        if tiff_start + gps_off + 2 <= data.len() {
            let gps_num = read_u16(data, tiff_start + gps_off) as usize;
            let gps_entries = tiff_start + gps_off + 2;

            let mut lat_ref: Option<char> = None;
            let mut lat_val: Option<(u32, u32, u32, u32, u32, u32)> = None;
            let mut lon_ref: Option<char> = None;
            let mut lon_val: Option<(u32, u32, u32, u32, u32, u32)> = None;
            let mut alt_val: Option<(u32, u32)> = None;
            let mut alt_ref: Option<u8> = None;

            for i in 0..gps_num {
                let entry_off = gps_entries + i * 12;
                if entry_off + 12 > data.len() { break; }

                let tag = read_u16(data, entry_off);
                let count = read_u32(data, entry_off + 4) as usize;

                match tag {
                    // GPSLatitudeRef
                    0x0001 => {
                        if count >= 1 && entry_off + 9 <= data.len() {
                            lat_ref = Some(data[entry_off + 8] as char);
                        }
                    }
                    // GPSLatitude
                    0x0002 => {
                        let data_offset = read_u32(data, entry_off + 8) as usize;
                        if tiff_start + data_offset + 24 <= data.len() {
                            let d1 = read_rational(data, tiff_start + data_offset);
                            let d2 = read_rational(data, tiff_start + data_offset + 8);
                            let d3 = read_rational(data, tiff_start + data_offset + 16);
                            lat_val = Some((d1.0, d1.1, d2.0, d2.1, d3.0, d3.1));
                        }
                    }
                    // GPSLongitudeRef
                    0x0003 => {
                        if count >= 1 && entry_off + 9 <= data.len() {
                            lon_ref = Some(data[entry_off + 8] as char);
                        }
                    }
                    // GPSLongitude
                    0x0004 => {
                        let data_offset = read_u32(data, entry_off + 8) as usize;
                        if tiff_start + data_offset + 24 <= data.len() {
                            let d1 = read_rational(data, tiff_start + data_offset);
                            let d2 = read_rational(data, tiff_start + data_offset + 8);
                            let d3 = read_rational(data, tiff_start + data_offset + 16);
                            lon_val = Some((d1.0, d1.1, d2.0, d2.1, d3.0, d3.1));
                        }
                    }
                    // GPSAltitude
                    0x0006 => { alt_val = read_rational_tag(data, entry_off); }
                    // GPSAltitudeRef
                    0x0005 => {
                        if entry_off + 8 < data.len() {
                            alt_ref = Some(data[entry_off + 8]);
                        }
                    }
                    _ => {}
                }
            }

            // Convert GPS to decimal degrees
            let convert_gps = |val: Option<(u32, u32, u32, u32, u32, u32)>| -> Option<f64> {
                val.map(|(d, dd, m, md, s, sd)| {
                    let degrees = if dd > 0 { d as f64 / dd as f64 } else { 0.0 };
                    let minutes = if md > 0 { m as f64 / md as f64 } else { 0.0 };
                    let seconds = if sd > 0 { s as f64 / sd as f64 } else { 0.0 };
                    degrees + minutes / 60.0 + seconds / 3600.0
                })
            };

            let lat = convert_gps(lat_val).map(|v| {
                if lat_ref == Some('S') { -v } else { v }
            });
            let lon = convert_gps(lon_val).map(|v| {
                if lon_ref == Some('W') { -v } else { v }
            });
            let alt = alt_val.and_then(|(n, d)| {
                if d > 0 {
                    let mut val = n as f64 / d as f64;
                    if alt_ref == Some(1) { val = -val; }
                    Some(val)
                } else { None }
            });

            if let (Some(latitude), Some(longitude)) = (lat, lon) {
                exif.gps = Some(GpsInfo { latitude, longitude, altitude: alt });
            }
        }
    }

    exif
}

/// Parse image dimensions from PNG header.
fn parse_png_dimensions(data: &[u8]) -> Option<(u32, u32)> {
    if data.len() < 24 { return None; }
    // PNG: bytes 16-19 = width, 20-23 = height (big-endian)
    let w = ((data[16] as u32) << 24) | ((data[17] as u32) << 16) | ((data[18] as u32) << 8) | data[19] as u32;
    let h = ((data[20] as u32) << 24) | ((data[21] as u32) << 16) | ((data[22] as u32) << 8) | data[23] as u32;
    Some((w, h))
}

/// Parse image dimensions from BMP header.
fn parse_bmp_dimensions(data: &[u8]) -> Option<(u32, u32)> {
    if data.len() < 26 { return None; }
    // BMP: bytes 18-21 = width (little-endian i32), 22-25 = height (little-endian i32)
    let w = (data[18] as u32) | ((data[19] as u32) << 8) | ((data[20] as u32) << 16) | ((data[21] as u32) << 24);
    let h = (data[22] as u32) | ((data[23] as u32) << 8) | ((data[24] as u32) << 16) | ((data[25] as u32) << 24);
    Some((w, h))
}

/// Parse image dimensions from GIF header.
fn parse_gif_dimensions(data: &[u8]) -> Option<(u32, u32)> {
    if data.len() < 10 { return None; }
    // GIF: bytes 6-7 = width (little-endian u16), 8-9 = height (little-endian u16)
    let w = (data[6] as u32) | ((data[7] as u32) << 8);
    let h = (data[8] as u32) | ((data[9] as u32) << 8);
    Some((w, h))
}

/// Parse image dimensions from WebP header.
fn parse_webp_dimensions(data: &[u8]) -> Option<(u32, u32)> {
    if data.len() < 30 { return None; }
    if &data[12..16] == b"VP8 " {
        // Lossy WebP: dimensions in VP8 bitstream header
        if data.len() < 30 { return None; }
        let w = ((data[26] as u32) & 0x3F) | (((data[27] as u32) & 0xFF) << 6) | (((data[28] as u32) & 0x03) << 14);
        let h = (((data[28] as u32) >> 2) & 0x3F) | (((data[29] as u32) & 0xFF) << 6) | (((data[30] as u32) & 0x03) << 14);
        return Some((w, h));
    }
    if &data[12..16] == b"VP8L" {
        // Lossless WebP
        if data.len() < 25 { return None; }
        let bits = (data[21] as u32) | ((data[22] as u32) << 8) | ((data[23] as u32) << 16) | ((data[24] as u32) << 24);
        let w = (bits & 0x3FFF) + 1;
        let h = ((bits >> 14) & 0x3FFF) + 1;
        return Some((w, h));
    }
    None
}

/// Read image metadata (dimensions, file size, EXIF, etc.).
/// Reads up to 64KB of the file to extract header information.
#[tauri::command]
async fn read_image_meta(path: String) -> Result<ImageMetadata, String> {
    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    // Get file metadata
    let metadata = fs::metadata(&file_path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    let file_size = metadata.len();

    // Determine extension and MIME type
    let ext = file_path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();
    let mime_type = image_mime_type(&ext);

    // Read up to 64KB for header parsing
    let max_header_size = 64 * 1024;
    let read_size = std::cmp::min(file_size, max_header_size) as usize;
    let file = std::fs::File::open(&file_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    let mut header_data = vec![0u8; read_size];
    use std::io::Seek;
    let mut file_reader = std::io::BufReader::new(file);
    use std::io::Read;
    file_reader.read_exact(&mut header_data)
        .map_err(|e| format!("Failed to read file header: {}", e))?;

    // Parse dimensions based on format
    let (width, height) = match ext.as_str() {
        "png" => parse_png_dimensions(&header_data).unwrap_or((0, 0)),
        "bmp" => parse_bmp_dimensions(&header_data).unwrap_or((0, 0)),
        "gif" => parse_gif_dimensions(&header_data).unwrap_or((0, 0)),
        "webp" => parse_webp_dimensions(&header_data).unwrap_or((0, 0)),
        "jpg" | "jpeg" | "jfif" | "pjpeg" | "pjp" => {
            // JPEG: SOF markers contain dimensions
            let mut w = 0u32;
            let mut h = 0u32;
            let mut offset = 2;
            while offset + 9 < header_data.len() {
                if header_data[offset] != 0xFF { break; }
                let marker = header_data[offset + 1];
                // SOF0 (0xFFC0), SOF1, SOF2 (progressive)
                if marker == 0xC0 || marker == 0xC1 || marker == 0xC2 {
                    let sof_start = offset + 2;
                    if sof_start + 7 <= header_data.len() {
                        h = ((header_data[sof_start + 3] as u32) << 8) | header_data[sof_start + 4] as u32;
                        w = ((header_data[sof_start + 5] as u32) << 8) | header_data[sof_start + 6] as u32;
                        break;
                    }
                }
                // Skip marker segment
                if offset + 3 < header_data.len() {
                    let seg_len = ((header_data[offset + 2] as usize) << 8) | header_data[offset + 3] as usize;
                    offset += 2 + seg_len;
                } else {
                    break;
                }
            }
            (w, h)
        }
        "tiff" | "tif" => {
            // TIFF IFD0 may contain ImageWidth and ImageLength tags
            let mut w = 0u32;
            let mut h = 0u32;
            if header_data.len() >= 8 {
                let little_endian = header_data[0] == b'I';
                let read_u16 = |d: &[u8], off: usize| -> u16 {
                    if little_endian { (d[off] as u16) | ((d[off+1] as u16) << 8) }
                    else { ((d[off] as u16) << 8) | d[off+1] as u16 }
                };
                let read_u32 = |d: &[u8], off: usize| -> u32 {
                    if little_endian { (d[off] as u32) | ((d[off+1] as u32) << 8) | ((d[off+2] as u32) << 16) | ((d[off+3] as u32) << 24) }
                    else { ((d[off] as u32) << 24) | ((d[off+1] as u32) << 16) | ((d[off+2] as u32) << 8) | d[off+3] as u32 }
                };
                let ifd_off = read_u32(&header_data, 4) as usize;
                if ifd_off + 2 <= header_data.len() {
                    let num = read_u16(&header_data, ifd_off) as usize;
                    for i in 0..num {
                        let e = ifd_off + 2 + i * 12;
                        if e + 12 > header_data.len() { break; }
                        let tag = read_u16(&header_data, e);
                        if tag == 0x0100 { // ImageWidth
                            w = read_u32(&header_data, e + 8);
                        } else if tag == 0x0101 { // ImageLength
                            h = read_u32(&header_data, e + 8);
                        }
                    }
                }
            }
            (w, h)
        }
        _ => (0, 0), // Unknown dimensions
    };

    // Parse EXIF data
    let exif = parse_exif_from_header(&header_data);

    // Determine bit depth and color space from EXIF or format defaults
    let bit_depth = match ext.as_str() {
        "png" => {
            // PNG IHDR byte 8: bit depth
            if header_data.len() > 24 { Some(header_data[24]) } else { None }
        }
        "jpg" | "jpeg" => {
            // Could parse from EXIF or SOF, but keep simple
            exif.as_ref().and_then(|_| None).or(Some(8))
        }
        _ => None,
    };

    let color_space = if ext == "svg" {
        "sRGB".to_string()
    } else {
        // Color space from EXIF ColorSpace tag if available, otherwise "Unknown"
        "Unknown".to_string()
    };

    Ok(ImageMetadata {
        width,
        height,
        file_size,
        file_size_str: format_file_size(file_size),
        format: ext,
        mime_type,
        bit_depth,
        color_space,
        exif,
    })
}

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write file '{}': {}", path, e))
}

// ===========================================================================
// Tauri commands - Settings & LLM Provider (feat-settings-llm-config)
// ===========================================================================

/// Read the application settings from {workspace}/.neuro/settings.yaml.
/// Returns default settings if the file does not exist.
#[tauri::command]
async fn read_settings(
    state: tauri::State<'_, AppState>,
) -> Result<AppSettings, String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Ok(AppSettings::default());
    }

    let settings_path = PathBuf::from(&workspace)
        .join(".neuro")
        .join("settings.yaml");

    if !settings_path.exists() {
        return Ok(AppSettings::default());
    }

    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings.yaml: {}", e))?;

    let settings: AppSettings = serde_yaml::from_str(&content)
        .map_err(|e| format!("Failed to parse settings.yaml: {}", e))?;

    Ok(settings)
}

/// Write the application settings to {workspace}/.neuro/settings.yaml.
/// Creates the .neuro directory if it does not exist.
#[tauri::command]
async fn write_settings(
    state: tauri::State<'_, AppState>,
    settings: AppSettings,
) -> Result<(), String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let neuro_dir = PathBuf::from(&workspace).join(".neuro");
    if !neuro_dir.exists() {
        fs::create_dir_all(&neuro_dir)
            .map_err(|e| format!("Failed to create .neuro directory: {}", e))?;
    }

    let settings_path = neuro_dir.join("settings.yaml");

    let yaml_str = serde_yaml::to_string(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    // Atomic write: temp then rename
    let temp_path = settings_path.with_extension("yaml.tmp");
    fs::write(&temp_path, &yaml_str)
        .map_err(|e| format!("Failed to write settings temp file: {}", e))?;

    fs::rename(&temp_path, &settings_path)
        .map_err(|e| format!("Failed to rename settings temp file: {}", e))?;

    Ok(())
}

/// Test an LLM provider connection by calling {api_base}/models.
/// Returns a list of available model IDs on success.
#[tauri::command]
async fn test_llm_connection(
    provider: ProviderConfig,
) -> Result<Vec<String>, String> {
    if provider.api_base.is_empty() {
        return Err("API base URL is required".into());
    }
    if provider.api_key.is_empty() {
        return Err("API key is required".into());
    }

    let client = reqwest::Client::new();
    let url = format!("{}/models", provider.api_base.trim_end_matches('/'));

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", provider.api_key))
        .header("Content-Type", "application/json")
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_else(|_| "Unknown error".into());
        return Err(format!("API error ({}): {}", status, body));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // OpenAI-compatible /models returns { data: [{ id: "model-name", ... }] }
    let models: Vec<String> = json
        .get("data")
        .and_then(|d| d.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m.get("id").and_then(|id| id.as_str()).map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    if models.is_empty() {
        return Err("Connection successful but no models found".into());
    }

    Ok(models)
}

// ===========================================================================
// Tauri commands - PMFile management (feat-agent-multimodal-upload)
// ===========================================================================

/// MIME type whitelist for file uploads.
const PMFILE_ALLOWED_EXTENSIONS: &[&str] = &[
    "docx", "doc", "pdf", "txt", "md",
    "png", "jpg", "jpeg", "gif", "bmp", "svg", "webp",
    "wav", "mp3", "ogg", "flac", "aac", "m4a",
    "csv", "xlsx", "xls", "json", "xml", "yaml", "yml",
    "zip", "tar", "gz",
];

/// Maximum file size: 50 MB.
const PMFILE_MAX_SIZE: u64 = 50 * 1024 * 1024;

/// Metadata for a single file in the PMFile directory.
#[derive(Debug, Serialize, Clone)]
pub struct PmFileEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub file_type: String,
    pub modified: String,
}

/// Result for pmfile_upload: lists successfully uploaded and rejected files.
#[derive(Debug, Serialize, Clone)]
pub struct PmFileUploadResult {
    pub uploaded: Vec<PmFileEntry>,
    pub rejected: Vec<PmFileRejection>,
}

#[derive(Debug, Serialize, Clone)]
pub struct PmFileRejection {
    pub name: String,
    pub reason: String,
}

/// Validate a file's extension against the whitelist.
fn pmfile_validate_extension(file_name: &str) -> Result<(), String> {
    let ext = file_name.rsplit('.').next()
        .unwrap_or("")
        .to_lowercase();
    if PMFILE_ALLOWED_EXTENSIONS.contains(&ext.as_str()) {
        Ok(())
    } else {
        Err(format!("不支持的文件类型: .{}", ext))
    }
}

/// Get the PMFile directory path for a workspace.
fn pmfile_dir(workspace: &str) -> PathBuf {
    PathBuf::from(workspace).join("PMFile")
}

/// Ensure the PMFile directory exists.
fn pmfile_ensure_dir(workspace: &str) -> Result<PathBuf, String> {
    let dir = pmfile_dir(workspace);
    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create PMFile directory: {}", e))?;
    }
    Ok(dir)
}

/// Generate a non-conflicting filename by appending a counter if needed.
fn pmfile_unique_name(dir: &PathBuf, name: &str) -> String {
    let target = dir.join(name);
    if !target.exists() {
        return name.to_string();
    }
    let stem = name.rsplit_once('.').map(|(s, _)| s).unwrap_or(name);
    let ext = name.rsplit_once('.').map(|(_, e)| e).unwrap_or("");
    let mut counter = 1u32;
    loop {
        let new_name = if ext.is_empty() {
            format!("{}-{}", stem, counter)
        } else {
            format!("{}-{}.{}", stem, counter, ext)
        };
        if !dir.join(&new_name).exists() {
            return new_name;
        }
        counter += 1;
    }
}

/// Categorize file type by extension for display purposes.
fn pmfile_file_type(name: &str) -> String {
    let ext = name.rsplit('.').next()
        .unwrap_or("")
        .to_lowercase();
    match ext.as_str() {
        "png" | "jpg" | "jpeg" | "gif" | "bmp" | "svg" | "webp" => "image",
        "wav" | "mp3" | "ogg" | "flac" | "aac" | "m4a" => "audio",
        "pdf" => "pdf",
        "docx" | "doc" => "document",
        "md" => "markdown",
        "csv" | "xlsx" | "xls" => "spreadsheet",
        "json" | "xml" | "yaml" | "yml" => "data",
        "zip" | "tar" | "gz" => "archive",
        _ => "file",
    }.to_string()
}

/// Upload (copy) files to the workspace's PMFile directory.
/// Validates MIME types, checks file size, and handles name conflicts.
#[tauri::command]
async fn pmfile_upload(
    state: tauri::State<'_, AppState>,
    file_paths: Vec<String>,
) -> Result<PmFileUploadResult, String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let dir = pmfile_ensure_dir(&workspace)?;
    let mut uploaded: Vec<PmFileEntry> = Vec::new();
    let mut rejected: Vec<PmFileRejection> = Vec::new();

    for src_path_str in &file_paths {
        let src_path = PathBuf::from(src_path_str);
        let file_name = src_path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string());

        // Validate extension
        if let Err(e) = pmfile_validate_extension(&file_name) {
            rejected.push(PmFileRejection { name: file_name, reason: e });
            continue;
        }

        // Check file size
        match fs::metadata(&src_path) {
            Ok(meta) => {
                if meta.len() > PMFILE_MAX_SIZE {
                    rejected.push(PmFileRejection {
                        name: file_name,
                        reason: format!("文件过大 ({:.1} MB，上限 50 MB)", meta.len() as f64 / (1024.0 * 1024.0)),
                    });
                    continue;
                }
            }
            Err(e) => {
                rejected.push(PmFileRejection { name: file_name, reason: format!("无法读取文件: {}", e) });
                continue;
            }
        }

        // Resolve name conflict
        let final_name = pmfile_unique_name(&dir, &file_name);
        let dest = dir.join(&final_name);

        // Copy the file
        if let Err(e) = fs::copy(&src_path, &dest) {
            rejected.push(PmFileRejection { name: file_name, reason: format!("复制失败: {}", e) });
            continue;
        }

        // Build metadata
        let meta = fs::metadata(&dest).unwrap_or_else(|_| fs::symlink_metadata(&dest).unwrap());
        let modified = meta.modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| {
                chrono::DateTime::from_timestamp(d.as_secs() as i64, 0)
                    .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
                    .unwrap_or_default()
            })
            .unwrap_or_default();

        uploaded.push(PmFileEntry {
            name: final_name,
            path: dest.to_string_lossy().to_string(),
            size: meta.len(),
            file_type: pmfile_file_type(&file_name),
            modified,
        });
    }

    Ok(PmFileUploadResult { uploaded, rejected })
}

/// Upload a single file from raw bytes (for drag-and-drop from browser).
#[tauri::command]
async fn pmfile_upload_bytes(
    state: tauri::State<'_, AppState>,
    workspace_path: String,
    file_name: String,
    file_bytes: Vec<u8>,
) -> Result<PmFileEntry, String> {
    let workspace = if workspace_path.is_empty() {
        state.workspace_path.lock().map_err(|e| e.to_string())?.clone()
    } else {
        workspace_path
    };
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    // Validate extension
    if let Err(e) = pmfile_validate_extension(&file_name) {
        return Err(e);
    }

    // Check file size
    if file_bytes.len() as u64 > PMFILE_MAX_SIZE {
        return Err(format!("文件过大 ({:.1} MB，上限 50 MB)", file_bytes.len() as f64 / (1024.0 * 1024.0)));
    }

    let dir = pmfile_ensure_dir(&workspace)?;

    // Resolve name conflict
    let final_name = pmfile_unique_name(&dir, &file_name);
    let dest = dir.join(&final_name);

    // Write bytes
    fs::write(&dest, &file_bytes)
        .map_err(|e| format!("写入文件失败: {}", e))?;

    let meta = fs::metadata(&dest).unwrap_or_else(|_| fs::symlink_metadata(&dest).unwrap());
    let modified = meta.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| {
            chrono::DateTime::from_timestamp(d.as_secs() as i64, 0)
                .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
                .unwrap_or_default()
        })
        .unwrap_or_default();

    Ok(PmFileEntry {
        name: final_name,
        path: dest.to_string_lossy().to_string(),
        size: meta.len(),
        file_type: pmfile_file_type(&file_name),
        modified,
    })
}

/// List all files in the workspace's PMFile directory.
#[tauri::command]
async fn pmfile_list(
    state: tauri::State<'_, AppState>,
    workspace_path: Option<String>,
) -> Result<Vec<PmFileEntry>, String> {
    let workspace = workspace_path.unwrap_or_else(|| {
        state.workspace_path.lock().map(|s| s.clone()).unwrap_or_default()
    });
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let dir = pmfile_dir(&workspace);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut entries: Vec<PmFileEntry> = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read PMFile directory: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().map(|ft| ft.is_file()).unwrap_or(false))
        .map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let path = e.path().to_string_lossy().to_string();
            let meta = e.metadata().ok();
            let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
            let modified = meta.as_ref()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| {
                    chrono::DateTime::from_timestamp(d.as_secs() as i64, 0)
                        .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
                        .unwrap_or_default()
                })
                .unwrap_or_default();
            let file_type = pmfile_file_type(&name);
            PmFileEntry {
                name,
                path,
                size,
                file_type,
                modified,
            }
        })
        .collect();

    // Sort by name
    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(entries)
}

/// Delete a file from the PMFile directory.
#[tauri::command]
async fn pmfile_delete(
    state: tauri::State<'_, AppState>,
    workspace_path: String,
    file_name: String,
) -> Result<(), String> {
    let workspace = if workspace_path.is_empty() {
        state.workspace_path.lock().map_err(|e| e.to_string())?.clone()
    } else {
        workspace_path
    };
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let dir = pmfile_dir(&workspace);
    let file_path = dir.join(&file_name);

    // Security: ensure the path is inside the PMFile directory
    if dir.exists() {
        let canonical_dir = dir.canonicalize().map_err(|e| format!("PMFile dir not found: {}", e))?;
        if file_path.exists() {
            let canonical_file = file_path.canonicalize().map_err(|e| format!("File not found: {}", e))?;
            if !canonical_file.starts_with(&canonical_dir) {
                return Err("Path traversal: file is not in PMFile directory".into());
            }
        }
    }

    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete '{}': {}", file_name, e))?;

    Ok(())
}

/// Rename a file in the PMFile directory.
#[tauri::command]
async fn pmfile_rename(
    state: tauri::State<'_, AppState>,
    workspace_path: String,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    let workspace = if workspace_path.is_empty() {
        state.workspace_path.lock().map_err(|e| e.to_string())?.clone()
    } else {
        workspace_path
    };
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let dir = pmfile_dir(&workspace);
    let old_path = dir.join(&old_name);
    let new_path = dir.join(&new_name);

    // Security: ensure paths are inside PMFile directory
    if dir.exists() {
        let canonical_dir = dir.canonicalize().map_err(|e| format!("PMFile dir not found: {}", e))?;
        if old_path.exists() {
            let canonical_old = old_path.canonicalize().map_err(|e| format!("File not found: {}", e))?;
            if !canonical_old.starts_with(&canonical_dir) {
                return Err("Path traversal: source file is not in PMFile directory".into());
            }
        }
    }

    if new_path.exists() {
        return Err(format!("文件 '{}' 已存在", new_name));
    }

    fs::rename(&old_path, &new_path)
        .map_err(|e| format!("Failed to rename '{}' to '{}': {}", old_name, new_name, e))?;

    Ok(())
}

// ===========================================================================
// Tauri commands - PMFile content reading (feat-agent-multimodal-analyze)
// ===========================================================================

/// Result for reading a PMFile's content for analysis.
#[derive(Debug, Serialize, Clone)]
pub struct PmFileContentResult {
    /// The file name.
    pub name: String,
    /// The file type category (image, audio, pdf, document, markdown, etc.).
    pub file_type: String,
    /// Base64-encoded file content (for images and audio).
    pub base64_content: Option<String>,
    /// Extracted text content (for PDF, docx, markdown, text files).
    pub text_content: Option<String>,
    /// MIME type of the file.
    pub mime_type: String,
}

/// Determine MIME type from file extension.
fn pmfile_mime_type(name: &str) -> String {
    let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "wav" => "audio/wav",
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        "aac" => "audio/aac",
        "m4a" => "audio/mp4",
        "pdf" => "application/pdf",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "doc" => "application/msword",
        "md" => "text/markdown",
        "txt" => "text/plain",
        "csv" => "text/csv",
        "json" => "application/json",
        "yaml" | "yml" => "text/yaml",
        "xml" => "text/xml",
        "html" => "text/html",
        "css" => "text/css",
        _ => "application/octet-stream",
    }.to_string()
}

/// Read a PMFile's content for multimodal analysis.
/// Returns base64 for images/audio, extracted text for documents.
#[tauri::command]
async fn pmfile_read_content(
    state: tauri::State<'_, AppState>,
    workspace_path: String,
    file_name: String,
) -> Result<PmFileContentResult, String> {
    let workspace = if workspace_path.is_empty() {
        state.workspace_path.lock().map_err(|e| e.to_string())?.clone()
    } else {
        workspace_path
    };
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let dir = pmfile_dir(&workspace);
    let file_path = dir.join(&file_name);

    if !file_path.exists() {
        return Err(format!("文件 '{}' 不存在", file_name));
    }

    let file_type = pmfile_file_type(&file_name);
    let mime_type = pmfile_mime_type(&file_name);
    let ext = file_name.rsplit('.').next().unwrap_or("").to_lowercase();

    let (base64_content, text_content) = match file_type.as_str() {
        "image" | "audio" => {
            // Read as base64 for multimodal API
            let bytes = fs::read(&file_path)
                .map_err(|e| format!("读取文件失败: {}", e))?;
            let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes);
            (Some(b64), None)
        }
        "markdown" | "data" => {
            // Read as text
            let text = fs::read_to_string(&file_path)
                .map_err(|e| format!("读取文件失败: {}", e))?;
            (None, Some(text))
        }
        "pdf" => {
            // For PDF, return base64 (Gemini can handle PDF via multimodal API)
            let bytes = fs::read(&file_path)
                .map_err(|e| format!("读取文件失败: {}", e))?;
            let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes);
            (Some(b64), None)
        }
        "document" => {
            // For docx, extract text using zip-based approach
            // docx is a zip file containing word/document.xml
            match pmfile_extract_docx_text(&file_path) {
                Ok(text) => (None, Some(text)),
                Err(_) => {
                    // Fallback: return base64 for API processing
                    let bytes = fs::read(&file_path)
                        .map_err(|e| format!("读取文件失败: {}", e))?;
                    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes);
                    (Some(b64), None)
                }
            }
        }
        _ => {
            // For unknown types, try text first, then base64
            match fs::read_to_string(&file_path) {
                Ok(text) => (None, Some(text)),
                Err(_) => {
                    let bytes = fs::read(&file_path)
                        .map_err(|e| format!("读取文件失败: {}", e))?;
                    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes);
                    (Some(b64), None)
                }
            }
        }
    };

    Ok(PmFileContentResult {
        name: file_name,
        file_type,
        base64_content,
        text_content,
        mime_type,
    })
}

/// Extract text from a docx file by reading the zip and parsing document.xml.
fn pmfile_extract_docx_text(path: &PathBuf) -> Result<String, String> {
    let file = std::fs::File::open(path)
        .map_err(|e| format!("Failed to open docx: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read docx as zip: {}", e))?;

    let mut xml_content = String::new();
    if let Ok(mut doc_file) = archive.by_name("word/document.xml") {
        std::io::Read::read_to_string(&mut doc_file, &mut xml_content)
            .map_err(|e| format!("Failed to read document.xml: {}", e))?;
    } else {
        return Err("word/document.xml not found in docx".into());
    }

    // Simple XML text extraction: strip tags, preserve text content
    let text = pmfile_strip_xml_tags(&xml_content);
    Ok(text)
}

/// Strip XML tags and return plain text content.
fn pmfile_strip_xml_tags(xml: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    let mut last_was_paragraph = false;

    for ch in xml.chars() {
        match ch {
            '<' => {
                in_tag = true;
            }
            '>' => {
                in_tag = false;
            }
            _ if !in_tag => {
                if last_was_paragraph {
                    result.push('\n');
                    last_was_paragraph = false;
                }
                result.push(ch);
            }
            _ if in_tag => {
                // Check if closing a paragraph tag
                // We look for "</w:p>" pattern
            }
            _ => {}
        }
    }

    // Post-process: add newlines where paragraph breaks were
    let text = xml.replace("</w:p>", "\n\n")
        .replace("</w:t>", "")
        .replace("<w:t", "")
        .replace("</w:r>", "");

    // Re-do the extraction more carefully
    let mut clean = String::new();
    let mut depth = 0;
    let mut buffer = String::new();
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        if chars[i] == '<' {
            // Find the end of the tag
            let mut tag_end = i + 1;
            while tag_end < chars.len() && chars[tag_end] != '>' {
                tag_end += 1;
            }
            if tag_end < chars.len() {
                let tag_content: String = chars[i+1..tag_end].iter().collect();
                if tag_content.starts_with("/w:p") {
                    clean.push('\n');
                }
                i = tag_end + 1;
                continue;
            }
        }
        if i < chars.len() && chars[i] != '<' {
            clean.push(chars[i]);
        }
        i += 1;
    }

    // Clean up whitespace
    let cleaned = clean
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join("\n");

    if cleaned.is_empty() {
        result
    } else {
        cleaned
    }
}

// ===========================================================================
// Tauri commands - PMDM (PM Document) management (feat-agent-multimodal-analyze)
// ===========================================================================

/// Get the PMDM directory path for a workspace.
fn pmdm_dir(workspace: &str) -> PathBuf {
    PathBuf::from(workspace).join("PMDM")
}

/// Ensure the PMDM directory exists.
fn pmdm_ensure_dir(workspace: &str) -> Result<PathBuf, String> {
    let dir = pmdm_dir(workspace);
    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create PMDM directory: {}", e))?;
    }
    Ok(dir)
}

/// Write analysis result as an MD file to the PMDM directory.
#[tauri::command]
async fn pmdm_write(
    state: tauri::State<'_, AppState>,
    workspace_path: String,
    file_name: String,
    content: String,
) -> Result<String, String> {
    let workspace = if workspace_path.is_empty() {
        state.workspace_path.lock().map_err(|e| e.to_string())?.clone()
    } else {
        workspace_path
    };
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let dir = pmdm_ensure_dir(&workspace)?;

    // Ensure .md extension
    let final_name = if file_name.ends_with(".md") {
        file_name
    } else {
        format!("{}.md", file_name)
    };

    let file_path = dir.join(&final_name);

    fs::write(&file_path, &content)
        .map_err(|e| format!("写入分析结果失败: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

/// List all MD files in the PMDM directory.
#[tauri::command]
async fn pmdm_list(
    state: tauri::State<'_, AppState>,
    workspace_path: Option<String>,
) -> Result<Vec<MdFileEntry>, String> {
    let workspace = workspace_path.unwrap_or_else(|| {
        state.workspace_path.lock().map(|s| s.clone()).unwrap_or_default()
    });
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let dir = pmdm_dir(&workspace);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut entries: Vec<MdFileEntry> = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read PMDM directory: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_type().map(|ft| ft.is_file()).unwrap_or(false)
        })
        .filter(|e| {
            e.path().extension().map(|ext| ext == "md").unwrap_or(false)
        })
        .map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let path = e.path().to_string_lossy().to_string();
            MdFileEntry { name, path }
        })
        .collect();

    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(entries)
}

/// Analyze a single file via the Gemini multimodal API.
/// Reads the file content, constructs a multimodal prompt, and streams the response.
#[tauri::command]
async fn pmfile_analyze(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    workspace_path: String,
    file_name: String,
    analysis_prompt: Option<String>,
) -> Result<(), String> {
    let workspace = if workspace_path.is_empty() {
        state.workspace_path.lock().map_err(|e| e.to_string())?.clone()
    } else {
        workspace_path
    };
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    // 1. Read file content
    let content_result = pmfile_read_content(
        tauri::State::clone(&state),
        workspace.clone(),
        file_name.clone(),
    ).await?;

    // 2. Get API key & base URL — prefer settings provider, fall back to keyring + Gemini
    let (api_key, api_base, model) = match get_llm_provider_from_settings(&workspace) {
        Some(config) => config,
        None => {
            // Fallback: use keyring key + hardcoded Gemini URL
            let key = get_api_key_inner()
                .map_err(|e| format!(
                    "API Key 未配置: {}. 请在 Settings 中配置一个 LLM Provider（如 OpenRouter、Gemini 等），或设置 Gemini API Key。",
                    e
                ))?;
            (key, GEMINI_API_URL.to_string(), "gemini-2.0-flash".to_string())
        }
    };

    // Build chat completions endpoint from api_base
    let api_url = {
        let base = api_base.trim_end_matches('/');
        // If api_base already ends with /chat/completions, use as-is; otherwise append
        if base.ends_with("/chat/completions") {
            base.to_string()
        } else {
            format!("{}/chat/completions", base)
        }
    };

    // 3. Build prompt based on file type
    let file_type = &content_result.file_type;
    let default_prompt = match file_type.as_str() {
        "image" => r#"你是一位专业的 UI/UX 设计分析专家。请对这张图片进行详细分析，包括：

1. **图片概述**：描述图片的整体内容和场景
2. **UI 元素识别**：识别图中的界面元素（按钮、表单、导航等）
3. **布局分析**：分析布局结构、信息层次、视觉动线
4. **色彩与风格**：描述色彩搭配和视觉风格
5. **交互建议**：基于图片内容提出可能的交互设计建议
6. **需求关联**：如果是设计稿或原型，提取可能的功能需求点

请以结构化的 Markdown 格式输出分析报告。"#,
        "audio" => r#"你是一位专业的音频内容分析专家。请对这段音频进行详细分析，包括：

1. **音频概述**：描述音频的类型和内容概要
2. **内容转录**：尽量转录音频中的关键内容
3. **关键决策**：提取音频中提到的重要决策和结论
4. **待办事项**：列出音频中提到的后续任务和待办事项
5. **参与者**：识别音频中的发言者（如果可辨识）
6. **摘要**：提供简洁的摘要

请以结构化的 Markdown 格式输出分析报告。"#,
        "pdf" | "document" => r#"你是一位专业的文档分析专家。请对这个文档进行详细分析，包括：

1. **文档概述**：总结文档的主题和目的
2. **核心内容**：提取文档的关键内容和要点
3. **需求识别**：识别文档中隐含或明确的需求
4. **技术要点**：提取技术相关的关键信息
5. **风险评估**：分析文档中可能存在的风险或挑战
6. **建议**：基于文档内容提出后续建议

请以结构化的 Markdown 格式输出分析报告。"#,
        _ => r#"请对这个文件进行详细分析，包括：
1. **内容概述**：总结文件的主题和内容
2. **关键要点**：提取文件中的关键信息
3. **分析建议**：基于文件内容提出建议

请以结构化的 Markdown 格式输出分析报告。"#,
    };

    let prompt = analysis_prompt.unwrap_or_else(|| default_prompt.to_string());

    // 4. Build multimodal message payload
    let mut messages_payload = Vec::new();

    // System prompt
    messages_payload.push(serde_json::json!({
        "role": "system",
        "content": format!("你是 Neuro Syntax IDE 的多模态文件分析助手。你的任务是对用户上传的文件进行深入分析，并生成结构化的 Markdown 分析报告。\n\n分析报告必须使用以下统一模板格式：\n\n# 文件分析报告\n\n## 元信息\n- **文件名**：{{filename}}\n- **文件类型**：{{file_type}}\n- **分析时间**：{{timestamp}}\n\n## 内容摘要\n{{summary}}\n\n## 关键内容\n{{key_content}}\n\n## 分析与建议\n{{analysis_and_suggestions}}\n\n---\n*Generated by Neuro Syntax IDE Multimodal Analyzer*")
    }));

    // Build user message with multimodal content
    let user_content = if let Some(b64) = &content_result.base64_content {
        // For images, audio, PDF — use inline_data format
        let parts = vec![
            serde_json::json!({ "type": "text", "text": prompt }),
            serde_json::json!({
                "type": "image_url",
                "image_url": {
                    "url": format!("data:{};base64,{}", content_result.mime_type, b64)
                }
            }),
        ];
        serde_json::json!(parts)
    } else if let Some(text) = &content_result.text_content {
        serde_json::json!(format!("{}\n\n---\n\n文件内容：\n```\n{}\n```", prompt, text))
    } else {
        serde_json::json!(prompt)
    };

    messages_payload.push(serde_json::json!({
        "role": "user",
        "content": user_content
    }));

    let body = serde_json::json!({
        "model": model,
        "messages": messages_payload,
        "stream": true,
        "max_tokens": 4096
    });

    // 5. Stream response via SSE
    let client = reqwest::Client::new();

    let response = client
        .post(&api_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("连接 AI API 失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_body = response.text().await.unwrap_or_else(|_| "Unknown error".into());
        let _ = app.emit("analyze://error", serde_json::json!({
            "file_name": file_name,
            "error": format!("AI API 错误 ({}): {}", status, error_body)
        }));
        return Err(format!("AI API 错误 ({}): {}", status, error_body));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut full_response = String::new();

    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                buffer.push_str(&text);

                while let Some(pos) = buffer.find('\n') {
                    let line = buffer[..pos].trim().to_string();
                    buffer = buffer[pos + 1..].to_string();

                    if line.starts_with("data: ") {
                        let data = &line[6..];
                        if data == "[DONE]" {
                            // Write result to PMDM
                            let timestamp = chrono::Utc::now().format("%Y-%m-%d %H:%M").to_string();
                            let analysis_md = format!(
                                "# 文件分析报告\n\n## 元信息\n- **文件名**：{}\n- **文件类型**：{}\n- **分析时间**：{}\n\n## 分析内容\n\n{}\n\n---\n*Generated by Neuro Syntax IDE Multimodal Analyzer*",
                                file_name, file_type, timestamp, full_response
                            );

                            // Build MD file name from original file name
                            let stem = file_name.rsplit_once('.').map(|(s, _)| s).unwrap_or(&file_name);
                            let md_name = format!("{}-analysis.md", stem);

                            let ws_clone = workspace.clone();
                            let md_name_clone = md_name.clone();
                            let analysis_md_clone = analysis_md.clone();
                            let dir = pmdm_ensure_dir(&ws_clone)?;
                            let md_path = dir.join(&md_name_clone);
                            fs::write(&md_path, &analysis_md_clone)
                                .map_err(|e| format!("写入分析结果失败: {}", e))?;

                            let _ = app.emit("analyze://complete", serde_json::json!({
                                "file_name": file_name,
                                "md_name": md_name,
                                "md_path": md_path.to_string_lossy().to_string(),
                                "content_length": full_response.len()
                            }));
                            return Ok(());
                        }

                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                            if let Some(choices) = parsed.get("choices") {
                                if let Some(first_choice) = choices.as_array().and_then(|a| a.first()) {
                                    if let Some(delta) = first_choice.get("delta") {
                                        if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                                            full_response.push_str(content);
                                            let _ = app.emit("analyze://chunk", serde_json::json!({
                                                "file_name": file_name,
                                                "text": content,
                                                "is_done": false
                                            }));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => {
                let _ = app.emit("analyze://error", serde_json::json!({
                    "file_name": file_name,
                    "error": format!("Stream 错误: {}", e)
                }));
                return Err(format!("Stream 错误: {}", e));
            }
        }
    }

    // Stream ended without [DONE]
    let _ = app.emit("analyze://complete", serde_json::json!({
        "file_name": file_name,
        "md_name": format!("{}-analysis.md", file_name.rsplit_once('.').map(|(s, _)| s).unwrap_or(&file_name)),
        "content_length": full_response.len()
    }));

    Ok(())
}

// ===========================================================================
// Application entry point
// ===========================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AppState {
            pty_manager: Mutex::new(PtyManager::new()),
            workspace_path: Mutex::new(String::new()),
            fs_watcher: Mutex::new(None),
            hw_monitor_stop: Mutex::new(None),
            runtime_monitor_stop: Mutex::new(None),
            req_agent: Mutex::new(ReqAgentState::new()),
            agent_runtime_registry: Mutex::new(create_default_registry()),
            router_engine: Mutex::new(RouterEngine::with_defaults()),
            session_output: Arc::new(Mutex::new(HashMap::new())),
            active_session_id: Mutex::new(None),
            active_sessions: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            pick_workspace,
            get_stored_workspace,
            read_file_tree,
            create_pty,
            write_to_pty,
            resize_pty,
            kill_pty,
            fetch_queue_state,
            update_task_status,
            read_feature_detail,
            start_fs_watcher,
            stop_fs_watcher,
            set_workspace_path,
            start_hardware_monitor,
            stop_hardware_monitor,
            fetch_git_stats,
            fetch_git_status,
            // Git detail queries (feat-git-modal-enhance)
            fetch_git_tags,
            fetch_git_log,
            fetch_git_branches,
            // Tag detail expand (feat-git-tag-expand)
            fetch_tag_commits,
            fetch_tag_diff,
            // Git stage & commit (feat-git-stage-commit)
            git_stage_file,
            git_stage_all,
            git_unstage_file,
            git_commit,
            // Git push & pull (feat-git-push-pull)
            git_push,
            git_pull,
            // Branch graph (feat-git-branch-graph)
            fetch_commit_graph,
            // AI Agent Service
            agent_chat_stream,
            store_api_key,
            has_api_key,
            delete_api_key,
            create_feature_from_agent,
            agent_generate_feature_plan,
            // ReqAgent (Claude Code CLI Bridge)
            req_agent_start,
            req_agent_send_message,
            req_agent_stop,
            req_agent_status,
            // Agent Runtime (feat-agent-runtime-core)
            list_agent_runtimes,
            scan_agent_runtimes,
            get_runtime_status,
            // Runtime Execute (feat-agent-runtime-execute)
            runtime_execute,
            runtime_session_start,
            runtime_session_stop,
            // Session Output (feat-runtime-session-output)
            get_active_session,
            get_session_chunks,
            clear_session_output,
            // Smart Router (feat-agent-runtime-router)
            submit_task,
            get_routing_rules,
            update_routing_rules,
            get_task_routing_decision,
            read_file,
            read_file_base64,
            write_file,
            // Image metadata (feat-file-preview-image-enhance)
            read_image_meta,
            // MD Explorer (feat-project-md-explorer)
            list_md_files,
            // Settings & LLM Provider (feat-settings-llm-config)
            read_settings,
            write_settings,
            test_llm_connection,
            // PMFile management (feat-agent-multimodal-upload)
            pmfile_upload,
            pmfile_upload_bytes,
            pmfile_list,
            pmfile_delete,
            pmfile_rename,
            // PMFile content reading & multimodal analysis (feat-agent-multimodal-analyze)
            pmfile_read_content,
            pmfile_analyze,
            // PMDM management (feat-agent-multimodal-analyze)
            pmdm_write,
            pmdm_list,
            // Runtime process monitor (feat-claude-code-runtime-monitor)
            scan_runtime_processes,
            start_runtime_monitor,
            stop_runtime_monitor,
            read_claude_session,
            // Kill process by PID (feat-runtime-process-stop)
            kill_process_by_pid,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
