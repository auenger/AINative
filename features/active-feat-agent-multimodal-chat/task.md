# Tasks: feat-agent-multimodal-chat

## Task Breakdown

### 1. Rust 后端消息格式扩展
- [x] 定义 `MessageAttachment` 结构体：`{ type, mime, data, name?, content? }`
- [x] 修改消息解析逻辑，识别 `attachments` 字段
- [x] OpenAI 兼容格式：将 attachments 转为 `{"type":"image_url","image_url":{...}}` content 块
- [x] 提取 `build_message_json()` 辅助函数消除重复代码

### 2. 前端消息构建
- [x] 扩展 `useMultimodalChat.enrichMessage()` 返回值，包含 attachments 数组
- [x] 从 `pmfile_read_content` 获取文件的 base64 数据
- [x] 消息 payload 格式扩展，包含 attachments
- [x] `useAgentStream.sendMessage()` 支持可选 attachments 参数
- [x] `ProjectView` PM Agent 和 REQ Agent 发送路径均传递 attachments

### 3. 向后兼容
- [x] 无 attachments 时消息格式与原来一致（`#[serde(default)]` + `build_message_json` fallback）
- [x] 文件大小上限检查（10 MB，通过 `MAX_ATTACHMENT_BASE64_LENGTH` 常量）

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-06 | Feature created | 从 feat-agent-tool-loop 拆分 |
| 2026-05-06 | Implementation complete | Rust 后端 + 前端 + 向后兼容全部完成 |
