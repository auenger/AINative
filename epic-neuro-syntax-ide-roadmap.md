# Epic: Neuro Syntax IDE — 从原型到桌面 App

**Epic ID**: epic-neuro-syntax-ide-roadmap
**Created**: 2026-04-01
**Status**: Phase 1 进行中
**Total Features**: 7

---

## 背景

Neuro Syntax IDE 是一款 AI 原生桌面端 IDE。当前已完成 React Web 原型 (`neuro-syntax-ide/`)，展示了完整的 UI 交互和视觉风格。本 Epic 的目标是将原型包裹进 Tauri V2 桌面窗口，逐步接入真实系统能力，最终实现从 Web Demo 到生产级桌面 App 的完整转化。

**核心原则**:
- 原型是 UI 参考，不是生产代码 — 复用组件和设计系统
- Agent/AI 通过服务接口统一调用，不急于嵌入 Rust
- 数据层坚持 FS-as-Database (YAML + Markdown + Git)
- 每个 Feature 交付后 App 都能跑，不出现半成品

---

## Feature 列表

| # | ID | 名称 | Phase | Priority | Size | 依赖 |
|---|-----|------|-------|----------|------|------|
| F1 | feat-tauri-v2-init | Tauri V2 工程初始化 | 1 | 90 | M | — |
| F2 | feat-workspace-loader | 工作区加载器 + 真实文件树 | 2 | 80 | M | F1 |
| F3 | feat-fs-database-engine | FS-as-Database 数据引擎 + 看板 | 2 | 75 | L | F2 |
| F4 | feat-editor-monaco | Monaco Editor 代码编辑器 | 3 | 60 | M | F2 |
| F5 | feat-native-terminal | xterm.js 真实终端 | 3 | 55 | L | F1 |
| F6 | feat-hardware-monitor | 硬件监控探针 + 仪表盘 | 4 | 40 | M | F2 |
| F7 | feat-ai-agent-service | AI Agent 服务化接口 | 5 | 30 | L | F3 |

---

## 依赖关系图

```
F1: tauri-v2-init ─────────────┬────────────────── F5: native-terminal
  (App 外壳)                    │                   (Pty 终端)
                               ▼
                    F2: workspace-loader ────────┬── F6: hardware-monitor
                      (工作区 + 文件树)           │   (硬件探针)
                               │                 │
                    ┌──────────┼──────────┐      │
                    ▼                     ▼      │
          F3: fs-database-engine   F4: editor-monaco
            (数据层 + 看板)         (Monaco 编辑器)
                    │
                    ▼
          F7: ai-agent-service
            (AI Agent 接口)
```

## 并行开发策略

```
Sprint 1 ─── F1 (tauri-v2-init)
              │
Sprint 2 ─── F2 (workspace-loader)
              │
Sprint 3 ─── F3 (fs-database) ─── F4 (editor) ─── F5 (terminal)  ← 三线并行
              │
Sprint 4 ─── F6 (hardware-monitor) ─── F7 (ai-agent-service)     ← 双线并行
```

---

## Feature 详细说明

### F1: feat-tauri-v2-init — Tauri V2 工程初始化
**Phase**: 1 — App 外壳与原型迁移
**User Story**: 作为开发者，我运行 `tauri dev` 就能在桌面窗口中看到完整的 React 原型页面。
**交付物**:
- `src-tauri/` 完整工程 (Cargo.toml, tauri.conf.json, main.rs, lib.rs)
- 无边框自定义窗口 (decorations: false)
- TopNav 拖拽区域 + 窗口控制按钮 (最小化/最大化/关闭)
- Vite dev server 集成 + HMR 热更新
**验收**: `tauri dev` 启动后，窗口显示全部 5 个原型视图且可切换。
**Status**: pending (已创建)

---

### F2: feat-workspace-loader — 工作区加载器 + 真实文件树
**Phase**: 2 — 系统级能力接入
**User Story**: 作为用户，我可以打开本地项目目录，看到真实的文件树结构。
**交付物**:
- `@tauri-apps/plugin-dialog` 系统文件夹选择器
- Rust 递归扫描文件树 → JSON 返回前端
- ProjectView/EditorView 文件树用真实数据替换 mock
- 工作区路径持久化 (AppData config, 下次自动加载)
- `data-tauri-drag-region` 不影响文件树交互
**验收**: 选择本地目录后，文件树展示真实目录结构，可展开/折叠。
**关键 IPC**:
- `invoke('pick_workspace')` → 选择目录
- `invoke('read_file_tree', { path })` → 文件树 JSON
**Status**: pending

---

### F3: feat-fs-database-engine — FS-as-Database 数据引擎 + 看板活数据
**Phase**: 2 — 系统级能力接入
**User Story**: 作为用户，我在看板上看到的是真实的工作区 Feature 数据，拖拽卡片直接修改本地文件。
**交付物**:
- Rust `serde_yaml` + `serde` 解析 `feature-workflow/queue.yaml`
- 扫描 `features/` 实体目录，聚合 `.status`、`evidence` 等属性
- TaskBoard 看板模式：拖拽卡片 → Rust 写回 `queue.yaml`
- TaskBoard 甘特图模式：读取日期字段渲染时间线
- WorkflowEditor 接真实工作流数据
- Rust `notify` 文件变更监听 → `emit("fs://workspace-changed")` → 前端自动刷新
**验收**: 在 `features/` 中新建文件夹后，看板自动出现新卡片；拖拽卡片到 Completed，`queue.yaml` 实际被修改。
**关键 IPC**:
- `invoke('fetch_queue_state')` → QueueState
- `invoke('update_task_status', { taskId, target })` → void
- `listen('fs://workspace-changed')` → FsChangeEvent
**风险**: Size L，建议拆为 子任务 A (YAML 解析器) + 子任务 B (看板双向绑定) + 子任务 C (Watcher)
**Status**: pending

