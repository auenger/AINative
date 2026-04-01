use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Write as IoWrite};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;
use notify::{RecommendedWatcher, RecursiveMode, Watcher, Config as NotifyConfig, Event as NotifyEvent};

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

        self.instances.insert(pty_id, PtyInstance { master: pair.master });
        Ok(())
    }

    fn write(&mut self, pty_id: &str, data: &str) -> Result<(), String> {
        if let Some(instance) = self.instances.get_mut(pty_id) {
            let mut writer = instance.master
                .take_writer()
                .map_err(|e| format!("Failed to get writer: {}", e))?;
            writer.write_all(data.as_bytes()).map_err(|e| format!("Failed to write: {}", e))?;
            writer.flush().map_err(|e| format!("Failed to flush: {}", e))?;
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
