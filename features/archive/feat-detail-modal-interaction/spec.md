# Feature: feat-detail-modal-interaction Task 详情弹窗交互增强

## Basic Information
- **ID**: feat-detail-modal-interaction
- **Name**: Task 详情弹窗交互增强（拖拽 + 调整大小 + MD 内容修复）
- **Priority**: 60
- **Size**: M
- **Dependencies**: []
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-02T21:00:00Z

## Description
当前 TaskBoard 看板中点击 feature 卡片弹出的详情弹窗存在三个问题：
1. 弹窗不能拖拽，位置固定在屏幕中央无法移动
2. 弹窗不能调整大小（resize），内容较多时查看不便
3. 虽然 feature 状态已正确识别，但点击已归档（completed）的 feature 时，MD 内容不渲染，因为 Rust 后端的 `read_feature_detail` 没有搜索 `features/archive/done-{id}-YYYYMMDD/` 目录

## User Value Points

### VP1: 弹窗可拖拽
用户可以按住弹窗标题栏拖动弹窗在屏幕上自由移动，方便同时查看弹窗内容与看板数据。

### VP2: 弹窗可调整大小
用户可以通过拖拽弹窗边缘/角落来调整弹窗尺寸，根据内容量灵活控制显示区域。

### VP3: 已归档 feature 的 MD 内容正确加载
用户点击任何状态的 feature（包括已归档的 completed feature），都能正确读取并渲染对应的 spec.md / task.md / checklist.md。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx` — 弹窗组件 (lines 506-696)
  - 固定 `max-w-2xl`，无拖拽/调整大小逻辑
- `neuro-syntax-ide/src-tauri/src/lib.rs` — `read_feature_detail` command (lines 673-716)
  - 只搜索 `pending-{id}`、`active-{id}`、`{id}`，不搜索 archive 目录
- `neuro-syntax-ide/src/components/common/MarkdownRenderer.tsx` — MD 渲染组件（已就绪）

### Related Documents
- `project-context.md` — Phase 2 FS-as-Database 数据绑定

### Related Features
- `feat-md-render-task-detail` (已完成) — 基础 MD 渲染能力
- `feat-fs-database-engine` (已完成) — FS 数据引擎

## Technical Solution

### VP1: 弹窗拖拽
在弹窗 header 区域添加 `onMouseDown` 事件处理，实现自定义拖拽逻辑：
- 记录鼠标按下时的偏移量
- `onMouseMove` 更新弹窗位置（通过 `transform: translate` 或 `top/left`）
- `onMouseUp` 停止拖拽
- header 区域添加 `cursor: grab / grabbing` 视觉反馈

方案选择：使用原生 JS 实现拖拽，不引入额外 npm 依赖。

### VP2: 弹窗调整大小
在弹窗右下角添加 resize handle：
- 使用 CSS `resize: both` + `overflow: auto`（最简方案）
- 或自定义 resize handle 组件（更精确控制）
- 设置 `min-width` / `min-height` 防止弹窗过小
- 方案选择：CSS resize，简单可靠

### VP3: 修复 MD 内容加载
修改 Rust `read_feature_detail` 函数的搜索逻辑，增加 archive 目录搜索：
```rust
let candidates = [
    format!("pending-{}", feature_id),
    format!("active-{}", feature_id),
    feature_id.clone(),
];
// 新增: 搜索 archive/done-{id}-* 目录
if feat_dir.is_none() {
    let archive_dir = features_dir.join("archive");
    if archive_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(&archive_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with(&format!("done-{}", feature_id)) {
                    feat_dir = Some(entry.path());
                    break;
                }
            }
        }
    }
}
```

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我想要在 Task 详情弹窗中自由拖拽和调整大小，并且所有状态的 feature 都能正确展示 MD 文档内容。

### Scenarios (Given/When/Then)

#### Scenario 1: 拖拽弹窗
```gherkin
Given 用户在看板视图中点击了一个 feature 卡片
And 详情弹窗已显示在屏幕中央
When 用户在弹窗标题栏区域按住鼠标并移动
Then 弹窗跟随鼠标移动
And 弹窗始终保持在可视区域内
When 用户松开鼠标
Then 弹窗停留在当前位置
```

#### Scenario 2: 调整弹窗大小
```gherkin
Given 用户已打开一个 feature 详情弹窗
When 用户拖拽弹窗右下角的 resize handle
Then 弹窗尺寸随鼠标移动而改变
And 弹窗尺寸不小于最小限制 (min-width: 400px, min-height: 300px)
```

#### Scenario 3: 已归档 feature 的 MD 内容加载
```gherkin
Given 看板显示了一个 status 为 completed 的 feature
And 该 feature 的文件存放在 features/archive/done-{id}-YYYYMMDD/ 目录下
When 用户点击该 feature 卡片
Then 弹窗打开并显示 spec.md / task.md / checklist.md 的 Markdown 渲染内容
And tab 上的绿色指示点正确显示哪些文件有内容
```

#### Scenario 4: 非 Tauri 环境降级
```gherkin
Given 应用在浏览器开发模式下运行 (非 Tauri)
When 用户点击 feature 卡片
Then 弹窗正常打开显示基本信息
And MD 内容区域显示 "No spec available" 等占位提示
```

### UI/Interaction Checkpoints
- [ ] 弹窗 header 区域显示 `cursor: grab` 提示可拖拽
- [ ] 拖拽时 header 变为 `cursor: grabbing`
- [ ] resize handle 在弹窗右下角可见
- [ ] tab 切换时内容区正确渲染 Markdown
- [ ] 关闭弹窗后再次打开，位置重置到屏幕中央

### General Checklist
- [ ] 无新增 npm 依赖
- [ ] 不影响看板卡片的拖拽排序功能
- [ ] 不影响弹窗的打开/关闭动画
