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
    *state.workspace_path.lock().map_err(|e| e.to_string())? = path;
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
            // Git stage & commit (feat-git-stage-commit)
            git_stage_file,
            git_stage_all,
            git_unstage_file,
            git_commit,
            // Git push & pull (feat-git-push-pull)
            git_push,
            git_pull,
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
            read_file,
            read_file_base64,
            write_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
