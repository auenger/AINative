# Feature: feat-bmad-prd PRD 创建 Skill

## Basic Information
- **ID**: feat-bmad-prd
- **Name**: PRD 创建 Skill（BMAD Create PRD）
- **Priority**: 55
- **Size**: M
- **Dependencies**: feat-bmad-workspace, feat-bmad-brainstorm, feat-bmad-party-mode
- **Parent**: feat-bmad-workshop
- **Children**: null
- **Created**: 2026-05-29

## Description

实现 BMAD Create PRD Skill，引导用户创建结构化的产品需求文档（PRD）。

### 设计决策
- **布局:** 左右分屏（可拖拽调整比例），左侧 Agent 对话 ~45%，右侧 PRD 文档预览 ~55%
- **复用:** 拖拽分隔条复用 MarkdownSplitView.tsx 的 onMouseDown 模式

### 核心工作流

1. **激活与发现**
   - 检测意图：创建 / 更新 / 验证
   - 头脑风暴（内嵌轻量版，或引用 Brainstorm Skill 产出）
   - 利益校准（业余/内部/创业，决定文档严谨度）
   - 工作模式选择：Fast Path / Coaching Path

2. **PRD 撰写**
   - Essential Spine：愿景、目标用户、JTBD、用户旅程、功能列表、非目标、MVP 范围、成功指标
   - 入口选择：愿景+功能 或 旅程主导
   - 支持引用 Brainstorm 产出和 Party Mode 洞察

3. **验证与定稿**
   - 7 维度质量评审
   - 输入协调
   - 最终定稿并保存

## Technical Solution — UI/UX 交互设计

### 1. 左右分屏布局

```
┌─── Chat (45%) ───┬── PRD Preview (55%) ──┐
│                  │  ┌─ Outline ─┬──────┐ │
│ [Agent 对话]     │  │ ✓ Vision  │      │ │
│                  │  │ ▶ Users   │ PRD  │ │
│ 意图选择:        │  │ ○ Glossary│ 正文 │ │
│ [Create][Update] │  │ ○ Features│      │ │
│                  │  └───────────┘      │ │
│ 利益校准:        │  文档内容渲染        │
│ [Hobby][Startup] │  [ASSUMPTION] 标签   │
│                  │                      │
│ 路径选择:        │                      │
│ ┌─Fast Path─┐   │                      │
│ └───────────┘   │                      │
│ ┌─Coaching──┐   │                      │
│ └───────────┘   │                      │
└──────────────────┴──────────────────────┘
       ↑ 可拖拽分隔条 (w-1.5)
```

**拖拽分隔条:** `w-1.5 cursor-col-resize bg-outline-variant/10 hover:bg-primary/30 transition-colors`
复用 `MarkdownSplitView.tsx` 的 `onMouseDown` 拖拽模式。

**PrdCreationPanel 布局:**
```
PrdCreationPanel (flex-1 flex overflow-hidden)
├── 左侧: WorkshopChatPanel (flex, 可拖拽调整宽度)
├── 分隔条 (w-1.5 cursor-col-resize)
└── 右侧: PRDDocumentPreview (flex-1)
```

### 2. IntentSelector（意图选择芯片）

3 个芯片横向排列：

```
[Create] [Update] [Verify]
```

**容器:** `flex gap-2 max-w-[85%]`
**每芯片:**
```
px-3 py-1.5 rounded-full border text-[10px] font-bold cursor-pointer transition-all
  default: bg-surface-container-high border-outline-variant/10 text-on-surface-variant
  selected: bg-primary/10 border-primary/20 text-primary
  hover: hover:bg-surface-container-highest
```

**组件:** `src/components/pm-workshop/IntentSelector.tsx`

### 3. StakeCalibration（利益校准芯片）

3 个芯片，样式同 IntentSelector：

```
[Hobby] [Internal] [Startup]
```

**组件:** 内联在 PrdCreationPanel 中，或单独 `src/components/pm-workshop/StakeCalibration.tsx`

