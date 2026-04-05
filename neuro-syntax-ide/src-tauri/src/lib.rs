use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, BufWriter, Write as IoWrite};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;
use notify::{RecommendedWatcher, RecursiveMode, Watcher, Config as NotifyConfig, Event as NotifyEvent};
use sysinfo::System;
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
            "--dangerously-skip-permissions".to_string(),
        ];

        if let Some(ref sid) = params.session_id {
            args.push("--resume".to_string());
            args.push("--session-id".to_string());
            args.push(sid.clone());
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

        // Spawn CLI process
        let mut child = Command::new("claude")
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

        // --- stdout reader thread ---
        let tx_stdout = tx.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout_handle);
            for line in reader.lines() {
                match line {
                    Ok(text) => {
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

                                // Extract text content based on message type
                                let text = if msg_type == "assistant" {
                                    json_obj.get("content")
                                        .and_then(|c| c.as_str())
                                        .unwrap_or("")
                                        .to_string()
                                } else if is_result {
                                    String::new()
                                } else if msg_type == "system" {
                                    json_obj.get("content")
                                        .and_then(|c| c.as_str())
                                        .unwrap_or("")
                                        .to_string()
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

            // Process exited — send final is_done event if no result message was received
            let _ = tx_stdout.send(StreamEvent {
                text: String::new(),
                is_done: true,
                error: None,
                msg_type: Some("process_exit".to_string()),
                session_id: None,
            });
        });

        // --- stderr reader thread ---
        let tx_stderr = tx.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr_handle);
            for line in reader.lines() {
                match line {
                    Ok(text) => {
                        if !text.trim().is_empty() {
                            let event = StreamEvent {
                                text: String::new(),
                                is_done: false,
                                error: Some(format!("CLI stderr: {}", text)),
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

        // --- timeout watcher thread ---
        let timeout_secs = params.timeout_secs;
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_secs(timeout_secs));
            // If the channel is still open after timeout, send timeout event
            let _ = tx.send(StreamEvent {
                text: String::new(),
                is_done: true,
                error: Some(format!("Timeout: CLI process exceeded {} second limit", timeout_secs)),
                msg_type: Some("timeout".to_string()),
                session_id: None,
            });
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
            let reader = BufReader::new(reader);
            for line in reader.lines() {
                match line {
                    Ok(text) => {
                        let payload = PtyOutputEvent {
                            pty_id: emit_id.clone(),
                            data: format!("{}\n", text),
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
    req_agent: Mutex<ReqAgentState>,
    /// Agent runtime registry (feat-agent-runtime-core)
    agent_runtime_registry: Mutex<RuntimeRegistry>,
    /// Smart routing engine (feat-agent-runtime-router)
    router_engine: Mutex<RouterEngine>,
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
// Tauri commands - Branch graph (feat-git-branch-graph)
// ===========================================================================

/// A node in the branch topology graph returned by fetch_branch_graph.
#[derive(Debug, Serialize, Clone)]
pub struct BranchGraphData {
    #[serde(rename = "id")]
    pub name: String,
    pub r#type: String, // "branch" | "merge" | "fork"
    pub latest_commit: String,
    pub latest_message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub feature_id: Option<String>,
}

/// An edge in the branch topology graph.
#[derive(Debug, Serialize, Clone)]
pub struct BranchGraphEdgeData {
    pub from: String,
    pub to: String,
    pub r#type: String, // "fork" | "merge" | "linear"
}

/// Result of fetch_branch_graph: nodes + edges.
#[derive(Debug, Serialize, Clone)]
pub struct BranchGraphResult {
    pub nodes: Vec<BranchGraphData>,
    pub edges: Vec<BranchGraphEdgeData>,
}

/// Fetch branch topology graph data for the /// Returns all local branches with fork/merge relationships and/// and matches feature tags from queue.yaml completed features.
#[tauri::command]
async fn fetch_branch_graph(
    state: tauri::State<'_, AppState>,
) -> Result<BranchGraphResult, String> {
    let workspace = state.workspace_path.lock().map_err(|e| e.to_string())?.clone();
    if workspace.is_empty() {
        return Err("No workspace loaded".into());
    }

    let repo_path = PathBuf::from(&workspace);
    let repo = git2::Repository::discover(&repo_path)
        .map_err(|e| format!("Not a git repository: {}", e))?;

    // Get current branch
    let current_branch = repo.head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()))
        .unwrap_or_default();

    // Collect all local branches with their tip commit OIDs
    let branch_iter = repo.branches(Some(git2::BranchType::Local))
        .map_err(|e| format!("Failed to list branches: {}", e))?;

    let mut nodes: Vec<BranchGraphData> = Vec::new();
    let mut edges: Vec<BranchGraphEdgeData> = Vec::new();

    // Load completed features from queue.yaml for matching
    let completed_features: std::collections::HashMap<String, String> = {
        let mut map: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        let queue_path = PathBuf::from(&workspace)
            .join("feature-workflow")
            .join("queue.yaml");
        if queue_path.exists() {
            if let Ok(content) = fs::read_to_string(&queue_path) {
                if let Ok(queue) = serde_yaml::from_str::<serde_yaml::Value>(&content) {
                    if let Some(completed) = queue.get("completed") {
                        if let Some(arr) = completed.as_sequence() {
                            for entry in arr {
                                if let Some(id) = entry.get("id").and_then(|v| v.as_str()) {
                                    // Try to match by tag: completed features have tags like "feat-xxx-20260403"
                                    if let Some(tag) = entry.get("tag").and_then(|v| v.as_str()) {
                                        map.insert(tag.to_string(), id.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        map
    };

    // Collect branch data
    let mut branch_tips: Vec<(String, git2::Oid)> = Vec::new();
    for branch_result in branch_iter {
        let (branch, _bt) = branch_result.map_err(|e| format!("Branch iteration error: {}", e))?;
        let name = branch.name()
            .ok()
            .flatten()
            .unwrap_or("(unknown)")
            .to_string();

        let is_current = name == current_branch;

        let (latest_message, latest_hash) = branch.get().target()
            .and_then(|oid| repo.find_commit(oid).ok())
            .map(|c| {
                let msg = c.message()
                    .unwrap_or("(no message)")
                    .lines()
                    .next()
                    .unwrap_or("")
                    .to_string();
                let hash = format!("{:.7}", c.id());
                (msg, hash)
            })
            .unwrap_or_else(|| (String::new(), String::new()));

        // Try to match with completed feature tags
        let feature_id: Option<String> = {
            // Match by branch name pattern: "feature/feat-xxx" -> feature tag "feat-xxx-*"
            if name.starts_with("feature/") {
                let feat_slug = &name["feature/".len()..];
                // Find matching tag
                completed_features.iter().find_map(|(tag_key, feat_id)| {
                    if tag_key.starts_with(feat_slug) {
                        Some(feat_id.clone())
                    } else {
                        None
                    }
                })
            } else {
                None
            }
        };

        nodes.push(BranchGraphData {
            name: name.clone(),
            r#type: "branch".to_string(),
            latest_commit: latest_hash,
            latest_message,
            feature_id,
        });

        if let Some(tip_oid) = branch.get().target() {
            branch_tips.push((name, tip_oid));
        }
    }

    // Compute fork/merge relationships by finding merge bases between branches
    // For each pair of branches, find their merge-base
    for i in 0..branch_tips.len() {
        for j in (i+1)..branch_tips.len() {
            let (name_a, oid_a) = &branch_tips[i];
            let (name_b, oid_b) = &branch_tips[j];

            if let Ok(merge_oid) = repo.merge_base(*oid_a, *oid_b) {
                // Determine relationship: which branch forked from which
                let commit_a = repo.find_commit(*oid_a);
                let commit_b = repo.find_commit(*oid_b);
                let commit_merge = repo.find_commit(merge_oid);

                if let (Ok(ca), Ok(cb), Ok(cm)) = (commit_a, commit_b, commit_merge) {
                    let time_a = ca.time().seconds();
                    let time_b = cb.time().seconds();
                    let time_m = cm.time().seconds();

                    // Skip if merge base is the same as one of the tips (direct ancestor)
                    if merge_oid == *oid_a || merge_oid == *oid_b {
                        // Linear relationship: one is ancestor of the other
                        if time_a > time_b {
                            // b is older, a is descendant
                            edges.push(BranchGraphEdgeData {
                                from: name_b.clone(),
                                to: name_a.clone(),
                                r#type: "linear".to_string(),
                            });
                        } else if time_b > time_a {
                            edges.push(BranchGraphEdgeData {
                                from: name_a.clone(),
                                to: name_b.clone(),
                                r#type: "linear".to_string(),
                            });
                        }
                        continue;
                    }

                    // Fork: the merge base is an ancestor of both branches
                    // Both branches diverged from a common ancestor
                    // The older branch is considered the "from" (source)
                    if time_a < time_b {
                        // a was created first, b forked from a's lineage
                        edges.push(BranchGraphEdgeData {
                            from: name_a.clone(),
                            to: name_b.clone(),
                            r#type: "fork".to_string(),
                        });
                    } else {
                        edges.push(BranchGraphEdgeData {
                            from: name_b.clone(),
                            to: name_a.clone(),
                            r#type: "fork".to_string(),
                        });
                    }

                    // Check if there's also a merge back
                    // A merge commit has >1 parent
                    if let Ok(merge_commit) = repo.find_commit(merge_oid) {
                        // Check if this merge_oid is actually a merge commit on either branch's path
                        // For simplicity, we check if merge_commit has 2+ parents
                        if merge_commit.parent_count() > 1 {
                            edges.push(BranchGraphEdgeData {
                                from: name_b.clone(),
                                to: name_a.clone(),
                                r#type: "merge".to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    // Sort nodes: main first, then current, then alphabetical
    nodes.sort_by(|a, b| {
        if a.name == "main" { return std::cmp::Ordering::Less; }
        if b.name == "main" { return std::cmp::Ordering::Greater; }
        if a.name == current_branch { return std::cmp::Ordering::Less; }
        if b.name == current_branch { return std::cmp::Ordering::Greater; }
        a.name.cmp(&b.name)
    });

    Ok(BranchGraphResult { nodes, edges })
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

    // Build CLI arguments: --print --resume to continue the conversation context
    let mut args = vec![
        "--print".to_string(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--resume".to_string(),
        "--session-id".to_string(),
        sid.clone(),
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
                            let text = if msg_type == "assistant" {
                                json_obj.get("content")
                                    .and_then(|c| c.as_str())
                                    .unwrap_or("")
                                    .to_string()
                            } else if is_result {
                                // Result messages signal completion; text is empty
                                String::new()
                            } else if msg_type == "system" {
                                json_obj.get("content")
                                    .and_then(|c| c.as_str())
                                    .unwrap_or("")
                                    .to_string()
                            } else {
                                // Forward other message types as raw JSON
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
        session_id,
        workspace: if workspace.is_empty() { None } else { Some(workspace) },
        system_prompt,
        timeout_secs: 120,
    };

    // We need to call execute() while holding the registry lock briefly
    let receiver = {
        let registry = state.agent_runtime_registry.lock().map_err(|e| e.to_string())?;
        let runtime = registry.get_runtime_instance(&runtime_id)?;
        runtime.execute(params)?
    };

    // Spawn thread to forward events to frontend via Tauri events
    std::thread::spawn(move || {
        while let Ok(event) = receiver.recv() {
            let _ = app.emit("agent://chunk", &event);
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
            req_agent: Mutex::new(ReqAgentState::new()),
            agent_runtime_registry: Mutex::new(create_default_registry()),
            router_engine: Mutex::new(RouterEngine::with_defaults()),
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
            fetch_branch_graph,
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
            // Smart Router (feat-agent-runtime-router)
            submit_task,
            get_routing_rules,
            update_routing_rules,
            get_task_routing_decision,
            read_file,
            read_file_base64,
            write_file,
            // Settings & LLM Provider (feat-settings-llm-config)
            read_settings,
            write_settings,
            test_llm_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
