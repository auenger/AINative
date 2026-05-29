# Feature: feat-bmad-party-mode Party Mode Skill

## Basic Information
- **ID**: feat-bmad-party-mode
- **Name**: Party Mode Skill（BMAD 多角色圆桌）
- **Priority**: 55
- **Size**: M
- **Dependencies**: feat-bmad-workspace
- **Parent**: feat-bmad-workshop
- **Children**: null
- **Created**: 2026-05-29

## Description

实现 BMAD Party Mode Skill，多个 Agent 扮演不同角色（PM、架构师、UX 设计师、测试等）顺序参与讨论，提供真实多样的视角。

### 设计决策
- **执行模式:** 顺序执行 + 顺序展示（简化实现，避免共享 `agent://chunk` 事件通道问题）
- **渲染模式:** 每个角色独立卡片，纵向堆叠，不混合不摘要

### 核心工作流

1. **激活** — 展示 PersonaRoster 角色网格
2. **核心循环** — 用户消息 → 编排器选角色 → 顺序生成 → 逐个渲染 PersonaCard
3. **定向互动** — 用户 `@角色名` 指定角色回应
4. **退出** — 关键收获总结

### 关键渲染规则
- 不混合、不释义、不总结各角色回应
- 每个角色完整独立展示
- 顺序生成，逐个渲染（带 loading 状态）

## Technical Solution — UI/UX 交互设计

### 1. PersonaRoster（欢迎页角色网格）

首次进入显示角色列表，用户开始对话后隐藏：

```
┌──────────────┐  ┌──────────────┐
│ 🚀 Winston   │  │ 🔧 Alex      │
│ 产品策略师    │  │ 技术架构师    │
│ 关注用户价值  │  │ 关注系统设计  │
└──────────────┘  └──────────────┘
┌──────────────┐  ┌──────────────┐
│ 🎨 Sally     │  │ 🧪 Marcus    │
│ UX 设计师    │  │ 测试工程师    │
│ 关注交互体验  │  │ 关注质量风险  │
└──────────────┘  └──────────────┘
```

**样式:** `grid grid-cols-2 gap-2 p-4`
**每张卡片:** `config-card hover:border-{accent}/30`
- emoji: `text-lg`
- 姓名: `text-xs font-bold text-on-surface`
- 角色: `text-[10px] text-on-surface-variant`

**组件:** 内联在 PartyModePanel 中

### 2. PersonaCardMessage（角色回应卡片 — 核心组件）

每个角色的回应渲染为独立卡片，纵向堆叠：

```
┌─────────────────────────────────────────────┐
│ 🚀 Winston · 产品策略师                      │
│─────────────────────────────────────────────│
│ 我认为这个方案的核心问题是...                │
│ 我们应该优先考虑用户价值而不是技术实现...     │
│                                             │
│ 不过 Alex 说的架构层面考虑也有道理...        │
└─────────────────────────────────────────────┘
  (左侧蓝色竖线)

┌─────────────────────────────────────────────┐
│ 🔧 Alex · 技术架构师                         │
│─────────────────────────────────────────────│
│ 我不完全同意 Winston 的看法...               │
│ 从系统扩展性角度，我们需要考虑...            │
└─────────────────────────────────────────────┘
  (左侧琥珀色竖线)
```

**结构:**
```
bg-surface-container-low border-l-3 border-{accent} rounded-lg overflow-hidden max-w-[85%]
  header: flex items-center gap-2 px-3 py-2 bg-{accent}/5
    emoji: w-7 h-7 rounded-full bg-{accent}/10 flex items-center justify-center text-sm
    name: text-xs font-bold text-on-surface
    title badge: text-[9px] bg-{accent}/10 px-1.5 py-0.5 rounded text-{accent}
  body: px-3 py-2
    MarkdownRenderer (content)
    streaming cursor (w-1.5 h-3 bg-primary/70 animate-pulse)
```

**角色配色方案:**