### 4. WorkModeSelector（路径选择卡片）

2 个大卡片，嵌入聊天流中：

```
┌─────────────────────────┐  ┌─────────────────────────┐
│ ⚡ Fast Path             │  │ 🎓 Coaching Path         │
│ AI 快速生成 PRD 草稿     │  │ 逐步引导 PM 思维         │
│ 用 [ASSUMPTION] 标记     │  │ 深度引导每个章节         │
│ 不确定内容，你审查迭代    │  │ 适合需要深度思考的产品   │
└─────────────────────────┘  └─────────────────────────┘
```

**容器:** `grid grid-cols-2 gap-3 max-w-[85%]`
**每卡片:**
```
bg-surface-container-low border rounded-lg p-4 cursor-pointer transition-all
  default: border-outline-variant/10
  selected: border-primary/30 bg-primary/5
  hover: hover:border-primary/20
  图标: text-lg mb-2
  标题: text-sm font-bold text-on-surface
  描述: text-[10px] text-on-surface-variant mt-1
```

**组件:** `src/components/pm-workshop/WorkModeSelector.tsx`

### 5. PRDDocumentPreview（PRD 文档预览）

**文件:** `src/components/pm-workshop/PRDDocumentPreview.tsx`

右侧面板分为两部分：大纲导航 + 文档内容。

#### 5.1 大纲导航（左侧 w-[200px]）

```
┌─ Document Outline ────────┐
│ ✓ 0. Document Purpose     │
│ ✓ 1. Vision               │
│ ▶ 2. Target User          │
│ ○ 3. Glossary             │
│ ○ 4. Features             │
│   ○ 4.1 Feature A         │
│   ○ 4.2 Feature B         │
│ ○ 5. Non-Goals            │
│ ○ 6. MVP Scope            │
│ ○ 7. Success Metrics      │
│ ○ 8. Open Questions  (2)  │ ← 假设数量徽章
└───────────────────────────┘
```

**样式:**
```
border-r border-outline-variant/10 bg-surface-container-lowest overflow-y-auto
  标题: "Document Outline" text-[9px] font-bold uppercase tracking-widest px-3 py-2
  各章节: flex items-center gap-2 px-3 py-1.5 text-[10px] cursor-pointer
    hover:bg-surface-container-high/50
  状态图标:
    完成: CheckCircle2 (text-tertiary, 10px)
    进行中: Loader2 animate-spin (text-primary, 10px)
    未开始: Circle (text-outline-variant, 10px)
  子章节: pl-6
  假设数量徽章: text-[8px] bg-warning/10 text-warning px-1 rounded
```

#### 5.2 文档内容（右侧 flex-1）

PRD 正文使用 MarkdownRenderer 渲染，滚动跟随。

**[ASSUMPTION] 交互标签:**

在 PRD 正文中渲染为内联交互徽章：

```
[ASSUMPTION: 用户主要通过移动端访问]
```

**样式:**
```
bg-warning/10 border border-warning/20 text-warning text-[9px] font-bold
px-1.5 py-0.5 rounded cursor-pointer hover:bg-warning/20 transition-all inline-flex items-center gap-1
```

**点击展开 popover:**
```
absolute z-50 bg-surface-container border border-outline-variant/10 rounded-lg shadow-xl p-3
  假设文本: text-xs text-on-surface
  [确认] 按钮: 点击后徽章变绿 bg-tertiary/10 text-tertiary border-tertiary/20
  [编辑] 按钮: 打开 inline textarea 修改假设文本
  [关闭] 按钮
```

**组件:** `src/components/pm-workshop/AssumptionTag.tsx`

### 6. ValidationReport（验证报告）

7 维度质量评分：

