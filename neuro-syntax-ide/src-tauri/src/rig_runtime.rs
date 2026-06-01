//! RigRuntime — Built-in LLM runtime using direct HTTP API with multi-provider support.
//!
//! Zero-process Agent runtime: calls LLM Messages API directly via
//! HTTP SSE streaming, converting responses to `StreamEvent` for the
//! unified Tauri event pipeline.
//!
//! Supported providers: Anthropic, OpenAI, Google Gemini, DeepSeek, Ollama (local).
//! Each provider uses its specific API format and endpoint pattern.
//!
//! Streaming path: Provider SSE → reqwest bytes_stream → StreamEvent → mpsc → Tauri Event

use futures::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;

use crate::{
    AgentCapability, AgentRuntime, AgentRuntimeInfo, AgentRuntimeStatus, ExecuteParams, StreamEvent,
};
use crate::rig_tools::{ToolDefinition, ToolRegistry};

// ---------------------------------------------------------------------------
// Provider types & constants
// ---------------------------------------------------------------------------

/// Supported Rig provider identifiers.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Default)]
#[serde(rename_all = "kebab-case")]
pub enum RigProvider {
    #[default]
    Anthropic,
    Openai,
    Gemini,
    Deepseek,
    Ollama,
}

impl RigProvider {
    #[allow(dead_code)]
    pub fn all() -> Vec<&'static str> {
        vec!["anthropic", "openai", "gemini", "deepseek", "ollama"]
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "anthropic" => Some(Self::Anthropic),
            "openai" => Some(Self::Openai),
            "gemini" => Some(Self::Gemini),
            "deepseek" => Some(Self::Deepseek),
            "ollama" => Some(Self::Ollama),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Anthropic => "anthropic",
            Self::Openai => "openai",
            Self::Gemini => "gemini",
            Self::Deepseek => "deepseek",
            Self::Ollama => "ollama",
        }
    }

    /// Default model for each provider.
    pub fn default_model(&self) -> &'static str {
        match self {
            Self::Anthropic => "claude-sonnet-4-20250514",
            Self::Openai => "gpt-4o",
            Self::Gemini => "gemini-2.0-flash",
            Self::Deepseek => "deepseek-chat",
            Self::Ollama => "llama3",
        }
    }

    /// Default API base URL for each provider.
    pub fn default_base_url(&self) -> &'static str {
        match self {
            Self::Anthropic => "https://api.anthropic.com",
            Self::Openai => "https://api.openai.com",
            Self::Gemini => "https://generativelanguage.googleapis.com",
            Self::Deepseek => "https://api.deepseek.com",
            Self::Ollama => "http://localhost:11434",
        }
    }

    /// Whether this provider requires an API key.
    pub fn requires_api_key(&self) -> bool {
        !matches!(self, Self::Ollama)
    }

    /// Human-readable label for UI display.
    pub fn label(&self) -> &'static str {
        match self {
            Self::Anthropic => "Anthropic",
            Self::Openai => "OpenAI",
            Self::Gemini => "Google Gemini",
            Self::Deepseek => "DeepSeek",
            Self::Ollama => "Ollama (Local)",
        }
    }

    /// Environment variable fallback for API key.
    pub fn env_key(&self) -> &'static str {
        match self {
            Self::Anthropic => "ANTHROPIC_API_KEY",
            Self::Openai => "OPENAI_API_KEY",
            Self::Gemini => "GOOGLE_API_KEY",
            Self::Deepseek => "DEEPSEEK_API_KEY",
            Self::Ollama => "", // No key needed
        }
    }
}

/// Rig provider configuration stored in settings.yaml.
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct RigProviderConfig {
    /// Selected provider: anthropic | openai | gemini | deepseek | ollama
    #[serde(default)]
    pub provider: String,
    /// API key for the selected provider
    #[serde(default)]
    pub api_key: String,
    /// Optional custom base URL (overrides provider default)
    #[serde(default)]
    pub base_url: String,
    /// Optional model override (overrides provider default)
    #[serde(default)]
    pub model: String,
}

/// Resolved configuration ready for API calls.
struct RigResolvedConfig {
    provider: RigProvider,
    api_key: String,
    api_base: String,
    model: String,
}

/// Compaction config resolved from settings.yaml.
struct CompactionConfig {
    /// Context window size in tokens (from LlmConfig.context_window_tokens).
    pub context_window_tokens: usize,
    /// Ratio at which compaction triggers (0.5–0.95, default 0.75).
    pub trigger_ratio: f64,
    /// Number of recent assistant+tool_result pairs to keep (default 4).
    pub keep_recent: usize,
    /// Compaction strategy.
    pub strategy: CompactionStrategy,
}

/// Read compaction configuration from settings.yaml, using defaults for missing fields.
fn read_compaction_config(workspace: &str) -> CompactionConfig {
    let defaults = CompactionConfig {
        context_window_tokens: 128000,
        trigger_ratio: 0.75,
        keep_recent: 4,
        strategy: CompactionStrategy::SlidingWindow,
    };

    let settings_path = PathBuf::from(workspace)
        .join(".neuro")
        .join("settings.yaml");

    if !settings_path.exists() {
        return defaults;
    }

    let content = match std::fs::read_to_string(&settings_path) {
        Ok(c) => c,
        Err(_) => return defaults,
    };

    let settings: crate::AppSettings = match serde_yaml::from_str(&content) {
        Ok(s) => s,
        Err(_) => return defaults,
    };

    CompactionConfig {
        context_window_tokens: settings.llm.context_window_tokens as usize,
        trigger_ratio: settings.llm.compaction_trigger_ratio,
        keep_recent: settings.llm.compaction_keep_recent as usize,
        strategy: CompactionStrategy::from_str(&settings.llm.compaction_strategy),
    }
}

// ---------------------------------------------------------------------------
// Context Compaction Engine
// ---------------------------------------------------------------------------

/// Compaction strategy selection.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Default)]
#[serde(rename_all = "snake_case")]
pub enum CompactionStrategy {
    /// Sliding window: drop oldest assistant+tool_result pairs, keep recent N.
    #[default]
    SlidingWindow,
    /// Summarize: generate a summary message from evicted turns before dropping.
    Summarize,
}

impl CompactionStrategy {
    pub fn from_str(s: &str) -> Self {
        match s {
            "summarize" => Self::Summarize,
            _ => Self::SlidingWindow,
        }
    }
}

/// Result of a compaction operation.
pub struct CompactionResult {
    /// The compacted messages array.
    pub messages: Vec<Value>,
    /// How many messages were removed.
    pub removed_count: usize,
    /// Token count before compaction.
    pub original_tokens: usize,
    /// Generated summary text (only for Summarize strategy).
    pub summary: Option<String>,
}

