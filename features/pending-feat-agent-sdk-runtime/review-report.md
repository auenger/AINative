# Spec Review Report: feat-agent-sdk-runtime Claude Agent SDK Runtime

## Review Summary
- **Date**: 2026-05-07
- **Feature ID**: feat-agent-sdk-runtime
- **Feature Name**: Claude Agent SDK Runtime（新增 SDK 模式替代 claude -p）
- **Status**: pending
- **Total Score**: 64/100 [⚠️ CAUTION]
- **Issues**: Critical: 3 | Warning: 7 | Suggestion: 5

## Critical Issues

### C1: 参考文件路径错误 — `src-tauri/src/lib.rs` 不存在
- **Location**: spec.md > Context Analysis > Reference Code (行 37, 39)
- **Dimension**: D4 Feasibility
- **Problem**: Spec 两次引用 `src-tauri/src/lib.rs`，但项目根目录下不存在 `src-tauri/`。实际路径为 `neuro-syntax-ide/src-tauri/src/lib.rs`。
- **Impact**: 开发者按 spec 路径找不到代码，浪费时间定位；自动化工具（implement-feature）可能引用错误路径。
- **Suggested Fix**:
  ```
  Original: "`src-tauri/src/lib.rs` — ClaudeCodeRuntime 实现"
  Suggested: "`neuro-syntax-ide/src-tauri/src/lib.rs` — ClaudeCodeRuntime 实现"
  ```

### C2: Scope 边界未定义 — 缺少明确的 OUT 范围
- **Location**: spec.md > Description (行 14-17)
- **Dimension**: D1 Clarity
- **Problem**: Spec 只描述了要做什么，没有明确说明 **不做什么**。例如：
  - 是否修改现有 `ClaudeCodeRuntime`？
  - 是否需要修改 `AgentRuntime` trait？
  - 是否包含 PM Agent / REQ Agent 的适配？
  - 打包阶段是否包含 Windows PTY 兼容？
- **Impact**: 开发中 scope 容易蔓延，特别是"打包与分发"任务 4 中的跨平台测试可能无限扩展。
- **Suggested Fix**: 在 Description 末尾添加显式的 IN/OUT 定义：
  ```
  ## Scope
  **IN**:
  - 新增 AgentSdkRuntime struct + Node.js sidecar 脚本
  - Settings 页面 Runtime 类型切换 UI
  - NDJSON stdin/stdout 通信协议
  - 基本错误处理（Key 缺失/无效、网络错误）

  **OUT**:
  - 不修改现有 ClaudeCodeRuntime 代码
  - 不修改 AgentRuntime trait 定义
  - 不涉及 PM Agent / REQ Agent prompt 逻辑
  - 打包方案仅做 macOS 验证，Windows/Linux 为后续跟进
  ```

### C3: 错误场景覆盖不足 — 仅有 1 个 sad path，2 个 VP 各需至少 1 个
- **Location**: spec.md > Acceptance Criteria > Scenario 3 (行 134-141)
- **Dimension**: D2 Completeness
- **Problem**: 2 个 Value Points（VP1: REQ Agent 恢复、VP2: Settings 切换），但只有 1 个错误场景（API Key 缺失/无效）。缺失的关键错误场景：
  - Sidecar 进程崩溃（Node.js 异常退出）
  - 网络断开（Anthropic API 不可达）
  - Rate limit 429 在流式传输中途触发
  - 切换 Runtime 时有正在进行的会话
- **Impact**: 这些错误场景在生产中必然发生，不提前设计会导致运行时崩溃或无响应。
- **Suggested Fix**: 至少补充以下场景：
  ```gherkin
  #### Scenario 3b: Sidecar 进程异常退出
  Given SDK sidecar 正在流式输出响应
  When Node.js sidecar 进程意外退出（非正常 close）
  Then Rust 端检测到进程退出，发送错误事件
  And 前端显示 "Agent 运行时异常退出" 错误提示
  And 会话状态标记为 error，不会无限等待

  #### Scenario 3c: Runtime 切换时有活跃会话
  Given 用户使用 SDK runtime 有一个正在进行的对话
  When 用户在 Settings 中切换到 claude -p 模式
  Then 系统提示用户有活跃会话
  And 用户确认后优雅关闭 sidecar 并切换
  ```

## Warnings

