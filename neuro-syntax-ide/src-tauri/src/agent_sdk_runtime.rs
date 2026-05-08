//! AgentSdkRuntime — Claude Agent SDK sidecar runtime.
//!
//! Spawns a Node.js sidecar (`agent-sdk-bridge.mjs`) that uses
//! `@anthropic-ai/claude-agent-sdk` to call Anthropic-compatible endpoints.
//! Communicates via NDJSON over stdin/stdout.

use serde_json::Value;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

// Re-export types from parent that we need
use crate::{
    AgentCapability, AgentRuntime, AgentRuntimeInfo, AgentRuntimeStatus, ExecuteParams, StreamEvent,
    ChatProtocol, ProviderConfig, AppSettings, SdkConfigMode,
};

// ---------------------------------------------------------------------------
// AgentSdkRuntime
// ---------------------------------------------------------------------------

pub struct AgentSdkRuntime {
    /// Currently running sidecar process PID (for monitoring)
    pid: Arc<AtomicU64>,
}

impl AgentSdkRuntime {
    pub fn new() -> Self {
        Self {
            pid: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Find the sidecar script path.
    /// Looks next to the binary, then in `src-tauri/sidecar/`.
    fn find_sidecar_path() -> Option<PathBuf> {
        // 1. Next to the current executable (for bundled app)
        if let Ok(exe) = std::env::current_exe() {
            let dir = exe.parent()?;
            let sidecar = dir.join("agent-sdk-bridge.mjs");
            if sidecar.exists() {
                return Some(sidecar);
            }
        }

        // 2. In src-tauri/sidecar/ (for development)
        if let Ok(exe) = std::env::current_exe() {
            let dir = exe.parent()?;
            // Walk up to find project root
            let mut current = dir.to_path_buf();
            for _ in 0..5 {
                let sidecar = current.join("src-tauri").join("sidecar").join("agent-sdk-bridge.mjs");
                if sidecar.exists() {
                    return Some(sidecar);
                }
                let sidecar2 = current.join("sidecar").join("agent-sdk-bridge.mjs");
                if sidecar2.exists() {
                    return Some(sidecar2);
                }
                if !current.pop() { break; }
            }
        }

        None
    }

    /// Find the `node` binary.
    fn find_node() -> Option<String> {
        // Try common names
        for name in &["node", "node20", "node18"] {
            if let Ok(output) = Command::new("which").arg(name).output() {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
        }
        None
    }

    /// Read settings and resolve provider config based on sdk_runtime.config_mode.
    /// Returns None for claude-config mode (no env injection).
    fn resolve_provider(workspace: &str) -> Result<Option<ProviderInfo>, String> {
        let settings_path = PathBuf::from(workspace)
            .join(".neuro")
            .join("settings.yaml");

        if !settings_path.exists() {
            return Err("未找到 settings.yaml，请先配置 Provider".to_string());
        }

        let content = std::fs::read_to_string(&settings_path)
            .map_err(|e| format!("读取 settings.yaml 失败: {}", e))?;
        let settings: AppSettings = serde_yaml::from_str(&content)
            .map_err(|e| format!("解析 settings.yaml 失败: {}", e))?;

        match settings.sdk_runtime.config_mode {
            SdkConfigMode::ClaudeConfig => Ok(None),
            SdkConfigMode::CustomProvider => {
                // Use custom_provider if set, otherwise active provider
                let provider_name = if !settings.sdk_runtime.custom_provider.is_empty() {
                    &settings.sdk_runtime.custom_provider
                } else {
                    &settings.llm.provider
                };

                if provider_name.is_empty() {
                    return Err("未配置 LLM Provider，请在 Settings 中选择或新增一个 Provider".to_string());
                }

                let provider_config = settings.providers.get(provider_name)
                    .ok_or_else(|| format!("Provider '{}' 不存在，请检查 Settings 配置", provider_name))?;

                if provider_config.api_key.is_empty() {
                    return Err("API Key 为空，请在 Settings 中配置有效的 API Key".to_string());
                }

                if provider_config.api_base.is_empty() {
                    return Err("API Base URL 为空，请在 Settings 中配置有效的 API Base URL".to_string());
                }

                // Protocol check: SDK mode requires anthropic protocol
                if provider_config.protocol != ChatProtocol::Anthropic {
                    return Err(
                        "SDK Custom Provider 模式要求 Provider 协议为 anthropic，请切换或新增一个 Anthropic 兼容的 Provider".to_string()
                    );
                }

                // Model: custom_model override > llm.model > default
                let model = if !settings.sdk_runtime.custom_model.is_empty() {
                    settings.sdk_runtime.custom_model.clone()
                } else if !settings.llm.model.is_empty() {
                    settings.llm.model.clone()
                } else {
                    "claude-sonnet-4-20250514".to_string()
                };

                Ok(Some(ProviderInfo {
                    api_key: provider_config.api_key.clone(),
                    api_base: provider_config.api_base.clone(),
                    model,
                }))
            }
        }
    }
}

struct ProviderInfo {
    api_key: String,
    api_base: String,
    model: String,
}

impl AgentRuntime for AgentSdkRuntime {
    fn id(&self) -> &str { "agent-sdk" }
    fn name(&self) -> &str { "Agent SDK" }
    fn runtime_type(&self) -> &str { "sdk" }

    fn capabilities(&self) -> Vec<AgentCapability> {
        vec![
            AgentCapability::Streaming,
            AgentCapability::Sessions,
            AgentCapability::ToolUse,
            AgentCapability::StructuredOutput,
        ]
    }

    fn install_hint(&self) -> String {
        "npm install -g @anthropic-ai/claude-agent-sdk".to_string()
    }

    fn detect(&self) -> Result<Option<(String, String)>, String> {
        // Check: node available + sidecar script exists
        let node_path = Self::find_node();
        let sidecar = Self::find_sidecar_path();

        match (node_path, sidecar) {
            (Some(np), Some(sp)) => {
                // Try to get node version
                let version = Command::new(&np)
                    .arg("--version")
                    .output()
                    .ok()
                    .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                    .unwrap_or_else(|| "unknown".to_string());
                Ok(Some((sp.to_string_lossy().to_string(), version)))
            }
            (Some(_), None) => Ok(None), // node found but no sidecar
            (None, Some(_)) => Ok(None), // sidecar found but no node
            (None, None) => Ok(None),
        }
    }

    fn health_check(&self) -> AgentRuntimeStatus {
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
        let node_path = Self::find_node()
            .ok_or_else(|| "未找到 Node.js 运行时，请安装 Node.js (v18+)".to_string())?;
        let sidecar_path = Self::find_sidecar_path()
            .ok_or_else(|| "未找到 agent-sdk-bridge.mjs sidecar 脚本".to_string())?;

        // Read provider config from settings based on config_mode
        let workspace = params.workspace.as_deref().unwrap_or("");
        let provider_opt = Self::resolve_provider(workspace)?;

        // Spawn sidecar process
        let mut child = Command::new(&node_path)
            .arg(&sidecar_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("启动 SDK sidecar 失败: {}", e))?;

        // Store PID for monitoring
        self.pid.store(child.id() as u64, Ordering::Relaxed);

        // Build query message based on config_mode
        let query_msg = match provider_opt {
            Some(provider) => {
                // Custom Provider mode: inject env vars + model override
                let mut env = serde_json::json!({
                    "ANTHROPIC_BASE_URL": provider.api_base,
                    "ANTHROPIC_API_KEY": provider.api_key,
                });
                if !provider.model.is_empty() {
                    env["ANTHROPIC_MODEL"] = serde_json::json!(provider.model);
                }
                serde_json::json!({
                    "type": "query",
                    "prompt": params.message,
                    "sessionId": params.session_id,
                    "options": {
                        "model": provider.model,
                        "env": env,
                    }
                })
            }
            None => {
                // Claude Config mode: no env injection
                serde_json::json!({
                    "type": "query",
                    "prompt": params.message,
                    "sessionId": params.session_id,
                    "options": {}
                })
            }
        };

        {
            let stdin = child.stdin.as_mut().ok_or("无法获取 sidecar stdin")?;
            serde_json::to_writer(&mut *stdin, &query_msg)
                .map_err(|e| format!("写入 sidecar stdin 失败: {}", e))?;
            stdin.write_all(b"\n")
                .map_err(|e| format!("写入 sidecar stdin 换行失败: {}", e))?;
        }

        let stdout_handle = child.stdout.take()
            .ok_or_else(|| "无法获取 sidecar stdout".to_string())?;
        let stderr_handle = child.stderr.take()
            .ok_or_else(|| "无法获取 sidecar stderr".to_string())?;

        let (tx, rx) = std::sync::mpsc::channel();

        // --- stdout reader thread: NDJSON → StreamEvent ---
        let tx_stdout = tx.clone();
        let pid = self.pid.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout_handle);
            for line in reader.lines() {
                match line {
                    Ok(text) => {
                        let trimmed = text.trim();
                        // Skip empty lines
                        if trimmed.is_empty() { continue; }

                        // Skip UTF-8 BOM
                        let trimmed = trimmed.strip_prefix('\u{feff}').unwrap_or(trimmed);

                        // Parse NDJSON
                        let parsed: Value = match serde_json::from_str(trimmed) {
                            Ok(v) => v,
                            Err(e) => {
                                // Log parse error but don't crash
                                eprintln!("[agent-sdk] NDJSON parse error: {} (line: {})",
                                    e, trimmed.chars().take(200).collect::<String>());
                                continue;
                            }
                        };

                        let msg_type = parsed.get("type")
                            .and_then(|t| t.as_str())
                            .unwrap_or("unknown")
                            .to_string();

                        let event = match msg_type.as_str() {
                            "assistant" => {
                                let text = parsed.get("text")
                                    .and_then(|t| t.as_str())
                                    .unwrap_or("")
                                    .to_string();
                                StreamEvent {
                                    text,
                                    is_done: false,
                                    error: None,
                                    msg_type: Some("assistant".to_string()),
                                    session_id: None,
                                    idle_seconds: None,
                                }
                            }
                            "result" => {
                                let text = parsed.get("text")
                                    .and_then(|t| t.as_str())
                                    .unwrap_or("")
                                    .to_string();
                                let session_id = parsed.get("session_id")
                                    .and_then(|s| s.as_str())
                                    .map(|s| s.to_string());
                                StreamEvent {
                                    text,
                                    is_done: true,
                                    error: None,
                                    msg_type: Some("result".to_string()),
                                    session_id,
                                    idle_seconds: None,
                                }
                            }
                            "error" => {
                                let text = parsed.get("text")
                                    .and_then(|t| t.as_str())
                                    .unwrap_or("Unknown SDK error")
                                    .to_string();
                                StreamEvent {
                                    text: String::new(),
                                    is_done: true,
                                    error: Some(text),
                                    msg_type: Some("error".to_string()),
                                    session_id: None,
                                    idle_seconds: None,
                                }
                            }
                            "system" => {
                                let session_id = parsed.get("session_id")
                                    .and_then(|s| s.as_str())
                                    .map(|s| s.to_string());
                                StreamEvent {
                                    text: String::new(),
                                    is_done: false,
                                    error: None,
                                    msg_type: Some("system".to_string()),
                                    session_id,
                                    idle_seconds: None,
                                }
                            }
                            "rate_limit" => {
                                let text = parsed.get("text")
                                    .and_then(|t| t.as_str())
                                    .unwrap_or("Rate limit reached")
                                    .to_string();
                                StreamEvent {
                                    text,
                                    is_done: false,
                                    error: None,
                                    msg_type: Some("rate_limit".to_string()),
                                    session_id: None,
                                    idle_seconds: None,
                                }
                            }
                            _ => {
                                // Unknown type, forward as raw
                                StreamEvent {
                                    text: trimmed.to_string(),
                                    is_done: false,
                                    error: None,
                                    msg_type: Some("raw".to_string()),
                                    session_id: None,
                                    idle_seconds: None,
                                }
                            }
                        };

                        if tx_stdout.send(event).is_err() { break; }
                        if msg_type == "result" || msg_type == "error" { break; }
                    }
                    Err(_) => break, // stdout closed
                }
            }

            // Clear PID
            pid.store(0, Ordering::Relaxed);
        });

        // --- stderr reader thread (diagnostics only) ---
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr_handle);
            for line in reader.lines() {
                if let Ok(text) = line {
                    eprintln!("[agent-sdk-sidecar] {}", text);
                }
            }
        });

        // --- Process exit monitor ---
        let tx_exit = tx.clone();
        let pid_monitor = self.pid.clone();
        std::thread::spawn(move || {
            // Wait for process to exit
            let _ = child.wait();
            // If the process exits and we haven't sent is_done yet
            let was_running = pid_monitor.swap(0, Ordering::Relaxed);
            if was_running > 0 {
                // Process died unexpectedly — send error event
                let _ = tx_exit.send(StreamEvent {
                    text: String::new(),
                    is_done: true,
                    error: Some("Agent 运行时异常退出".to_string()),
                    msg_type: Some("error".to_string()),
                    session_id: None,
                    idle_seconds: None,
                });
            }
        });

        Ok(rx)
    }
}
