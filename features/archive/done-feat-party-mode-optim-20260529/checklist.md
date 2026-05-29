# Checklist: feat-party-mode-optim

## Completion Checklist

### Development
- [x] 所有 tasks completed (7/9, 2 deferred)
- [x] 代码自测通过（TypeScript 编译无错误）
- [x] 向后兼容现有 Party Mode 对话

### 角色库
- [x] 角色从 5 个扩展到 16 个
- [x] 角色有完整 prompt + 分类 + expertise
- [x] 角色可通过分类/关键词搜索

### 动态角色选择
- [x] Orchestrator 根据主题推荐角色
- [x] 用户可确认/调整角色名单
- [x] 前端正确渲染角色选择 UI

### 进程管理
- [x] 最大并发进程数受控（配置 + UI 状态）
- [ ] 进程超时自动终止（配置存在，但未实现 AbortController）
- [x] 进程完成后资源回收
- [x] 无残留 claude -p 进程（切换为 SDK 模式）

### 流水线
- [x] 前序角色输出完整传递给后序角色
- [x] 角色间有明确的回应/互动
- [x] 无 400 字符截断限制（改为 2000 字符智能保留）

### 收敛
- [x] 最大轮数限制生效
- [x] 最终轮生成结构化报告
- [x] 报告包含共识/分歧/行动/风险
- [x] 报告可流入 PRD 创建 Tab

### Code Quality
- [x] 代码风格遵循 conventions（cn() / types.ts / Tailwind）
- [x] 类型定义集中在 types.ts
- [x] 无硬编码 API Keys

### Testing
- [ ] 单元测试：角色匹配逻辑
- [ ] 集成测试：完整 Party Mode 流程
- [ ] 边界测试：超时/进程上限/空角色

### Documentation
- [x] spec.md technical solution filled
- [x] persona-definitions.ts 新角色文档化

---

## Verification Record

| Date | Status | Summary |
|------|--------|---------|
| 2026-05-29 | PASS (6/8) | 6 scenarios PASS, 2 PARTIAL (parallel pool, timeout enforcement). Evidence: evidence/verification-report.md |