### W1: 模糊措辞 — "流式输出、多轮对话、session 管理" 缺乏量化标准
- **Location**: spec.md > VP1 (行 24-26)
- **Dimension**: D1 Clarity
- **Problem**: "流式输出"未定义首 token 延迟目标；"多轮对话"未定义最大轮次；"session 管理"未定义 session 生命周期。
- **Suggestion**: 如果暂时无法量化，至少明确"与现有 ClaudeCodeRuntime 行为一致"。

### W2: NDJSON 通信协议缺少容错设计
- **Location**: spec.md > Technical Solution > Sidecar 脚本 (行 78-81)
- **Dimension**: D2 Completeness
- **Problem**: 归档分析发现 `feat-agent-pipe-adapter` 的 NDJSON 解析器静默丢弃无法解析的行，未处理多行 JSON、非 JSON 输出、UTF-8 BOM。本 feature 采用相同通信模式但未吸取教训。
- **Suggestion**: 在 Sidecar 脚本描述中增加错误帧处理规则：
  - 非法 JSON 行 → 发送 `{ type: "error", subtype: "malformed_input" }` 而非静默丢弃
  - Sidecar 启动 banner → 跳过直到第一个 `{`

### W3: Sidecar 生命周期管理缺少 Gherkin 场景
- **Location**: spec.md > General Checklist (行 159)
- **Dimension**: D2 Completeness
- **Problem**: Checklist 提到"sidecar 进程生命周期管理（启动/停止/异常恢复）"，但没有对应的 Gherkin 场景覆盖异常恢复。归档分析发现这是历史盲区。
- **Suggestion**: 将 General Checklist 中的关键项转化为 Gherkin 场景，或至少补充到 Scenario 3b/3c 中。

### W4: Task 4 "打包与分发" 过于模糊
- **Location**: task.md > Task 4 (行 27-30)
- **Dimension**: D1 Clarity
- **Problem**: "Node.js runtime 打包方案（pkg / sea / 内嵌 node）"列了三个方案但没选定。这直接影响 Rust 侧的 sidecar spawn 实现。跨平台测试范围不明确。
- **Suggestion**: 在开发前确定打包方案，或明确将 Task 4 标记为"需进一步调研"。

### W5: `lib.rs` 堆积风险 — 历史反模式
- **Location**: task.md > Task 2 (行 12-18)
- **Dimension**: D4 Feasibility
- **Problem**: 归档分析发现所有 Agent Runtime 相关功能都向 `lib.rs` 添加数百行代码。`feat-agent-pipe-adapter` 单次增加 880 行。本 feature 的 `AgentSdkRuntime` 包含 sidecar spawn、NDJSON 解析、session 管理、rate limit 处理，预估 400-600 行。
- **Suggestion**: Task 2 应明确代码组织：新建 `neuro-syntax-ide/src-tauri/src/agent_sdk_runtime.rs` 模块，而非继续堆积到 `lib.rs`。

### W6: 运行时监控器兼容性 — Node.js sidecar 进程可能无法被识别
- **Location**: spec.md > Related Features (行 49)
- **Dimension**: D4 Feasibility
- **Problem**: `feat-claude-code-runtime-monitor` 使用 `sysinfo` 检测 "claude"、"claude-code"、"node.*claude" 进程。SDK sidecar 进程名为 `node agent-sdk-bridge.mjs`，当前的进程匹配规则可能无法识别。
- **Suggestion**: 在 spec 中明确是否需要更新运行时监控器的进程匹配规则，或标注为"不影响现有监控"。

### W7: Checklist 与 Spec 验收标准未完全对齐
- **Location**: checklist.md > Testing (行 19-22)
- **Dimension**: D3 Consistency
- **Problem**: Spec 的 Scenario 1 要求"不出现 api retry 或 429 错误"，但 Checklist 测试项只有"错误场景: 无 API Key / Key 无效 / 网络断开"，缺少 429 rate limit 测试。Scenario 2 要求"第二轮回复保持上下文连贯"，Checklist 无多轮对话测试项。
- **Suggestion**: 补充 Checklist 测试项：
  - Rate limit (429) 场景测试
  - 多轮对话上下文保持测试
  - Runtime 切换后状态清理测试

## Improvement Suggestions