| 角色 | emoji | accentColor | Tailwind 前缀 |
|------|-------|-------------|--------------|
| Winston (PM) | 🚀 | blue | `border-blue-400` `bg-blue-400/10` |
| Alex (架构师) | 🔧 | amber | `border-amber-400` `bg-amber-400/10` |
| Sally (UX) | 🎨 | emerald | `border-emerald-400` `bg-emerald-400/10` |
| Marcus (测试) | 🧪 | red | `border-red-400` `bg-red-400/10` |
| Jordan (Dev) | 💻 | purple | `border-purple-400` `bg-purple-400/10` |

**Loading 状态:** 角色正在生成时，显示 header + skeleton body
```
bg-surface-container-low border-l-3 border-{accent} rounded-lg overflow-hidden
  header: 完整显示（emoji + name + title）
  body: h-16 bg-{accent}/5 animate-pulse
```

**组件:** `src/components/pm-workshop/PersonaCardMessage.tsx`

### 3. OrchestratorNoteMessage（编排器备注）

所有角色卡片之后，风格与角色卡片明确区分：

```
┌──────────────────────────────────────────────────────────┐
│ 🎼 编排器                                                │
│ 注意到 Winston 和 Alex 在优先级上存在分歧，建议深入讨论。  │
└──────────────────────────────────────────────────────────┘
```

**样式:**
```
bg-surface-container-high/50 rounded-lg px-3 py-2 border-t border-outline-variant/10 max-w-[85%]
  italic text-on-surface-variant text-[10px]
  编排器图标: text-[10px]
```

**组件:** `src/components/pm-workshop/OrchestratorNoteMessage.tsx`

### 4. PersonaReferencePicker（角色 @ 引用选择器）

复用 `FileReferencePicker.tsx` 的模式，输入 `@` 时弹出角色选择：

- **触发:** textarea 中检测 `/@\w*$/` 正则匹配
- **弹窗:** absolute positioned above textarea，列出角色 icon + name + title
- **选择:** 点击插入 `@Winston` 文本到输入框
- **过滤:** 支持模糊搜索角色名

**样式:** 与 FileReferencePicker 一致的 popup 风格
```
absolute bottom-full left-0 right-0 mb-1 bg-surface-container border border-outline-variant/10
  rounded-lg shadow-xl max-h-48 overflow-y-auto z-50
```

**组件:** `src/components/pm-workshop/PersonaReferencePicker.tsx`

### 5. 多 Agent 顺序执行流程

```
用户消息
  ↓
编排器 Agent (useAgentStream) → 选择 2-4 个角色 + 构建上下文
  ↓
角色 1 执行 (runtime_execute)
  → PersonaCardMessage 渲染（完整回应）
  ↓
角色 2 执行 (runtime_execute)
  → PersonaCardMessage 渲染（完整回应）
  ↓
... 更多角色
  ↓
OrchestratorNoteMessage 渲染
  ↓
等待用户下一条消息
```

### 6. usePartyAgentPool hook

**文件:** `src/lib/usePartyAgentPool.ts`

管理多角色 session 的状态：

```typescript
interface PersonaSession {
  personaId: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  currentResponse: string;
}

export function usePartyAgentPool(runtimeId: string) {
  const [personaSessions, setPersonaSessions] = useState<Record<string, PersonaSession>>({});

  // 顺序执行：依次调用每个角色
  const executePersonas: (message: string, personaIds: string[], context: string) => Promise<void>;

  // 定向执行：只调用指定角色
  const executePersona: (personaId: string, message: string, context: string) => Promise<void>;

  // 获取角色列表
  const getActivePersonas: () => PartyPersona[];

  return { personaSessions, executePersonas, executePersona, getActivePersonas };
}
```

### 7. PartyModePanel 面板

