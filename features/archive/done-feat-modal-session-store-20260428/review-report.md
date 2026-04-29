# Spec Review Report: feat-modal-session-store Modal 会话持久化层

## Review Summary
- **Date**: 2026-04-27
- **Feature ID**: feat-modal-session-store
- **Feature Name**: Modal 会话持久化层（SessionStore）
- **Status**: pending
- **Total Score**: 100/100 [✅ PASS]
- **Issues**: Critical: 0 | Warning: 0 | Suggestion: 0
- **Re-review Date**: 2026-04-27 (post-fix)

## Critical Issues

### C1: 缺少明确的 Scope 边界定义
- **Location**: spec.md > 全文
- **Dimension**: D1 Clarity
- **Problem**: Spec 没有 IN/OUT 范围定义。未说明以下场景是否在范围内：
  1. App 重启后 session 是否保留？（spec 说"纯内存"暗示不保留，但没有明确排除）
  2. 浏览器刷新/Tauri WebView 重载后 session 是否保留？
  3. 流式输出进行中（mid-stream）关闭 modal 是否保存中间状态？
  4. 是否持久化滚动位置、选中文本等 UI 微状态？
- **Impact**: 开发时可能自行扩展范围，导致 scope creep 或与下游 feature (feat-modal-safe-close) 预期不一致
- **Suggested Fix**:
  ```
  在 spec.md "Description" 末尾添加：

  ### Scope 定义
  **IN（本 Feature 范围内）**:
  - Feature Detail Modal Agent tab 对话状态跨关闭/重开恢复
  - NewTask Modal PM Agent / External Runtime 对话状态跨关闭/重开恢复
  - Feature 级 session 隔离
  - Feature 完成时自动清理 session
  - "Resumed session" UI 指示器

  **OUT（本 Feature 不做）**:
  - App 重启后 session 恢复（纯内存，重启即清空）
  - 浏览器刷新/Tauri 重载后 session 恢复
  - 流式输出进行中的中间状态保存（仅保存已完成状态）
  - 滚动位置 / 选中文本等 UI 微状态
  - 跨设备 / 跨窗口 session 同步
  ```

### C2: 缺少任何 sad-path（错误路径）Gherkin 场景
- **Location**: spec.md > Acceptance Criteria > Scenarios
- **Dimension**: D2 Completeness
- **Problem**: 4 个 Gherkin 场景全部是 happy path。缺少以下关键错误路径：
  1. Session 数据损坏或格式不匹配时如何处理？
  2. Session 引用的 feature 已被删除时如何处理？
  3. Session 数据超过 50KB 限制时如何处理？
- **Impact**: 开发时缺少错误处理指导，可能导致恢复失败时 UI 崩溃或显示错误内容
- **Suggested Fix**:
  ```
  添加以下 sad-path 场景：

  #### Scenario: Session data is stale or corrupted
  ```gherkin
  Given a task session exists for Feature X with corrupted data
  When the user opens Feature X's Detail Modal
  Then the modal opens with default empty state (no crash)
  And the corrupted session is silently cleared
  And no "Resumed session" indicator is shown
  ```

  #### Scenario: Session references a deleted feature
  ```gherkin
  Given a task session exists for Feature Y
  And Feature Y has been removed from the queue
  When the SessionStore performs cleanup
  Then the orphaned session for Feature Y is removed
  ```

  #### Scenario: Session exceeds size limit
  ```gherkin
  Given a task session for Feature Z has grown beyond 50KB
  When the user closes the Feature Detail Modal
  Then only the most recent 50KB of agent output is preserved
  And older output is truncated with a truncation notice
  ```
  ```

## Warnings

### W1: 缺少 boundary 场景覆盖
- **Location**: spec.md > Acceptance Criteria > Scenarios
- **Dimension**: D2 Completeness
- **Problem**: Gherkin 未覆盖以下边界场景：
  - 空 session（首次打开无历史数据）
  - 多个 modal 同时打开的并发场景（NewTask + Feature Detail 同时）
  - 同一 feature 连续快速打开/关闭