/// Compact a messages array using sliding window and optional summarization.
///
/// Preserves the first user message, generates an optional summary from evicted
/// turns, then keeps the most recent N assistant+tool_result pairs.
///
/// This function is designed to be independently callable — both from the
/// automatic tool-loop compaction check and from a future `/compact` slash command.
pub fn compact_messages(
    messages: &[Value],
    _context_window: usize,
    keep_recent: usize,
    strategy: CompactionStrategy,
) -> CompactionResult {
    let original_tokens = 0; // Not estimated here; caller tracks via API usage
    let original_count = messages.len();

    if messages.len() <= 3 {
        // Too few messages to compact
        return CompactionResult {
            messages: messages.to_vec(),
            removed_count: 0,
            original_tokens,
            summary: None,
        };
    }

    // Find the index of the first user message (the original request)
    let first_user_idx = messages.iter().position(|m| {
        m.get("role").and_then(|r| r.as_str()) == Some("user")
    }).unwrap_or(0);

    // Collect assistant+tool_result pairs as contiguous groups.
    // We scan from the end to identify the "keep_recent" pairs.
    // Each "pair" is: assistant message (+ its tool_calls) followed by user/tool messages (tool_results).
    //
    // We work backwards: count N groups from the end.

    // Build a list of "turn groups" — each group starts with an assistant message
    // and includes any following tool-result messages (user with tool_result content,
    // or role:"tool" messages).
    let mut turn_groups: Vec<(usize, usize)> = Vec::new(); // (start_idx, end_idx_exclusive)
    let mut i = first_user_idx + 1;
    while i < messages.len() {
        let role = messages[i].get("role").and_then(|r| r.as_str()).unwrap_or("");
        if role == "assistant" {
            let start = i;
            i += 1;
            // Consume following tool-result messages
            while i < messages.len() {
                let r = messages[i].get("role").and_then(|r2| r2.as_str()).unwrap_or("");
                if r == "assistant" {
                    break;
                }
                // Check if this is a tool result message
                let is_tool_result = r == "tool"
                    || (r == "user" && messages[i].get("content").and_then(|c| c.as_array()).map_or(false, |arr| {
                        arr.iter().any(|block| block.get("type").and_then(|t| t.as_str()) == Some("tool_result"))
                    }));
                if !is_tool_result {
                    break;
                }
                i += 1;
            }
            turn_groups.push((start, i));
        } else {
            i += 1;
        }
    }

    // If we have fewer turn groups than keep_recent, no compaction needed
    if turn_groups.len() <= keep_recent {
        return CompactionResult {
            messages: messages.to_vec(),
            removed_count: 0,
            original_tokens,
            summary: None,
        };
    }

    // Determine which groups to evict and which to keep
    let keep_from = turn_groups.len() - keep_recent;
    let evicted_groups = &turn_groups[..keep_from];
    let kept_groups = &turn_groups[keep_from..];

    // Build summary from evicted messages if Summarize strategy
    let summary = if strategy == CompactionStrategy::Summarize && !evicted_groups.is_empty() {
        Some(generate_summary_from_groups(messages, evicted_groups))
    } else {
        None
    };

    // Rebuild messages: first user message + optional summary + kept groups
    let mut result = Vec::new();

    // Keep everything up to and including the first user message
    for msg in messages.iter().take(first_user_idx + 1) {
        result.push(msg.clone());
    }

    // Insert summary message if generated
    if let Some(ref summary_text) = summary {
        result.push(serde_json::json!({
            "role": "user",
            "content": summary_text,
        }));
    }

    // Add kept turn groups
    for &(start, end) in kept_groups {
        for msg in messages.iter().take(end).skip(start) {
            result.push(msg.clone());
        }
    }

    let removed_count = original_count - result.len();

    CompactionResult {
        messages: result,
        removed_count,
        original_tokens,
        summary,
    }
}

/// Generate a structured summary from evicted turn groups.
///
/// Extracts tool names, file paths, and result snippets to create a compact
/// summary message that preserves key context without full conversation history.
fn generate_summary_from_groups(messages: &[Value], groups: &[(usize, usize)]) -> String {
    let mut tool_calls: Vec<String> = Vec::new();
    let mut file_operations: Vec<String> = Vec::new();
    let mut errors: Vec<String> = Vec::new();

    for &(start, end) in groups {
        for msg in messages.iter().take(end).skip(start) {
            let role = msg.get("role").and_then(|r| r.as_str()).unwrap_or("");

            // Extract tool call names from assistant messages
            if role == "assistant" {
                // Anthropic format: content blocks with type "tool_use"
                if let Some(content) = msg.get("content").and_then(|c| c.as_array()) {
                    for block in content {
                        if block.get("type").and_then(|t| t.as_str()) == Some("tool_use") {
                            let name = block.get("name").and_then(|n| n.as_str()).unwrap_or("unknown");
                            tool_calls.push(name.to_string());

                            // Extract file paths from common tool arguments
                            if let Some(path) = block.get("input")
                                .and_then(|i| i.get("path"))
                                .and_then(|p| p.as_str())
                            {
                                file_operations.push(format!("{}({})", name, path));
                            }
                        }
                    }
                }
                // OpenAI format: tool_calls array
                if let Some(tool_calls_arr) = msg.get("tool_calls").and_then(|c| c.as_array()) {
                    for tc in tool_calls_arr {
                        let name = tc.get("function")
                            .and_then(|f| f.get("name"))
                            .and_then(|n| n.as_str())
                            .unwrap_or("unknown");
                        tool_calls.push(name.to_string());

                        let args_str = tc.get("function")
                            .and_then(|f| f.get("arguments"))
                            .and_then(|a| a.as_str())
                            .unwrap_or("{}");
                        if let Ok(args) = serde_json::from_str::<Value>(args_str) {
                            if let Some(path) = args.get("path").and_then(|p| p.as_str()) {
                                file_operations.push(format!("{}({})", name, path));
                            }
                        }
                    }
                }
            }

            // Extract errors from tool result messages
            if role == "tool" || role == "user" {
                let content = msg.get("content").and_then(|c| c.as_str()).unwrap_or("");
                if content.contains("error") || content.contains("Error") || content.contains("failed") {
                    let snippet = if content.len() > 200 {
                        format!("{}...", &content[..200])
                    } else {
                        content.to_string()
                    };
                    errors.push(snippet);
                }
            }
        }
    }

    let total_turns = groups.len();
    let mut parts = vec![format!("[Context Summary — {} turns compacted]", total_turns)];

    if !file_operations.is_empty() {
        let unique_ops: Vec<String> = {
            let mut seen = std::collections::HashSet::new();
            file_operations.iter()
                .filter(|op| seen.insert(op.clone()))
                .cloned()
                .collect()
        };
        parts.push(format!("Files: {}", unique_ops.join(", ")));
    }

    if !errors.is_empty() {
        // Keep up to 3 error snippets
        let error_snippets: Vec<&str> = errors.iter().take(3).map(|s| s.as_str()).collect();
        parts.push(format!("Errors encountered: {}", error_snippets.join("; ")));
    }

    parts.push(format!("Tools used: {} calls total", tool_calls.len()));

    parts.join("\n")
}

// ---------------------------------------------------------------------------
// RigRuntime
// ---------------------------------------------------------------------------

pub struct RigRuntime;

impl RigRuntime {
    pub fn new() -> Self {
        Self
    }

