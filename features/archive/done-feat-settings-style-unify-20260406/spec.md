# Feature: feat-settings-style-unify Settings 页面样式优化与配置页统一样式

## Basic Information
- **ID**: feat-settings-style-unify
- **Name**: Settings 页面样式优化与配置页统一样式
- **Priority**: 75
- **Size**: S
- **Dependencies**: none
- **Parent**: null
- **Children**: empty
- **Created**: 2026-04-06T12:00:00Z

## Description
优化 Settings 页面的布局样式，使内容模块在视口中居中显示；同时检查并统一所有配置相关页面（SettingsView、AgentControlPanel、ConfigTreeView 等）的视觉风格，包括容器样式、间距、表单控件、Tab 样式等，确保一致的视觉体验。

## User Value Points
1. **设置页面居中布局**: Settings 页面内容在宽屏下居中显示，提升视觉聚焦感，避免内容贴左
2. **配置页样式统一**: 所有配置/设置相关页面使用一致的容器、表单、Tab、按钮样式，消除视觉割裂感

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/SettingsView.tsx` — 主设置页，当前 `max-w-2xl` 左对齐
- `neuro-syntax-ide/src/components/views/AgentControlPanel.tsx` — Agent 配置面板，使用 `glass-panel` 样式
- `neuro-syntax-ide/src/components/views/ConfigTreeView.tsx` — 配置文件树编辑器
- `neuro-syntax-ide/src/index.css` — 设计系统 CSS 变量

### Related Documents
- Design System 颜色/字体/动画定义

### Related Features
- feat-settings-llm-config (已完成) — 原始 Settings 页面创建

## Technical Solution

### Approach: Shared CSS Utility Classes

Added unified config-page style utility classes to `index.css` using Tailwind's `@apply` directive:

- **`config-input`** / **`config-input-mono`**: Standardized form input style (border, background, rounded-md, focus ring)
- **`config-label`**: Standardized label style (text-[10px], uppercase, tracking-wider)
- **`config-card`**: Standardized card/section container (border, bg, rounded-lg, p-4)
- **`config-section-title`**: Section heading style (xs, bold, uppercase, tracking-widest)
- **`config-page-header`** / **`config-page-title`** / **`config-page-subtitle`**: Page-level header styles
- **`config-tab-active`** / **`config-tab-inactive`**: Unified tab button styles
- **`config-action-btn`**: Small action button style

### Files Changed

1. **`neuro-syntax-ide/src/index.css`**: Added shared config utility classes
2. **`neuro-syntax-ide/src/components/views/SettingsView.tsx`**:
   - Added `mx-auto` to center content at `max-w-3xl`
   - Replaced all inline form styles with shared utility classes
   - Used `config-tab-active`/`config-tab-inactive` for tab buttons
   - Used `config-card` for section containers
   - Used `config-page-header`/`config-page-title`/`config-page-subtitle` for header
3. **`neuro-syntax-ide/src/components/views/AgentControlPanel.tsx`**:
   - Replaced all inline form styles with shared utility classes
   - Used `config-section-title` for section headings
   - Used `config-page-header`/`config-page-title`/`config-page-subtitle` for tab page headers
   - Used `config-action-btn` for action buttons
   - Standardized `rounded-sm` to `rounded-md` throughout

### Key Design Decisions
- Used CSS `@apply` in index.css rather than React component constants, so styles are shareable across any component without imports
- All CSS variables (theme-aware colors) are preserved - no hardcoded colors added
- `rounded-md` chosen as standard border radius for consistency with modern Material-like design

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望设置和配置页面有一致的视觉体验，内容居中展示，让我在不同配置页面之间切换时感到舒适和专业。

### Scenarios (Given/When/Then)

#### Scenario 1: Settings 页面内容居中
- Given 用户打开 Settings 页面
- When 视口宽度大于内容宽度时
- Then 内容区域水平居中显示，两侧有适当留白

#### Scenario 2: Settings 页面窄屏适配
- Given 用户在较窄的窗口打开 Settings 页面
- When 视口宽度小于等于内容最大宽度
- Then 内容左右保持合理 padding，不贴边

#### Scenario 3: 配置页面 Tab 样式一致
- Given 用户在 Settings 页面和 Agent Control Panel 之间切换
- When 查看各自的 Tab 导航
- Then Tab 的样式（字号、颜色、激活态、间距）保持一致

#### Scenario 4: 表单控件样式统一
- Given 用户在任意配置页面中
- When 查看输入框、选择器、按钮等表单元素
- Then 所有表单控件使用一致的边框、背景色、圆角和聚焦样式

#### Scenario 5: 容器和卡片样式统一
- Given 用户在配置页面中查看分组内容
- When 查看内容区块/卡片容器
- Then 容器使用一致的背景色、边框、圆角和内间距

### UI/Interaction Checkpoints
- Settings 页面居中后视觉平衡
- Tab 切换样式在 Settings 和 Agent 面板间保持一致
- 表单控件在不同配置页面间样式统一

### General Checklist
- [ ] 不影响已有功能逻辑
- [ ] 深色/浅色主题下均表现正常
- [ ] 响应式布局在窄屏下正常
