# Feature: feat-fix-read-file 修复编辑器文件读取

## Basic Information
- **ID**: feat-fix-read-file
- **Name**: 修复编辑器 read_file / write_file Command 缺失
- **Priority**: 90
- **Size**: S
- **Dependencies**: feat-editor-monaco
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-02

## Description
编辑器 Tab 页面文件树加载正常，但点击文件时报错 `Command read_file not found`，无法查看文件内容。
根因：前端 EditorView.tsx 调用 `invoke('read_file')` 和 `invoke('write_file')`，但 Rust 后端 lib.rs 中未注册这两个 Tauri command。

## User Value Points
1. **点击文件树中的文件能正确打开并显示内容** — 用户可以在编辑器中浏览和编辑任意文件

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/EditorView.tsx` — 前端调用 `invoke('read_file')` / `invoke('write_file')`
- `neuro-syntax-ide/src-tauri/src/lib.rs` — Rust 后端 command 注册（缺少 read_file / write_file）
- `neuro-syntax-ide/src/lib/useWorkspace.ts` — 已有 `read_file_tree` 等 command 的参考实现

### Related Documents
- project-context.md — IPC Contract 定义了 `read_file` 和 `write_file` 接口

### Related Features
- feat-editor-monaco — Monaco Editor 代码编辑器（已完成）
- feat-workspace-loader — 工作区加载器 + 真实文件树（已完成）

## Technical Solution

### 1. 在 lib.rs 中添加 `read_file` command
```rust
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file '{}': {}", path, e))
}
```

### 2. 在 lib.rs 中添加 `write_file` command
```rust
#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Failed to write file '{}': {}", path, e))
}
```

### 3. 在 `invoke_handler` 中注册这两个 command
```rust
.invoke_handler(tauri::generate_handler![
    // ...existing commands...
    read_file,
    write_file,
])
```

### 前端代码无需修改
前端 EditorView.tsx 中的 `readFileContent` 和 `writeFileContent` 已经正确实现了 Tauri invoke 调用逻辑，只是后端缺少对应的 command。

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望在文件树中点击文件时能在编辑器中查看文件内容，以便浏览和编辑项目文件。

### Scenarios (Given/When/Then)

**Scenario 1: 点击文件树中的文件成功打开**
```gherkin
Given 用户已选择工作区且文件树正常加载
When 用户点击文件树中的一个文件
Then 编辑器应显示该文件的完整内容
And 不再出现 "Command read_file not found" 错误
```

**Scenario 2: 编辑文件并保存**
```gherkin
Given 编辑器中已打开一个文件
When 用户编辑文件内容并触发保存
Then 文件内容应成功写入磁盘
And 状态栏提示保存成功
```

**Scenario 3: 读取不存在的文件错误处理**
```gherkin
Given 文件树中显示了一个已被外部删除的文件
When 用户点击该文件
Then 应显示友好的错误提示信息
And 应用不应崩溃
```

### General Checklist
- [x] Rust command 实现完整
- [x] 错误处理包含文件路径信息
- [x] 遵循现有 command 模式

## Merge Record
- **Completed:** 2026-04-02T19:30:00Z
- **Merged Branch:** feature/feat-fix-read-file
- **Merge Commit:** 0eab03f
- **Archive Tag:** feat-fix-read-file-20260402
- **Conflicts:** None
- **Verification:** All 3 Gherkin scenarios passed (code analysis)
- **Stats:** 1 commit, 1 file changed, 18 insertions, 0 deletions
