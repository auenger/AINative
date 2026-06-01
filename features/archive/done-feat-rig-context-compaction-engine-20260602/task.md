# Tasks: feat-rig-context-compaction-engine

## Task Breakdown

### 1. 基础设施 — compact_messages 函数
- [x] 在 `rig_runtime.rs` 新增 `CompactionResult` 结构体
- [x] 实现 `compact_messages()` 函数：滑动窗口裁剪逻辑
- [x] 保留第一条 user message + 最近 N 对 assistant+tool_result
- [x] 实现摘要消息生成：将被裁剪消息的关键信息提取为结构化摘要
- [x] 单元测试：验证裁剪后 messages 结构正确

### 2. Tool Loop 集成
- [x] 修改 `run_rig_agent_tool_loop()` 中每轮迭代结束后的 token 检查逻辑
- [x] 将硬编码 60k 替换为从配置读取的 context_window_tokens
- [x] 加入 compaction trigger 判断（`total_input_tokens >= threshold * trigger_ratio`）
- [x] 触发时调用 `compact_messages()` 并更新 messages 数组
- [x] 输出压缩日志到日志面板

### 3. LlmConfig 扩展
- [x] `lib.rs` 中 `LlmConfig` 新增字段：`compaction_trigger_ratio`, `compaction_keep_recent`, `compaction_strategy`
- [x] 所有新字段提供默认值（向后兼容现有 settings）
- [x] `read_settings` / `write_settings` 支持新字段

### 4. 前端 Settings UI
- [x] `SettingsView.tsx` LLM 配置区新增 compaction 配置项
- [x] 添加 trigger ratio 滑块/输入（0.5-0.95，默认 0.75）
- [x] 添加 keep recent 数量输入（1-10，默认 4）
- [x] 添加 strategy 下拉选择（sliding_window / summarize）
- [x] `types.ts` 更新对应 TypeScript 类型

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-06-01 | Feature created | 初始 task breakdown |
| 2026-06-02 | All tasks completed | cargo check passes; TS pre-existing errors only |
