# Feature: feat-bmad-brainstorm 头脑风暴 Skill

## Basic Information
- **ID**: feat-bmad-brainstorm
- **Name**: 头脑风暴 Skill（BMAD Brainstorming）
- **Priority**: 55
- **Size**: S
- **Dependencies**: feat-bmad-workspace
- **Parent**: feat-bmad-workshop
- **Children**: null
- **Created**: 2026-05-29

## Description

实现 BMAD Brainstorming Skill，Agent 作为创意引导者（非内容生成器），通过 60+ ideation 技术引导用户进行头脑风暴。

### 核心工作流（4 步微文件架构）

1. **会话设置** — 收集主题、目标、约束；提供 4 种技术选择方式
2. **技术选择** — 从 60+ 技术（9 个类别）中选择合适的 ideation 方法
3. **技术执行** — 引导循环：一次一个元素，每回合最多一个新想法/挑战
4. **想法整理** — 聚类主题、优先级排序、行动计划

### Agent 交互模式
- Agent 严格扮演引导者，不批量生成想法列表
- 模式：一个挑战/问题 → 用户回应 → Agent 阐述深化 → 循环
- 目标：100+ 协作产生的想法后再整理
- 反偏见协议：每 10 个想法进行一次领域转移
- 能量检查点：每 4-5 次交流

## Technical Solution — UI/UX 交互设计

### 1. ProgressStepper（顶部固定进度条）

```
┌────────────────────────────────────────────────────────────────┐
│  ● Setup  ────  ● Technique  ────  ○ Execute  ────  ○ Organize │
│  (done)        (active)           (pending)        (pending)    │
└────────────────────────────────────────────────────────────────┘
```

**样式规则:**
- 完成: `text-tertiary` + CheckCircle2 图标
- 当前: `text-primary font-bold` + 实心圆点
- 待定: `text-on-surface-variant opacity-50` + 空心圆
- 连接线: `h-0.5 bg-primary`（已完成）/ `bg-outline-variant/20`（未完成）

**组件:** `src/components/pm-workshop/ProgressStepper.tsx`
**Props:** `currentStep: BrainstormStep`, `completedSteps: BrainstormStep[]`

### 2. OptionCardMessage（选项选择卡片）

Agent 呈现选项时，渲染为 2x2 网格的可点击卡片（嵌入聊天流中）：

```
┌─────────────────┐  ┌─────────────────┐
│ 🔍 自选技术      │  │ 🤖 AI 推荐      │
│ 浏览 60+ 技术    │  │ 基于上下文匹配   │
└─────────────────┘  └─────────────────┘
┌─────────────────┐  ┌─────────────────┐
│ 🎲 随机选择      │  │ 📈 渐进流程      │
│ 意外发现         │  │ 发散到收敛       │
└─────────────────┘  └─────────────────┘
```

**容器:** `grid grid-cols-2 gap-2 max-w-[85%]`

**每张卡片:**
```
bg-surface-container-low border border-outline-variant/10 rounded-lg p-3
hover:border-primary/30 hover:bg-primary/5 cursor-pointer transition-all
  emoji: text-lg mb-1
  标题: text-xs font-bold text-on-surface
  描述: text-[10px] text-on-surface-variant mt-0.5
```

**选中后:** `border-primary bg-primary/10`

**点击行为:** 将选项 ID 作为用户消息发送

**组件:** `src/components/pm-workshop/OptionCardMessage.tsx`

### 3. IdeaCardMessage（结构化想法卡片）

```
┌──────────────────────────────────────────┐
│ [结构型 #42]  SCAMPER 逆向思维           │
│ 概念: 将现有功能翻转，考虑反向操作场景     │
│ 新颖性: 突破"只能正向操作"的思维定式      │
└──────────────────────────────────────────┘
```

**样式:**
```
bg-surface-container-low border border-outline-variant/10 rounded-lg p-3 max-w-[85%]
  类别标签: text-[9px] font-bold uppercase tracking-widest text-on-surface-variant
  标题: text-xs font-bold text-on-surface
  概念: text-[10px] text-on-surface-variant mt-1
  新颖性: text-[10px] text-primary/70 italic mt-1
```

**组件:** `src/components/pm-workshop/IdeaCardMessage.tsx`

### 4. IdeaCounterBadge（持久想法计数徽章）

右上角固定，始终显示当前想法数量：

```
💡 42 ideas (target: 100+)
```

**样式:** `px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold`
**图标:** Lightbulb (12px)

**组件:** `src/components/pm-workshop/IdeaCounterBadge.tsx`

### 5. EnergyCheckpointMessage（能量检查点）

每 4-5 次交流后 Agent 发出的内联检查：

