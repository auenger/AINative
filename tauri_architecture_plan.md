# Neuro Syntax IDE: React + Tauri App 架构实现方案文档

基于当前原型的设计（项目、任务、编辑器、任务控制看板），将纯前端的 React Web 原型转化为 **React + Tauri App** 的完整桌面端应用，可以极大地提升应用的系统级集成能力（文件系统访问、终端执行、系统状态监控等）和原生交互体验。

以下为基于原型各个模块的具体拆解与技术实现方案。

---

## 一、 系统架构概览 (Architecture)

Tauri 应用采用 **双层/多进程架构**：
- **前端层 (Frontend)**: React + Vite + Tailwind CSS + Framer Motion。直接复用并强化当前原型的响应式 UI。
- **后端层 (Core Backend)**: Rust 进程。负责处理与 OS 交互的底层任务，包括真正的系统硬件级监控、受限目录下的文件系统 I/O 操作、Git CLI 集成或 Native Git 库调用，以及与系统 Shell 伪终端的通信。
- **通信桥梁 (IPC)**: 前后端通过 Tauri 的 `invoke` 或事件广播 (`emit`/`listen`) 进行无缝且高性能的跨进程通信。

---

## 二、 核心功能模块拆解与具体实现

### 1. 项目模块 (`ProjectView`)
**原型功能分析**：PM Agent (上下文沟通窗口)、系统/项目运行上下文 (Markdown 动态渲染)、本地 Workspace 路经指示、Git 状态可视化交互。

**Tauri 实现路径**：
- **项目初始化加载**：
  - 通过 Tauri 官方插件 `@tauri-apps/plugin-dialog` 提供系统原生文件夹选择器，定位并打开硬盘上的工程目录。
  - 通过 `@tauri-apps/plugin-fs` 进行该目录结构的扫描，实现动态刷新和读写项目环境配置 (例如 `.neuro-ide-config.json`)。
- **Git 状态聚合**：
  - **后端实现（推荐）**：在 Rust 侧整合 `git2` (libgit2 的 Rust 绑定)，开放如 `git_get_status`、`git_commit` 等 Tauri Command 供前端调用。比前端模拟更加准确和高效。
- **PM Agent 的集成**：
  - 前端负责 Chat UI 的绘制。
  - 后端 Rust 发起向 Gemini/Claude 等 LLM API 的长链接 (利用 `reqwest` 支持 Server-Sent Events 流式返回)。绕过前端 CORS 限制，同时将 API Keys 等敏感数据安全储存在 Rust 侧的加密 Keyring 中。

### 2. 任务/看板模块 (`TaskBoard`)
**原型功能分析**：业务需求与开发任务的双栏看板分离、时间线 ( Timeline )甘特图视图、任务之间的父子依赖关系维护、Task 详情弹窗。

**Tauri 实现路径**：
- **文件系统与 Git 驱动的无库架构 (FS-as-Database)**：
  - 摒弃传统的 SQLite 数据库，将应用状态直接映射到用户的工作区目录结构中（如 `feature-workflow` 队列和 `features` 目录）。
  - **目录即任务**：每一个具体的 Feature (Task) 对应 `features` 目录下的一个实体文件夹（如 `active-feat-xxx`、`pending-feat-xxx` 等）。
  - **结构化查询与追踪**：引擎启动后，后端通过解析 `feature-workflow/queue.yaml` 来读取父子需求关联、当前状态（active/pending/completed）以及工作优先级。Rust 侧直接监听这些 Yaml 和文件夹变动，转化为前端看板视图。
- **AI 赋能的文档流转闭环**：
  - PM Agent 产出的详细规划与用户的交互文档证据（如 Evidence、Plan 等），直接存入到对应任务的本地实体文件夹中。
  - 所有任务的状态流转和文档变更，全部通过应用内集成的 Git 功能进行版本管控和快照归档，达成 100% 透明和可回溯。

### 3. 编辑器模块 (`EditorView`)
**原型功能分析**：多层次文件目录树渲染、代码编辑区容器、深度集成终端 (包含 Bash, Claude Code CLI, Gemini Terminal 单独分组)。

