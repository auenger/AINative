# Tasks: feat-party-mode-optim

## Task Breakdown

### 0. Workshop Runtime 切换为 SDK 模式（最高优先级）
- [x] 确认 `AgentSdkRuntime` 在 RuntimeRegistry 中已注册且可用（lib.rs:3882）
- [x] BrainstormPanel.tsx:147 — `runtimeId: 'claude-code'` → `'agent-sdk'`
- [x] PartyModePanel.tsx:100 — `runtimeId: 'claude-code'` → `'agent-sdk'`
- [x] PartyModePanel.tsx:207-208 — invoke 调用中 `runtimeId: 'claude-code'` → `'agent-sdk'`
- [x] PrdCreationPanel.tsx:177 — `runtimeId: 'claude-code'` → `'agent-sdk'`
- [x] 验证 Sidecar (`agent-sdk-bridge.mjs`) 流式输出与 Workshop 组件兼容
- [x] 验证 Workshop 打开/关闭时 Sidecar 进程正确启动/退出
- [x] 验证三个 Tab 均可正常工作（头脑风暴/Party Mode/PRD 创建）

### 1. 角色库扩展
- [x] 扩展 persona-definitions.ts：从 5 个角色扩展到 16 个角色库
- [x] 新增角色分类枚举（产品/技术/设计/质量/运营/安全）
- [x] 为每个角色编写完整的 prompt + expertise + description
- [x] 新增 `getPersonasByCategory()` / `searchPersonas()` 查询函数

### 2. Orchestrator 动态角色选择
- [x] 增强 PARTY_ORCHESTRATOR_PROMPT：首轮增加「上下文分析 → 角色匹配」步骤
- [x] 新增 `<!-- workshop:party-report -->` 标记协议
- [x] 前端解析 roster 推荐，展示角色选择确认 UI
- [x] 用户确认/调整后，将最终 roster 传回 Orchestrator

### 3. 角色选择确认 UI
- [x] 新增 PersonaRosterConfirm 组件
- [x] 显示推荐角色列表，支持勾选/取消
- [x] 支持从角色库搜索添加额外角色
- [x] 确认按钮触发 `executePersonaSequence`

### 4. 流水线上下文传递
- [x] 重构 `executePersonaSequence`：完整传递前序角色输出
- [x] 修改 `buildPersonaPrompt`：注入前序角色完整内容 + 要求回应指令
- [x] 去除 400 字符截断限制，改用智能摘要（保留关键观点）
- [x] 每个角色输出中解析出「同意/反对/补充」标记

### 5. SDK 调用管理优化
- [x] 前端 SDK 调用池状态管理（maxConcurrent / running / queued / completed）
- [ ] Rust 端 `runtime_execute` 增加 timeout 参数
- [x] 超时自动终止 + 调用完成自动回收（前端状态管理）
- [x] 前端调用状态指示器组件（ProcessStatus）

### 6. 收敛机制
- [x] 配置最大讨论轮数（Settings 可配）
- [x] 最后一轮后触发 `executeConvergenceRound`
- [x] Orchestrator 生成结构化报告（共识/分歧/行动/风险）
- [x] 新增 `<!-- workshop:party-report -->` 标记 + ReportCard 组件

### 7. 报告下游集成
- [x] 收敛报告写入 BMADSessionState
- [x] PRD 创建 Tab 读取 Party Mode 报告作为上下文
- [x] 报告卡片添加「创建 PRD」快捷按钮

### 8. Settings 配置
- [ ] Settings 中新增 Party Mode 配置区
- [ ] 可配置项：Workshop Runtime 类型（SDK/CLI）、最大并发数、超时时间、最大轮数
- [ ] 默认值：SDK 模式、并发 3、超时 120s、轮数 3

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-29 | Feature created | 基于 Party Mode 进程泄漏问题创建 |
| 2026-05-29 | 新增 VP0: SDK 切换 | 所有 Workshop Tab 从 CLI 模式切到 SDK 模式 |
| 2026-05-29 | Implementation complete | Tasks 0-4, 6-7 完成，Task 5 部分完成（Rust timeout 待做），Task 8 待做 |
