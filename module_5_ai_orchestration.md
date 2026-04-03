# Module 5: AI Orchestration 与工作流交控中心 (AI Agent Kernel)

## 1. 模块边界与目标

**责任范围**：接管原型中的 PM Agent。负责解析外部人类指令、将请求组装给云端大模型（LLMs）、获取并清理脏数据流，并充当发起系统 IO 的裁判（例如控制生成 Feature 目录与文档的最终落盘行动）。

## 2. 核心技术栈

* **前端**：基于流处理的 Markdown React UI（支持在 LLM 打字过程实时高亮）。

* **Rust 安全及网络层**：

  * `reqwest` (开启 `stream` Feature 以支撑流式 Http 请求)。

  * `tauri-plugin-store` / [keyring](https://crates.io/crates/keyring) (安全的鉴权与秘钥持久管控)。

## 3. 实现细节与步骤规划

### Step 1: SSE 流式通信管线 (Streaming Tunnel)

* **背景**：常规大模型生成结构化任务（排期规划、Json拆解）非常耗时。若走普通的短 HTTP 就会导致前台死机 30 秒。

* **Rust IPC Command** (`ask_pm_agent(prompt)`):

  * Rust 发起与 Gemini/Claude API 的 TCP 请求，配置 `text/event-stream`。

  * 服务端接收到一块 Token 后直接立即通过 `app_handle.emit("pm_agent_chunk", { text: "xx", is_done: false })` 投递给桌面 UI。

  * 前端在接受到最后一条 `is_done: true` 时，转为正式确认状态。

### Step 2: 上下文拦截与结构化输出 (Auto Task Gen)

* 最核心的价值就是**代替人类动手写特征规划包**。

* 当 Agent 完成回复并通过 Structured Output Schema 固定返回了特定的 Markdown 格式及 Json 后：

* 后端截获该特定格式对象。在本地自动使用 `std::fs` 调用：

  1. 篡改修改并重新保存 `queue.yaml`。

  2. 在对应的 `features/` 或 `active-feat-xxx/` 目录下创建一个真实的文件夹。

  3. 往内部丢进去一份该次交涉产出的 `Agent-Plan.md` 文件。

* （注意：此处的变更一旦触发硬盘写入，Module 2 的文件拦截器 Watcher 会瞬间感知，自动帮 Kanban 去触发页面刷新重绘）。

### Step 3: 系统鉴权保密舱 (Keyring Vault)

* 为了防止恶意代码扫描本机的 Node/React 环境抓取 API 密钥，用户的 Token 配置页面输入只走后门存储进操作系统的 Keychain 中。

* 所有 HTTP Header 的拼装动作均隐藏在二进制 Rust 模块里。

## 4. 并行实施逻辑

* **依赖项**：依赖大模型生态，以及后续会强依赖 Module 2 提供的工作流 yaml 写回 API。

* **并行建议安排**：大模型架构师可使用纯 Node 或 Python 独立调试 Prompt 和 Function calling 定义。调优完成保证输出严格符合 `queue.yaml` 设定的格式后，最后一天由 Rust 工程师进行纯接口替换，风险极低。

⠀