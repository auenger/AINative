# Feature: feat-skill-step-progress Skill 步骤进度指示器

## Basic Information
- **ID**: feat-skill-step-progress
- **Name**: Skill Step Progress — 产品工坊 Skill 执行步骤进度实时展示
- **Priority**: 60
- **Size**: M
- **Dependencies**: feat-bmad-workshop (已完成)
- **Parent**: null
- **Children**: []
- **Created**: 2026-05-31

## Description

在产品工坊（PMWorkshopView）的三个面板（头脑风暴/派对模式/PRD）中，当 AI 执行多步骤 Skill 时，实时展示当前步骤进度。

核心体验：
- AI 在回复中嵌入步骤标记（如 `<!-- workshop:step-progress current="3" total="8" label="AI 分析中" -->`）
- 前端解析标记，在聊天区域顶部渲染进度条 + 步骤文字
- 用户可直观感知"当前走到哪一步，还剩多少步"

参考现有的 `<!-- workshop:option-card -->` 标记模式，新增 `step-progress` 标记类型。

## User Value Points

### VP1: 步骤进度实时展示
用户在工坊中执行 Skill 时，聊天区顶部实时显示当前步骤和剩余步骤数，消除"AI 在干什么、还要等多久"的焦虑。

### VP2: Skill 步骤标记协议
定义 `<!-- workshop:step-progress -->` 标记格式，复用现有 parseWorkshopMarkers 解析管道。为 Bmad 风格 Skill 的 system prompt 添加步骤输出指令，使 AI 自动在回复中嵌入步骤标记。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/pm-workshop/ProgressStepper.tsx` — 现有 4 步硬编码进度条，可复用视觉风格
- `neuro-syntax-ide/src/components/pm-workshop/BrainstormPanel.tsx` — `parseWorkshopMarkers()` 解析管道，需扩展
- `neuro-syntax-ide/src/components/pm-workshop/WorkshopChatPanel.tsx` — 聊天面板，进度条插入位置
- `neuro-syntax-ide/src/components/pm-workshop/WorkshopMessageRenderer.tsx` — 消息渲染路由
- `neuro-syntax-ide/src/lib/bmad/brainstorm-prompts.ts` — 头脑风暴系统提示，需添加步骤输出指令
- `neuro-syntax-ide/src/types.ts` — 需新增 `StepProgressPayload` 类型

### Related Documents
- 现有标记协议格式：`<!-- workshop:{type} -->...<!-- /workshop:{type} -->`
- 现有标记类型：option-card, idea-card, energy-checkpoint, action-menu

### Related Features
- feat-bmad-workshop (已完成) — 产品工坊基础设施
- feat-workshop-ux-enhance (已完成) — 工坊 UX 增强

## Technical Solution

### 1. 标记协议设计

新增 `step-progress` 标记类型，格式为自闭合 HTML 注释（无内容体），直接在注释中携带属性：

```
<!-- workshop:step-progress current="3" total="8" label="AI 分析 - 生成 Gherkin 场景" -->
```

属性说明：
- `current` (必填): 当前步骤序号（1-based）
- `total` (必填): 总步骤数
- `label` (必填): 当前步骤描述

每个步骤的 AI 回复中嵌入一次，前端自动更新进度条。无需闭合标记（与现有标记不同，这是单行标记）。

### 2. 前端解析管道扩展

**2.1 新增类型定义** (`types.ts`)
```typescript
interface StepProgressPayload {
  type: 'step-progress';
  current: number;   // 1-based
  total: number;
  label: string;
}
```

在 `ParsedWorkshopPayload` 联合类型中追加 `'step-progress'`。

**2.2 扩展 parseWorkshopMarkers** (`BrainstormPanel.tsx` 或提取为独立模块)
- 在现有 4 种标记解析之前，先检测 `step-progress`（优先级最高）
- 正则：`/<!-- workshop:step-progress current="(\d+)" total="(\d+)" label="([^"]*)" -->/`
- 解析成功后从原始文本中移除标记，返回 `{ text, payload: { type: 'step-progress', current, total, label } }`

**2.3 进度条状态提升**

当前 `parseWorkshopMarkers` 返回的 payload 是逐消息解析的。`step-progress` 需要跨消息追踪最新状态：
- 在 `BrainstormPanel` / `PartyModePanel` / `PrdCreationPanel` 中维护 `stepProgress` state
- 每次解析到 `step-progress` payload 时更新 state
- 将 state 传递给 `WorkshopChatPanel` 作为顶部进度条

### 3. SkillStepProgress 组件

新建 `neuro-syntax-ide/src/components/pm-workshop/SkillStepProgress.tsx`：

