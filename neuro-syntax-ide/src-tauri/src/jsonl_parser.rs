//! JSONL transcript parser for Claude Code session files.
//!
//! Ported from pixel-agents `transcriptParser.ts`.
//! Parses each JSONL line and emits structured `SessionEvent`s.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

/// Maximum bytes to read per poll cycle.
const MAX_READ_BYTES: u64 = 65536;

/// Tracks state for a single watched JSONL session file.
pub struct SessionWatchState {
    pub session_id: String,
    pub jsonl_path: PathBuf,
    pub file_offset: u64,
    pub line_buffer: String,
    pub active_tool_ids: HashSet<String>,
    pub active_tool_names: HashMap<String, String>,
    pub active_tool_statuses: HashMap<String, String>,
    /// parent_tool_id → (sub_tool_id → tool_name)
    pub active_subagent_tools: HashMap<String, HashMap<String, String>>,
    /// Tool IDs for run_in_background Agent calls (stay alive until queue-operation).
    pub background_agent_tool_ids: HashSet<String>,
    pub is_waiting: bool,
    pub had_tools_in_turn: bool,
    /// Timestamp (ms since epoch) of last JSONL data received.
    pub last_data_at: u64,
}

/// Event types emitted to the frontend via Tauri events.
#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type")]
pub enum SessionEvent {
    #[serde(rename = "tool_start")]
    ToolStart {
        session_id: String,
        tool_id: String,
        tool_name: String,
        status: String,
    },
    #[serde(rename = "tool_done")]
    ToolDone {
        session_id: String,
        tool_id: String,
    },
    #[serde(rename = "tools_clear")]
    ToolsClear {
        session_id: String,
    },
    #[serde(rename = "turn_end")]
    TurnEnd {
        session_id: String,
    },
    #[serde(rename = "subagent_start")]
    SubagentStart {
        session_id: String,
        parent_tool_id: String,
        tool_id: String,
        tool_name: String,
        status: String,
    },
    #[serde(rename = "subagent_done")]
    SubagentDone {
        session_id: String,
        parent_tool_id: String,
        tool_id: String,
    },
    #[serde(rename = "subagent_clear")]
    SubagentClear {
        session_id: String,
        parent_tool_id: String,
    },
    #[serde(rename = "session_discovered")]
    SessionDiscovered {
        session_id: String,
    },
    #[serde(rename = "session_lost")]
    SessionLost {
        session_id: String,
    },
}

const BASH_DISPLAY_MAX: usize = 80;
const TASK_DESC_DISPLAY_MAX: usize = 60;

/// Format a human-readable status string for a tool invocation.
pub fn format_tool_status(tool_name: &str, input: &serde_json::Value) -> String {
    let basename = |v: &serde_json::Value| -> String {
        v.as_str()
            .and_then(|s| s.rsplit('/').next())
            .unwrap_or("")
            .to_string()
    };

    match tool_name {
        "Read" => format!("Reading {}", basename(&input["file_path"])),
        "Edit" => format!("Editing {}", basename(&input["file_path"])),
        "Write" => format!("Writing {}", basename(&input["file_path"])),
        "Bash" => {
            let cmd = input["command"].as_str().unwrap_or("");
            if cmd.len() > BASH_DISPLAY_MAX {
                format!("Running: {}…", &cmd[..BASH_DISPLAY_MAX])
            } else {
                format!("Running: {cmd}")
            }
        }
        "Glob" => "Searching files".to_string(),
        "Grep" => "Searching code".to_string(),
        "WebFetch" => "Fetching web content".to_string(),
        "WebSearch" => "Searching the web".to_string(),
        "Task" | "Agent" => {
            let desc = input["description"].as_str().unwrap_or("");
            if desc.is_empty() {
                "Running subtask".to_string()
            } else if desc.len() > TASK_DESC_DISPLAY_MAX {
                format!("Subtask: {}…", &desc[..TASK_DESC_DISPLAY_MAX])
            } else {
                format!("Subtask: {desc}")
            }
        }
        "NotebookEdit" => "Editing notebook".to_string(),
        _ => format!("Using {tool_name}"),
    }
}

