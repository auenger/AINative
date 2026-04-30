# Feature: feat-reveal-in-file-manager

## Basic Information
- **ID**: feat-reveal-in-file-manager
- **Name**: 文件树「在文件管理器中显示」Tauri 后端实现
- **Priority**: 70
- **Size**: S
- **Dependencies**: none
- **Parent**: null
- **Children**: none
- **Created**: 2026-04-30

## Description

文件树右键菜单中「在文件管理器中显示」选项当前点击后提示"需要 Tauri 后端支持"。
需要在 Tauri Rust 后端添加 `reveal_in_file_manager` Command，利用已引入的 `tauri-plugin-opener` 插件实现跨平台文件定位（macOS Finder / Windows Explorer / Linux 文件管理器）。

前端代码已就绪（EditorView.tsx:885-898），只缺后端 command。

## User Value Points

1. **跨平台文件定位** — 用户右键文件/文件夹后可直接在系统文件管理器中定位该条目，无需手动查找

## Context Analysis

### Reference Code
- 前端调用: `neuro-syntax-ide/src/components/views/EditorView.tsx` L885-898（`revealInFileManager` 函数）
- 前端菜单项: 同文件 L1034-1035（`reveal-in-finder` context menu item）
- i18n 消息: `neuro-syntax-ide/src/i18n.ts` L114（en）/ L346（zh）
- Tauri 后端: `neuro-syntax-ide/src-tauri/src/lib.rs`
- Opener 插件: `tauri-plugin-opener = "2"`（Cargo.toml L17，已注册 init）

### Related Features
- feat-file-tree-context-menu（右键菜单基础框架，已完成）

## Technical Solution

1. 在 `lib.rs` 中添加 `#[tauri::command]` 函数 `reveal_in_file_manager`
2. 使用 `tauri_plugin_opener::reveal_item_in_dir(app, path)` 或 `opener::reveal(path)` 标准 API
3. 在 `invoke_handler` 中注册该 command
4. 前端无需改动（已有 try/catch 和 fallback）

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我想右键点击文件树中的文件/文件夹后选择「在文件管理器中显示」，系统文件管理器打开并定位到该条目。

### Scenarios

**Scenario 1: 文件右键在 Finder/Explorer 中显示**
```gherkin
Given 文件树中存在一个文件节点
When 用户右键该文件并点击「在文件管理器中显示」
Then 系统文件管理器打开并选中该文件
```

**Scenario 2: 文件夹右键在 Finder/Explorer 中显示**
```gherkin
Given 文件树中存在一个文件夹节点
When 用户右键该文件夹并点击「在文件管理器中显示」
Then 系统文件管理器打开并定位到该文件夹
```

**Scenario 3: 路径不存在时优雅降级**
```gherkin
Given 文件树中显示的路径在磁盘上不存在
When 用户右键并点击「在文件管理器中显示」
Then 显示友好错误提示而非崩溃
```

### General Checklist
- [ ] macOS Finder 测试通过
- [ ] 无平台特定编译错误
- [ ] invoke_handler 注册正确
