# Tasks: feat-pipeline-yaml-editor

## Task Breakdown

### 1. YAML/JSON 编辑器组件
- [x] 创建 PipelineTextEditor 组件
- [x] textarea + monospace 字体渲染
- [x] YAML ↔ JSON 格式切换按钮
- [x] 格式互转逻辑（JSON.stringify / 自实现 YAML 序列化）

### 2. 校验逻辑
- [x] YAML/JSON 语法校验
- [x] PipelineConfig 类型校验（必需字段检查）
- [x] 错误信息展示

### 3. 保存集成
- [x] 解析文本为 PipelineConfig 对象
- [x] 调用 usePipelineEngine.savePipeline()
- [x] 校验失败时禁用保存

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-05 | All tasks completed | PipelineTextEditor created with YAML/JSON editing, validation, and save integration |