```
┌─ PRD 质量报告 ──────────────────────────────────────┐
│                                                      │
│  决策准备度        [A 强]  ████████████████  92%     │
│  内容完整性        [B 适当] ████████████    78%      │
│  战略连贯性        [A 强]  ██████████████  88%      │
│  完成度            [C 弱]  ██████          45%   ▼   │
│    ┌──────────────────────────────────────────────┐  │
│    │ ● 高  功能需求缺乏验收标准                    │  │
│    │   位置: 4.1 Feature A                        │  │
│    │   建议: 为每个 FR 添加可测试的验收标准        │  │
│    │ ● 中  MVP 范围边界模糊                       │  │
│    │   位置: 6. MVP Scope                         │  │
│    │   建议: 明确 v1 包含/排除的具体功能列表       │  │
│    └──────────────────────────────────────────────┘  │
│  范围诚实度        [B 适当] ██████████      72%      │
│  下游可用性        [A 强]  ██████████████  85%      │
│  文档规范          [A 强]  ████████████████ 95%      │
│                                                      │
│  综合评分: 79/100                                    │
└──────────────────────────────────────────────────────┘
```

**容器:** `bg-surface-container-low border border-outline-variant/10 rounded-lg overflow-hidden`

**维度行:**
```
flex items-center gap-3 px-3 py-2 border-b border-outline-variant/10 cursor-pointer
  hover:bg-surface-container-high/30
  维度名: text-xs font-bold text-on-surface w-24
  评分徽章:
    A (强): bg-tertiary/10 text-tertiary px-2 py-0.5 rounded text-[9px] font-bold
    B (适当): bg-primary/10 text-primary px-2 py-0.5 rounded text-[9px] font-bold
    C (弱): bg-warning/10 text-warning px-2 py-0.5 rounded text-[9px] font-bold
    D (问题): bg-error/10 text-error px-2 py-0.5 rounded text-[9px] font-bold
  进度条: h-1.5 bg-outline-variant/10 rounded-full flex-1
    填充: bg-{color} rounded-full
```

**可折叠详情:** 弱(C) 和 问题(D) 默认展开，强(A) 和 适当(B) 默认折叠

**Finding 条目:**
```
px-4 py-2 border-l-2 border-{severity-color}
  severity badge: text-[8px] font-bold px-1.5 py-0.5 rounded
    高: bg-error/10 text-error
    中: bg-warning/10 text-warning
    低: bg-surface-container-highest text-on-surface-variant
  标题: text-[10px] font-bold text-on-surface
  位置: text-[9px] text-on-surface-variant font-mono
  建议: text-[10px] text-primary/70 italic
```

**组件:** `src/components/pm-workshop/ValidationReport.tsx`

### 7. Finalization Checklist（定稿清单）

PRD 最终确认的有序检查清单：

```
┌─ PRD 定稿清单 ──────────────────────────┐
│ ✓ 1. 决策日志审计                       │
│ ✓ 2. 输入协调                           │
│ ✓ 3. 评审员关卡                         │
│ ▶ 4. 开放项分流                         │
│ ○ 5. 文档润色                           │
│ ○ 6. 外部交接                           │
│ ○ 7. 关闭                               │
│                                         │
│ 进度: 3/7                               │
│                                         │
│ [Create Feature →]                      │
└─────────────────────────────────────────┘
```

**容器:** `bg-surface-container-low border border-outline-variant/10 rounded-lg p-4`
**清单项:**
```
flex items-center gap-2 text-[10px] py-1
  ✓: CheckCircle2 text-tertiary (10px)
  ▶: Loader2 animate-spin text-primary (10px)
  ○: Circle text-outline-variant (10px)
```

**Create Feature 按钮:** `bg-primary text-on-primary px-4 py-2 rounded-lg text-xs font-bold`

### 8. PrdCreationPanel 面板

**文件:** `src/components/pm-workshop/PrdCreationPanel.tsx`

**Agent 集成:**
```typescript
const prdAgent = useAgentStream({
  runtimeId: pmRuntimeId,
  systemPrompt: PRD_SYSTEM_PROMPT,
  greetingMessage: "Welcome to the PRD Workshop! ...",
});
```