    /// Resolve provider config from settings.yaml with env var fallback.
    fn resolve_config(workspace: &str) -> Result<RigResolvedConfig, String> {
        let settings_path = PathBuf::from(workspace)
            .join(".neuro")
            .join("settings.yaml");

        if settings_path.exists() {
            let content = std::fs::read_to_string(&settings_path)
                .map_err(|e| format!("读取 settings.yaml 失败: {}", e))?;

            // Parse as generic Value first to check for `rig` key
            let doc: serde_json::Value = serde_yaml::from_str(&content)
                .map_err(|e| format!("解析 settings.yaml 失败: {}", e))?;

            // Try the new `rig` config block
            if let Some(rig_val) = doc.get("rig") {
                let rig_config: RigProviderConfig = serde_json::from_value(rig_val.clone())
                    .map_err(|e| format!("解析 rig 配置失败: {}", e))?;

                if !rig_config.provider.is_empty() {
                    let provider = RigProvider::from_str(&rig_config.provider)
                        .ok_or_else(|| format!("不支持的 Provider: {}", rig_config.provider))?;

                    // Resolve API key: settings > env var
                    let api_key = if rig_config.api_key.is_empty() {
                        if provider.requires_api_key() {
                            // Try env var fallback
                            std::env::var(provider.env_key())
                                .ok()
                                .filter(|k| !k.is_empty())
                                .ok_or_else(|| format!(
                                    "请先配置 {} API Key。可在 Settings 的 Rig 配置区设置，或设置环境变量 {}。",
                                    provider.label(),
                                    provider.env_key()
                                ))?
                        } else {
                            String::new() // Ollama doesn't need a key
                        }
                    } else {
                        rig_config.api_key.clone()
                    };

                    // Resolve base URL: settings > provider default
                    let api_base = if rig_config.base_url.is_empty() {
                        provider.default_base_url().to_string()
                    } else {
                        rig_config.base_url.trim_end_matches('/').to_string()
                    };

                    // Resolve model: settings > provider default
                    let model = if rig_config.model.is_empty() {
                        provider.default_model().to_string()
                    } else {
                        rig_config.model.clone()
                    };

                    eprintln!(
                        "[RigRuntime] Provider={}, model={}, base={}",
                        provider.as_str(),
                        model,
                        api_base
                    );

                    return Ok(RigResolvedConfig {
                        provider,
                        api_key,
                        api_base,
                        model,
                    });
                }
            }

            // Fallback: try legacy Anthropic provider from `providers` map
            let settings: crate::AppSettings = serde_yaml::from_str(&content)
                .map_err(|e| format!("解析 settings.yaml 失败: {}", e))?;

            for (name, config) in &settings.providers {
                if config.protocol == crate::ChatProtocol::Anthropic
                    && !config.api_key.is_empty()
                {
                    let api_base = if config.api_base.is_empty() {
                        "https://api.anthropic.com".to_string()
                    } else {
                        config.api_base.trim_end_matches('/').to_string()
                    };
                    let model = if !settings.llm.model.is_empty() {
                        settings.llm.model.clone()
                    } else {
                        "claude-sonnet-4-20250514".to_string()
                    };

                    eprintln!(
                        "[RigRuntime] Legacy fallback: Provider '{}' (anthropic protocol)",
                        name
                    );

                    return Ok(RigResolvedConfig {
                        provider: RigProvider::Anthropic,
                        api_key: config.api_key.clone(),
                        api_base,
                        model,
                    });
                }
            }
        }

        // Fallback: environment variable
        for (env_key, provider) in [
            ("ANTHROPIC_API_KEY", RigProvider::Anthropic),
            ("OPENAI_API_KEY", RigProvider::Openai),
            ("GOOGLE_API_KEY", RigProvider::Gemini),
            ("DEEPSEEK_API_KEY", RigProvider::Deepseek),
        ] {
            if let Ok(key) = std::env::var(env_key) {
                if !key.is_empty() {
                    return Ok(RigResolvedConfig {
                        provider,
                        api_key: key,
                        api_base: provider.default_base_url().to_string(),
                        model: provider.default_model().to_string(),
                    });
                }
            }
        }

        Err("未配置任何 LLM Provider。请在 Settings 中配置 Rig Provider，或设置相应的 API Key 环境变量。".to_string())
    }

    /// Test connection to the configured provider.
    pub fn test_connection(config: &RigProviderConfig) -> Result<Vec<String>, String> {
        let provider = RigProvider::from_str(&config.provider)
            .ok_or_else(|| format!("不支持的 Provider: {}", config.provider))?;

        // For Ollama, test connectivity to local server
        let api_key = if config.api_key.is_empty() {
            if provider.requires_api_key() {
                std::env::var(provider.env_key())
                    .ok()
                    .filter(|k| !k.is_empty())
                    .ok_or_else(|| format!("{} API Key 未配置", provider.label()))?
            } else {
                String::new()
            }
        } else {
            config.api_key.clone()
        };

        let base_url = if config.base_url.is_empty() {
            provider.default_base_url().to_string()
        } else {
            config.base_url.trim_end_matches('/').to_string()
        };

        // Use blocking reqwest for a synchronous test
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|e| format!("Runtime error: {}", e))?;

        rt.block_on(async {
            let client = reqwest::Client::new();

            match provider {
                RigProvider::Anthropic => {
                    let url = format!("{}/v1/models", base_url);
                    let resp = client
                        .get(&url)
                        .header("x-api-key", &api_key)
                        .header("anthropic-version", "2023-06-01")
                        .send()
                        .await
                        .map_err(|e| format!("连接失败: {}", e))?;

                    let status = resp.status();
                    if !status.is_success() {
                        let body = resp.text().await.unwrap_or_default();
                        return Err(format!("API 错误 ({}): {}", status, body));
                    }

                    let json: Value = resp.json().await.unwrap_or_default();
                    let models: Vec<String> = json.get("data")
                        .and_then(|d| d.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|m| m.get("id").and_then(|id| id.as_str()).map(String::from))
                                .collect()
                        })
                        .unwrap_or_default();

                    Ok(models)
                }
                RigProvider::Openai | RigProvider::Deepseek => {
                    let url = format!("{}/v1/models", base_url);
                    let resp = client
                        .get(&url)
                        .header("Authorization", format!("Bearer {}", api_key))
                        .send()
                        .await
                        .map_err(|e| format!("连接失败: {}", e))?;

                    let status = resp.status();
                    if !status.is_success() {
                        let body = resp.text().await.unwrap_or_default();
                        return Err(format!("API 错误 ({}): {}", status, body));
                    }

                    let json: Value = resp.json().await.unwrap_or_default();
                    let models: Vec<String> = json.get("data")
                        .and_then(|d| d.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|m| m.get("id").and_then(|id| id.as_str()).map(String::from))
                                .collect()
                        })
                        .unwrap_or_default();

                    Ok(models)
                }
                RigProvider::Gemini => {
                    let url = format!(
                        "{}/v1beta/models?key={}",
                        base_url, api_key
                    );
                    let resp = client
                        .get(&url)
                        .send()
                        .await
                        .map_err(|e| format!("连接失败: {}", e))?;

                    let status = resp.status();
                    if !status.is_success() {
                        let body = resp.text().await.unwrap_or_default();
                        return Err(format!("API 错误 ({}): {}", status, body));
                    }

                    let json: Value = resp.json().await.unwrap_or_default();
                    let models: Vec<String> = json.get("models")
                        .and_then(|d| d.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(String::from))
                                .collect()
                        })
                        .unwrap_or_default();

                    Ok(models)
                }
                RigProvider::Ollama => {
                    let url = format!("{}/api/tags", base_url);
                    let resp = client
                        .get(&url)
                        .send()
                        .await
                        .map_err(|e| format!("连接 Ollama 失败（请确认 Ollama 已启动）: {}", e))?;

                    let status = resp.status();
                    if !status.is_success() {
                        let body = resp.text().await.unwrap_or_default();
                        return Err(format!("Ollama 错误 ({}): {}", status, body));
                    }

                    let json: Value = resp.json().await.unwrap_or_default();
                    let models: Vec<String> = json.get("models")
                        .and_then(|d| d.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(String::from))
                                .collect()
                        })
                        .unwrap_or_default();

                    Ok(models)
                }
            }
        })
    }
}

