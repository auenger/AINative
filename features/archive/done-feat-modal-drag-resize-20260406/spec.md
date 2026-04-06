# Feature: feat-modal-drag-resize Modal Drag & Resize

## Basic Information
- **ID**: feat-modal-drag-resize
- **Name**: NewTaskModal 拖拽移动与调整大小
- **Priority**: 60
- **Size**: S
- **Dependencies**: none
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-06

## Description

NewTaskModal 弹窗增加拖拽移动和调整大小能力，对齐 TaskBoard Feature Detail Modal 的现有实现方案。

核心改动：
1. Header 区域通过 `mousedown/mousemove/mouseup` 实现拖拽移动，带 viewport 边界 clamp
2. CSS `resize: 'both'` + `overflow: 'hidden'` 实现自由调整大小
3. 拖拽中 header 显示 `cursor-grabbing`，默认显示 `cursor-grab`

## User Value Points

1. **VP1: 自由定位弹窗** — 用户可通过拖拽 header 将弹窗移动到屏幕任意位置，避免遮挡其他内容

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx` L293-331 — Feature Detail Modal 的拖拽实现（复制此模式）
- `neuro-syntax-ide/src/components/views/NewTaskModal.tsx` L346-363 — 当前 modal 容器（需改造）

### Related Documents
- `feature-workflow/config.yaml` — 项目配置

### Related Features
- `feat-detail-modal-interaction` (已完成) — Task 详情弹窗的拖拽+resize 方案参考
- `feat-git-modal-enhance` (已完成) — Git 弹窗的拖拽+resize 方案参考

## Technical Solution

### 实现步骤

1. 在 `NewTaskModal.tsx` 中添加拖拽状态：
   ```ts
   const [modalPos, setModalPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
   const [isDraggingModal, setIsDraggingModal] = useState(false);
   const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
   ```

2. 添加 `handleModalHeaderMouseDown` handler（与 TaskBoard L298-307 一致）

3. 添加 `useEffect` 监听 `mousemove/mouseup`（与 TaskBoard L309-331 一致）

4. 修改 modal 容器：
   - `motion.div` 的 animate 加入 `x: modalPos.x, y: modalPos.y`
   - style 中添加 `resize: 'both'`, `overflow: 'hidden'`, `minWidth/minHeight`
   - className 加入 `isDraggingModal && "select-none"`

5. Header 区域添加 `onMouseDown={handleModalHeaderMouseDown}` 和 cursor 样式

6. Close 时重置 `modalPos` 为 `{ x: 0, y: 0 }`

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望 NewTaskModal 可以拖拽移动和调整大小，以便在不遮挡其他内容的情况下创建新 feature。

### Scenarios (Given/When/Then)

**Scenario 1: 拖拽移动弹窗**
```gherkin
Given NewTaskModal 弹窗已打开
When 用户在 header 区域按住鼠标左键并拖动
Then 弹窗跟随鼠标移动
And 弹窗不会超出 viewport 边界
And header 光标从 cursor-grab 变为 cursor-grabbing
```

**Scenario 2: 调整弹窗大小**
```gherkin
Given NewTaskModal 弹窗已打开
When 用户拖拽弹窗右下角 resize handle
Then 弹窗尺寸随之改变
And 弹窗有最小宽高限制 (minWidth: 480, minHeight: 360)
```

**Scenario 3: 关闭后重置位置**
```gherkin
Given 用户已拖拽 NewTaskModal 到非默认位置
When 用户关闭弹窗后重新打开
Then 弹窗回到默认居中位置 (modalPos 重置为 {x:0, y:0})
```

### UI/Interaction Checkpoints
- Header 区域 hover 时显示 `cursor-grab`
- 拖拽中显示 `cursor-grabbing` 且内容不可选中 (`select-none`)
- resize handle 在右下角可见
- modal 有 `minWidth: 480`, `minHeight: 360` 下限

### General Checklist
- 不引入新的第三方依赖
- 拖拽实现与 TaskBoard Feature Detail Modal 保持一致
- 不影响现有 step 流程的交互

## Merge Record

- **completed**: 2026-04-06
- **merged_branch**: feature/feat-modal-drag-resize
- **merge_commit**: 0ecdde3
- **archive_tag**: feat-modal-drag-resize-20260406
- **conflicts**: none
- **verification**: passed (3/3 Gherkin scenarios via code analysis)
- **stats**: 1 commit, 1 file changed, 62 insertions, 4 deletions