---

### F4: feat-editor-monaco — Monaco Editor 代码编辑器
**Phase**: 3 — 终端与编辑器
**User Story**: 作为用户，我可以在 IDE 中打开代码文件进行编辑和保存。
**交付物**:
- 接入 `@monaco-editor/react` 替换当前 `pre/code` 标签
- 双击文件树文件 → 打开为 Tab，按扩展名设置语法高亮
- 多 Tab 管理 (切换、关闭)
- Cmd+S 保存 → `invoke('write_file', { path, content })` → Rust `std::fs::write`
- 文件变更监听 → Monaco 感知外部修改并提示
**验收**: 打开 .tsx 文件显示语法高亮，编辑后 Cmd+S 保存成功，外部修改文件后编辑器提示重新加载。
**依赖**: F2 (需要文件树和文件读取能力)
**Status**: pending

---

### F5: feat-native-terminal — xterm.js 真实终端
**Phase**: 3 — 终端与编辑器
**User Story**: 作为用户，我可以在 IDE 内使用真实的 Shell 终端执行命令。
**交付物**:
- Rust `portable-pty` 派生 Shell 子进程 (macOS: zsh, Windows: powershell)
- xterm.js 前端渲染 + xterm-addon-fit 自适应尺寸
- 前后端双向数据流:
  - `xterm.onData()` → `invoke('write_to_pty', { data })` → Rust stdin
  - Rust stdout → `emit("pty-out", { data })` → `xterm.write(data)`
- 多终端 Tab: Bash / Claude CLI / Gemini CLI (带参启动对应命令)
- 窗口 resize → PtySize 同步
**验收**: 在终端中执行 `ls -la`、`git status` 等命令输出正确，颜色渲染正常。
**风险**: 技术难点最高 — Pty 进程管理、高频 stdout 流、resize 同步、ANSI 转义码处理
**依赖**: F1 (基础 Tauri 框架，不依赖 F2)
**Status**: pending

---

### F6: feat-hardware-monitor — 硬件监控探针 + 仪表盘
**Phase**: 4 — 硬件监控与仪表盘
**User Story**: 作为用户，我可以在 MissionControl 面板看到真实的 CPU/RAM 使用率和 Git 活跃度。
**交付物**:
- Rust `sysinfo` 异步轮询线程 (每 1s 刷新)
- `app_handle.emit("sys-hardware-tick", payload)` 广播
- MissionControl 接真实数据: CPU/RAM 波浪图、系统健康状态
- `git2-rs` 读取工作区 Git 统计 (近 7 天 commits, 变动文件数)
- 全局 Logger 注入 — AI Activity Log 真实日志流
**验收**: MissionControl 面板显示当前系统真实的 CPU 使用率曲线，数值每秒刷新。
**依赖**: F2 (需要工作区路径)
**Status**: pending

---

### F7: feat-ai-agent-service — AI Agent 服务化接口
**Phase**: 5 — AI Agent 服务化
**User Story**: 作为用户，我可以在 PM Agent 对话窗口中与 AI 交互，Agent 可以自动创建和管理 Feature。
**交付物**:
- Agent 统一服务接口封装 (不绑定特定 LLM)
- Rust `reqwest` SSE 流式通信 → `emit("pm_agent_chunk")` → 前端打字效果
- Keyring 安全凭证管理 (API Keys 不暴露到前端)
- Agent 结构化输出 → 自动触发 F3 的 Task IO:
  - 修改 `queue.yaml` 插入新 Feature
  - 在 `features/` 下创建目录和 `plan.md`
- ProjectView 的 PM Agent 聊天接真实后端
**验收**: 输入"帮我创建一个用户登录功能"，Agent 返回规划并自动在 `features/` 下创建对应目录和文档，看板实时出现新卡片。
**依赖**: F3 (需要 FS-as-Database 写回能力)
**Status**: pending

---

## 风险与注意事项

| Feature | 风险等级 | 关键风险 |
|---------|---------|---------|
| F1 | 低 | Tauri V2 文档变化快，注意 API 版本一致性 |
| F2 | 低 | 大型目录文件树扫描性能 — 需要做懒加载 |
| F3 | **高** | Size L，拖拽 + YAML 写回 + Watcher 三者联调复杂 |
| F4 | 中 | Monaco Editor 体积大，需考虑按需加载 |
| F5 | **高** | Pty 进程管理、高频 stdout、resize 同步、ANSI 处理 |
| F6 | 低 | sysinfo 跨平台行为差异，macOS/Windows 需分别测试 |
| F7 | 中 | LLM 输出格式不稳定，需严格的 Schema 校验 |

## 技术栈总览

| Feature | Rust Crates | 前端 Libraries | Tauri Plugins |
|---------|-------------|---------------|---------------|
| F1 | tauri 2.x, serde | @tauri-apps/api 2.x | opener |
| F2 | serde_json, tokio | — | dialog, fs |
| F3 | serde_yaml, notify, tokio | @dnd-kit/core | fs |
| F4 | std::fs | @monaco-editor/react | fs |
| F5 | portable-pty, tokio | xterm.js, xterm-addon-fit | — |
| F6 | sysinfo, git2 | — | — |
| F7 | reqwest, keyring | react-markdown | store |
