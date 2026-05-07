# Feature: feat-agent-multimodal-chat Agent 多模态消息支持

## Basic Information
- **ID**: feat-agent-multimodal-chat
- **Name**: Agent 多模态消息支持
- **Priority**: 80
- **Size**: M
- **Dependencies**: feat-agent-tool-exec
- **Parent**: feat-agent-tool-loop
- **Children**: []
- **Created**: 2026-05-06

## Description

恢复 PM Agent 的多模态能力。当前 `HttpProviderRuntime` 只发送纯文本消息到 API，不支持 `image_url` 内容块。已有的 `useMultimodalChat` hook 和 `FileUploadArea` 组件可以收集文件引用，但图片/文件的 base64 数据无法传递给 API。

需要修改消息格式，支持在 API 请求中包含多模态内容块（图片 base64、文件内容等），使 PM Agent 能"看到"用户上传的图片和文件。

## User Value Points

### VP1: 图片理解
用户上传截图/设计稿，PM Agent 能理解图片内容并给出分析或生成对应代码。

### VP2: 文件内容感知
用户引用文件后，PM Agent 能读取文件内容并结合分析，给出更准确的建议。

## Context Analysis

### Reference Code
- `src/lib/useMultimodalChat.ts` — 已有的多模态消息构建 hook（当前只注入文本描述）
- `src/lib/usePMFiles.ts` — 文件上传管理
- `src/components/common/FileUploadArea.tsx` — 文件上传 UI
- `src-tauri/src/lib.rs` — `pmfile_read_content` (line ~10665, 已有 base64 读取)
- `src-tauri/src/lib.rs` — `pmfile_analyze` (line ~10941, 已有多模态 API 调用参考)

### Related Features
- feat-agent-tool-exec (前置依赖)
- feat-agent-multimodal-upload (已归档，上传功能)
- feat-agent-multimodal-analyze (已归档，分析功能)

## Technical Solution

### 1. Rust 后端：消息格式扩展

修改 `HttpProviderRuntime::execute()` 中的消息构建逻辑，支持多模态 content 数组：

**Anthropic 格式**：
```json
{
  "role": "user",
  "content": [
    {"type": "text", "text": "分析这张图片"},
    {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "..."}}
  ]
}
```

**OpenAI 格式**：
```json
{
  "role": "user",
  "content": [
    {"type": "text", "text": "分析这张图片"},
    {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}}
  ]
}
```

### 2. 前端：传递 base64 数据到消息

当前 `useMultimodalChat.enrichMessage()` 只注入文本描述。需要扩展为同时传递文件 base64 数据。

方案：消息 JSON 格式扩展，支持 `attachments` 字段：
```json
{
  "role": "user",
  "content": "消息文本",
  "attachments": [
    {"type": "image", "mime": "image/png", "data": "base64..."},
    {"type": "file", "name": "config.yaml", "content": "文件文本内容"}
  ]
}
```

后端解析消息时，检查 `attachments` 字段并转换为对应 API 格式的 content 数组。

### 3. 已有基础设施复用

- `pmfile_read_content` 已支持读取文件 base64（图片/音频/PDF）
- `FileUploadArea` 已支持拖拽上传
- `useMultimodalChat` 已有文件引用管理

## Acceptance Criteria (Gherkin)

### Scenario 1: 上传图片并分析
```gherkin
Given 用户在 PM Agent 对话中上传了一张 UI 设计稿截图
When 发送消息 "分析这个设计稿"
Then 图片 base64 数据被包含在 API 请求中
And PM Agent 能描述图片内容并给出分析建议
```

### Scenario 2: 引用文件内容
```gherkin
Given 用户在 PM Agent 对话中引用了 config.yaml 文件
When 发送消息 "分析这个配置文件"
Then 文件内容被包含在 API 请求中
And PM Agent 能基于文件内容给出建议
```

### Scenario 3: 纯文本消息不受影响
```gherkin
Given 用户发送纯文本消息（无附件）
When 消息被发送到 API
Then API 请求格式与改造前一致（纯文本 content）
```

### General Checklist
- [x] Anthropic 和 OpenAI 格式都支持多模态
- [x] 大文件 base64 不导致性能问题（设上限）
- [x] 纯文本消息向后兼容

## Merge Record

- **completed**: 2026-05-06T18:30:00Z
- **merged_branch**: feature/feat-agent-multimodal-chat
- **merge_commit**: a285ad1
- **archive_tag**: feat-agent-multimodal-chat-20260506
- **conflicts**: none
- **verification**: passed (code analysis, 3/3 Gherkin scenarios)
- **stats**: 1 commit, 8 files changed, 476 insertions, 19 deletions
