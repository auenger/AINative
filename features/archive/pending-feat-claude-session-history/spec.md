# Feature: feat-claude-session-history Claude Code 会话历史回看

## Basic Information
- **ID**: feat-claude-session-history
- **Name**: Claude Code 会话历史回看
- **Priority**: 75
- **Size**: M
- **Dependencies**: none
- **Parent**: null
- **Children**: none
- **Created**: 2026-04-27T14:30:00Z

## Description
在 Neuro Syntax IDE 中新增 Claude Code 会话历史回看能力。通过解析 `~/.claude/projects/<path>/` 下的 JSONL 对话记录和 `.session_cache.json` 索引，提供完整的会话列表浏览、对话内容回放、会话元数据展示功能。

用户可以查看当前项目中所有 Claude Code 的历史对话（包括交互模式和 `claude -p` print 模式产生的会话），回看完整的用户消息、AI 回复、工具调用过程。

## User Value Points

### VP1: 会话列表与搜索
用户可以浏览当前工作区下所有历史 Claude Code 会话，按时间排序，支持关键词搜索过滤。每条会话显示摘要、时间、消息数量。

### VP2: 对话内容回放
选择某个会话后，以聊天记录格式展示完整的对话内容，包括：
- 用户消息（文本 + 附件）
- AI 回复（文本 + thinking + tool_use）
- 系统消息（命令执行结果）
- 按时间线排列，支持滚动浏览

