# Feature: feat-editor-tab-overflow 编辑器 Tab 溢出优化

## Basic Information
- **ID**: feat-editor-tab-overflow
- **Name**: 编辑器 Tab 溢出优化
- **Priority**: 60
- **Size**: M
- **Dependencies**: none
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-07

## Description
编辑器 tab 中打开多个文件时，tab 直接超出 header 宽度，看不到新开的文件。
需要优化 tab 显示方案，确保用户始终能感知和访问所有已打开的文件。

## User Value Points
1. **Tab 溢出滚动导航** — 当 tab 超出容器宽度时，显示左右箭头按钮，点击可滚动查看隐藏的 tab
2. **Tab 溢出下拉菜单** — 在 tab 栏右侧提供下拉菜单，列出所有已打开文件，支持快速切换和关闭

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/EditorView.tsx` (lines 846-903) — 当前 tab 渲染逻辑
- `neuro-syntax-ide/src/types.ts` — OpenFileState 接口
- `neuro-syntax-ide/src/index.css` (lines 314-316) — `.scroll-hide` 样式

### Current Implementation Issues
- Tab 容器使用 `overflow-x-auto scroll-hide`，滚动条被隐藏
- 每个 tab 设 `shrink-0`，不会自适应压缩
- 文件名限制 `max-w-[120px]`，但 tab 本身不压缩
- 没有滚动导航按钮或溢出菜单

### Related Features
- feat-editor-save-status — 编辑器状态优化（已完成）

## Technical Solution

### 方案：Scrollable Tabs + Overflow Dropdown

#### 1. Tab 溢出滚动
- 使用 `useRef` + `ResizeObserver` 检测 tab 容器是否溢出
- 溢出时显示左右箭头按钮（ChevronLeft/ChevronRight）
- 点击箭头平滑滚动 tab 容器
- 激活 tab 自动滚动到可视区域（scrollIntoView）

#### 2. Tab 溢出下拉菜单
- 在 tab 栏最右侧固定位置放置一个下拉触发按钮
- 点击展示所有已打开文件列表
- 每项显示：文件图标 + 文件名 + 修改状态 + 关闭按钮
- 当前激活项高亮标记

#### 3. Tab 自适应压缩（可选增强）
- 当 tab 数量增多但未溢出时，逐步压缩 tab 宽度
- 文件名 `max-w` 随 tab 数量动态调整

## Acceptance Criteria (Gherkin)

### User Story
作为一个开发者，我希望在编辑器中打开多个文件时，能够方便地找到和切换到任何已打开的文件，
这样我就不会因为 tab 溢出而丢失对文件的访问。

### Scenarios

#### Scenario 1: Tab 溢出时显示滚动箭头
```gherkin
Given 编辑器打开了 5 个文件
And tab 栏宽度只能显示 3 个 tab
When tab 总宽度超出容器
Then 左侧显示左箭头按钮
And 右侧显示右箭头按钮
And 点击右箭头，tab 栏向左滚动
And 点击左箭头，tab 栏向右滚动
```

#### Scenario 2: 切换到不可见的 tab 自动滚动
```gherkin
Given 编辑器打开了 5 个文件
And 第 5 个文件的 tab 在可视区域外
When 用户通过文件树点击第 5 个文件
Then tab 栏自动滚动，使第 5 个文件的 tab 可见
And 该 tab 显示为激活状态
```

#### Scenario 3: 溢出下拉菜单快速切换
```gherkin
Given 编辑器打开了 8 个文件
When 用户点击 tab 栏右侧的下拉菜单按钮
Then 显示所有 8 个文件的列表
And 每项显示文件图标、文件名、修改状态
And 当前激活文件高亮标记
When 用户点击列表中某个文件
Then 切换到该文件
And tab 栏自动滚动到对应 tab
And 下拉菜单关闭
```

#### Scenario 4: 下拉菜单中关闭文件
```gherkin
Given 编辑器打开了 5 个文件
And 用户打开了 tab 溢出下拉菜单
When 用户点击某个文件的关闭按钮
Then 该文件被关闭
And 下拉菜单更新显示剩余 4 个文件
```

#### Scenario 5: 少量 tab 不显示溢出 UI
```gherkin
Given 编辑器打开了 2 个文件
And 所有 tab 都在可视区域内
Then 不显示左右滚动箭头
And 下拉菜单按钮仍显示（用于快速查看所有文件）
```

### UI/Interaction Checkpoints
- [ ] 滚动箭头在溢出时平滑出现/消失
- [ ] 激活 tab 高亮始终可见
- [ ] 下拉菜单定位正确，不遮挡内容
- [ ] 下拉菜单支持键盘导航（上下箭头 + Enter）
- [ ] hover 状态和点击反馈流畅

### General Checklist
- [ ] 不引入新依赖
- [ ] 复用现有设计系统（颜色/字体/动画）
- [ ] 使用 `cn()` 合并样式
- [ ] 类型安全（TypeScript）
