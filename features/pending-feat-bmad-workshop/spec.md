# Feature: feat-bmad-workshop BMAD AI Product Workshop

## Basic Information
- **ID**: feat-bmad-workshop
- **Name**: BMAD AI Product Workshop
- **Priority**: 60
- **Size**: L
- **Dependencies**: null
- **Parent**: null
- **Children**: [feat-bmad-workspace, feat-bmad-brainstorm, feat-bmad-party-mode, feat-bmad-prd]
- **Created**: 2026-05-29

## Description

在 Neuro Syntax IDE 中集成 BMAD-METHOD 的三大核心 Skill（头脑风暴、Party Mode、创建 PRD），通过 builtin agent 驱动与用户交互，实现 AI 引导的产品需求工作流。

## User Value Points

1. **头脑风暴引导** — Agent 作为创意引导者（非内容生成器），60+ ideation 技术，从发散到收敛
2. **Party Mode 多角色圆桌** — 多 Agent 扮演不同角色并行讨论，避免单一 LLM 趋同
3. **PRD 结构化创建** — 引导式 PRD 撰写（Fast Path / Coaching Path），产出标准 PRD 文档
4. **PRD 后续对话** — 已有 PRD 的对话式迭代、审查和关联 Feature 开发

## 设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 导航位置 | Project 和 Tasks 之间（SideNav index 1） | PM 工具关联性 |
| Party Mode 执行模式 | 顺序执行 + 顺序展示 | 简化实现，避免共享事件通道问题 |
| PRD 布局 | 左右分屏（可拖拽调整比例） | 实时对照 Agent 对话和 PRD 文档 |

## 整体组件架构

```
PMWorkshopView
├── header (h-14: 标题 + 产出物指示器)
├── WorkshopTabBar (子 Tab: Brainstorm | Party Mode | Create PRD)
├── BrainstormPanel (conditional)
│   ├── ProgressStepper (顶部固定)
│   ├── IdeaCounterBadge (右上角)
│   └── WorkshopChatPanel (共享聊天组件)
│       ├── 消息列表 (含 WorkshopMessageRenderer)
│       │   ├── DefaultChatBubble (普通对话)
│       │   ├── OptionCardMessage (2x2 选择卡片)
│       │   ├── IdeaCardMessage (结构化想法卡片)
│       │   ├── ActionMenuMessage (内联操作按钮)
│       │   └── EnergyCheckpointMessage (能量检查点)
│       └── 输入区 (textarea + 发送按钮)
├── PartyModePanel (conditional)
│   ├── PersonaRoster (欢迎页: 角色网格)
│   └── WorkshopChatPanel (共享聊天组件)
│       ├── 消息列表
│       │   ├── DefaultChatBubble (用户消息)
│       │   ├── PersonaCardMessage (角色回应卡片)
│       │   └── OrchestratorNoteMessage (编排器备注)
│       └── 输入区 (textarea + PersonaReferencePicker)
└── PrdCreationPanel (conditional)
    ├── WorkshopChatPanel (左侧 ~45%)
    │   ├── 消息列表
    │   │   ├── DefaultChatBubble
    │   │   ├── IntentSelector (Create/Update/Verify chips)
    │   │   ├── StakeCalibration (Hobby/Internal/Startup chips)
    │   │   └── WorkModeSelector (Fast/Coaching path cards)
    │   └── 输入区
    ├── 拖拽分隔条 (w-1.5, cursor-col-resize)
    └── PRDDocumentPreview (右侧 ~55%)
        ├── PRDOutline (大纲导航 w-[200px])
        └── PRDContent (文档内容 + [ASSUMPTION] 交互标签)
```

## 共享基础设施

### 消息类型扩展（useAgentStream.ts ChatMessage）

Agent 在流式文本中使用 HTML 注释标记传递结构化数据：

```
<!-- OPTION id="x" title="..." -->    → option-card
<!-- IDEA category="..." number="42" title="..." -->  → idea-card
<!-- CHECKPOINT -->                    → energy-checkpoint
```

渲染层在 MarkdownRenderer 之前拦截这些标记，提取结构化 payload 并设置 `workshopType`。

```typescript
export interface ChatMessage {
  // ... existing fields ...
  workshopType?: 'option-card' | 'idea-card' | 'persona-card' | 'action-menu'
    | 'energy-checkpoint' | 'orchestrator-note' | 'validation-report';
  workshopPayload?: any;
}
```

### 共享聊天组件: WorkshopChatPanel

从 `ProjectView.tsx:784-930` 提取核心聊天模式，参数化以支持三种 Skill：

```typescript
interface WorkshopChatPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (text: string) => void;
  placeholder: string;
  renderWorkshopMessage?: (msg: ChatMessage, idx: number) => ReactNode | null;
  inputAddons?: ReactNode;
  rightPanel?: ReactNode;
}
```