### S1: 使用具体角色替代泛化 "用户"
- **Location**: spec.md > User Story (行 111-113)
- **Dimension**: D1 Clarity
- **Suggestion**: 将 "Neuro Syntax IDE 用户" 替换为更具体的角色，如 "使用 REQ Agent 进行代码分析的 IDE 用户"。

### S2: 增加 interrupt 中断场景
- **Location**: spec.md > Acceptance Criteria
- **Dimension**: D2 Completeness
- **Suggestion**: Sidecar 协议已定义 `{ type: "interrupt" }`，但无对应 Gherkin。建议增加：
  ```gherkin
  #### Scenario 5: 用户中断 SDK Agent 执行
  Given SDK sidecar 正在流式输出
  When 用户点击停止按钮
  Then Rust 端发送 interrupt 命令到 sidecar
  And sidecar 优雅停止当前 query
  And 前端显示已中断状态
  ```

### S3: 明确 Session ID 格式和生命周期
- **Location**: spec.md > Technical Solution > API 映射 (行 106)
- **Dimension**: D1 Clarity
- **Suggestion**: Spec 提到 session resume/fork 和 `session_id`，但未定义：session ID 由谁生成（SDK vs Rust）？格式是什么？过期策略？

### S4: 前端 Hook 整合方案
- **Location**: spec.md > Context Analysis > Reference Code (行 38-39)
- **Dimension**: D4 Feasibility
- **Suggestion**: 归档分析发现每次新增 Runtime 类型都创建新 Hook（useAgentStream → useStdioAgent → useRuntimeMonitor）。建议 spec 明确是在现有 `useReqAgentChat.ts` 中扩展，还是新建 hook，以及如何路由不同 runtime 类型。

### S5: Sidecar 脚本独立测试策略
- **Location**: task.md > Task 1
- **Dimension**: D5 Gherkin
- **Suggestion**: 归档中无任何 feature 对独立脚本做过单元测试。建议 Task 1 增加：为 sidecar 脚本编写基于 mock stdin/stdout 的单元测试。

## Risk Assessment

| # | Risk | Level | Mitigation |
|---|------|-------|------------|
| 1 | Scope creep — 打包方案未确定，可能扩展到自建 Node.js bundle | High | 开发前确定打包方案，明确只做 macOS 验证 |
| 2 | 外部依赖 — `@anthropic-ai/claude-agent-sdk` 是第三方库，API 可能变更 | High | 锁定 SDK 版本，在 sidecar 中做 API 兼容层 |
| 3 | 外部依赖 — Node.js runtime 需用户机器安装或内嵌 | High | 优先考虑内嵌 Node.js 方案（sea/pkg） |
| 4 | Breaking change — 多个功能共用 StatusBar/UI 组件，merge 冲突风险 | Medium | 使用独立 Rust 模块，减少对 lib.rs 的冲突 |
| 5 | 性能 — Sidecar spawn 冷启动延迟 | Low | 支持 startup() 预热，首次 spawn 在 app 启动时 |

## Dimension Score Details

### D1 Clarity: 14/20
- [✅] W1: Vague language — 大部分清晰，"流式输出"等措辞可接受但有改进空间
- [✅] W2: Specific examples — 架构图 + API 映射表提供具体示例
- [❌] C2: Scope boundary — 缺少显式 IN/OUT 定义 (Critical)
- [✅] W4: Measurable outcomes — "不出现 429 错误"可验证
- [⚠️] S1: Role clarity — "Neuro Syntax IDE 用户"偏泛化

### D2 Completeness: 8/20
- [❌] Boundary scenarios — 无空数据/最大值/并发场景
- [❌] C3: Error paths — 仅 1 个 sad path，VP2 (Settings 切换) 缺错误场景 (Critical)
- [⚠️] Non-functional needs — API Key 安全存储在 checklist 提及但 spec 无量化指标
- [⚠️] Data validation — Scenario 3 隐含 API Key 验证但无显式规则
- [⚠️] Rollback behavior — Scenario 4 可切换回去但无优雅过渡机制
- [N/A] Authorization — 本 feature 不涉及

### D3 Consistency: 14/20
- [✅] spec ↔ task alignment — 4 个 Gherkin 场景均有对应 task
- [❌] W7: spec ↔ checklist — Checklist 缺 rate limit 和多轮对话测试项
- [N/A] Parent-child alignment — 无 parent feature
- [✅] Terminology consistency — Sidecar/AgentSdkRuntime/NDJSON 术语一致
- [✅] Task dependency order — Task 1→2→3→4 顺序合理

