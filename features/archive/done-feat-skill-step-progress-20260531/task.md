# Tasks: feat-skill-step-progress

## Task Breakdown

### 1. 类型定义 (types.ts)
- [x] 新增 `StepProgressPayload` 接口
- [x] 在 `WorkshopMessageType` 联合类型中追加 `'step-progress'`

### 2. 标记解析管道扩展
- [x] 创建 `src/lib/bmad/workshop-markers.ts` 独立模块（parseStepProgressMarker + extractLatestStepProgress）
- [x] `BrainstormPanel` 中集成 step-progress 解析（最高优先级，先于其他标记）
- [x] `PartyModePanel` 中集成 step-progress 解析
- [x] `PrdCreationPanel` 中集成 step-progress 解析
- [x] 正则匹配 `<!-- workshop:step-progress current="N" total="M" label="..." -->`
- [x] 从原始文本中移除标记，返回结构化 payload

### 3. SkillStepProgress 组件
- [x] 新建 `src/components/pm-workshop/SkillStepProgress.tsx`
- [x] 实现进度条 + 步骤文字 UI
- [x] 完成状态特殊渲染（绿色对勾 + "完成"）
- [x] 进度条宽度 transition 动画（300ms ease-out）

### 4. 聊天面板集成
- [x] `WorkshopChatPanel` 新增 `stepProgress` prop
- [x] 在消息列表上方条件渲染 `SkillStepProgress`
- [x] `BrainstormPanel` 中维护 `stepProgress` state，从 parsedMessages 提取最新进度
- [x] `PartyModePanel` 同上
- [x] `PrdCreationPanel` 同上
- [x] 各面板 newSession 时重置 stepProgress

### 5. Skill Prompt 指令
- [x] `brainstorm-prompts.ts` 添加步骤输出指令
- [x] `party-mode-prompts.ts` 添加步骤输出指令
- [x] `prd-prompts.ts` 添加步骤输出指令

### 6. 测试验证
- [x] Vite 构建通过（无编译错误）
- [ ] 标记解析单元测试（正则匹配、payload 生成、文本清理）
- [ ] 组件渲染测试（进度比例、完成状态、无进度时隐藏）
- [ ] 现有功能回归测试（现有 4 种标记不受影响）

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-31 | Feature created | spec.md + task.md + checklist.md |
| 2026-05-31 | Implementation complete | 10 files modified/created, Vite build ✅ |