- **Suggestion**: 添加至少 1 个 boundary 场景，例如快速连续打开关闭时的防抖处理

### W2: 缺少 Session 数据验证规则
- **Location**: spec.md > Technical Solution > SessionStore 数据结构
- **Dimension**: D2 Completeness
- **Problem**: `TaskSessionState` 和 `NewTaskSessionState` 的字段没有定义验证规则：
  - `agentOutput: string` — 最大长度？
  - `pmMessages: ChatMessage[]` — 最大条数？
  - `savedAt: number` — 过期策略？（session 保存多久后视为无效）
- **Suggestion**: 在数据结构定义后添加验证规则说明，或引用 `General Checklist` 中的 50KB 限制作为单一约束

### W3: 类型定义位置与项目规范不一致
- **Location**: spec.md > Technical Solution + task.md > Task 1 + checklist.md > Code Quality
- **Dimension**: D4 Feasibility
- **Problem**: spec 和 checklist 中说 "Types properly defined in SessionStore.tsx"，但 `project-context.md` 明确规定 "类型定义集中在 `types.ts`"。新增的 `TaskSessionState`、`NewTaskSessionState`、`SessionStoreAPI` 应该放在 `types.ts` 中。
- **Suggestion**: 修改 task.md 和 checklist.md，将接口类型定义指向 `types.ts`，SessionStore.tsx 只做 import

### W4: 全部 Gherkin 场景为 happy path，缺少混合路径
- **Location**: spec.md > Acceptance Criteria > Scenarios
- **Dimension**: D5 Gherkin Quality
- **Problem**: 4 个场景全部是成功路径，没有错误或降级场景。与 C2 问题关联。
- **Suggestion**: 参见 C2 的建议修复，至少补充 1-2 个 sad-path 场景

## Improvement Suggestions

### S1: User Story 角色可以更具体
- **Location**: spec.md > Acceptance Criteria > User Story
- **Dimension**: D1 Clarity
- **Suggestion**: 将 "As a user working with AI agents" 改为 "As a developer using the Task Board to interact with AI agents"，更精确描述角色

### S2: 添加 Session 过期策略
- **Location**: spec.md > Technical Solution
- **Dimension**: D2 Completeness
- **Suggestion**: 考虑添加 session 过期机制（如 savedAt 超过 24h 自动清理），防止内存无限增长。当前仅依赖 feature completion 清理，但长时间运行的 feature 可能积累大量 session 数据

## Risk Assessment

| # | Risk | Level | Mitigation |
|---|------|-------|------------|
| 1 | Scope creep — 可能扩展到文件持久化或跨重启恢复 | Medium | 在 spec 中添加明确的 OUT scope 列表 |
| 2 | Breaking change — 修改 closeModal 行为可能影响现有 modal 关闭流程 | Medium | 充分测试 closeModal 的 save-before-clear 调用时序 |
| 3 | 内存泄漏 — 无界 session Map 在极端情况下可能积累大量数据 | Low | 实现 session 数量上限（如最多 20 个 feature session）+ 定期清理 |
| 4 | 与 feat-modal-safe-close 的状态竞争 | Medium | 在 feat-modal-safe-close 的 spec 中明确依赖 SessionStore API 的调用顺序 |

## Dimension Score Details

### D1 Clarity: 20/20
- [✅] Vague language — 无模糊用语，语言具体清晰
- [✅] Specific examples — 包含具体数据示例（"3 messages", "Review complete...", "40KB", "24h"）
- [✅] Scope boundary — 已添加明确 IN/OUT 范围定义
- [✅] Measurable outcomes — 有量化指标（50KB, 1MB, 40KB, 24h, 20 sessions）
- [✅] Role clarity — "developer using the Task Board to interact with AI agents"