```
┌──────────────────────────────────────────────────────────┐
│ ⚡ 能量检查点 — 你觉得节奏怎么样？                          │
│ [继续探索] [切换技术] [深入某个想法] [进入整理阶段]        │
└──────────────────────────────────────────────────────────┘
```

**样式:** `bg-warning/5 border border-warning/20 rounded-lg p-3 max-w-[85%]`
**标题:** `text-[10px] text-warning font-bold`
**按钮组:** `flex gap-1.5 flex-wrap mt-2`，每按钮使用 `config-action-btn` 样式

**组件:** `src/components/pm-workshop/EnergyCheckpointMessage.tsx`

### 6. ActionMenuMessage（操作菜单）

技术执行完成后的内联操作按钮：

```
[K 继续] [T 换技术] [A 深入] [B 休息] [C 整理]
```

**样式:** `flex gap-1.5 flex-wrap max-w-[85%]`
**每按钮:** `config-action-btn text-on-surface-variant hover:bg-primary/10 border border-outline-variant/10`

**组件:** `src/components/pm-workshop/ActionMenuMessage.tsx`

### 7. BrainstormPanel 面板

```
src/components/pm-workshop/BrainstormPanel.tsx

布局:
┌── ProgressStepper ────────────────────────────────────┐
│  ● Setup ──── ● Technique ──── ○ Execute ──── ○ Org   │
└───────────────────────────────────────────────────────┘
┌── Header Bar ─────────────────────────────────────────┐
│  "Brainstorm Workshop"               💡 42 ideas      │
├── WorkshopChatPanel ──────────────────────────────────┤
│  [消息列表 — 含 OptionCard / IdeaCard / ActionMenu]    │
│  ...                                                  │
│  [输入区 — textarea + 发送]                            │
└───────────────────────────────────────────────────────┘
```

**Agent 集成:**
```typescript
const brainstormAgent = useAgentStream({
  runtimeId: pmRuntimeId,
  systemPrompt: BRAINSTORM_SYSTEM_PROMPT,
  greetingMessage: "Welcome to the Brainstorm Workshop! ...",
});
```

**状态管理:**
```typescript
interface BrainstormPanelState {
  step: BrainstormStep;
  topic: string;
  ideas: BrainstormIdea[];
  ideaCount: number;
  selectedTechnique?: BrainMethod;
}
```

### 8. Agent Prompt 文件

**文件:** `src/lib/bmad/brainstorm-prompts.ts`
- `BRAINSTORM_SYSTEM_PROMPT` — 角色定义：创意引导者
- 4 步引导提示（SETUP / TECHNIQUE / EXECUTE / ORGANIZE）
- Agent 使用 HTML 注释标记输出结构化数据

**文件:** `src/lib/bmad/brain-methods.ts`
- 60+ 技术数据，9 个类别

## Acceptance Criteria (Gherkin)

```gherkin
Feature: 头脑风暴 Skill

Scenario: 完整头脑风暴流程
  Given 用户进入 Brainstorm 子 Tab
  And ProgressStepper 显示 "Setup" 为当前步骤
  When 用户描述主题和目标
  Then Agent 提供 4 种技术选择方式（2x2 OptionCard 网格）
  And 用户点击卡片后进入技术执行

Scenario: 想法收集循环
  Given 用户在执行阶段（ProgressStepper 显示 "Execute"）
  When Agent 提出一个挑战或问题
  Then 用户回应后 Agent 深化并继续
  And 每个想法渲染为 IdeaCardMessage
  And IdeaCounterBadge 更新计数

Scenario: 能量检查点
  Given 执行阶段每 4-5 次交流
  Then Agent 发出 EnergyCheckpointMessage
  And 用户可点击 [继续] [切换] [深入] [整理] 按钮

Scenario: 产出物传递
  Given 用户完成头脑风暴（ProgressStepper 显示 "Organize" 完成）
  When 切换到 Party Mode 或 Create PRD
  Then 产出物自动序列化到 BMADSessionState 作为上下文输入
```

## Checklist
- [ ] BrainstormPanel 组件（含 ProgressStepper + IdeaCounterBadge）
- [ ] 头脑风暴 Agent system prompt（中文）
- [ ] 60+ 技术数据文件（brain-methods.ts）
- [ ] ProgressStepper 进度条组件
- [ ] OptionCardMessage 选项卡片组件
- [ ] IdeaCardMessage 想法卡片组件
- [ ] EnergyCheckpointMessage 能量检查点组件
- [ ] ActionMenuMessage 操作菜单组件
- [ ] IdeaCounterBadge 计数徽章组件
- [ ] 产出物序列化到 BMADSessionState
- [ ] 与 WorkshopChatPanel 集成