/// Read new lines from a JSONL file (incremental from `file_offset`).
/// Returns parsed events.
pub fn read_new_lines(state: &mut SessionWatchState) -> Vec<SessionEvent> {
    let mut events = Vec::new();

    let Ok(metadata) = std::fs::metadata(&state.jsonl_path) else {
        return events;
    };
    let file_size = metadata.len();
    if file_size <= state.file_offset {
        return events;
    }

    let bytes_to_read = (file_size - state.file_offset).min(MAX_READ_BYTES) as usize;
    let Ok(mut file) = std::fs::File::open(&state.jsonl_path) else {
        return events;
    };
    use std::io::{Read, Seek, SeekFrom};
    if file
        .seek(SeekFrom::Start(state.file_offset))
        .is_err()
    {
        return events;
    }

    let mut buf = vec![0u8; bytes_to_read];
    if file.read_exact(&mut buf).is_err() {
        return events;
    }
    state.file_offset += bytes_to_read as u64;

    let text = format!("{}{}", state.line_buffer, String::from_utf8_lossy(&buf));
    let mut lines: Vec<&str> = text.split('\n').collect();
    // Last element is the incomplete remainder
    state.line_buffer = lines.pop().unwrap_or("").to_string();

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let has_lines = lines.iter().any(|l| !l.trim().is_empty());
    if has_lines {
        state.last_data_at = now;
    }

    for line in lines {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        events.extend(parse_jsonl_line(trimmed, state));
    }

    events
}

