# Neuro Syntax IDE: 并行开发模块拆分与规划

基于 `tauri_architecture_plan.md` 中确立的“前端响应式、后端跨系统、FS-as-Database”架构，为了实现高效的团队并行开发，我们将整个系统切分为 **5 个可并发独立开发的主模块 (Epics)**。每个模块的职责边界清晰，依赖降至最低，非常适合打散分配给不同的前端、Rust 和 AI 工程师。

---

## 模块 1: Tauri 基建与工作区管理 (Core Foundation & Workspace)
> **并行开发说明**：此模块负责应用的地基。只有当这个模块的基础骨架确定后，其他模块的 UI 才能拼装进来。但它的开发可以独立于具体业务逻辑。

* **基础窗口配置**：
  - 初始化 Tauri 2.0 + React 架构。
  - 配置 macOS/Windows 无边框透明窗口 (Decorations: false) 和自定义拖拽栏。
* **工作区读取 (Workspace Initialization)**：
  - 核心：使用 `@tauri-apps/plugin-dialog` 提供选取本地项目根目录的能力。
  - Rust 侧提供全量扫描文件树的能力，返回 JSON 树状结构数据。
* **文件监听器 (Watcher)**：
  - Rust 侧实现 `notify` 库，建立对已加载工作区目录变动的轮询。将外部产生的文件增减、YAML 修改事件通过 `SysEvent` 发送到前端。

## 模块 2: FS-as-Database 驱动的数据层及任务看板 (Task Data Layer & Board)
> **并行开发说明**：此模块是该工具的业务核心。通过 Mock 工作区（一份静态的 `queue.yaml` 和 `features/` 目录）即可独立开发前端看板，同时也支持 Rust 后端工程师独立编写真实的解析器。

* **Rust 数据解析引擎**：
  - 读取工作区中的 `feature-workflow/queue.yaml` 解析出 `active/pending/completed` 队列和任务树结构。
  - 扫描 `features/*` 实体文件夹，提取附加的 `.status` 和 `evidence` 信息，反序列化成标准 JSON 数据结构吐给前端。
* **任务交互接口 (Task IO)**：
  - 提供 Rust -> React 的 CRUD RPC：移动任务队列、改变 Priority、写出 Markdown (`Plan.md` / `Evidence`) 至某个特定 Task 夹下。
* **任务前端视图**：
  - 承接任务数据流，开发出原本原型的 **Board 视图**（卡片拖拽）与 **Timeline 视图**（甘特图渲染）。

## 模块 3: 原生终端与集成编辑器 (Terminal & Editor)
> **并行开发说明**：这个模块的技术难点最高，需要重度对接底层的进程处理，适合资深客户端/全栈工程师专研。

* **Pty 伪终端内核**：
  - Rust 侧集成 `portable-pty`，通过多线程处理子进程的 stdout 与 stdin。
  - 创建并维持多个隔离的 Shell 实例 (支持常规 Bash, Claude CLI, Gemini CLI 进程分离管理)。
* **前端 Terminal 渲染**：
  - 接入 `xterm.js`，响应 UI 事件传递指令到 Rust 的 Pty；高效接收来自后端的高频日志并打印到屏幕上。
* **核心代码编辑器桥接**：
  - 接入 `monaco-editor` 库做代码呈现底盘。
  - 构建多 Tab 加载文件的逻辑体验（读取模块1返回的内容展示）。

## 模块 4: Dashboard 仪表盘与系统监控探针 (Mission Control)
> **并行开发说明**：这个模块相对独立，完全依赖硬件探针与前台可视化呈现。可直接开工。

* **硬件资源搜集后台**：
  - Rust 引入 `sysinfo`（甚至特定环境的 GPU 包），开启一条低消耗异步轮询线程，每 `1s` 打包机器 CPU、RAM 负载进行通道下发。
* **内置 Git 与数据可视化**：
  - 集成 `git2-rs`，每间隔 15s 后台检查 Git Tree 计算出 PR、Commit 信息和变动文件数并落盘。
  - 前台接收硬件 JSON 指标和 Git 活跃度指标渲染 Mission Control 的波浪图及雷达图。

## 模块 5: AI PM Agent 工作流交互中心 (AI Orchestration)
> **并行开发说明**：AI 应用的独立性使其可以在第一天就开始，使用 Postman 或纯 React 侧 Mock 数据联调交互逻辑，后期再嵌入 Tauri。

* **LLM 流式通信隧道**：
  - 利用 Rust `reqwest` 实现原生 HTTP/2 SSE 长连接，封装跟 Gemini/Claude 的 API 的握手（避开跨域和拦截），返回 Streaming 字符块通过 Event 抛给前端。
* **本地凭证安全 (Keyring) 保护**：
  - 核心的大模型 API 绝不能保存在 localStorage，使用 OS 层级加密的密码库存储鉴权密钥，再由 Rust 从内存中提取使用。
* **语义分析入库执行 (AI Exec)**：
  - PM Agent Chat 对话组件。
  - 当通过文字对 Agent 要求“新建注册功能”时，Agent 自动响应后，直接触发模块 2 的 `Task IO` 逻辑，**自动在本地 `queue.yaml` 插入配置并在 `features/` 下建立对应的 Markdown 目录及结构**。

---

## 📅 合理的并行实施路径推荐

对于典型的 3 人小组配置（前端、Rust 服务端、全栈或 AI 工程师）：

* **Sprint 1 (地基周期)** 
  * `全员`：确认多进程通信格式与全局事件字典（JSON Schema）。
  * `前端`：全面移植纯 React 原型为正式的业务组件包，拆解 UI 视图。
  * `Rust`：攻坚 [模块3] 的终端进程桥接方案，验证 Pty 的流通性。

* **Sprint 2 (数据集成)**
  * `前端`：完成 [模块1] 和 [模块4] 的视图渲染接入。
  * `Rust`：全力实现 [模块2] 里的 `queue.yaml` 动态解析读写器与监控系统 `sysinfo`。
  * `AI 研发`：开发 [模块5] 下流式打字的 UI、提示词链路，尝试读取本地 Context 解析输出格式化 JSON。

* **Sprint 3 (联调收口)**
  * `全员`：打通“Agent 对话生成 -> Rust 处理 FS 和日志 -> Xterm 和看板实时变动”的全局大闭环。修复进程间通信出现的资源竞争死锁。
