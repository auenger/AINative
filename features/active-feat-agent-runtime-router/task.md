# Tasks: feat-agent-runtime-router

## Task Breakdown

### 1. Rust 后端 — 路由引擎核心
- [x] 定义 `TaskCategory` 枚举（code_generation, code_review, requirements, testing, general）
- [x] 实现 `TaskClassifier`（基于关键词/正则匹配任务类型）
- [x] 定义 `RoutingRule` 结构（category → runtime_id, priority）
- [x] 实现 `RouterEngine`（规则匹配 + runtime 选择）

### 2. Rust 后端 — Fallback 策略
- [x] 定义 `FallbackChain`（有序 runtime 列表）
- [x] 实现自动降级逻辑（首选不可用 → 按序尝试备选）
- [x] Fallback 日志记录（记录切换原因）

### 3. Rust 后端 — 路由配置
- [x] 路由规则 YAML 格式定义
- [x] 默认路由策略（内置 sensible defaults）
- [x] 用户自定义路由规则加载
- [x] 规则验证（检查引用的 runtime 是否存在）

### 4. Rust 后端 — Tauri IPC Commands
- [x] `submit_task` — 提交任务（自动路由）
- [x] `get_routing_rules` — 获取当前路由规则
- [x] `update_routing_rules` — 更新路由规则
- [x] `get_task_routing_decision` — 查询任务路由决策

### 5. Tauri Events
- [x] `router://task-routed` — 任务路由决策事件（含 runtime + 原因）
- [x] `router://fallback` — fallback 触发事件

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-03 | Created | Feature created |
| 2026-04-03 | Implemented | All tasks implemented, Rust compilation verified |