**消息渲染优先级:**
1. `renderWorkshopMessage` 返回非 null → 使用自定义渲染
2. `msg.isToolCall` → ToolCallMessage
3. `msg.role === 'user'` → 右对齐蓝色气泡（纯文本）
4. `msg.role === 'assistant'` → 左对齐灰底气泡（MarkdownRenderer）

## 新增文件清单

```
src/components/views/PMWorkshopView.tsx              — 主视图
src/components/pm-workshop/
  WorkshopChatPanel.tsx         — 共享聊天面板
  WorkshopChatBubble.tsx        — 共享消息气泡
  WorkshopMessageRenderer.tsx   — 消息类型路由（解析 workshopType）
  ProgressStepper.tsx           — 头脑风暴进度条
  OptionCardMessage.tsx         — 选项选择卡片
  IdeaCardMessage.tsx           — 想法卡片
  ActionMenuMessage.tsx         — 内联操作按钮组
  EnergyCheckpointMessage.tsx   — 能量检查点
  IdeaCounterBadge.tsx          — 想法计数徽章
  BrainstormPanel.tsx           — 头脑风暴面板
  PersonaCardMessage.tsx        — 角色回应卡片
  OrchestratorNoteMessage.tsx   — 编排器备注
  PersonaReferencePicker.tsx    — 角色选择器
  PartyModePanel.tsx            — Party Mode 面板
  IntentSelector.tsx            — PRD 意图选择
  WorkModeSelector.tsx          — 路径选择卡片
  AssumptionTag.tsx             — [ASSUMPTION] 交互标签
  PRDDocumentPreview.tsx        — PRD 文档预览（含大纲）
  ValidationReport.tsx          — 验证报告
  PrdCreationPanel.tsx          — PRD 创建面板
src/lib/bmad/
  brainstorm-prompts.ts         — 头脑风暴 Agent prompts
  party-mode-prompts.ts         — Party Mode prompts
  prd-prompts.ts                — PRD Agent prompts
  brain-methods.ts              — 60+ 技术数据
  persona-definitions.ts        — 角色定义
src/lib/usePartyAgentPool.ts    — Party Mode 多 Agent session 管理
```

## 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `src/types.ts` | ViewType 新增 `pm-workshop`，新增 BMAD 相关类型 |
| `src/components/SideNav.tsx` | navItems 数组在 index 1 插入 pm-workshop (FlaskConical 图标) |
| `src/App.tsx` | 新增 PMWorkshopView 视图挂载 |
| `src/lib/useAgentStream.ts` | ChatMessage 接口扩展 workshopType/workshopPayload |
| `src/i18n.ts` | 新增 nav.pmWorkshop 等翻译键 |

## Acceptance Criteria (Gherkin)

### Scenario 1: 完整工作流
```gherkin
Given 用户打开了 PM Workshop Tab
When 用户依次使用 Brainstorm → Party Mode → Create PRD
Then 头脑风暴的产出自动作为 Party Mode 的上下文
And Party Mode 的洞察自动作为 PRD 创建的输入
And 最终 PRD 文档保存到工作区
```

### Scenario 2: 独立使用
```gherkin
Given 用户打开了 PM Workshop Tab
When 用户直接进入 Create PRD 而不使用前两个 Skill
Then PRD Agent 引导用户从零开始发现和撰写
And 不强制依赖前置 Skill 的产出
```

### Scenario 3: PRD 后续对话
```gherkin
Given 用户已创建 PRD 文档
When 用户在 Project 页面打开该 PRD
Then PM Agent 可以基于 PRD 内容进行后续对话
And 支持将 PRD 转化为 Feature spec
```

## 实现顺序

1. **feat-bmad-workspace**: types + SideNav + App.tsx + PMWorkshopView 框架 + WorkshopChatPanel
2. **feat-bmad-brainstorm**: prompts + BrainstormPanel + ProgressStepper + OptionCard + IdeaCard + ActionMenu
3. **feat-bmad-party-mode**: persona-definitions + prompts + usePartyAgentPool + PartyModePanel + PersonaCard + PersonaReferencePicker
4. **feat-bmad-prd**: prompts + PrdCreationPanel + PRDDocumentPreview + AssumptionTag + ValidationReport

## 验证方式

- 每个 Feature 完成后 `tauri dev` 启动应用
- 验证 Tab 导航、子 Tab 切换、Agent 对话连通
- Brainstorm: 完成 4 步向导流程，验证选项卡片点击和想法卡片渲染
- Party Mode: 触发 2+ 角色回应，验证 PersonaCard 纵向堆叠和角色区分
- PRD: 左右分屏拖拽、大纲导航、[ASSUMPTION] 标签交互
