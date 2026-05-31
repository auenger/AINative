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

/// Result of processing a full Anthropic stream response.
enum StreamOutcome {
    /// LLM produced text and finished normally.
    Done,
    /// LLM requested tool calls (stop_reason = "tool_use").
    ToolCalls(Vec<AnthropicToolCall>),
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
        let mut stop_reason: Option<String> = None;
        let mut tool_calls: Vec<AnthropicToolCall> = Vec::new();
        let mut current_tool_id: Option<String> = None;
        let mut current_tool_name: Option<String> = None;
        let mut current_tool_input: String = String::new();

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
                                    return StreamOutcome::ToolCalls(tool_calls);
                                }
                                let _ = tx.send(StreamEvent {
                                    text: String::new(),
                                    is_done: true,
                                    error: None,
                                    msg_type: Some("result".to_string()),
                                    session_id: None,
                                    idle_seconds: None,
                                });
                                return StreamOutcome::Done;
                            }

                            let parsed: Value = match serde_json::from_str(data) {
                                Ok(v) => v,
                                Err(_) => continue,
                            };

                            let event_type = parsed.get("type")
                                .and_then(|t| t.as_str())
                                .unwrap_or("");

                            match event_type {
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
                                    if let Some(usage) = parsed.get("delta") {
                                        if let Some(reason) = usage.get("stop_reason").and_then(|r| r.as_str()) {
                                            stop_reason = Some(reason.to_string());
                                        }
                                    }
                                }
                                "message_stop" => {
                                    // If we have tool calls and stop_reason is tool_use, return them
                                    if !tool_calls.is_empty() {
                                        return StreamOutcome::ToolCalls(tool_calls);
                                    }
                                    let _ = tx.send(StreamEvent {
                                        text: String::new(),
                                        is_done: true,
                                        error: None,
                                        msg_type: Some("result".to_string()),
                                        session_id: None,
                                        idle_seconds: None,
                                    });
                                    return StreamOutcome::Done;
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
                                    return StreamOutcome::Done;
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
                    return StreamOutcome::Done;
                }
            }
        }

        // If we ended with tool calls, return them
        if !tool_calls.is_empty() {
            return StreamOutcome::ToolCalls(tool_calls);
        }
        let _ = tx.send(StreamEvent {
            text: String::new(),
            is_done: true,
            error: None,
            msg_type: Some("result".to_string()),
            session_id: None,
            idle_seconds: None,
        });
        StreamOutcome::Done
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
        let mut finish_reason: Option<String> = None;

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
                                        .map(|(i, (id, name, args))| AnthropicToolCall {
                                            id: id.clone(),
                                            name,
                                            input_json: args,
                                        })
                                        .collect();
                                    return StreamOutcome::ToolCalls(calls);
                                }
                                let _ = tx.send(StreamEvent {
                                    text: String::new(),
                                    is_done: true,
                                    error: None,
                                    msg_type: Some("result".to_string()),
                                    session_id: None,
                                    idle_seconds: None,
                                });
                                return StreamOutcome::Done;
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
                                        finish_reason = Some(reason.to_string());
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
                    return StreamOutcome::Done;
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
            return StreamOutcome::ToolCalls(non_empty_calls);
        }

        let _ = tx.send(StreamEvent {
            text: String::new(),
            is_done: true,
            error: None,
            msg_type: Some("result".to_string()),
            session_id: None,
            idle_seconds: None,
        });
        StreamOutcome::Done
    })
}

/// Process Anthropic SSE stream → StreamEvent (backward-compatible wrapper, no tool collection)
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

        eprintln!(
            "[RigRuntime] Executing: provider={}, model={}, base={}",
            config.provider.as_str(),
            config.model,
            config.api_base
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
            for _iteration in 0..max_iterations {
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
                                StreamOutcome::Done
                            }
                            RigProvider::Ollama => stream_openai_with_tools(resp, &tx),
                        };

                        match outcome {
                            StreamOutcome::Done => {
                                // LLM finished without requesting tools
                                return;
                            }
                            StreamOutcome::ToolCalls(calls) => {
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
                                        for (i, _tc) in calls.iter().enumerate() {
                                            let result = tool_registry.execute(
                                                &tool_results[i].1,
                                                &tool_results[i].2,
                                            );
                                            user_content.push(serde_json::json!({
                                                "type": "tool_result",
                                                "tool_use_id": tool_results[i].0,
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
                                        for (i, tc) in calls.iter().enumerate() {
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

                                        for (i, _tc) in calls.iter().enumerate() {
                                            let result = tool_registry.execute(
                                                &tool_results[i].1,
                                                &tool_results[i].2,
                                            );
                                            messages.push(serde_json::json!({
                                                "role": "tool",
                                                "tool_call_id": tool_results[i].0,
                                                "content": result.output,
                                            }));
                                        }
                                    }
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
