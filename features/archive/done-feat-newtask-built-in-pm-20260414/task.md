# Tasks: feat-newtask-built-in-pm

## Task Breakdown

### 1. Prompt 设计
- [x] 设计独立的 "Feature Creation PM" system prompt
- [x] Prompt 包含 feature-workflow 文档结构知识（spec/task/checklist）
- [x] Prompt 包含价值点分析、Gherkin scenario 生成引导
- [x] Prompt 包含复杂度评估和拆分建议策略

### 2. 代码集成
- [x] 将新 prompt 集成到 useAgentChat.ts，替换当前 PM_SYSTEM_PROMPT
- [x] 确保新 prompt 不引用项目级 PM Agent 的任何内容
- [x] 更新 greeting message 以反映 Feature Creation PM 定位

### 3. 质量验证
- [ ] 测试多轮需求澄清对话质量
- [ ] 验证生成的 feature plan 符合 feature-workflow 模板
- [ ] 对比新旧 prompt 的 feature plan 输出质量

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-14 | Task 1 & 2 完成 | 设计 FEATURE_CREATION_PM_PROMPT，集成到 useAgentChat.ts，更新 greeting |
