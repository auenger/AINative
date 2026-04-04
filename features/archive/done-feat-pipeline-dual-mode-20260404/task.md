# Tasks: feat-pipeline-dual-mode

## Task Breakdown

### 1. 统一编辑器容器
- [x] 创建 PipelineEditorContainer 组件
- [x] 集成 PipelineVisualEditor 和 PipelineTextEditor
- [x] 模式切换按钮（Visual / YAML / JSON）
- [x] 共享 PipelineConfig 状态

### 2. 双向同步逻辑
- [x] Visual → Text：serialize PipelineConfig → YAML/JSON
- [x] Text → Visual：parse YAML/JSON → PipelineConfig → 更新节点
- [x] 切换时校验：Text 模式有语法错误时阻止切换
- [x] 未保存修改检测与提示

### 3. 统一操作栏
- [x] Save / Cancel / Delete 按钮
- [x] 状态指示（已保存 / 有未保存修改）

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-04 | All tasks completed | Created usePipelineDualMode hook, PipelineEditorContainer component; updated PipelineTextEditor for controlled mode; updated AgentControlPanel to use unified container. Build passes. |
