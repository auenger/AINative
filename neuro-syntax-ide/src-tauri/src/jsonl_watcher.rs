//! JSONL session file watcher for Claude Code.
//!
//! Polls `~/.claude/projects/<encoded-path>/` for session JSONL files,
//! reads new lines incrementally, and emits `SessionEvent`s via Tauri events.

use crate::jsonl_parser::{read_new_lines, SessionEvent, SessionWatchState};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::mpsc::Receiver;
use tauri::{AppHandle, Emitter};

/// Poll interval in milliseconds.
const POLL_INTERVAL_MS: u64 = 500;
/// How far back (seconds) to look for recently-modified session files on initial scan.
const INITIAL_SCAN_MAX_AGE_SECS: u64 = 300;
/// How long (seconds) before a stale session (no data, no active tools) is considered lost.
const STALE_SESSION_TIMEOUT_SECS: u64 = 300;
/// Delay (seconds) after a session goes idle before emitting `session_lost`.
const SESSION_LOST_DELAY_SECS: u64 = 5;

/// Encode a file path the same way Claude Code does: `/Users/ryan/foo` → `-Users-ryan-foo`.
pub fn encode_path(p: &str) -> String {
    let p = p.trim_end_matches('/');
    let mut s = String::new();
    for ch in p.chars() {
        if ch == '/' {
            s.push('-');
        } else {
            s.push(ch);
        }
    }
    s
}

/// Resolve the Claude projects directory for a workspace path.
/// Tries the workspace path and up to 4 parent directories.
pub fn resolve_project_dir(workspace_path: &str) -> Option<PathBuf> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .ok()?;
    let claude_dir = PathBuf::from(home).join(".claude");
    let projects_base = claude_dir.join("projects");

    let mut try_path = workspace_path.trim_end_matches('/').to_string();
    for _ in 0..5 {
        let encoded = encode_path(&try_path);
        let candidate = projects_base.join(&encoded);
        if candidate.is_dir() {
            return Some(candidate);
        }
        match PathBuf::from(&try_path).parent() {
            Some(p) if !p.as_os_str().is_empty() => {
                try_path = p.to_string_lossy().to_string();
            }
            _ => break,
        }
    }
    None
}

/// Start the JSONL session watcher on a background thread.
/// Returns immediately. The thread runs until `stop_rx` receives a signal.
pub fn start_watcher(
    workspace_path: String,
    stop_rx: Receiver<()>,
    app_handle: AppHandle,
) {
    let project_dir = match resolve_project_dir(&workspace_path) {
        Some(d) => d,
        None => {
            eprintln!("[jsonl_watcher] No project dir found for: {workspace_path}");
            return;
        }
    };

    eprintln!("[jsonl_watcher] Watching: {project_dir:?}");

    std::thread::spawn(move || {
        let mut sessions: HashMap<String, SessionWatchState> = HashMap::new();
        let mut known_files: HashMap<String, u64> = HashMap::new(); // path → file_offset at discovery
        let mut lost_timers: HashMap<String, u64> = HashMap::new(); // session_id → timestamp when idle detected

        // Initial scan: discover existing JSONL files
        discover_sessions(
            &project_dir,
            &mut sessions,
            &mut known_files,
            true, // read_from_start for recent files
            &app_handle,
        );

        loop {
            // Check stop signal
            if stop_rx.try_recv().is_ok() {
                eprintln!("[jsonl_watcher] Stopped");
                break;
            }

            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();

            // Discover new session files
            discover_sessions(
                &project_dir,
                &mut sessions,
                &mut known_files,
                false, // only new files get read_from_start=true
                &app_handle,
            );

            // Poll existing sessions for new data
            let mut to_remove: Vec<String> = Vec::new();
            for (session_id, state) in sessions.iter_mut() {
                let events = read_new_lines(state);
                for event in events {
                    if let Err(e) = app_handle.emit("claude://session-event", &event) {
                        eprintln!("[jsonl_watcher] Emit error: {e}");
                    }
                }

                // Check staleness
                let has_active_tools = !state.active_tool_ids.is_empty();
                let data_age_ms = now.saturating_mul(1000).saturating_sub(state.last_data_at);
                let is_stale = data_age_ms > STALE_SESSION_TIMEOUT_SECS * 1000 && !has_active_tools;

                if is_stale {
                    if !lost_timers.contains_key(session_id) {
                        lost_timers.insert(session_id.clone(), now);
                    }
                } else {
                    lost_timers.remove(session_id);
                }
            }

            // Emit session_lost for sessions that have been idle for the delay period
            for (session_id, idle_since) in lost_timers.clone() {
                if now.saturating_sub(idle_since) >= SESSION_LOST_DELAY_SECS {
                    let _ = app_handle.emit(
                        "claude://session-event",
                        &SessionEvent::SessionLost {
                            session_id: session_id.clone(),
                        },
                    );
                    to_remove.push(session_id);
                }
            }
            for id in &to_remove {
                sessions.remove(id);
                lost_timers.remove(id);
                // Also remove from known_files so they can be re-discovered
                known_files.retain(|_, _| true); // keep all for now
            }

            std::thread::sleep(std::time::Duration::from_millis(POLL_INTERVAL_MS));
        }
    });
}

/// Discover new JSONL session files in the project directory.
/// When `read_from_start` is true, recent files are parsed from the beginning (for `claude -p` sessions).
fn discover_sessions(
    project_dir: &PathBuf,
    sessions: &mut HashMap<String, SessionWatchState>,
    known_files: &mut HashMap<String, u64>,
    initial_scan: bool,
    app_handle: &AppHandle,
) {
    let entries = match std::fs::read_dir(project_dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map_or(true, |e| e != "jsonl") {
            continue;
        }

        let path_str = path.to_string_lossy().to_string();
        if known_files.contains_key(&path_str) {
            continue;
        }

        // Check modification time
        let mtime = path
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let file_size = path.metadata().map(|m| m.len()).unwrap_or(0);

        // Initial scan: adopt recent files. Ongoing: only adopt files modified within 120s
        let max_age = if initial_scan {
            INITIAL_SCAN_MAX_AGE_SECS
        } else {
            120
        };
        if now.saturating_sub(mtime) > max_age {
            continue;
        }

        let session_id = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        if session_id.is_empty() {
            continue;
        }

        // Determine initial offset
        // For initial scan of recent files, start from 0 to capture `claude -p` sessions.
        // For newly-discovered files during polling, skip to end (only show live activity).
        let file_offset = if initial_scan && now.saturating_sub(mtime) < INITIAL_SCAN_MAX_AGE_SECS {
            0
        } else {
            file_size
        };

        known_files.insert(path_str, file_offset);

        let state = SessionWatchState {
            session_id: session_id.clone(),
            jsonl_path: path,
            file_offset,
            line_buffer: String::new(),
            active_tool_ids: std::collections::HashSet::new(),
            active_tool_names: std::collections::HashMap::new(),
            active_tool_statuses: std::collections::HashMap::new(),
            active_subagent_tools: std::collections::HashMap::new(),
            background_agent_tool_ids: std::collections::HashSet::new(),
            is_waiting: false,
            had_tools_in_turn: false,
            last_data_at: now * 1000,
        };

        sessions.insert(session_id.clone(), state);

        let _ = app_handle.emit(
            "claude://session-event",
            &SessionEvent::SessionDiscovered {
                session_id: session_id.clone(),
            },
        );

        eprintln!("[jsonl_watcher] Discovered session: {session_id} (offset: {file_offset})");
    }
}