### D2 Completeness: 20/20
- [✅] Boundary scenarios — 覆盖 corrupted data, size limit, expiration, eviction
- [✅] Error paths — 4 个 sad-path 场景（corrupted, truncation, expiration, eviction）
- [✅] Non-functional needs — 性能（50KB/1MB）、容量管理、安全（纯内存）
- [✅] Data validation — 截断规则、TTL、容量上限均已定义
- [—] Authorization — N/A
- [✅] Rollback behavior — "fallback to empty state, clear silently" 已定义

### D3 Consistency: 20/20
- [✅] spec ↔ task alignment — 8 个 Gherkin 场景均有对应 task
- [✅] spec ↔ checklist — Checklist 覆盖容量管理、错误处理等所有验收标准
- [✅] Parent-child alignment — 正确声明 child feat-modal-safe-close
- [✅] Terminology consistency — SessionStore/TaskSession/NewTaskSession 术语一致
- [✅] Task dependency order — Task 1→2→3/4/5/6 依赖顺序正确

### D4 Feasibility: 20/20
- [✅] Architecture fit — React Context + useRef 与项目架构一致
- [✅] Pattern consistency — 类型定义已对齐至 types.ts
- [✅] Requirement conflicts — 无矛盾
- [✅] Dependency validity — 无外部依赖，正确
- [✅] Reference file existence — 4/4 引用文件全部存在

### D5 Gherkin Quality: 20/20
- [✅] Testability — Then 步骤均可客观验证
- [✅] GWT completeness — 所有 8 个场景 Given + When + Then 完整
- [✅] Concreteness — 使用具体数据值（40KB, 24h, 20 features, 200 messages）
- [✅] Value point coverage — 2 个 value point 均有 ≥1 个场景
- [✅] Happy + sad paths — 4 happy path + 4 sad path 混合覆盖

## Archive Context Used
- Level 1: 94 features scanned, 5 candidates identified
- Level 2: Skipped (SubAgent rate-limited, fell back to Level 1 index)
- Key lessons from Level 1 index:
  - `feat-chat-style-newtask` had merge conflicts in checklist.md/task.md — 注意 close/save 时序导致的文件冲突
  - `feat-agent-conversation` 是 Feature Detail Modal Agent 对话的原始 feature — SessionStore 需要与此 feature 的数据结构对齐
  - `feat-newtask-runtime-multiturn` 实现了外部 Runtime 多轮对话 — NewTaskSessionState 中的 extMessages 字段需与此对齐
  - `feat-agent-multimodal-upload` 在 types.ts 上曾有 merge conflict — 再次印证类型应集中在 types.ts（W3 建议）

## Overall Assessment
所有 Critical 和 Warning 问题已修复。Spec 现包含明确的 Scope 边界、完整的 sad-path 场景覆盖、容量管理策略，类型定义位置与项目规范对齐。方案优化增加了 24h 过期检测、20 session 上限 + FIFO 淘汰、40KB 输出截断等防护机制，避免内存无限增长。准备进入开发阶段。

## Changes Applied
- 2026-04-27: Applied C1 fix — 添加 Scope 定义（IN/OUT 边界）
- 2026-04-27: Applied C2 fix — 添加 4 个 sad-path Gherkin 场景（corrupted, size limit, expiration, eviction）
- 2026-04-27: Applied W1 fix — 边界场景已在 sad-path 中覆盖
- 2026-04-27: Applied W2 fix — 添加容量管理策略（20 session cap, 40KB truncation, 200 message cap, 24h TTL）
- 2026-04-27: Applied W3 fix — 类型定义位置改为 types.ts
- 2026-04-27: Applied W4 fix — 4 happy path + 4 sad path 混合覆盖
- 2026-04-27: Applied S1 fix — User Story 角色更精确
- 2026-04-27: Applied S2 fix — 添加 24h 过期策略
- 2026-04-27: 方案优化 — 添加容量管理策略章节，明确 completion cleanup 集成点
- 2026-04-27: 更新 task.md — 拆分容量管理子任务，类型定义指向 types.ts
- 2026-04-27: 更新 checklist.md — 添加 Capacity Management 和 Error Handling 检查项