### VP3: 会话元数据
展示会话级别的元信息：开始/结束时间、持续时长、模型、token 用量（input/output）、消息总数、git 分支、是否使用工具、是否有错误。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src-tauri/src/lib.rs:5717-5790` — `read_claude_session` 现有 session 读取逻辑
- `neuro-syntax-ide/src-tauri/src/lib.rs:5804-5950` — `discover_session_tool` 现有 JSONL 解析逻辑
- `neuro-syntax-ide/src/components/RuntimeOutputModal.tsx` — 现有运行时输出弹窗（可参考 UI 模式）
- `neuro-syntax-ide/src/lib/useAgentStream.ts` — 现有 Agent 流式 hook

### Data Sources
**Primary: `~/.claude/projects/<encoded-path>/`**
- `<session-uuid>.jsonl` — 每个会话的完整对话记录（JSONL 格式，每行一个 JSON 对象）
- `<session-uuid>/subagents/` — SubAgent 对话文件
- `.session_cache.json` — 会话索引缓存（含摘要、时间、消息数等元数据）

**JSONL Message Types:**
| Type | Count | Content |
|------|-------|---------|
| `assistant` | ~76/会话 | AI 回复（含 thinking + tool_use content blocks） |
| `user` | ~53/会话 | 用户消息（含 display content） |
| `system` | ~12/会话 | 系统消息（命令、本地命令输出） |
| `file-history-snapshot` | ~15/会话 | 文件快照 |
| `permission-mode` | ~13/会话 | 权限模式变更 |
| `attachment` | ~8/会话 | 文件附件 |

**JSONL Entry Schema:**
```json
{
  "uuid": "string",
  "parentUuid": "string|null",
  "type": "user|assistant|system|tool_result|...",
  "message": { "role": "...", "content": [...] },
  "timestamp": "ISO-8601",
  "sessionId": "uuid",
  "entrypoint": "cli|print",
  "gitBranch": "string",
  "isSidechain": false,
  "userType": "external|internal"
}
```

**Session Cache Schema (`.session_cache.json`):**
```json
{
  "version": 8,
  "entries": {
    "<file_path>": {
      "session": {
        "actual_session_id": "uuid",
        "project_name": "string",
        "message_count": 124,
        "first_message_time": "ISO-8601",
        "last_message_time": "ISO-8601",
        "summary": "string (first assistant text)",
        "has_tool_use": true,
        "has_errors": false
      },
      "first_user_content": "string|null",
      "last_user_content": "string|null"
    }
  }
}
```

### Related Features
- `feat-claude-code-runtime-monitor` (已完成) — Runtime 进程监控，本 feature 可复用其 session 读取模式
- `feat-runtime-output-polish` (已完成) — Runtime 输出弹窗 UI 可参考
- `feat-modal-session-store` (pending) — Modal 会话持久化，与本 feature 互补

## Technical Solution

### Architecture
采用 Rust 后端 + React 前端的 Tauri IPC 模式：

**Rust 侧（新增 Commands）：**
1. `list_claude_sessions(workspace_path)` — 读取 `.session_cache.json`，返回会话列表
2. `get_claude_session_detail(session_id, workspace_path)` — 读取指定 JSONL，解析为消息列表
3. `search_claude_sessions(query, workspace_path)` — 全文搜索会话内容

**前端侧（新增组件）：**
1. `SessionHistoryPanel` — 会话列表面板（嵌入 Mission Control 或作为独立视图）
2. `SessionReplayView` — 对话回放组件（聊天气泡格式）
3. 集成到现有 MissionControl 视图的 Agent 日志区域

### Performance Considerations
- JSONL 文件可能较大（5MB+），需要分页加载或流式读取
- `.session_cache.json` 已有元数据索引，列表加载无需扫描所有 JSONL
- 对话内容按需加载（用户点击会话后才读取对应 JSONL）

## Acceptance Criteria (Gherkin)

### User Story
作为 Neuro Syntax IDE 用户，我想要查看和回放 Claude Code 的历史对话记录，以便回顾之前的工作过程、排查问题、或了解 Agent 的操作历史。

### Scenarios (Given/When/Then)

#### Scenario 1: 浏览会话列表
```gherkin
Given 用户在 Mission Control 视图中
When 用户点击 "会话历史" tab
Then 显示当前项目的所有 Claude Code 历史会话列表
And 每条会话显示：摘要、开始时间、消息数量、模型
And 列表按最后活跃时间倒序排列
```

#### Scenario 2: 搜索会话
```gherkin
Given 用户在会话列表视图中
When 用户在搜索框输入关键词
Then 会话列表实时过滤，只显示匹配的会话
And 匹配范围包括：会话摘要、用户消息内容
```

#### Scenario 3: 回放对话内容
```gherkin
Given 用户在会话列表中
When 用户点击某个会话
Then 右侧面板显示该会话的完整对话记录
And 用户消息显示在右侧（气泡样式）
And AI 回复显示在左侧（含 thinking 折叠区）
And 工具调用显示为可展开的调用块
And 支持滚动浏览全部内容
```

#### Scenario 4: 查看会话元数据
```gherkin
Given 用户正在查看某个会话的对话回放
When 用户查看会话头部信息区
Then 显示：会话 ID、开始/结束时间、持续时长、总消息数
And 显示 token 用量（input/output）
And 显示使用的模型和 git 分支
```

#### Scenario 5: 大文件性能
```gherkin
Given 一个会话的 JSONL 文件超过 2MB
When 用户请求查看该会话
Then 对话内容分页加载（首次加载最近 50 条消息）
And 用户可以向上滚动加载更早的消息
And 加载过程中显示骨架屏动画
```

### UI/Interaction Checkpoints
- 会话列表使用 glass-panel 卡片样式，hover 时高亮
- 对话气泡使用现有 Agent 对话区的设计语言
- Thinking 区块默认折叠，点击展开
- Tool use 区块显示工具名称 + 参数摘要，点击展开详情
- 搜索框使用 TopNav 的搜索框样式

### General Checklist
- 不修改原型设计系统（颜色/字体/动画）
- 使用 `cn()` 合并样式
- 类型定义集中在 `types.ts`
- IPC 使用 `invoke()` + Tauri Command 模式
- 数据格式遵循 FS-as-Database 原则（读取现有 `.claude` 目录数据，不新建存储）