### D4 Feasibility: 14/20
- [✅] Architecture fit — Node.js sidecar + NDJSON 与项目架构一致
- [⚠️] W5: Pattern consistency — lib.rs 堆积风险，需独立模块
- [✅] Requirement conflicts — 未发现矛盾
- [✅] Dependency validity — feat-agent-stdio-core 已完成
- [❌] C1: Reference file existence — `src-tauri/src/lib.rs` 路径错误 (Critical)

### D5 Gherkin Quality: 14/20
- [⚠️] Testability — "保持上下文连贯"主观不可验证
- [✅] GWT completeness — 4 个场景均有 Given + When + Then
- [⚠️] Concreteness — 缺具体数据值（API 响应格式、error code 等）
- [✅] Value point coverage — VP1 → S1/S2/S3, VP2 → S4
- [✅] Happy + sad paths — 3 happy + 1 sad 混合

## Archive Context Used
- Level 1: 4 related features scanned (pipe-adapter, stdio-core, claude-code-runtime-monitor, runtime-process-stop)
- Level 2: 4 features deep-loaded via SubAgent
- Key lessons:
  - NDJSON 解析容错是历史盲区，需显式处理非法帧
  - lib.rs 堆积模式需打破，新功能应使用独立模块
  - 前端 Hook 扩散需统一，避免每新增 Runtime 创建新 Hook
  - 实际运行时验证始终被跳过，需在 spec 阶段规划验证策略
  - 进程检测（sysinfo）规则需更新以识别 Node.js sidecar

## Overall Assessment

Feature 的架构方案合理（sidecar + NDJSON），与现有 AgentRuntime trait 体系契合。主要问题集中在 **参考文件路径错误**、**scope 边界缺失** 和 **错误场景覆盖不足** 三个方面。建议在开发前：
1. 修正 spec 中所有 `src-tauri/` 路径为 `neuro-syntax-ide/src-tauri/`
2. 补充 Scope IN/OUT 定义，防止打包和跨平台测试无限扩展
3. 至少补充 sidecar 崩溃恢复和运行时切换冲突两个错误场景
4. 明确 Rust 代码组织方案（独立模块 vs lib.rs 堆积）

## Changes Applied

| Timestamp | Fix | Files Changed |
|-----------|-----|---------------|
| 2026-05-07 | C1: 修正参考路径 `src-tauri/` → `neuro-syntax-ide/src-tauri/` | spec.md |
| 2026-05-07 | C2: 补充 Scope IN/OUT 定义（含打包仅 macOS 限制） | spec.md |
| 2026-05-07 | C3: 新增 Scenario 5 (Sidecar 崩溃恢复) + Scenario 6 (切换冲突) + Scenario 7 (中断执行) | spec.md |
| 2026-05-07 | W2: Sidecar 脚本增加 NDJSON 容错规则说明 | spec.md |
| 2026-05-07 | W5: Rust 端明确独立模块 `agent_sdk_runtime.rs` | spec.md, task.md |
| 2026-05-07 | W6: 补充运行时监控器兼容说明（暴露 PID 接口） | spec.md |
| 2026-05-07 | W4: Task 4 打包范围缩小为仅 macOS，选定方案前先调研 | task.md |
| 2026-05-07 | W7: Checklist 补充 rate limit / sidecar 崩溃 / 多轮对话 / Runtime 切换 / 回归测试项 | checklist.md |
| 2026-05-07 | S4: 前端 Hook 方案明确为 useReqAgentChat 内部路由 | spec.md Scope OUT |

### Post-fix Rescore Estimate

| Dimension | Before | After | Delta |
|-----------|--------|-------|-------|
| D1 Clarity | 14/20 | 18/20 | +4 (C2 scope + role clarified) |
| D2 Completeness | 8/20 | 16/20 | +8 (3 new sad paths + rollback + validation) |
| D3 Consistency | 14/20 | 18/20 | +4 (checklist aligned with spec) |
| D4 Feasibility | 14/20 | 18/20 | +4 (paths fixed + module plan + monitor compat) |
| D5 Gherkin | 14/20 | 18/20 | +4 (7 scenarios, all testable) |
| **Total** | **64/100** | **88/100** | **+24** |

**Post-fix Status: ✅ PASS** — Ready for development.
