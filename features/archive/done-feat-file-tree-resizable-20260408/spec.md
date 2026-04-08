# Feature: feat-file-tree-resizable 文件树横向拖拽调整宽度

## Basic Information
- **ID**: feat-file-tree-resizable
- **Name**: 文件树横向拖拽调整宽度
- **Priority**: 60
- **Size**: S
- **Dependencies**: none
- **Parent**: null
- **Children**: none
- **Created**: 2026-04-08

## Description
编辑器区域的文件树（左侧边栏）当前使用固定 `w-64` (256px) 宽度，无法横向拖拽调整。需要实现拖拽分隔条来自由调整文件树宽度，同时保证文本编辑区域自适应剩余空间。

## User Value Points
1. **拖拽调整宽度** — 用户可通过拖拽文件树右侧边缘来调整文件树宽度，满足不同屏幕尺寸和偏好
2. **宽度记忆** — 调整后的宽度在当前会话内保持一致
3. **兼容性保障** — 文本编辑区域自适应剩余宽度，Monaco 编辑器正确重绘；最小/最大宽度约束防止布局崩溃

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/EditorView.tsx` — 编辑器主布局，文件树固定 `w-64`
- 终端面板拖拽调整实现 (EditorView.tsx:274-305) — 可复用的拖拽逻辑模式

### Related Features
- `fix-terminal-io-resize` — 终端面板动态调整（已有拖拽实现可参考）

## Technical Solution
Added horizontal drag-resize to the file tree sidebar in EditorView.tsx:
- `sidebarWidth` state (default 256px, min 150px, max 500px) replaces fixed `w-64` class
- Drag logic mirrors the terminal panel resize pattern using refs + document mousemove/mouseup listeners
- `col-resize` cursor on hover, `select-none` during drag via document.body.style
- Double-click on divider resets to default 256px
- 1px-wide divider with invisible hit area (-1px each side) for easier grabbing
- Monaco `automaticLayout: true` (already set) handles editor redraw automatically
- No external libraries introduced

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望通过拖拽来调整文件树宽度，以便在不同场景下获得最优的编辑空间分配。

### Scenarios (Given/When/Then)

#### Scenario 1: 拖拽调整文件树宽度
```gherkin
Given 编辑器视图已打开并显示文件树和编辑器
When 用户将鼠标移至文件树右侧边缘（出现拖拽光标）
And 用户按下鼠标并左右拖拽
Then 文件树宽度跟随鼠标位置实时变化
And 文本编辑区域宽度自动调整填充剩余空间
```

#### Scenario 2: 最小宽度约束
```gherkin
Given 文件树当前宽度为 180px
When 用户尝试将文件树拖拽至小于 150px
Then 文件树宽度停止在 150px 不再缩小
```

#### Scenario 3: 最大宽度约束
```gherkin
Given 编辑器窗口总宽度为 1200px
When 用户尝试将文件树拖拽至超过 500px
Then 文件树宽度停止在 500px 不再扩大
```

#### Scenario 4: 双击分隔条恢复默认宽度
```gherkin
Given 文件树已被调整为 350px
When 用户双击分隔条
Then 文件树宽度恢复为默认 256px
```

#### Scenario 5: Monaco 编辑器正确重绘
```gherkin
Given 文件树正在被拖拽调整宽度
When 文件树宽度变化
Then Monaco 编辑器布局正确重绘，无闪烁或空白区域
```

### UI/Interaction Checkpoints
- [ ] 分隔条 hover 时显示 `col-resize` 光标
- [ ] 分隔条视觉指示（细线或微弱高亮）
- [ ] 拖拽过程中无文本选中副作用
- [ ] 文件树内容在宽度变化时正确重排

### General Checklist
- [ ] 不引入外部 resizable 库（复用终端面板的拖拽模式）
- [ ] 保留现有 `shrink-0` 和 `flex-1` 布局语义
- [ ] 最小宽度 150px，最大宽度 500px，默认 256px
