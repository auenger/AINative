# Tasks: feat-i18n-complete

## Task Breakdown

### 1. i18n.ts 翻译资源完善
- [x] 新增 `time` 分组: justNow, minutesAgo, today, yesterday, queueUpdatedAt
- [x] 新增 `agent` 分组: greetReqAgent, copyCommand, myAgent, newAgentHint, newPipelineHint
- [x] 新增 `upload` 分组: analyzeAll, analyzing, analyzeFiles, analyzeFile, deleteFile, confirmDelete, attachFiles
- [x] 新增 `output` 分组: clearClose, close
- [x] 新增 `pipeline` 分组: name, autoLayout, deleteStage, addStageHint, visual, analysisStage
- [x] 补充 editor 分组缺失 key: refreshTree, openTerminal
- [x] en 和 zh 翻译一一对应

### 2. TaskBoard.tsx 硬编码修复
- [x] `formatUpdatedTime()` 函数使用 t() 替换硬编码中文 (刚刚/分钟前/今天/昨天)
- [x] "队列更新于 {relative}" 使用 t('time.queueUpdatedAt', { time: relative })
- [x] title="Refresh" 替换为 t()

### 3. ProjectView.tsx 硬编码修复
- [x] reqAgent greetingMessage 使用 t('agent.greetReqAgent')
- [x] title 属性硬编码文本替换

### 4. EditorView.tsx key 注册
- [x] editor.refreshTree 在 i18n.ts 中注册 en/zh
- [x] editor.openTerminal 在 i18n.ts 中注册 en/zh

### 5. RuntimeOutputModal.tsx 接入 i18n
- [x] 添加 useTranslation import 和 hook
- [x] 替换 "Clear output and close" → t('output.clearClose')
- [x] 替换 "Close" → t('output.close')

### 6. FileUploadArea.tsx 接入 i18n
- [x] 添加 useTranslation import 和 hook
- [x] 替换所有硬编码 title/label

### 7. AgentControlPanel.tsx 接入 i18n
- [x] 添加 useTranslation import 和 hook
- [x] 替换 placeholder、title、空状态提示

### 8. Pipeline 组件接入 i18n
- [x] PipelineVisualEditor.tsx: useTranslation + 替换硬编码
- [x] PipelineEditorContainer.tsx: useTranslation + 替换 "Visual"
- [x] StagePropertyPanel.tsx: useTranslation + 替换 placeholder

### 9. 验证与测试
- [x] 全组件切换英文验证无遗漏中文
- [x] 全组件切换中文验证无遗漏英文
- [x] i18n.ts en/zh key 一致性检查

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-10 | Feature created | 完成需求分析和任务拆解 |