// ---------------------------------------------------------------------------
// Provider-specific HTTP execution
// ---------------------------------------------------------------------------

/// Build and send a streaming request to Anthropic API.
fn execute_anthropic(
    client: &reqwest::Client,
    config: &RigResolvedConfig,
    messages: Vec<Value>,
    system_prompt: Option<&str>,
    tool_defs: Option<&Vec<ToolDefinition>>,
) -> Result<reqwest::Response, reqwest::Error> {
    let url = format!("{}/v1/messages", config.api_base);

    let mut body = serde_json::json!({
        "model": config.model,
        "messages": messages,
        "max_tokens": 8192,
        "stream": true
    });

    if let Some(sp) = system_prompt {
        if !sp.is_empty() {
            body["system"] = serde_json::json!(sp);
        }
    }

    // Add tool definitions if provided (Anthropic format)
    if let Some(tools) = tool_defs {
        if !tools.is_empty() {
            let anthropic_tools: Vec<Value> = tools
                .iter()
                .map(|t| {
                    serde_json::json!({
                        "name": t.name,
                        "description": t.description,
                        "input_schema": t.parameters,
                    })
                })
                .collect();
            body["tools"] = serde_json::json!(anthropic_tools);
        }
    }

    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    rt.block_on(async {
        client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("anthropic-version", "2023-06-01")
            .header("x-api-key", &config.api_key)
            .json(&body)
            .send()
            .await
    })
}

/// Build and send a streaming request to OpenAI-compatible API.
fn execute_openai_compatible(
    client: &reqwest::Client,
    config: &RigResolvedConfig,
    messages: Vec<Value>,
    system_prompt: Option<&str>,
    tool_defs: Option<&Vec<ToolDefinition>>,
) -> Result<reqwest::Response, reqwest::Error> {
    let url = format!("{}/v1/chat/completions", config.api_base);

    let mut all_messages: Vec<Value> = Vec::new();

    // Add system prompt as first message
    if let Some(sp) = system_prompt {
        if !sp.is_empty() {
            all_messages.push(serde_json::json!({
                "role": "system",
                "content": sp
            }));
        }
    }

    all_messages.extend(messages);

    let mut body = serde_json::json!({
        "model": config.model,
        "messages": all_messages,
        "max_tokens": 8192,
        "stream": true
    });

    // Add tool definitions if provided (OpenAI function calling format)
    if let Some(tools) = tool_defs {
        if !tools.is_empty() {
            let openai_tools: Vec<Value> = tools
                .iter()
                .map(|t| {
                    serde_json::json!({
                        "type": "function",
                        "function": {
                            "name": t.name,
                            "description": t.description,
                            "parameters": t.parameters,
                        }
                    })
                })
                .collect();
            body["tools"] = serde_json::json!(openai_tools);
        }
    }

    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    rt.block_on(async {
        let mut req = client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body);

        // Only add auth header if API key is provided (Ollama doesn't need one)
        if !config.api_key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", config.api_key));
        }

        req.send().await
    })
}

/// Build and send a streaming request to Gemini API.
fn execute_gemini(
    client: &reqwest::Client,
    config: &RigResolvedConfig,
    messages: Vec<Value>,
    system_prompt: Option<&str>,
    _tool_defs: Option<&Vec<ToolDefinition>>,
) -> Result<reqwest::Response, reqwest::Error> {
    // Gemini streaming endpoint
    let url = format!(
        "{}/v1beta/models/{}:streamGenerateContent?alt=sse&key={}",
        config.api_base, config.model, config.api_key
    );

    // Convert messages to Gemini format
    let mut contents: Vec<Value> = Vec::new();

    for msg in &messages {
        let role = msg.get("role").and_then(|r| r.as_str()).unwrap_or("user");
        let content = msg.get("content").and_then(|c| c.as_str()).unwrap_or("");

        let gemini_role = match role {
            "assistant" => "model",
            _ => "user",
        };

        contents.push(serde_json::json!({
            "role": gemini_role,
            "parts": [{ "text": content }]
        }));
    }

    let mut body = serde_json::json!({
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": 8192,
        }
    });

    if let Some(sp) = system_prompt {
        if !sp.is_empty() {
            body["systemInstruction"] = serde_json::json!({
                "parts": [{ "text": sp }]
            });
        }
    }

    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    rt.block_on(async {
        client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
    })
}

// ---------------------------------------------------------------------------
// SSE Stream Processors
// ---------------------------------------------------------------------------

/// Collected tool call from an Anthropic streaming response.
#[derive(Debug, Clone)]
struct AnthropicToolCall {
    id: String,
    name: String,
    input_json: String,
}

/// Token usage reported by the LLM API response.
#[derive(Debug, Clone, Default)]
struct StreamUsage {
    input_tokens: usize,
    output_tokens: usize,
}

/// Result of processing a full Anthropic stream response.
enum StreamOutcome {
    /// LLM produced text and finished normally.
    Done(Option<StreamUsage>),
    /// LLM requested tool calls (stop_reason = "tool_use").
    ToolCalls(Vec<AnthropicToolCall>, Option<StreamUsage>),
}

