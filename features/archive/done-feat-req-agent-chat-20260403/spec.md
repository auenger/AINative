# Feature: feat-req-agent-chat 需求分析 Agent 聊天 UI

## Basic Information
- **ID**: feat-req-agent-chat
- **Name**: 需求分析 Agent 聊天 UI
- **Priority**: 70
- **Size**: S
- **Dependencies**: [feat-req-agent-bridge]
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-03

## Description
在 ProjectView 中实现需求分析 Agent 的聊天 UI，复用现有 PM Agent 的流式聊天模式，对接新的 `req_agent_*` IPC 命令。支持多轮对话、会话恢复、Agent 状态指示。

## User Value Points
1. **需求分析对话** — 用户可以在 IDE 内与 Claude Agent 多轮对话讨论需求
2. **会话持久化** — 关闭 IDE 再打开可恢复上次的对话上下文

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/lib/useAgentChat.ts` — 现有 PM Agent hook（核心参考）
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — PM Agent 聊天 UI
- `features/pending-feat-req-agent-bridge/spec.md` — Bridge 服务的 IPC 命令定义

### Related Features
- feat-req-agent-bridge — 本 feature 依赖其 IPC 命令

## Technical Solution

### 前端 Hook: `useReqAgentChat.ts`
基于 `useAgentChat.ts` 模式，对接新的 IPC：
- `invoke('req_agent_start')` → 启动会话
- `invoke('req_agent_send', { message })` → 发送消息
- `listen('req_agent_chunk', ...)` → 接收流式响应
- `invoke('req_agent_stop')` → 停止会话
- `invoke('req_agent_status')` → 检查状态

### UI 变更
- ProjectView 中增加需求分析 Agent tab 或切换按钮
- 复用聊天消息列表 + Markdown 渲染
- 增加 Agent 连接状态指示器
- 增加"新建会话"按钮

### System Prompt (由后端注入)
```
你是 Neuro Syntax IDE 的需求分析专家。你的任务是：
1. 与用户对话，理解他们的软件需求
2. 分析需求的完整性、可行性和潜在问题
3. 将分析结果以结构化 Markdown 输出

你可以使用文件读写工具来：
- 读取项目现有代码了解上下文
- 将需求分析结果写入项目的 features/ 目录

输出格式：使用 /new-feature 的规范格式
```

## Acceptance Criteria (Gherkin)
### User Story
作为 IDE 用户，我想要在 IDE 内与 AI Agent 聊天讨论需求，以便快速分析和文档化我的软件需求。

### Scenarios
```gherkin
Scenario: 启动需求分析对话
  Given Claude Code CLI 已安装并认证
  And 用户在 ProjectView 页面
  When 用户点击"需求分析"按钮
  Then Agent 会话启动
  And 聊天界面显示 Agent 问候语
  And 状态指示器显示"已连接"

Scenario: 多轮对话分析需求
  Given Agent 会话已启动
  When 用户输入 "我想要一个用户登录功能"
  Then Agent 以流式方式回复分析和追问
  And 用户可以继续追问或补充细节

Scenario: 恢复历史会话
  Given 存在之前的需求分析会话
  When 用户打开 ProjectView
  Then 自动恢复上次会话
  And 显示历史消息

Scenario: Agent 不可用
  Given Claude Code CLI 未安装
  When 用户点击"需求分析"按钮
  Then 显示明确的安装指引
  And 不显示空白或卡住的状态
```

### General Checklist
- [x] 聊天 UI 正确渲染流式 Markdown 响应
- [x] 会话恢复工作正常
- [x] Agent 状态清晰可见
- [x] 错误状态有友好提示

## Merge Record
- **Completed**: 2026-04-03T20:30:00Z
- **Merged Branch**: feature/feat-req-agent-chat
- **Merge Commit**: 8b1199e
- **Archive Tag**: feat-req-agent-chat-20260403
- **Conflicts**: none
- **Verification**: passed (4/4 Gherkin scenarios, tsc + build clean)
- **Stats**: 1 commit, 3 files changed, 652 insertions, 90 deletions