```tsx
interface SkillStepProgressProps {
  current: number;
  total: number;
  label: string;
}
```

视觉设计（对齐现有 ProgressStepper 风格）：
- 高度紧凑（py-2），不抢占聊天空间
- 左侧：进度条（`bg-primary` 填充比例 = current/total）
- 右侧：步骤文字 `Step 3/8 — AI 分析中`
- 完成时（current === total）：绿色对勾 + "完成" 文字
- 动画：进度条宽度 transition（300ms ease）

### 4. WorkshopChatPanel 集成

在 `WorkshopChatPanel` 的消息列表上方插入 `SkillStepProgress`：
- 仅当 `stepProgress` 不为 null 时渲染
- 位于输入框和消息列表之间
- 可点击折叠/展开

### 5. Bmad Skill Prompt 指令

为三个面板的 system prompt 添加步骤输出规范：

**brainstorm-prompts.ts**:
```
当执行多步骤任务时，在每一步的回复开头嵌入步骤进度标记：
<!-- workshop:step-progress current="N" total="M" label="步骤描述" -->
```

**party-mode-prompts.ts** 和 **prd-prompts.ts** 同理。

### 6. 跨面板复用

三个面板共享的提取路径：
1. `parseWorkshopMarkers` 提取到 `neuro-syntax-ide/src/lib/bmad/workshop-markers.ts`（独立模块）
2. `SkillStepProgress` 组件三个面板通用
3. `stepProgress` state 在 `PMWorkshopView` 层级管理（或各面板独立管理）

## Acceptance Criteria (Gherkin)

### User Story
作为产品工坊用户，我希望在 AI 执行多步骤任务时看到步骤进度指示，以便了解当前进度和预计剩余步骤。

### Scenarios (Given/When/Then)

#### Scenario 1: 头脑风暴中显示步骤进度
```gherkin
Given 用户在产品工坊的头脑风暴面板
And AI 正在执行多步骤头脑风暴流程
When AI 在回复中输出 <!-- workshop:step-progress current="2" total="4" label="选择技法" -->
Then 聊天区顶部应显示进度条
And 进度条填充 50%
And 显示文字 "Step 2/4 — 选择技法"
```

#### Scenario 2: 步骤自动递进
```gherkin
Given 进度条当前显示 "Step 2/4 — 选择技法"
When AI 后续回复中输出 <!-- workshop:step-progress current="3" total="4" label="执行头脑风暴" -->
Then 进度条平滑过渡到 75%
And 文字更新为 "Step 3/4 — 执行头脑风暴"
```

#### Scenario 3: 所有步骤完成
```gherkin
Given 进度条当前显示 "Step 3/4 — 执行头脑风暴"
When AI 后续回复中输出 <!-- workshop:step-progress current="4" total="4" label="整理结果" -->
Then 进度条显示 100%
And 显示绿色对勾 + "完成"
```

#### Scenario 4: 无步骤标记时不显示
```gherkin
Given 用户在产品工坊的任意面板
And AI 回复中不包含 step-progress 标记
Then 聊天区顶部不显示进度条
And 界面与当前完全一致
```

#### Scenario 5: PRD 创建面板复用
```gherkin
Given 用户在 PRD 创建面板
When AI 在回复中输出 <!-- workshop:step-progress current="1" total="5" label="意图识别" -->
Then 聊天区顶部同样显示进度条和步骤文字
```

#### Scenario 6: 步骤标记对用户不可见
```gherkin
Given AI 回复中包含 <!-- workshop:step-progress --> 标记
When 前端渲染消息内容
Then 标记本身不显示在聊天气泡中
And 标记信息仅通过顶部进度条展示
```

### UI/Interaction Checkpoints
- [ ] 进度条宽度与 current/total 比例一致
- [ ] 进度条 transition 动画平滑（300ms）
- [ ] 完成状态有视觉区分（绿色对勾）
- [ ] 进度条高度紧凑，不影响聊天区域使用
- [ ] 步骤文字清晰可读（字号 >= 10px）

### General Checklist
- [ ] 标记解析兼容现有 4 种标记类型，不破坏现有功能
- [ ] parseWorkshopMarkers 扩展后，现有单元测试仍通过
- [ ] 新增组件遵循现有样式系统（cn(), Tailwind CSS 4）
- [ ] 类型定义集中在 types.ts

## Merge Record

- **Completed**: 2026-05-31
- **Merged Branch**: feature/skill-step-progress
- **Merge Commit**: 3e5dbfb
- **Archive Tag**: feat-skill-step-progress-20260531
- **Conflicts**: None
- **Verification**: 6/6 Gherkin scenarios PASS, Vite build ✅
- **Stats**: 10 files changed, +231/-19 lines, 1 commit
