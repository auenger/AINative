# Tasks: feat-agent-multimodal-analyze
## Task Breakdown
### 1. Tauri 后端 — 文件解析 Command
- [x] `pmfile_read_content` Command: 统一文件内容读取（base64/text by file type）
- [x] `pmfile_read_docx` 提取逻辑: zip 解析 docx 提取文本（内置于 pmfile_read_content）
- [x] `pmfile_read_pdf`: 返回 base64（Gemini 多模态 API 直接处理）
- [x] `pmfile_read_image`: 返回 base64（内置于 pmfile_read_content）
- [x] `pmfile_read_audio`: 返回 base64（内置于 pmfile_read_content）
- [x] `pmdm_write` Command: 将分析结果 MD 写入 {workspace}/PMDM/ 目录
- [x] `pmdm_list` Command: 列出 PMDM 目录下所有 MD 文件
- [x] `pmfile_analyze` Command: 完整分析流程（读取 → 构建多模态 prompt → Gemini API → 流式响应 → 写入 PMDM）

### 2. 前端 Hook — useMultimodalAnalyze
- [x] `useMultimodalAnalyze(workspacePath)` Hook: 封装文件分析流程
- [x] 分析状态管理（idle / analyzing / done / error）
- [x] 进度追踪（per-file progress + overall progress）
- [x] 与 Gemini Runtime 集成（通过 Tauri Commands 调用 pmfile_analyze）
- [x] 已分析文件检测（checkAnalyzedFiles — 扫描 PMDM 目录）

### 3. LLM 多模态分析 Prompt 设计
- [x] 文档类分析 Prompt（文本提取 + 结构化摘要 + 需求识别）
- [x] 图片分析 Prompt（视觉描述 + UI 元素识别 + 设计建议）
- [x] 音频分析 Prompt（转录 + 摘要 + 关键决策提取）
- [x] MD 输出模板统一设计（元信息头 + 内容主体 + 分析建议）

### 4. UI — 分析交互
- [x] PMFile 文件列表每项增加"分析"操作按钮（Sparkles icon）
- [x] "全部分析"批量操作按钮（Analyze All bar）
- [x] 分析进度条（per-file streaming indicator）
- [x] 分析完成标记（CheckCircle2 green badge）
- [x] 批量进度统计（analyzedCount / total display）

### 5. 集成与测试
- [x] 与 Gemini Runtime 多模态 API 集成（image_url format + base64）
- [x] 各文件类型统一处理路由（image / audio / pdf / document / markdown / data）
- [x] 错误处理（解析失败、LLM 超时、API 错误 → analyze://error event）

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-07 | All tasks completed | Full multimodal analysis pipeline implemented |