/// Parse a single JSONL line and return events.
pub fn parse_jsonl_line(line: &str, state: &mut SessionWatchState) -> Vec<SessionEvent> {
    let mut events = Vec::new();
    let Ok(record) = serde_json::from_str::<serde_json::Value>(line) else {
        return events;
    };

    let record_type = record["type"].as_str().unwrap_or("");

    match record_type {
        "assistant" | "message" => {
            // Both `assistant` and `message` type records can contain tool_use blocks.
            // Content may be in record.message.content or record.content directly.
            let content = record
                .get("message")
                .and_then(|m| m.get("content"))
                .or_else(|| record.get("content"));

            let Some(content_arr) = content.and_then(|c| c.as_array()) else {
                return events;
            };

            let has_tool_use = content_arr
                .iter()
                .any(|b| b["type"].as_str() == Some("tool_use"));

            if has_tool_use {
                state.is_waiting = false;
                state.had_tools_in_turn = true;

                for block in content_arr {
                    if block["type"].as_str() != Some("tool_use") {
                        continue;
                    }
                    let tool_id = block["id"].as_str().unwrap_or("").to_string();
                    let tool_name = block["name"].as_str().unwrap_or("").to_string();
                    if tool_id.is_empty() {
                        continue;
                    }

                    let status = format_tool_status(&tool_name, &block.get("input").cloned().unwrap_or(serde_json::Value::Null));

                    state.active_tool_ids.insert(tool_id.clone());
                    state.active_tool_names.insert(tool_id.clone(), tool_name.clone());
                    state.active_tool_statuses.insert(tool_id.clone(), status.clone());

                    events.push(SessionEvent::ToolStart {
                        session_id: state.session_id.clone(),
                        tool_id,
                        tool_name,
                        status,
                    });
                }
            }
        }

        "user" => {
            let content = record
                .get("message")
                .and_then(|m| m.get("content"))
                .or_else(|| record.get("content"));

            if let Some(content_arr) = content.and_then(|c| c.as_array()) {
                let has_tool_result = content_arr
                    .iter()
                    .any(|b| b["type"].as_str() == Some("tool_result"));

                if has_tool_result {
                    for block in content_arr {
                        if block["type"].as_str() != Some("tool_result") {
                            continue;
                        }
                        let tool_use_id = block["tool_use_id"].as_str().unwrap_or("").to_string();
                        if tool_use_id.is_empty() {
                            continue;
                        }

                        let completed_tool_name = state
                            .active_tool_names
                            .get(&tool_use_id)
                            .cloned()
                            .unwrap_or_default();

                        // Detect background agent launches
                        if (completed_tool_name == "Task" || completed_tool_name == "Agent")
                            && is_async_agent_result(block)
                        {
                            state
                                .background_agent_tool_ids
                                .insert(tool_use_id.clone());
                            continue;
                        }

                        // If the completed tool was a Task/Agent, clear its subagent tools
                        if completed_tool_name == "Task" || completed_tool_name == "Agent" {
                            state.active_subagent_tools.remove(&tool_use_id);
                            events.push(SessionEvent::SubagentClear {
                                session_id: state.session_id.clone(),
                                parent_tool_id: tool_use_id.clone(),
                            });
                        }

                        state.active_tool_ids.remove(&tool_use_id);
                        state.active_tool_names.remove(&tool_use_id);
                        state.active_tool_statuses.remove(&tool_use_id);

                        events.push(SessionEvent::ToolDone {
                            session_id: state.session_id.clone(),
                            tool_id: tool_use_id,
                        });
                    }

                    if state.active_tool_ids.is_empty() {
                        state.had_tools_in_turn = false;
                    }
                } else {
                    // New user text prompt — new turn starting
                    events.extend(clear_agent_activity(state));
                    state.had_tools_in_turn = false;
                }
            } else if content.map_or(false, |c| c.as_str().map_or(false, |s| !s.trim().is_empty()))
            {
                // New user text prompt — new turn starting
                events.extend(clear_agent_activity(state));
                state.had_tools_in_turn = false;
            }
        }

        "progress" => {
            events.extend(process_progress_record(&record, state));
        }

        "system" => {
            let subtype = record["subtype"].as_str().unwrap_or("");
            if subtype == "turn_duration" {
                // Turn complete — clear non-background tool state
                let bg_ids = state.background_agent_tool_ids.clone();
                let foreground_ids: Vec<String> = state
                    .active_tool_ids
                    .iter()
                    .filter(|id| !bg_ids.contains(*id))
                    .cloned()
                    .collect();

                for id in &foreground_ids {
                    let tool_name = state.active_tool_names.remove(id);
                    state.active_tool_statuses.remove(id);
                    if let Some(name) = &tool_name {
                        if name == "Task" || name == "Agent" {
                            state.active_subagent_tools.remove(id);
                            events.push(SessionEvent::SubagentClear {
                                session_id: state.session_id.clone(),
                                parent_tool_id: id.clone(),
                            });
                        }
                    }
                    state.active_tool_ids.remove(id);
                }

                if !foreground_ids.is_empty() {
                    events.push(SessionEvent::ToolsClear {
                        session_id: state.session_id.clone(),
                    });
                }

                state.is_waiting = true;
                state.had_tools_in_turn = false;

                events.push(SessionEvent::TurnEnd {
                    session_id: state.session_id.clone(),
                });
            }
        }

        "queue-operation" => {
            let operation = record["operation"].as_str().unwrap_or("");
            if operation == "enqueue" {
                if let Some(content_str) = record["content"].as_str() {
                    if let Some(tool_id) = extract_tool_use_id(content_str) {
                        if state.background_agent_tool_ids.contains(&tool_id) {
                            state.background_agent_tool_ids.remove(&tool_id);
                            state.active_subagent_tools.remove(&tool_id);
                            events.push(SessionEvent::SubagentClear {
                                session_id: state.session_id.clone(),
                                parent_tool_id: tool_id.clone(),
                            });
                            state.active_tool_ids.remove(&tool_id);
                            state.active_tool_names.remove(&tool_id);
                            state.active_tool_statuses.remove(&tool_id);
                            events.push(SessionEvent::ToolDone {
                                session_id: state.session_id.clone(),
                                tool_id,
                            });
                        }
                    }
                }
            }
        }

        _ => {}
    }

    events
}

