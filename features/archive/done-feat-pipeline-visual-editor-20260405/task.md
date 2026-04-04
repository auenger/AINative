# Tasks: feat-pipeline-visual-editor

## Task Breakdown

### 1. Pipeline 编辑入口 UI
- [x] 在 AgentControlPanel Agents Tab 添加 "New Pipeline" 按钮
- [x] 添加 Pipeline 列表展示（已有的 pipelineIds）
- [x] 列表项支持编辑/删除操作

### 2. 可视化画布组件
- [x] 创建 PipelineVisualEditor 组件
- [x] 实现网格背景画布（参考 WorkflowEditor 的 node-grid 样式）
- [x] 实现 Stage 节点卡片组件（拖拽定位、选中高亮）
- [x] 实现 SVG 连线自动生成（按 stage 顺序串联）
- [x] 实现拖拽排序（改变 stage 顺序并重绘连线）

### 3. Stage 属性编辑面板
- [x] 创建 StagePropertyPanel 组件
- [x] runtime_id 下拉选择（来自 useAgentRuntimes）
- [x] prompt_template 文本编辑区（支持模板变量提示）
- [x] input_mapping key-value 编辑
- [x] max_retries / timeout_seconds 数值输入

### 4. Pipeline 配置管理
- [x] 新建 Pipeline 表单（id / name / description）
- [x] 添加/删除 Stage 操作
- [x] 全局 variables 配置
- [x] 保存调用 usePipelineEngine.savePipeline()
- [x] 删除调用 usePipelineEngine.deletePipeline()

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-05 | All 4 tasks completed | PipelineVisualEditor + StagePropertyPanel created; AgentControlPanel integrated with pipeline list + "New Pipeline" button + editor overlay |
