# Tasks: fix-queue-resilient-parsing

## Task Breakdown

### 1. Rust 数据结构兼容
- [x] FeatureNode 添加 `#[serde(alias = "depends_on")]` 字段别名
- [x] ParentEntry 添加 `children` 别名映射到 `features`
- [x] 确认所有非必须字段有 `#[serde(default)]`
- [x] 添加 `parent` 可选字段支持
- [x] 保持默认忽略未知字段行为（不使用 deny_unknown_fields）

### 2. 两阶段解析实现
- [x] 改造 `fetch_queue_state`：先用 `serde_yaml::Value` 解析顶层
- [x] 实现逐条 FeatureNode 解析，单条失败 skip + log
- [x] 实现逐条 ParentEntry 解析，单条失败 skip + log
- [x] 对顶层各 section 做空值兜底（section 不存在则用空数组）

### 3. 日志与错误处理
- [x] 解析失败条目用 `eprintln!` 记录 warning
- [x] 前端 error 状态已有友好提示（复用现有 error state）

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-14 | Implementation complete | Rust compilation passes, all tasks done |
