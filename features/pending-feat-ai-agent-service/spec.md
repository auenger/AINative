# Feature: feat-ai-agent-service AI Agent 服务化接口

## Basic Information
- **ID**: feat-ai-agent-service
- **Name**: AI Agent 服务化接口
- **Priority**: 30
- **Size**: L
- **Dependencies**: feat-fs-database-engine
- **Parent**: epic-neuro-syntax-ide-roadmap
- **Created**: 2026-04-01

## Description

将 AI Agent 能力封装为统一的服务接口。Rust 后端通过 `reqwest` 与 LLM API 建立 SSE 流式通信，前端 ProjectView 的 PM Agent 对话接真实后端。Agent 可通过结构化输出自动创建 Feature 目录和文档，直接驱动看板变更。

## User Value Points

### VP1: 真实 AI 对话
在 PM Agent 对话窗口中与 AI 实时交互，AI 回复以流式打字效果呈现。

### VP2: Agent 自动创建 Feature
Agent 分析需求后自动在 `features/` 下创建目录和文档，修改 `queue.yaml`，看板实时出现新卡片。

### VP3: 安全凭证管理
API Keys 存储在操作系统 Keyring 中，前端代码永远无法接触敏感凭证。

## Acceptance Criteria (Gherkin)

```gherkin
Scenario: PM Agent 流式对话
  Given 用户在 ProjectView 的 PM Agent 窗口
  When 用户输入 "分析当前项目的架构"
  Then AI 以打字效果流式回复分析结果
  And Markdown 格式正确渲染

Scenario: Agent 自动创建 Feature
  Given PM Agent 对话中
  When 用户输入 "帮我创建一个用户登录功能的 Feature"
  Then Agent 生成结构化规划
  And 自动在 features/ 下创建对应目录
  And 自动修改 queue.yaml 添加新 Feature
  And TaskBoard 看板自动出现新卡片

Scenario: API Key 安全存储
  Given 用户首次使用 AI 功能
  When 用户在设置中输入 API Key
  Then Key 被存储到操作系统 Keyring
  And 前端代码和网络请求中不可见该 Key
```

## Technical Solution

### 架构: 服务接口抽象
```rust
trait AgentService {
    async fn chat_stream(prompt: &str, context: &str) -> impl Stream<Item = Chunk>;
    async fn structured_output(prompt: &str, schema: &Schema) -> Result<Output>;
}
```

### SSE 流式通信
- Rust `reqwest` 发起 HTTP/2 SSE 请求
- 接收 token 块 → `emit("pm_agent_chunk", { text, is_done })`
- 前端 `listen('pm_agent_chunk')` → 实时追加到对话区

### 结构化输出 → FS 操作
- Agent 返回 JSON 格式的 Feature 规划
- Rust 验证 Schema → 调用 feat-fs-database-engine 的写回 API
- 自动创建: `features/pending-feat-{id}/` + `plan.md` + 更新 `queue.yaml`

### Keyring 凭证
- `keyring` crate 存取 API Keys
- 设置页面: 输入 Key → Rust 写入 Keyring
- 网络请求: Rust 从 Keyring 读取，不经过前端

### 建议拆分策略 (Size L)
- **子任务 A**: SSE 流式通信管线 + 前端打字效果
- **子任务 B**: Keyring 凭证管理 + 设置页面
- **子任务 C**: 结构化输出 → Feature 自动创建闭环
