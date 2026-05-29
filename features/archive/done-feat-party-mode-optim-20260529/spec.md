# Feature: feat-party-mode-optim Party Mode 引擎优化

## Basic Information
- **ID**: feat-party-mode-optim
- **Name**: Party Mode 引擎优化（动态角色 + 受控进程 + 流水线 + 收敛）
- **Priority**: 65
- **Size**: M
- **Dependencies**: feat-bmad-party-mode (completed)
- **Parent**: feat-bmad-workshop
- **Children**: (none)
- **Created**: 2026-05-29

## Description

优化 BMAD 产品工坊（BMAD Workshop）的核心执行引擎，涵盖所有三个 Tab（头脑风暴/Party Mode/PRD 创建）：

### 核心问题
1. **Runtime 硬编码 CLI 模式** — 所有 Workshop Tab（BrainstormPanel/PartyModePanel/PrdCreationPanel）硬编码 `runtimeId: 'claude-code'`，走 `ClaudeCodeRuntime`（即 `claude --print`），每次调用 spawn 新的 claude 进程，无 session 复用，导致资源泄漏（实测 12 个残留进程）
2. 角色固定为 5 个硬编码 Persona，无法根据讨论主题动态调整
3. 角色间只传 400 字符摘要，没有真正的上下文流水线传递
4. 无收敛机制，讨论可以无限循环，无法产出最终结论

## User Value Points

### VP0: Workshop Runtime 切换为 SDK 模式（最高优先级）
将产品工坊所有 Tab 的底层 Runtime 从 CLI 模式 (`claude --print`) 切换为 SDK 模式 (`AgentSdkRuntime` + Sidecar)。
- 所有 Workshop 组件（BrainstormPanel / PartyModePanel / PrdCreationPanel）的 `runtimeId` 从硬编码 `'claude-code'` 改为 `'agent-sdk'`
- 利用 Sidecar (`agent-sdk-bridge.mjs`) 的 NDJSON 通信，复用单个 Node.js 进程
- SDK 模式天然支持 session 复用，避免每次 spawn 新的 claude 进程
- 解决 12 个残留进程的资源泄漏问题
- **涉及文件**：BrainstormPanel.tsx (line 147), PartyModePanel.tsx (line 100, 207-208), PrdCreationPanel.tsx (line 177)

### VP1: 动态角色分配
根据用户输入的主题/文档/上下文，AI 自动判断应该邀请哪些角色参与讨论。
- 扩展 persona-definitions.ts 为可插拔的角色库（15-20 个角色）
- Orchestrator 首轮分析上下文后，从角色库中选择 3-5 个最匹配的角色
- 用户可以在发起前确认或调整角色名单

### VP2: 受控进程管理
在 SDK 模式基础上，进一步优化进程资源管理。
- 最大并发 SDK 调用数可配置（默认 3）
- 单次调用超时自动终止（默认 120s）
- 完成后立即回收资源
- 前端显示调用状态（运行中/完成/超时）

### VP3: 流水线上下文传递
前序角色的输出作为后序角色的输入，形成有意义的评审链。
- 第一个角色拿到原始主题
- 后续角色拿到原始主题 + 所有前序角色的完整输出
- 每个角色需要明确回应前序角色的关键观点（同意/反对/补充）

