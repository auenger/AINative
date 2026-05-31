//! RigRuntime — Built-in LLM runtime using direct Anthropic HTTP API.
//!
//! Zero-process Agent runtime: calls Anthropic Messages API directly via
//! HTTP SSE streaming, converting responses to `StreamEvent` for the
//! unified Tauri event pipeline.
//!
//! Streaming path: Anthropic SSE → reqwest bytes_stream → StreamEvent → mpsc → Tauri Event
//! (2 hops vs CLI mode's 4 hops: API → CLI process → stdout → Tauri Event)

use futures::StreamExt;
use serde_json::Value;
use std::path::PathBuf;

use crate::{
    AgentCapability, AgentRuntime, AgentRuntimeInfo, AgentRuntimeStatus, ExecuteParams, StreamEvent,
    ChatProtocol, AppSettings,
};

// ---------------------------------------------------------------------------
// RigRuntime
// ---------------------------------------------------------------------------

pub struct RigRuntime;

impl RigRuntime {
    pub fn new() -> Self {
        Self
    }

    /// Read the Anthropic API key from settings or environment variable.
    /// Priority:
    ///   1. `rig.anthropic_api_key` in `.neuro/settings.yaml` (future, not yet in AppSettings)
    ///   2. Active provider with `anthropic` protocol in settings
    ///   3. `ANTHROPIC_API_KEY` environment variable
    fn resolve_api_key(workspace: &str) -> Result<RigResolvedConfig, String> {
        // Try settings.yaml first
        let settings_path = PathBuf::from(workspace)
            .join(".neuro")
            .join("settings.yaml");

        if settings_path.exists() {
            let content = std::fs::read_to_string(&settings_path)
                .map_err(|e| format!("读取 settings.yaml 失败: {}", e))?;
            let settings: AppSettings = serde_yaml::from_str(&content)
                .map_err(|e| format!("解析 settings.yaml 失败: {}", e))?;

            // Look for an anthropic-protocol provider
            for (name, config) in &settings.providers {
                if config.protocol == ChatProtocol::Anthropic
                    && !config.api_key.is_empty()
                {
                    let api_base = if config.api_base.is_empty() {
                        "https://api.anthropic.com/v1/messages".to_string()
                    } else {
                        let b = config.api_base.trim_end_matches('/');
                        if b.ends_with("/v1/messages") || b.ends_with("/messages") {
                            b.to_string()
                        } else {
                            format!("{}/v1/messages", b)
                        }
                    };

                    let model = if !settings.llm.model.is_empty() {
                        settings.llm.model.clone()
                    } else {
                        "claude-sonnet-4-20250514".to_string()
                    };

                    eprintln!("[RigRuntime] 使用 Provider '{}' (anthropic protocol)", name);

                    return Ok(RigResolvedConfig {
                        api_key: config.api_key.clone(),
                        api_base,
                        model,
                    });
                }
            }
        }

        // Fallback: environment variable
        if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
            if !key.is_empty() {
                return Ok(RigResolvedConfig {
                    api_key: key,
                    api_base: "https://api.anthropic.com/v1/messages".to_string(),
                    model: "claude-sonnet-4-20250514".to_string(),
                });
            }
        }

        Err("未配置 Anthropic API Key。请在 Settings 中添加一个 Anthropic 协议的 Provider，或设置 ANTHROPIC_API_KEY 环境变量。".to_string())
    }

}

struct RigResolvedConfig {
    api_key: String,
    api_base: String,
    model: String,
}

impl AgentRuntime for RigRuntime {
    fn id(&self) -> &str { "rig" }
    fn name(&self) -> &str { "Rig (Built-in)" }
    fn runtime_type(&self) -> &str { "builtin" }

    fn capabilities(&self) -> Vec<AgentCapability> {
        vec![
            AgentCapability::Streaming,
            AgentCapability::ToolUse,
            AgentCapability::Sessions,
        ]
    }

    fn install_hint(&self) -> String {
        "Configure an Anthropic API Key in Settings or set ANTHROPIC_API_KEY env var".to_string()
    }

