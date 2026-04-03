# Feature: feat-git-modal-compact Git 弹窗布局优化

## Basic Information
- **ID**: feat-git-modal-compact
- **Name**: Git 弹窗布局优化（高度限制 + 内容分组折叠）
- **Priority**: 70
- **Size**: S
- **Dependencies**: feat-git-integration
- **Parent**: null
- **Children**: none
- **Created**: 2026-04-03

## Description
项目页面的 Git 按钮弹窗一次展示所有内容（分支信息 + 全部变更文件列表 + 底部操作区），当变更文件较多时弹窗高度超出视口，内容显示不全。需要优化弹窗高度，确保内容在任何屏幕尺寸下都能完整显示和操作。

## User Value Points
1. **弹窗高度可控**：弹窗不超出视口高度，所有操作可达（Commit / Push / Pull 按钮不被截断）
2. **内容分组折叠**：Staged / Unstaged / Untracked 文件组可折叠，减少一次性展示的内容量

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — Git Modal 定义在 L749-L1029
  - 弹窗容器：`max-w-lg` 限宽，无 `max-h` 限高
  - 内容区：分支图 SVG + 完整文件列表平铺
  - 底部：Commit 输入框 + Push/Pull 按钮
- `neuro-syntax-ide/src/lib/useGitStatus.ts` — Git 状态数据 Hook

### Related Features
- feat-git-integration (已完成) — Git 集成基础功能

## Technical Solution

### 弹窗高度约束
- 弹窗容器添加 `max-h-[85vh]` CSS 类，确保弹窗在任何文件数量下不超过视口 85%
- 布局改为 flex-col 三段式：Header (`shrink-0`) + Content (`flex-1 overflow-y-auto scroll-hide`) + Footer (`shrink-0`)
- Footer 区域（Commit 输入框 + Push/Pull 按钮）始终可见，不受内容滚动影响

### 文件分组折叠
- 新增 `collapsedGroups` state（`Record<string, boolean>`），管理 staged / unstaged / untracked 三个组的折叠状态
- 默认状态：staged 和 unstaged 展开显示（false），untracked 折叠（true）
- 将原先混合的 "Changes" 组拆分为三个独立分组：Staged (tertiary)、Modified (primary)、Untracked (warning)
- 每组标题为可点击按钮，带 ChevronDown/ChevronRight 切换图标
- 折叠态显示文件数量 badge（带背景色圆角标签）
- 使用 `AnimatePresence` + `motion.div` 实现展开/折叠过渡动画（height: 0 -> auto, opacity: 0 -> 1, duration 0.2s easeInOut）

## Acceptance Criteria (Gherkin)
### User Story
作为用户，我希望 Git 弹窗在任何文件数量下都能完整显示，方便我执行 Git 操作。

### Scenarios (Given/When/Then)

**Scenario 1: 弹窗高度限制**
- Given 项目有 20+ 个变更文件
- When 用户点击 Git 按钮打开弹窗
- Then 弹窗高度不超过视口高度的 85%
- And 弹窗内容区域可滚动
- And 底部 Commit / Push / Pull 按钮始终可见

**Scenario 2: 文件分组折叠**
- Given 项目有 staged 和 unstaged 文件
- When 用户打开 Git 弹窗
- Then Staged 文件组和 Unstaged 文件组分别显示文件数量
- And 用户点击组标题可折叠/展开该组
- And 默认 Staged 展开其余折叠（或全部展开，实现时决定）

**Scenario 3: 少量文件正常显示**
- Given 项目只有 1-3 个变更文件
- When 用户打开 Git 弹窗
- Then 弹窗紧凑显示，无多余空白
- And 无需滚动即可看到所有内容和操作按钮

### UI/Interaction Checkpoints
- 弹窗容器增加 `max-h-[85vh]` 或类似约束
- Header 固定、Footer 固定、中间内容区 `overflow-y-auto`
- 文件分组增加折叠/展开交互（点击标题切换）
- 折叠态显示文件数量 badge

### General Checklist
- [x] 弹窗在任何文件数量下不超出视口
- [x] Footer 操作区始终可见
- [x] 折叠/展开动画平滑
- [x] 深色/浅色主题下样式正确

## Merge Record
- **Completed**: 2026-04-04
- **Merged Branch**: feature/feat-git-modal-compact
- **Merge Commit**: f0a4c931b3340b3c2a9eb7cc543c331d227c945f
- **Archive Tag**: feat-git-modal-compact-20260404
- **Conflicts**: none
- **Verification**: passed (3/3 scenarios)
- **Development Stats**: 1 commit, 1 file changed, 200 insertions, 81 deletions