### VP4: 收敛产出
多轮讨论后，必须产出结构化的最终结论。
- 最大讨论轮数可配置（默认 3 轮）
- 最后一轮后 Orchestrator 生成结构化评审报告
- 报告包含：共识点、分歧点、建议行动、风险提示
- 报告可直接流入 PRD 创建 Tab 作为输入

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/lib/bmad/persona-definitions.ts` — 当前 5 个硬编码角色定义（185 行）
- `neuro-syntax-ide/src/lib/bmad/party-mode-prompts.ts` — Orchestrator prompt + buildPersonaPrompt（133 行）
- `neuro-syntax-ide/src/components/pm-workshop/PartyModePanel.tsx` — 主面板组件（523 行）
- `neuro-syntax-ide/src/components/pm-workshop/PersonaCardMessage.tsx` — 角色卡片渲染（122 行）
- `neuro-syntax-ide/src/lib/useAgentStream.ts` — Agent 流式通信 hook（733 行）
- `neuro-syntax-ide/src-tauri/src/lib.rs` — runtime_execute command（line 7850）
- `neuro-syntax-ide/src-tauri/src/agent_sdk_runtime.rs` — SDK Runtime 进程管理（465 行）

### Related Documents
- `neuro-syntax-ide/src/types.ts` — PartyPersona / PartyInsight / BMADSessionState 类型定义

### Related Features
- feat-bmad-party-mode (completed) — Party Mode 初始实现
- feat-bmad-prd (completed) — PRD 创建，作为 Party Mode 输出的下游消费者

## Technical Solution

### Runtime 切换为 SDK 模式（最高优先级）

**当前问题**：所有 Workshop Tab 硬编码 `runtimeId: 'claude-code'`，走 `ClaudeCodeRuntime`（`claude --print --output-format stream-json`），每次调用 spawn 新 claude 进程，`sessionId: null`。

**切换方案**：

1. **前端改动**（3 个文件，各改 1 行）：
   - `BrainstormPanel.tsx:147` — `runtimeId: 'claude-code'` → `'agent-sdk'`
   - `PartyModePanel.tsx:100` — 同上
   - `PartyModePanel.tsx:207-208` — invoke 调用中的 `runtimeId: 'claude-code'` → `'agent-sdk'`
   - `PrdCreationPanel.tsx:177` — 同上

2. **Rust 后端确认**：
   - `RuntimeRegistry` 已注册 `AgentSdkRuntime`（lib.rs:3882），`runtime_id = "agent-sdk"`
   - `runtime_execute` command (lib.rs:7850) 已支持按 runtime_id 路由到对应 Runtime 实例
   - `AgentSdkRuntime::execute()` 通过 Sidecar 调用 `@anthropic-ai/claude-agent-sdk`，流式返回 NDJSON
   - **无需新增 Rust 代码**，SDK 模式已完整可用

3. **Sidecar session 复用**：
   - `agent-sdk-bridge.mjs` 支持 session 概念，同一 session 内对话有状态
   - Workshop 组件可通过传入 `sessionId` 实现 session 复用（当前传 null）
   - Party Mode 的 Orchestrator 可使用持久 session，角色调用使用一次性 session

4. **向后兼容**：
   - CLI 模式仍保留在 RuntimeRegistry 中，用户可通过 Settings 切回
   - 后续可在 Settings 中新增「Workshop Runtime 类型」下拉选项
- 从 5 个硬编码角色扩展为 15-20 个角色库
- 新增角色分类：产品、技术、设计、质量、运营、安全
- 角色 prompt 模板化，支持动态参数注入（如项目上下文）

### Orchestrator 增强 (party-mode-prompts.ts)
- 首轮指令增加「角色选择」步骤：分析上下文 → 从角色库匹配 → 输出 roster
- 新增收敛轮 prompt：要求 Orchestrator 综合所有角色观点，生成结构化报告
- 输出 `<!-- workshop:party-report -->` 标记

### 进程管理 (SDK 模式基础上)
- 前端维护 SDK 调用池状态，控制并发数
- 超时监控：Rust 端 tokio::time::timeout 包装 SDK 调用

### 流水线编排 (PartyModePanel.tsx)
- `executePersonaSequence` 改为真正的流水线：
  - 每个角色执行完毕后，完整输出追加到 `previousResponses`
  - 下一个角色的 prompt 包含所有前序输出（非截断摘要）
  - prompt 指令要求角色必须回应前序观点
- 新增 `executeConvergenceRound`：最后一轮 Orchestrator 生成报告

### UI 变更
- 角色选择确认 UI：Orchestrator 推荐角色后，用户可勾选/取消
- 进程状态指示器：显示当前运行/排队/完成的角色数量
- 收敛报告卡片：渲染结构化评审报告
- 轮次指示器：显示当前第几轮 / 共几轮

## Acceptance Criteria (Gherkin)

### User Story
作为产品经理，我希望 Party Mode 能根据讨论主题自动选择合适的角色，有序地进行评审，并最终产出结构化的结论报告。

### Scenarios

#### Scenario 1: Workshop 切换为 SDK Runtime
```gherkin
Given 产品工坊的三个 Tab（头脑风暴/Party Mode/PRD 创建）当前使用 claude-code runtime
When 切换为 agent-sdk runtime 后
Then 所有 Tab 使用 AgentSdkRuntime 通过 Sidecar 执行
And 不再为每次调用 spawn 新的 claude 进程
And Sidecar 进程在 Workshop 会话期间保持活跃
And Workshop 关闭后 Sidecar 进程正确退出
```

#### Scenario 2: 动态角色分配
```gherkin
Given 用户在 Party Mode 输入一个技术方案评审主题
When Orchestrator 分析主题后
Then 系统从角色库中选择 3-5 个最匹配的角色
And 用户可以看到推荐角色列表并可调整
And 调整确认后开始讨论
```

#### Scenario 2: 角色选择确认
```gherkin
Given Orchestrator 推荐了 4 个角色
When 用户移除其中 1 个角色并添加另 1 个
Then 系统使用用户调整后的 3 个角色开始讨论
And 前端正确显示用户选择的角色卡片
```

#### Scenario 3: 流水线上下文传递
```gherkin
Given 角色执行顺序为 [Alex, Sally, Marcus]
When Alex 完成评审后
Then Sally 的 prompt 中包含 Alex 的完整评审内容
And Sally 的回复中明确回应了 Alex 的关键观点
And Marcus 的 prompt 包含 Alex 和 Sally 的完整评审
```

#### Scenario 4: 进程资源控制
```gherkin
Given 系统配置最大并发进程数为 3
When 4 个角色需要执行时
Then 前 3 个角色并行执行
And 第 4 个角色排队等待
And 任一角色完成后，第 4 个角色立即启动
And 所有角色完成后，子进程全部被回收
```

#### Scenario 5: 收敛报告生成
```gherkin
Given 配置最大讨论轮数为 2
When 第 2 轮所有角色完成发言后
Then Orchestrator 自动生成结构化评审报告
And 报告包含：共识点、分歧点、建议行动、风险提示
And 报告以卡片形式渲染在对话中
```

#### Scenario 6: 报告流入 PRD 创建
```gherkin
Given Party Mode 已生成收敛报告
When 用户切换到 PRD 创建 Tab
Then PRD 创建的上下文中包含 Party Mode 的报告内容
And PRD 可以引用报告中的建议行动和风险提示
```

#### Scenario 7: 进程超时保护
```gherkin
Given 配置进程超时时间为 120 秒
When 某个角色的执行超过 120 秒
Then 系统自动终止该角色的子进程
And 前端显示超时提示
And 其他角色继续正常执行
```

### UI/Interaction Checkpoints
- [ ] 角色推荐确认界面（可勾选/取消/搜索）
- [ ] 轮次进度指示器（Round 1/3, Round 2/3...）
- [ ] 进程状态面板（运行中/排队/完成/超时）
- [ ] 收敛报告专用卡片组件
- [ ] 从报告卡片一键跳转 PRD 创建

### General Checklist
- [ ] 向后兼容现有 Party Mode 对话格式
- [ ] persona-definitions.ts 角色库可扩展
- [ ] 进程参数（并发数/超时）可通过 Settings 配置