/// Process a `progress` record for sub-agent tracking.
fn process_progress_record(
    record: &serde_json::Value,
    state: &mut SessionWatchState,
) -> Vec<SessionEvent> {
    let mut events = Vec::new();

    let parent_tool_id = match record["parentToolUseID"].as_str() {
        Some(id) => id.to_string(),
        None => return events,
    };

    let Some(data) = record.get("data") else {
        return events;
    };

    // bash_progress / mcp_progress: tool is running, no event needed
    let data_type = data["type"].as_str().unwrap_or("");
    if data_type == "bash_progress" || data_type == "mcp_progress" {
        return events;
    }

    // Verify parent is an active Task/Agent tool
    let parent_tool_name = state
        .active_tool_names
        .get(&parent_tool_id)
        .cloned()
        .unwrap_or_default();
    if parent_tool_name != "Task" && parent_tool_name != "Agent" {
        return events;
    }

    let Some(msg) = data.get("message") else {
        return events;
    };
    let msg_type = msg["type"].as_str().unwrap_or("");
    let content = msg
        .get("message")
        .and_then(|m| m.get("content"))
        .or_else(|| msg.get("content"));
    let Some(content_arr) = content.and_then(|c| c.as_array()) else {
        return events;
    };

    if msg_type == "assistant" {
        for block in content_arr {
            if block["type"].as_str() != Some("tool_use") {
                continue;
            }
            let sub_tool_id = block["id"].as_str().unwrap_or("").to_string();
            let sub_tool_name = block["name"].as_str().unwrap_or("").to_string();
            if sub_tool_id.is_empty() {
                continue;
            }

            let status = format_tool_status(
                &sub_tool_name,
                &block.get("input").cloned().unwrap_or(serde_json::Value::Null),
            );

            state
                .active_subagent_tools
                .entry(parent_tool_id.clone())
                .or_default()
                .insert(sub_tool_id.clone(), sub_tool_name.clone());

            events.push(SessionEvent::SubagentStart {
                session_id: state.session_id.clone(),
                parent_tool_id: parent_tool_id.clone(),
                tool_id: sub_tool_id,
                tool_name: sub_tool_name,
                status,
            });
        }
    } else if msg_type == "user" {
        for block in content_arr {
            if block["type"].as_str() != Some("tool_result") {
                continue;
            }
            let sub_tool_id = block["tool_use_id"].as_str().unwrap_or("").to_string();
            if sub_tool_id.is_empty() {
                continue;
            }

            if let Some(subs) = state.active_subagent_tools.get_mut(&parent_tool_id) {
                subs.remove(&sub_tool_id);
            }

            events.push(SessionEvent::SubagentDone {
                session_id: state.session_id.clone(),
                parent_tool_id: parent_tool_id.clone(),
                tool_id: sub_tool_id,
            });
        }
    }

    events
}

/// Clear all agent activity state and return appropriate events.
fn clear_agent_activity(state: &mut SessionWatchState) -> Vec<SessionEvent> {
    let mut events = Vec::new();

    if !state.active_tool_ids.is_empty() {
        events.push(SessionEvent::ToolsClear {
            session_id: state.session_id.clone(),
        });
    }

    // Clear sub-agent state
    for parent_id in state.active_subagent_tools.keys().cloned().collect::<Vec<_>>() {
        events.push(SessionEvent::SubagentClear {
            session_id: state.session_id.clone(),
            parent_tool_id: parent_id,
        });
    }

    state.active_tool_ids.clear();
    state.active_tool_names.clear();
    state.active_tool_statuses.clear();
    state.active_subagent_tools.clear();
    state.background_agent_tool_ids.clear();
    state.is_waiting = false;

    events
}

/// Check if a tool_result block indicates an async/background agent launch.
fn is_async_agent_result(block: &serde_json::Value) -> bool {
    let content = &block["content"];
    if let Some(arr) = content.as_array() {
        for item in arr {
            if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                if text.starts_with("Async agent launched successfully.") {
                    return true;
                }
            }
        }
    } else if let Some(text) = content.as_str() {
        return text.starts_with("Async agent launched successfully.");
    }
    false
}

/// Extract `<tool-use-id>` from XML content in queue-operation records.
fn extract_tool_use_id(content: &str) -> Option<String> {
    let start = content.find("<tool-use-id>")?;
    let end = content.find("</tool-use-id>")?;
    let id_start = start + "<tool-use-id>".len();
    if id_start < end {
        Some(content[id_start..end].to_string())
    } else {
        None
    }
}