/// Process Anthropic SSE stream → StreamEvent, also collecting tool calls.
fn stream_anthropic_with_tools(
    response: reqwest::Response,
    tx: &std::sync::mpsc::Sender<StreamEvent>,
) -> StreamOutcome {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    rt.block_on(async {
        let mut stream = response.bytes_stream();
        let mut buffer = String::new();
        let mut _stop_reason: Option<String> = None;
        let mut tool_calls: Vec<AnthropicToolCall> = Vec::new();
        let mut current_tool_id: Option<String> = None;
        let mut current_tool_name: Option<String> = None;
        let mut current_tool_input: String = String::new();
        let mut usage: StreamUsage = StreamUsage::default();

        while let Some(chunk_result) = stream.next().await {
            match chunk_result {
                Ok(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    buffer.push_str(&text);

                    while let Some(pos) = buffer.find('\n') {
                        let line = buffer[..pos].trim().to_string();
                        buffer = buffer[pos + 1..].to_string();

                        if line.is_empty() {
                            continue;
                        }

                        if let Some(data) = line.strip_prefix("data: ") {
                            if data == "[DONE]" {
                                // Flush any pending tool call
                                if let (Some(id), Some(name)) = (current_tool_id.take(), current_tool_name.take()) {
                                    tool_calls.push(AnthropicToolCall {
                                        id,
                                        name,
                                        input_json: std::mem::take(&mut current_tool_input),
                                    });
                                }
                                if !tool_calls.is_empty() {
                                    return StreamOutcome::ToolCalls(tool_calls, Some(usage));
                                }
                                let _ = tx.send(StreamEvent {
                                    text: String::new(),
                                    is_done: true,
                                    error: None,
                                    msg_type: Some("result".to_string()),
                                    session_id: None,
                                    idle_seconds: None,
                                });
                                return StreamOutcome::Done(Some(usage));
                            }

                            let parsed: Value = match serde_json::from_str(data) {
                                Ok(v) => v,
                                Err(_) => continue,
                            };

                            let event_type = parsed.get("type")
                                .and_then(|t| t.as_str())
                                .unwrap_or("");

                            match event_type {
                                "message_start" => {
                                    // Extract usage (input_tokens) from message_start event
                                    if let Some(msg_usage) = parsed.get("message")
                                        .and_then(|m| m.get("usage"))
                                    {
                                        usage.input_tokens = msg_usage.get("input_tokens")
                                            .and_then(|t| t.as_u64())
                                            .unwrap_or(0) as usize;
                                        usage.output_tokens = msg_usage.get("output_tokens")
                                            .and_then(|t| t.as_u64())
                                            .unwrap_or(0) as usize;
                                    }
                                }
                                "content_block_start" => {
                                    if let Some(cb) = parsed.get("content_block") {
                                        let cb_type = cb.get("type").and_then(|t| t.as_str()).unwrap_or("");
                                        if cb_type == "tool_use" {
                                            let id = parsed.get("index")
                                                .and_then(|i| i.as_u64())
                                                .map(|i| format!("toolu_{}", i))
                                                .unwrap_or_default();
                                            let tool_id = cb.get("id")
                                                .and_then(|i| i.as_str())
                                                .unwrap_or(&id)
                                                .to_string();
                                            let tool_name = cb.get("name")
                                                .and_then(|n| n.as_str())
                                                .unwrap_or("")
                                                .to_string();
                                            current_tool_id = Some(tool_id);
                                            current_tool_name = Some(tool_name.clone());
                                            current_tool_input = String::new();
                                        }
                                    }
                                }
                                "content_block_delta" => {
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
                                                let partial = delta.get("partial_json")
                                                    .and_then(|t| t.as_str())
                                                    .unwrap_or("");
                                                if !partial.is_empty() {
                                                    current_tool_input.push_str(partial);
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
                                "content_block_stop" => {
                                    // Flush completed tool call
                                    if current_tool_id.is_some() && current_tool_name.is_some() {
                                        tool_calls.push(AnthropicToolCall {
                                            id: current_tool_id.take().unwrap(),
                                            name: current_tool_name.take().unwrap(),
                                            input_json: std::mem::take(&mut current_tool_input),
                                        });
                                    }
                                }
                                "message_delta" => {
                                    if let Some(delta) = parsed.get("delta") {
                                        if let Some(reason) = delta.get("stop_reason").and_then(|r| r.as_str()) {
                                            _stop_reason = Some(reason.to_string());
                                        }
                                    }
                                    // Also check for usage in message_delta (output_tokens update)
                                    if let Some(delta_usage) = parsed.get("usage") {
                                        if let Some(out) = delta_usage.get("output_tokens").and_then(|t| t.as_u64()) {
                                            usage.output_tokens = out as usize;
                                        }
                                    }
                                }
                                "message_stop" => {
                                    // If we have tool calls and stop_reason is tool_use, return them
                                    if !tool_calls.is_empty() {
                                        return StreamOutcome::ToolCalls(tool_calls, Some(usage));
                                    }
                                    let _ = tx.send(StreamEvent {
                                        text: String::new(),
                                        is_done: true,
                                        error: None,
                                        msg_type: Some("result".to_string()),
                                        session_id: None,
                                        idle_seconds: None,
                                    });
                                    return StreamOutcome::Done(Some(usage));
                                }
                                "error" => {
                                    let error_msg = parsed.get("error")
                                        .and_then(|e| e.get("message"))
                                        .and_then(|m| m.as_str())
                                        .unwrap_or("Unknown API error");
                                    let _ = tx.send(StreamEvent {
                                        text: String::new(),
                                        is_done: true,
                                        error: Some(error_msg.to_string()),
                                        msg_type: Some("error".to_string()),
                                        session_id: None,
                                        idle_seconds: None,
                                    });
                                    return StreamOutcome::Done(None);
                                }
                                _ => {}
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
                    return StreamOutcome::Done(None);
                }
            }
        }

        // If we ended with tool calls, return them
        if !tool_calls.is_empty() {
            return StreamOutcome::ToolCalls(tool_calls, Some(usage));
        }
        let _ = tx.send(StreamEvent {
            text: String::new(),
            is_done: true,
            error: None,
            msg_type: Some("result".to_string()),
            session_id: None,
            idle_seconds: None,
        });
        StreamOutcome::Done(Some(usage))
    })
}

/// Process OpenAI SSE stream → StreamEvent, also collecting tool calls.
fn stream_openai_with_tools(
    response: reqwest::Response,
    tx: &std::sync::mpsc::Sender<StreamEvent>,
) -> StreamOutcome {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    rt.block_on(async {
        let mut stream = response.bytes_stream();
        let mut buffer = String::new();
        let mut tool_calls: Vec<(String, String, String)> = Vec::new(); // (id, name, arguments)
        let mut _finish_reason: Option<String> = None;
        let mut usage: StreamUsage = StreamUsage::default();

        while let Some(chunk_result) = stream.next().await {
            match chunk_result {
                Ok(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    buffer.push_str(&text);

                    while let Some(pos) = buffer.find('\n') {
                        let line = buffer[..pos].trim().to_string();
                        buffer = buffer[pos + 1..].to_string();

                        if line.is_empty() {
                            continue;
                        }

                        if let Some(data) = line.strip_prefix("data: ") {
                            if data == "[DONE]" {
                                if !tool_calls.is_empty() {
                                    let calls: Vec<AnthropicToolCall> = tool_calls
                                        .into_iter()
                                        .enumerate()
                                        .map(|(_i, (id, name, args))| AnthropicToolCall {
                                            id: id.clone(),
                                            name,
                                            input_json: args,
                                        })
                                        .collect();
                                    return StreamOutcome::ToolCalls(calls, Some(usage));
                                }
                                let _ = tx.send(StreamEvent {
                                    text: String::new(),
                                    is_done: true,
                                    error: None,
                                    msg_type: Some("result".to_string()),
                                    session_id: None,
                                    idle_seconds: None,
                                });
                                return StreamOutcome::Done(Some(usage));
                            }

                            let parsed: Value = match serde_json::from_str(data) {
                                Ok(v) => v,
                                Err(_) => continue,
                            };

                            // OpenAI format: { choices: [{ delta: { content: "..." } }] }
                            if let Some(choices) = parsed.get("choices").and_then(|c| c.as_array()) {
                                for choice in choices {
                                    if let Some(delta) = choice.get("delta") {
                                        // Text content
                                        if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                                            if !content.is_empty() {
                                                let _ = tx.send(StreamEvent {
                                                    text: content.to_string(),
                                                    is_done: false,
                                                    error: None,
                                                    msg_type: Some("assistant".to_string()),
                                                    session_id: None,
                                                    idle_seconds: None,
                                                });
                                            }
                                        }
                                        // Tool call (function call)
                                        if let Some(tool_calls_delta) = delta.get("tool_calls").and_then(|t| t.as_array()) {
                                            for tc in tool_calls_delta {
                                                let tc_id = tc.get("id")
                                                    .and_then(|i| i.as_str())
                                                    .unwrap_or("")
                                                    .to_string();
                                                let tc_index = tc.get("index")
                                                    .and_then(|i| i.as_u64())
                                                    .unwrap_or(0) as usize;

                                                if let Some(func) = tc.get("function") {
                                                    let name = func.get("name")
                                                        .and_then(|n| n.as_str())
                                                        .unwrap_or("")
                                                        .to_string();
                                                    let args = func.get("arguments")
                                                        .and_then(|a| a.as_str())
                                                        .unwrap_or("")
                                                        .to_string();

                                                    // Ensure we have a slot for this tool call
                                                    if tc_index >= tool_calls.len() {
                                                        tool_calls.resize(tc_index + 1, (String::new(), String::new(), String::new()));
                                                    }

                                                    if !tc_id.is_empty() {
                                                        tool_calls[tc_index].0 = tc_id;
                                                    }
                                                    if !name.is_empty() {
                                                        tool_calls[tc_index].1 = name;
                                                    }
                                                    if !args.is_empty() {
                                                        tool_calls[tc_index].2.push_str(&args);
                                                        let _ = tx.send(StreamEvent {
                                                            text: args.to_string(),
                                                            is_done: false,
                                                            error: None,
                                                            msg_type: Some("tool_use".to_string()),
                                                            session_id: None,
                                                            idle_seconds: None,
                                                        });
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    // Check for finish_reason
                                    if let Some(reason) = choice.get("finish_reason").and_then(|r| r.as_str()) {
                                        _finish_reason = Some(reason.to_string());
                                    }
                                }
                            }

                            // Extract usage from OpenAI response (may appear in any chunk)
                            if let Some(u) = parsed.get("usage") {
                                if let Some(prompt) = u.get("prompt_tokens").and_then(|t| t.as_u64()) {
                                    usage.input_tokens = prompt as usize;
                                }
                                if let Some(compl) = u.get("completion_tokens").and_then(|t| t.as_u64()) {
                                    usage.output_tokens = compl as usize;
                                }
                            }

                            // DeepSeek may include reasoning_content
                            if let Some(choices) = parsed.get("choices").and_then(|c| c.as_array()) {
                                for choice in choices {
                                    if let Some(delta) = choice.get("delta") {
                                        if let Some(reasoning) = delta.get("reasoning_content").and_then(|r| r.as_str()) {
                                            if !reasoning.is_empty() {
                                                let _ = tx.send(StreamEvent {
                                                    text: reasoning.to_string(),
                                                    is_done: false,
                                                    error: None,
                                                    msg_type: Some("reasoning".to_string()),
                                                    session_id: None,
                                                    idle_seconds: None,
                                                });
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
                        error: Some(format!("流式读取错误: {}", e)),
                        msg_type: Some("error".to_string()),
                        session_id: None,
                        idle_seconds: None,
                    });
                    return StreamOutcome::Done(None);
                }
            }
        }

        // If we ended with tool calls, return them
        let non_empty_calls: Vec<AnthropicToolCall> = tool_calls
            .into_iter()
            .filter(|(_, name, _)| !name.is_empty())
            .map(|(id, name, args)| AnthropicToolCall {
                id,
                name,
                input_json: args,
            })
            .collect();

        if !non_empty_calls.is_empty() {
            return StreamOutcome::ToolCalls(non_empty_calls, Some(usage));
        }

        let _ = tx.send(StreamEvent {
            text: String::new(),
            is_done: true,
            error: None,
            msg_type: Some("result".to_string()),
            session_id: None,
            idle_seconds: None,
        });
        StreamOutcome::Done(Some(usage))
    })
}

/// Process Anthropic SSE stream → StreamEvent (backward-compatible wrapper, no tool collection)
#[allow(dead_code)]
fn stream_anthropic(
    response: reqwest::Response,
    tx: std::sync::mpsc::Sender<StreamEvent>,
) {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    rt.block_on(async {
        let mut stream = response.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk_result) = stream.next().await {
            match chunk_result {
                Ok(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    buffer.push_str(&text);

                    while let Some(pos) = buffer.find('\n') {
                        let line = buffer[..pos].trim().to_string();
                        buffer = buffer[pos + 1..].to_string();

                        if line.is_empty() {
                            continue;
                        }

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

                            let parsed: Value = match serde_json::from_str(data) {
                                Ok(v) => v,
                                Err(_) => continue,
                            };

                            let event_type = parsed.get("type")
                                .and_then(|t| t.as_str())
                                .unwrap_or("");

                            match event_type {
                                "content_block_delta" => {
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
                                "message_stop" => {
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
                                "error" => {
                                    let error_msg = parsed.get("error")
                                        .and_then(|e| e.get("message"))
                                        .and_then(|m| m.as_str())
                                        .unwrap_or("Unknown API error");
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
                                _ => {}
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

        let _ = tx.send(StreamEvent {
            text: String::new(),
            is_done: true,
            error: None,
            msg_type: Some("result".to_string()),
            session_id: None,
            idle_seconds: None,
        });
    });
}

/// Process OpenAI-compatible SSE stream → StreamEvent
#[allow(dead_code)]
fn stream_openai(
    response: reqwest::Response,
    tx: std::sync::mpsc::Sender<StreamEvent>,
) {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    rt.block_on(async {
        let mut stream = response.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk_result) = stream.next().await {
            match chunk_result {
                Ok(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    buffer.push_str(&text);

                    while let Some(pos) = buffer.find('\n') {
                        let line = buffer[..pos].trim().to_string();
                        buffer = buffer[pos + 1..].to_string();

                        if line.is_empty() {
                            continue;
                        }

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

                            let parsed: Value = match serde_json::from_str(data) {
                                Ok(v) => v,
                                Err(_) => continue,
                            };

                            // OpenAI format: { choices: [{ delta: { content: "..." } }] }
                            if let Some(choices) = parsed.get("choices").and_then(|c| c.as_array()) {
                                for choice in choices {
                                    if let Some(delta) = choice.get("delta") {
                                        // Text content
                                        if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                                            if !content.is_empty() {
                                                let _ = tx.send(StreamEvent {
                                                    text: content.to_string(),
                                                    is_done: false,
                                                    error: None,
                                                    msg_type: Some("assistant".to_string()),
                                                    session_id: None,
                                                    idle_seconds: None,
                                                });
                                            }
                                        }
                                        // Tool call (function call)
                                        if let Some(tool_calls) = delta.get("tool_calls").and_then(|t| t.as_array()) {
                                            for tc in tool_calls {
                                                if let Some(func) = tc.get("function") {
                                                    if let Some(args) = func.get("arguments").and_then(|a| a.as_str()) {
                                                        if !args.is_empty() {
                                                            let _ = tx.send(StreamEvent {
                                                                text: args.to_string(),
                                                                is_done: false,
                                                                error: None,
                                                                msg_type: Some("tool_use".to_string()),
                                                                session_id: None,
                                                                idle_seconds: None,
                                                            });
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    // Check for finish_reason
                                    if let Some(reason) = choice.get("finish_reason").and_then(|r| r.as_str()) {
                                        if reason == "stop" || reason == "end_turn" {
                                            // Don't send done yet — wait for [DONE] marker
                                        }
                                    }
                                }
                            }

                            // DeepSeek may include reasoning_content
                            if let Some(choices) = parsed.get("choices").and_then(|c| c.as_array()) {
                                for choice in choices {
                                    if let Some(delta) = choice.get("delta") {
                                        if let Some(reasoning) = delta.get("reasoning_content").and_then(|r| r.as_str()) {
                                            if !reasoning.is_empty() {
                                                let _ = tx.send(StreamEvent {
                                                    text: reasoning.to_string(),
                                                    is_done: false,
                                                    error: None,
                                                    msg_type: Some("reasoning".to_string()),
                                                    session_id: None,
                                                    idle_seconds: None,
                                                });
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
                        error: Some(format!("流式读取错误: {}", e)),
                        msg_type: Some("error".to_string()),
                        session_id: None,
                        idle_seconds: None,
                    });
                    return;
                }
            }
        }

        let _ = tx.send(StreamEvent {
            text: String::new(),
            is_done: true,
            error: None,
            msg_type: Some("result".to_string()),
            session_id: None,
            idle_seconds: None,
        });
    });
}

/// Process Gemini SSE stream → StreamEvent
fn stream_gemini(
    response: reqwest::Response,
    tx: std::sync::mpsc::Sender<StreamEvent>,
) {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    rt.block_on(async {
        let mut stream = response.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk_result) = stream.next().await {
            match chunk_result {
                Ok(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    buffer.push_str(&text);

                    while let Some(pos) = buffer.find('\n') {
                        let line = buffer[..pos].trim().to_string();
                        buffer = buffer[pos + 1..].to_string();

                        if line.is_empty() {
                            continue;
                        }

                        if let Some(data) = line.strip_prefix("data: ") {
                            let parsed: Value = match serde_json::from_str(data) {
                                Ok(v) => v,
                                Err(_) => continue,
                            };

                            // Gemini format: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
                            if let Some(candidates) = parsed.get("candidates").and_then(|c| c.as_array()) {
                                for candidate in candidates {
                                    if let Some(parts) = candidate.get("content")
                                        .and_then(|c| c.get("parts"))
                                        .and_then(|p| p.as_array())
                                    {
                                        for part in parts {
                                            if let Some(text) = part.get("text").and_then(|t| t.as_str()) {
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
                                        }
                                    }

                                    // Check finish reason
                                    if let Some(reason) = candidate.get("finishReason").and_then(|r| r.as_str()) {
                                        if reason == "STOP" {
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
                                    }
                                }
                            }

                            // Check for error
                            if let Some(error) = parsed.get("error") {
                                let msg = error.get("message")
                                    .and_then(|m| m.as_str())
                                    .unwrap_or("Unknown Gemini error");
                                let _ = tx.send(StreamEvent {
                                    text: String::new(),
                                    is_done: true,
                                    error: Some(msg.to_string()),
                                    msg_type: Some("error".to_string()),
                                    session_id: None,
                                    idle_seconds: None,
                                });
                                return;
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

        let _ = tx.send(StreamEvent {
            text: String::new(),
            is_done: true,
            error: None,
            msg_type: Some("result".to_string()),
            session_id: None,
            idle_seconds: None,
        });
    });
}

// ---------------------------------------------------------------------------
// AgentRuntime impl
// ---------------------------------------------------------------------------

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
        "Configure a Rig Provider in Settings or set API Key environment variable".to_string()
    }

    fn detect(&self) -> Result<Option<(String, String)>, String> {
        // Check for any supported provider env var
        for (env_key, provider) in [
            ("ANTHROPIC_API_KEY", "anthropic"),
            ("OPENAI_API_KEY", "openai"),
            ("GOOGLE_API_KEY", "gemini"),
            ("DEEPSEEK_API_KEY", "deepseek"),
        ] {
            if let Ok(key) = std::env::var(env_key) {
                if !key.is_empty() {
                    return Ok(Some(("builtin".to_string(), format!("0.2.0-{}", provider))));
                }
            }
        }
        Ok(None)
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
        let workspace = params.workspace.clone().unwrap_or_default();
        let config = Self::resolve_config(&workspace)?;
        let compaction_cfg = read_compaction_config(&workspace);

        eprintln!(
            "[RigRuntime] Executing: provider={}, model={}, base={}, context_window={}",
            config.provider.as_str(),
            config.model,
            config.api_base,
            compaction_cfg.context_window_tokens
        );

        let (tx, rx) = std::sync::mpsc::channel();

        let api_key = config.api_key.clone();
        let api_base = config.api_base.clone();
        let model = config.model.clone();
        let provider = config.provider.clone();
        let system_prompt = params.system_prompt.clone();
        let user_message = params.message.clone();
        let workspace_path = PathBuf::from(&workspace);

        std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();

            let client = rt.block_on(async { reqwest::Client::new() });

            // Create tool registry for workspace
            let tool_registry = ToolRegistry::new(workspace_path.clone());
            let tool_defs = tool_registry.definitions();

            // Parse user message — JSON-encoded messages array or plain string
            let mut messages: Vec<Value> = Vec::new();
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

            let resolved = RigResolvedConfig {
                provider: provider.clone(),
                api_key: api_key.clone(),
                api_base: api_base.clone(),
                model: model.clone(),
            };

            // Tool-use loop: max 10 iterations to prevent infinite loops
            let max_iterations = 10;
            let mut total_input_tokens: usize = 0;
            for iteration in 0..max_iterations {
                // Context budget check: if tokens exceed context window, stop
                if total_input_tokens > 0 && total_input_tokens >= compaction_cfg.context_window_tokens {
                    eprintln!("[RigRuntime] Context budget exceeded: {} >= {}, stopping tool loop",
                        total_input_tokens, compaction_cfg.context_window_tokens);
                    let _ = tx.send(StreamEvent {
                        text: String::new(),
                        is_done: true,
                        error: Some(format!("上下文预算已达上限 ({} tokens)，已停止工具调用循环", total_input_tokens)),
                        msg_type: Some("error".to_string()),
                        session_id: None,
                        idle_seconds: None,
                    });
                    return;
                }

                eprintln!("[RigRuntime] Tool-use loop iteration {}/{}, tokens={}/{}",
                    iteration + 1, max_iterations, total_input_tokens, compaction_cfg.context_window_tokens);
                // Send request based on provider type
                let response_result = match provider {
                    RigProvider::Anthropic => execute_anthropic(
                        &client, &resolved, messages.clone(),
                        system_prompt.as_deref(),
                        Some(&tool_defs),
                    ),
                    RigProvider::Openai | RigProvider::Deepseek => {
                        execute_openai_compatible(
                            &client, &resolved, messages.clone(),
                            system_prompt.as_deref(),
                            Some(&tool_defs),
                        )
                    }
                    RigProvider::Gemini => execute_gemini(
                        &client, &resolved, messages.clone(),
                        system_prompt.as_deref(),
                        None, // Gemini tools not yet supported
                    ),
                    RigProvider::Ollama => execute_openai_compatible(
                        &client, &resolved, messages.clone(),
                        system_prompt.as_deref(),
                        Some(&tool_defs),
                    ),
                };

                match response_result {
                    Ok(resp) => {
                        let status = resp.status();
                        if !status.is_success() {
                            let error_body: String = rt.block_on(async {
                                resp.text().await.unwrap_or_else(|_| "Unknown error".into())
                            });
                            let _ = tx.send(StreamEvent {
                                text: String::new(),
                                is_done: true,
                                error: Some(format!("{} API 错误 ({}): {}", provider.label(), status, error_body)),
                                msg_type: Some("error".to_string()),
                                session_id: None,
                                idle_seconds: None,
                            });
                            return;
                        }

                        eprintln!("[RigRuntime] response status={}", status);

                        // Route to provider-specific stream processor with tool collection
                        let outcome = match provider {
                            RigProvider::Anthropic => stream_anthropic_with_tools(resp, &tx),
                            RigProvider::Openai | RigProvider::Deepseek => stream_openai_with_tools(resp, &tx),
                            RigProvider::Gemini => {
                                stream_gemini(resp, tx.clone());
                                StreamOutcome::Done(None)
                            }
                            RigProvider::Ollama => stream_openai_with_tools(resp, &tx),
                        };

                        match outcome {
                            StreamOutcome::Done(_usage) => {
                                // LLM finished without requesting tools
                                return;
                            }
                            StreamOutcome::ToolCalls(calls, usage) => {
                                // Track token usage for context budget
                                if let Some(u) = &usage {
                                    total_input_tokens = u.input_tokens;
                                    eprintln!("[RigRuntime] Tool calls: {}, tokens: input={}, output={}",
                                        calls.len(), u.input_tokens, u.output_tokens);
                                }
                                // Execute each tool call and send results
                                let mut tool_results: Vec<(String, String, Value)> = Vec::new(); // (tool_call_id, tool_name, result)

                                for tc in &calls {
                                    eprintln!(
                                        "[RigRuntime] Tool call: {} ({})",
                                        tc.name, tc.id
                                    );

                                    // Parse tool arguments
                                    let args: Value = serde_json::from_str(&tc.input_json)
                                        .unwrap_or_else(|_| serde_json::json!({}));

                                    // Send tool_use event to frontend
                                    let _ = tx.send(StreamEvent {
                                        text: serde_json::json!({
                                            "name": tc.name,
                                            "args": args,
                                            "id": tc.id,
                                        }).to_string(),
                                        is_done: false,
                                        error: None,
                                        msg_type: Some("tool_use".to_string()),
                                        session_id: None,
                                        idle_seconds: None,
                                    });

                                    // Execute the tool
                                    let result = tool_registry.execute(&tc.name, &args);

                                    // Send tool_result event to frontend
                                    let _ = tx.send(StreamEvent {
                                        text: serde_json::json!({
                                            "name": tc.name,
                                            "success": result.success,
                                            "output": if result.output.len() > 5000 {
                                                format!("{}...\n(truncated, {} chars total)", &result.output[..5000], result.output.len())
                                            } else {
                                                result.output.clone()
                                            },
                                        }).to_string(),
                                        is_done: false,
                                        error: None,
                                        msg_type: Some("tool_result".to_string()),
                                        session_id: None,
                                        idle_seconds: None,
                                    });

                                    tool_results.push((tc.id.clone(), tc.name.clone(), args));
                                }

                                // Add tool calls and results to messages for next iteration
                                match provider {
                                    RigProvider::Anthropic => {
                                        // Anthropic format: assistant message with tool_use content blocks,
                                        // then user message with tool_result content blocks
                                        let mut assistant_content: Vec<Value> = Vec::new();
                                        for tc in &calls {
                                            assistant_content.push(serde_json::json!({
                                                "type": "tool_use",
                                                "id": tc.id,
                                                "name": tc.name,
                                                "input": serde_json::from_str::<Value>(&tc.input_json)
                                                    .unwrap_or_else(|_| serde_json::json!({}))
                                            }));
                                        }
                                        messages.push(serde_json::json!({
                                            "role": "assistant",
                                            "content": assistant_content,
                                        }));

                                        let mut user_content: Vec<Value> = Vec::new();
                                        for (idx, _tc) in calls.iter().enumerate() {
                                            let result = tool_registry.execute(
                                                &tool_results[idx].1,
                                                &tool_results[idx].2,
                                            );
                                            user_content.push(serde_json::json!({
                                                "type": "tool_result",
                                                "tool_use_id": tool_results[idx].0,
                                                "content": result.output,
                                            }));
                                        }
                                        messages.push(serde_json::json!({
                                            "role": "user",
                                            "content": user_content,
                                        }));
                                    }
                                    _ => {
                                        // OpenAI format: assistant message with tool_calls,
                                        // then tool messages for each result
                                        let mut tool_calls_msg: Vec<Value> = Vec::new();
                                        for (_i, tc) in calls.iter().enumerate() {
                                            tool_calls_msg.push(serde_json::json!({
                                                "id": tc.id,
                                                "type": "function",
                                                "function": {
                                                    "name": tc.name,
                                                    "arguments": tc.input_json,
                                                }
                                            }));
                                        }
                                        messages.push(serde_json::json!({
                                            "role": "assistant",
                                            "tool_calls": tool_calls_msg,
                                        }));

                                        for (idx, _tc) in calls.iter().enumerate() {
                                            let result = tool_registry.execute(
                                                &tool_results[idx].1,
                                                &tool_results[idx].2,
                                            );
                                            messages.push(serde_json::json!({
                                                "role": "tool",
                                                "tool_call_id": tool_results[idx].0,
                                                "content": result.output,
                                            }));
                                        }
                                    }
                                }

                                // Context compaction check: trigger if tokens exceed threshold
                                let threshold = (compaction_cfg.context_window_tokens as f64
                                    * compaction_cfg.trigger_ratio) as usize;
                                if total_input_tokens >= threshold {
                                    eprintln!(
                                        "[RigRuntime] Context compaction triggered: tokens={} >= threshold={}, strategy={:?}, keep_recent={}",
                                        total_input_tokens, threshold, compaction_cfg.strategy, compaction_cfg.keep_recent
                                    );
                                    let before_count = messages.len();
                                    let compaction_result = compact_messages(
                                        &messages,
                                        compaction_cfg.context_window_tokens,
                                        compaction_cfg.keep_recent,
                                        compaction_cfg.strategy,
                                    );
                                    let after_count = compaction_result.messages.len();
                                    eprintln!(
                                        "[RigRuntime] Context compaction complete: removed {} messages ({} -> {}){}",
                                        compaction_result.removed_count,
                                        before_count,
                                        after_count,
                                        compaction_result.summary.as_ref()
                                            .map(|s| format!(", summary generated ({} chars)", s.len()))
                                            .unwrap_or_default()
                                    );
                                    // Send compaction event to frontend log
                                    let _ = tx.send(StreamEvent {
                                        text: format!(
                                            "[RigRuntime] Context compaction: removed {} messages ({} -> {}){}",
                                            compaction_result.removed_count,
                                            before_count,
                                            after_count,
                                            compaction_result.summary.as_ref()
                                                .map(|_| ", summary generated")
                                                .unwrap_or_default()
                                        ),
                                        is_done: false,
                                        error: None,
                                        msg_type: Some("compaction".to_string()),
                                        session_id: None,
                                        idle_seconds: None,
                                    });
                                    messages = compaction_result.messages;
                                }

                                // Continue loop — next iteration sends messages+results back to LLM
                                continue;
                            }
                        }
                    }
                    Err(e) => {
                        let _ = tx.send(StreamEvent {
                            text: String::new(),
                            is_done: true,
                            error: Some(format!("连接 {} API 失败: {}", provider.label(), e)),
                            msg_type: Some("error".to_string()),
                            session_id: None,
                            idle_seconds: None,
                        });
                        return;
                    }
                }
            }

            // If we exited the loop due to max iterations
            let _ = tx.send(StreamEvent {
                text: String::new(),
                is_done: true,
                error: Some("Max tool-use iterations reached (10)".to_string()),
                msg_type: Some("error".to_string()),
                session_id: None,
                idle_seconds: None,
            });
        });

        Ok(rx)
    }
}