    /// Detect: built-in runtime, always "installed" if API key is configured.
    fn detect(&self) -> Result<Option<(String, String)>, String> {
        // We check with an empty workspace — env var only
        if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
            if !key.is_empty() {
                return Ok(Some(("builtin".to_string(), "0.1.0".to_string())));
            }
        }
        // If no env var, we report as detected but unavailable at runtime
        // (actual check happens via health_check with workspace)
        Ok(None)
    }

    fn health_check(&self) -> AgentRuntimeStatus {
        // We cannot check with workspace here (no workspace param in trait)
        // Use env var check as best-effort
        match self.detect() {
            Ok(Some(_)) => AgentRuntimeStatus::Available,
            _ => AgentRuntimeStatus::NotInstalled,
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
        let workspace = params.workspace.clone().unwrap_or_default();

        // Resolve API key from settings or env
        let config = Self::resolve_api_key(&workspace)?;

        eprintln!("[RigRuntime] api_base={}, model={}", config.api_base, config.model);

        let (tx, rx) = std::sync::mpsc::channel();

        let api_key = config.api_key;
        let api_base = config.api_base;
        let model = config.model;
        let system_prompt = params.system_prompt.clone();
        let user_message = params.message.clone();

        std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();

            rt.block_on(async move {
                let client = reqwest::Client::new();

                // Build messages payload
                let mut messages: Vec<serde_json::Value> = Vec::new();

                // Parse user message — JSON-encoded messages array or plain string
                if let Ok(chat_msgs) = serde_json::from_str::<Vec<Value>>(&user_message) {
                    for msg in &chat_msgs {
                        messages.push(msg.clone());
                    }
                } else {
                    messages.push(serde_json::json!({
                        "role": "user",
                        "content": user_message
                    }));
                }

                // Build Anthropic request body
                let mut body = serde_json::json!({
                    "model": model,
                    "messages": messages,
                    "max_tokens": 8192,
                    "stream": true
                });

                // System prompt as top-level field (Anthropic convention)
                if let Some(sp) = &system_prompt {
                    if !sp.is_empty() {
                        body["system"] = serde_json::json!(sp);
                    }
                }

                // Build request with Anthropic headers
                let response = match client
                    .post(&api_base)
                    .header("Content-Type", "application/json")
                    .header("anthropic-version", "2023-06-01")
                    .header("x-api-key", &api_key)
                    .json(&body)
                    .send()
                    .await
                {
                    Ok(r) => {
                        eprintln!("[RigRuntime] response status={}", r.status());
                        r
                    }
                    Err(e) => {
                        let _ = tx.send(StreamEvent {
                            text: String::new(),
                            is_done: true,
                            error: Some(format!("连接 Anthropic API 失败: {}", e)),
                            msg_type: Some("error".to_string()),
                            session_id: None,
                            idle_seconds: None,
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
                        error: Some(format!("Anthropic API 错误 ({}): {}", status, error_body)),
                        msg_type: Some("error".to_string()),
                        session_id: None,
                        idle_seconds: None,
                    });
                    return;
                }

                // Stream SSE response
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

                                if line.is_empty() {
                                    continue;
                                }

                                // SSE lines start with "data: "
                                if let Some(data) = line.strip_prefix("data: ") {
                                    if data == "[DONE]" {
                                        let _ = tx.send(StreamEvent {
                                            text: String::new(),
                                            is_done: true,
                                            error: None,
                                            msg_type: Some("result".to_string()),
                                            session_id: None,
                                            idle_seconds: None,
                                        });
                                        return;
                                    }

                                    // Parse SSE JSON
                                    let parsed: Value = match serde_json::from_str(data) {
                                        Ok(v) => v,
                                        Err(_) => continue,
                                    };

                                    let event_type = parsed.get("type")
                                        .and_then(|t| t.as_str())
                                        .unwrap_or("");

                                    match event_type {
                                        "content_block_delta" => {
                                            // Text delta
                                            if let Some(delta) = parsed.get("delta") {
                                                let delta_type = delta.get("type")
                                                    .and_then(|t| t.as_str())
                                                    .unwrap_or("");

                                                match delta_type {
                                                    "text_delta" => {
                                                        let text = delta.get("text")
                                                            .and_then(|t| t.as_str())
                                                            .unwrap_or("");
                                                        if !text.is_empty() {
                                                            let _ = tx.send(StreamEvent {
                                                                text: text.to_string(),
                                                                is_done: false,
                                                                error: None,
                                                                msg_type: Some("assistant".to_string()),
                                                                session_id: None,
                                                                idle_seconds: None,
                                                            });
                                                        }
                                                    }
                                                    "input_json_delta" => {
                                                        // Tool call partial JSON
                                                        let partial = delta.get("partial_json")
                                                            .and_then(|t| t.as_str())
                                                            .unwrap_or("");
                                                        if !partial.is_empty() {
                                                            let _ = tx.send(StreamEvent {
                                                                text: partial.to_string(),
                                                                is_done: false,
                                                                error: None,
                                                                msg_type: Some("tool_use".to_string()),
                                                                session_id: None,
                                                                idle_seconds: None,
                                                            });
                                                        }
                                                    }
                                                    _ => {}
                                                }
                                            }
                                        }
                                        "message_start" => {
                                            // Message started — extract session/message ID if available
                                            eprintln!("[RigRuntime] message_start received");
                                        }
                                        "message_delta" => {
                                            // Message-level delta (stop reason, usage)
                                            if let Some(usage) = parsed.get("usage") {
                                                let output_tokens = usage.get("output_tokens")
                                                    .and_then(|t| t.as_u64())
                                                    .unwrap_or(0);
                                                eprintln!("[RigRuntime] message_delta: output_tokens={}", output_tokens);
                                            }
                                        }
                                        "message_stop" => {
                                            // Stream complete
                                            let _ = tx.send(StreamEvent {
                                                text: String::new(),
                                                is_done: true,
                                                error: None,
                                                msg_type: Some("result".to_string()),
                                                session_id: None,
                                                idle_seconds: None,
                                            });
                                            return;
                                        }
                                        "content_block_start" => {
                                            // New content block (text or tool_use)
                                            if let Some(content_block) = parsed.get("content_block") {
                                                let block_type = content_block.get("type")
                                                    .and_then(|t| t.as_str())
                                                    .unwrap_or("");

                                                if block_type == "tool_use" {
                                                    let tool_name = content_block.get("name")
                                                        .and_then(|n| n.as_str())
                                                        .unwrap_or("unknown");
                                                    let tool_id = content_block.get("id")
                                                        .and_then(|i| i.as_str())
                                                        .unwrap_or("");
                                                    eprintln!("[RigRuntime] tool_use started: {} ({})", tool_name, tool_id);
                                                }
                                            }
                                        }
                                        "content_block_stop" => {
                                            // Content block ended
                                        }
                                        "ping" => {
                                            // Heartbeat, ignore
                                        }
                                        "error" => {
                                            let error_msg = parsed.get("error")
                                                .and_then(|e| e.get("message"))
                                                .and_then(|m| m.as_str())
                                                .unwrap_or("Unknown Anthropic API error");
                                            let _ = tx.send(StreamEvent {
                                                text: String::new(),
                                                is_done: true,
                                                error: Some(error_msg.to_string()),
                                                msg_type: Some("error".to_string()),
                                                session_id: None,
                                                idle_seconds: None,
                                            });
                                            return;
                                        }
                                        _ => {
                                            // Unknown event type, log and continue
                                            eprintln!("[RigRuntime] unknown SSE event: {}", event_type);
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            let _ = tx.send(StreamEvent {
                                text: String::new(),
                                is_done: true,
                                error: Some(format!("流式读取错误: {}", e)),
                                msg_type: Some("error".to_string()),
                                session_id: None,
                                idle_seconds: None,
                            });
                            return;
                        }
                    }
                }

                // If we exit the loop without a message_stop, send done
                let _ = tx.send(StreamEvent {
                    text: String::new(),
                    is_done: true,
                    error: None,
                    msg_type: Some("result".to_string()),
                    session_id: None,
                    idle_seconds: None,
                });
            });
        });

        Ok(rx)
    }
}