**Tauri 实现路径**：
- **高性能文件监听工具 (File System Watcher)**：
  - 弃用前端 mock 的 `FILE_TREE`，在 Rust 层挂载 `notify` 库，创建一个文件监听服务，外部产生的文件更改自动推送至 Frontend 进行树结构的局部增量更新。
- **工业级编辑器植入**：
  - 当前原型使用 `pre`/`code` 标签构建代码预览区块。生产需引入 `monaco-editor` React 桥接器包（即 VS Code 开发核心），在组件中按文件拓展名呈现对应语法的高亮渲染。
- **Tauri Pty 虚拟终端实现 (重难点)**：
  - **前端容器**：引入 `xterm.js` 及 `xterm-addon-fit` 组件承载终端 UI。
  - **后端通信**：Rust 端使用 `portable-pty` 派生一个子 Shell (macOS `zsh` / Win `powershell`) 实例。前后端之间通过 Tauri 事件机制将 `xterm` 捕捉到的键盘输入转发给 Rust pty，同时将 pty 输出的高频标准输出流 (stdout) 返回给 xterm 去写屏，实现 100% 真实可用终端。

### 4. 任务控制 / 看板监控模块 (`MissionControl`)
**原型功能分析**：AI Agent 集群当前指派任务、实时的 CPU 和 VRAM 使用量追踪卡片、后台 Terminal 日志滚动、Git 动态统计、技能覆盖率。

**Tauri 实现路径**：
- **物理硬件监控与探针**：
  - 依赖 Rust 侧强大的底层调用能力，使用 `sysinfo` Crate 轮询操作系统的 CPU 占用%、剩余物理 Memory；甚至引入 `nvml-wrapper`/`mac-sys-info` 去分别捕捉不同架构机器的真实 NPU/GPU 占用率。
  - Rust 后端可以通过一个异步线程定期每秒钟对前端抛出含硬件数据的 `sys_update_event` 广播，渲染为波浪流或仪表盘。
- **系统日志中心与 Agent 并发运行库**：
  - Tauri 环境下，全局配置 `tracing-subscriber` 或 `log` 的文件日志拦截，把所有的 LLM 并发调用的 Request/Response 元数据以及 Agent 报错归拢至管道。该模块面板将直接定阅并消费该后台日志流。

---

## 三、 技术栈选型参考清单

| 域功能 | Rust 侧方案 (Backend) | 前端层面及 Tauri Plugin 方案 |
| --- | --- | --- |
| 应用框架 | Tauri Core V2 (高响应、体积小) | React 18 / Vite 5 / Tailwind |
| 文件读写与选择 | `std::fs`, `notify` (监听更改) | `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs` |
| 任务状态与队列 | `serde_yaml`, `std::fs` | `@tauri-apps/plugin-fs` 解析 Markdown/YAML |
| Git 集成 | `git2-rs` | 暴漏 Invoke 函数交由前端处理 UI |
| 虚拟终端集成 | `portable-pty` | `xterm.js` |
| 真机监控探查 | `sysinfo`, Mac系统调用 | 实时渲染 Motion 图表组件 |
| 跨进程通讯 | `tauri::emit`, `tauri::command` | `@tauri-apps/api/core` (`invoke`, `listen`) |

---

## 四、 实施迭代建议 (Milestone 规划)

1. **第一阶段 (基础迁移与解耦)**：建立 Tauri + React 工程基础模板，平移全部已有 UI 组件的样式。实现无边框、自定义 Drag 透明顶栏。
2. **第二阶段 (系统接管)**：用 `@tauri-apps/plugin-fs` 替换 Mock 数据，实现真实的本地 Project 选择与文件树读写展示；实现对 `feature-workflow/queue.yaml` 和 `features/` 目录的监听及双向解析，完成本地驱动。
3. **第三阶段 (终端与高级系统 API)**：实现 `xterm.js` 结合后端 `portable-pty` 的功能通信通道。接入硬件状态 `sysinfo` 使 Dashboard 全部"活"过来。
4. **第四阶段 (AI Agent 对接)**：集成大模型流式通信支持并在后端进行 Keyring 服务整合，保证本地敏感凭证和数据的安全运转，打通 PM Agent 到看板的一键创建闭环工作流。
