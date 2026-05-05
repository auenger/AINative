# Feature: fix-settings-workflow-tab Settings 工作流 Tab 加载报错修复

## Basic Information
- **ID**: fix-settings-workflow-tab
- **Name**: 修复 Settings Workflow Tab 加载报错（Command read_text_file not found）
- **Priority**: 80
- **Size**: S
- **Dependencies**: none
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-30T19:30:00Z

## Description

Settings 页面的 Workflow Tab 加载时报错 `Command read_text_file not found`。

**根因分析**：`useWorkflowConfig.ts` 调用了 `read_text_file` / `write_text_file` 两个 Tauri Command，但后端 Rust 侧注册的是 `read_file` / `write_file`，命令名不匹配。

**修复方案**：将前端 `useWorkflowConfig.ts` 中的 `read_text_file` 改为 `read_file`，`write_text_file` 改为 `write_file`。两个命令的参数签名完全一致，只需改名。

## User Value Points

1. Settings Workflow Tab 正常加载和保存配置

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/lib/useWorkflowConfig.ts` — 调用 `read_text_file` / `write_text_file` 的 hook
- `neuro-syntax-ide/src-tauri/src/lib.rs:8311` — `read_file` command 定义
- `neuro-syntax-ide/src-tauri/src/lib.rs:8955` — `write_file` command 定义

### Related Documents

### Related Features
- feat-settings-workflow-config — Settings 工作流参数配置（已归档，原始实现）

## Technical Solution

修改 `useWorkflowConfig.ts` 两处：
1. 第 147 行：`read_text_file` → `read_file`
2. 第 187 行：`write_text_file` → `write_file`

## Acceptance Criteria (Gherkin)

### Scenarios

```gherkin
Scenario: Workflow Tab 正常加载
  Given 用户打开 Settings 页面
  When 用户点击 Workflow Tab
  Then 页面正常显示工作流配置项
  And 无 "Command not found" 错误

Scenario: Workflow Tab 保存配置
  Given Workflow Tab 已加载
  When 用户修改配置并保存
  Then 配置成功写入 feature-workflow/config.yaml
  And 无 "Command not found" 错误
```

### General Checklist
- [x] 无 console 报错
- [x] 配置读取和保存功能正常

## Merge Record

- **Completed**: 2026-04-30T20:00:00Z
- **Merged Branch**: feature/fix-settings-workflow-tab
- **Merge Commit**: ort merge, 1 file changed (2 insertions, 2 deletions)
- **Archive Tag**: fix-settings-workflow-tab-20260430
- **Conflicts**: None
- **Verification**: 2/2 Gherkin scenarios passed
- **Stats**: 1 commit, 1 file changed
