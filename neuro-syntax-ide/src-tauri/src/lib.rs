use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Write as IoWrite};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

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
}

// ===========================================================================
// Tauri commands - File system
// ===========================================================================

#[tauri::command]
async fn pick_workspace(app: AppHandle) -> Result<WorkspaceResult, String> {
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

            if let Err(e) = persist_workspace(&app, &path_str) {
                return Ok(WorkspaceResult {
                    path: path_str,
                    valid,
                    error: Some(format!("Failed to persist workspace: {}", e)),
                });
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
async fn get_stored_workspace(app: AppHandle) -> Result<WorkspaceResult, String> {
    let store = get_store(&app)?;

    if let Some(value) = store.get(STORE_KEY_WORKSPACE) {
        let path_str = value.as_str().unwrap_or_default().to_string();
        if path_str.is_empty() {
            return Ok(WorkspaceResult { path: String::new(), valid: false, error: None });
        }

        let dir = PathBuf::from(&path_str);
        let valid = dir.exists() && dir.is_dir();
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