**PRD 文档状态（同步到右侧预览）:**
```typescript
const [prdDocument, setPrdDocument] = useState<PRDDocument>({
  title: '',
  status: 'draft',
  intent: 'create',
  sections: [],
});
```

Agent 的结构化输出更新 PRDDocument 状态，右侧 PRDDocumentPreview 实时响应。

### 9. Prompt 文件

**文件:** `src/lib/bmad/prd-prompts.ts`
- `PRD_SYSTEM_PROMPT` — 角色定义：PM 主题专家引导者
- 发现阶段、Fast Path、Coaching Path、验证、定稿等各阶段提示

## Acceptance Criteria (Gherkin)

```gherkin
Feature: PRD 创建 Skill

Scenario: 发现阶段 UI 交互
  Given 用户进入 Create PRD 子 Tab
  And 左右分屏布局显示（左: 对话, 右: PRD 预览）
  Then Agent 首先呈现 IntentSelector (3 个芯片)
  When 用户选择 "Create"
  Then Agent 呈现 StakeCalibration (3 个芯片)
  When 用户选择 "Startup"
  Then Agent 呈现 WorkModeSelector (2 个大卡片)

Scenario: Fast Path 创建 PRD
  Given 用户选择 Fast Path
  When 用户描述产品想法
  Then AI 批量生成 PRD 草稿
  And 右侧 PRDDocumentPreview 实时更新
  And [ASSUMPTION] 标签渲染为黄色可点击徽章

Scenario: [ASSUMPTION] 交互
  Given PRD 草稿包含 [ASSUMPTION: ...] 标签
  When 用户点击某个 ASSUMPTION 徽章
  Then 展开 popover 显示假设文本
  When 用户点击 [确认]
  Then 徽章变为绿色 (tertiary)
  When 用户点击 [编辑]
  Then 打开 inline textarea 修改

Scenario: 大纲导航
  Given PRD 正在构建中
  Then 右侧 Outline 显示各章节状态
  And 完成的章节显示 ✓ (绿色)
  And 进行中的章节显示 ▶ (蓝色 spinner)
  And 未开始的章节显示 ○ (灰色)

Scenario: 验证报告
  Given PRD 草稿已完成
  When 用户触发验证
  Then 显示 7 维度 ValidationReport
  And 弱/问题维度默认展开，显示 findings 和 fix suggestions
  And 评分徽章颜色正确 (A=green, B=blue, C=amber, D=red)

Scenario: PRD 转化为 Feature
  Given PRD 文档状态为 final
  And 定稿清单全部完成
  When 用户点击 "Create Feature" 按钮
  Then PRD 内容自动转化为 Feature spec.md
  And Feature 添加到 queue.yaml pending 队列

Scenario: 引用上游产出
  Given 用户在 Brainstorm 产生了想法集合
  And 在 Party Mode 获得了多角色洞察
  When 用户进入 Create PRD
  Then PRD Agent 自动引用这些产出作为输入

Scenario: 拖拽调整分屏
  Given 用户在 PRD 创建页面
  When 用户拖拽中间分隔条
  Then 左右面板宽度实时调整
```

## Checklist
- [ ] PrdCreationPanel 组件（左右分屏 + 拖拽分隔条）
- [ ] PRD Agent system prompt（中文）
- [ ] IntentSelector 意图选择芯片组件
- [ ] StakeCalibration 利益校准芯片组件
- [ ] WorkModeSelector 路径选择卡片组件
- [ ] PRDDocumentPreview 文档预览组件（大纲 + 内容）
- [ ] AssumptionTag [ASSUMPTION] 交互标签（popover 确认/编辑）
- [ ] ValidationReport 验证报告组件（7 维度 + findings）
- [ ] 定稿清单 UI（Create Feature 按钮）
- [ ] PRD → Feature spec 转化逻辑（复用 createFeature IPC）
- [ ] PRD 文件保存到工作区
- [ ] PRD 文档状态同步（Agent 输出 → 右侧预览）
- [ ] 拖拽分隔条（复用 MarkdownSplitView 模式）
- [ ] i18n 字符串