```
src/components/pm-workshop/PartyModePanel.tsx

布局:
┌── Header Bar ────────────────────────────────────────┐
│  "Party Mode"                           5 personas   │
├── 欢迎页 或 WorkshopChatPanel ───────────────────────┤
│                                                      │
│  [欢迎页: PersonaRoster 2x3 网格]                    │
│  或                                                  │
│  [消息列表]                                           │
│    PersonaCardMessage (Winston 🚀, blue accent)      │
│    PersonaCardMessage (Alex 🔧, amber accent)        │
│    OrchestratorNoteMessage                            │
│    [用户消息]                                         │
│    PersonaCardMessage (Sally 🎨, emerald accent)     │
│    PersonaCardMessage (Marcus 🧪, red accent)        │
│    OrchestratorNoteMessage                            │
│                                                      │
│  [输入区 — textarea + PersonaReferencePicker]        │
└──────────────────────────────────────────────────────┘
```

**编排器 Agent 集成:**
```typescript
const orchestratorAgent = useAgentStream({
  runtimeId: pmRuntimeId,
  systemPrompt: PARTY_ORCHESTRATOR_PROMPT,
  greetingMessage: "Welcome to Party Mode! ...",
});
```

### 8. 角色定义文件

**文件:** `src/lib/bmad/persona-definitions.ts`

预定义 5 个角色的完整配置（id, name, title, icon, accentColor, description, expertise, prompt）。

**文件:** `src/lib/bmad/party-mode-prompts.ts`
- `PARTY_ORCHESTRATOR_PROMPT` — 编排器系统提示
- `buildPersonaPrompt(persona, context)` — 角色提示构建函数

## Acceptance Criteria (Gherkin)

```gherkin
Feature: Party Mode Skill

Scenario: 多角色讨论
  Given 用户进入 Party Mode 子 Tab
  And 显示 PersonaRoster 角色网格（5 个角色）
  When 用户输入讨论话题
  Then 编排器选择 2-4 个相关角色
  And 每个角色依次渲染 PersonaCardMessage（带左侧彩色竖线和 emoji 头像）
  And 角色回应不混合、不摘要

Scenario: 定向互动
  Given 用户在 Party Mode 讨论中
  When 用户在输入框输入 "@Alex"
  Then PersonaReferencePicker 弹出，显示 Alex 角色选项
  When 用户说 "@Alex，你对 Sally 的想法怎么看？"
  Then 只有 Alex 基于 Sally 的回应生成 PersonaCardMessage

Scenario: 编排器备注
  Given 多个角色已生成回应
  When 角色间存在意见分歧
  Then 最后渲染 OrchestratorNoteMessage 标记分歧

Scenario: Loading 状态
  Given 角色正在生成回应
  Then PersonaCardMessage 显示 header + skeleton body (animate-pulse)
  When 回应完成
  Then skeleton 替换为完整 MarkdownRenderer 内容

Scenario: 产出物传递
  Given 用户完成 Party Mode 讨论
  When 切换到 Create PRD 子 Tab
  Then 各角色的关键洞察自动作为 PRD 创建的输入
```

## Checklist
- [ ] PartyModePanel 组件（含 PersonaRoster + WorkshopChatPanel）
- [ ] PersonaCardMessage 角色回应卡片（5 种 accent 色彩）
- [ ] OrchestratorNoteMessage 编排器备注
- [ ] PersonaReferencePicker 角色选择器（@ 触发）
- [ ] persona-definitions.ts 角色定义（5 个角色）
- [ ] party-mode-prompts.ts 编排器 + 角色 prompts
- [ ] usePartyAgentPool hook（顺序执行多角色 session）
- [ ] PersonaCardMessage loading skeleton 状态
- [ ] 定向互动解析（@角色名）
- [ ] 对话摘要管理（<400 字，每 2-3 轮更新）
- [ ] 退出总结生成
- [ ] 产出物序列化到 BMADSessionState

## Merge Record

- **Completed:** 2026-05-29T19:00:00Z
- **Merged Branch:** feature/feat-bmad-party-mode
- **Merge Commit:** d85f6bb
- **Archive Tag:** feat-bmad-party-mode-20260529
- **Conflicts:** None (clean rebase)
- **Verification:** PASS (5/5 Gherkin scenarios validated)
- **Stats:** 1 commit, 7 files changed, +1497/-16 lines
