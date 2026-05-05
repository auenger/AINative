# Feature: feat-shell-settings-ui Settings Shell 切换 UI

## Basic Information
- **ID**: feat-shell-settings-ui
- **Name**: Settings Shell 切换 UI
- **Priority**: 70
- **Size**: S
- **Dependencies**: feat-shell-detect
- **Parent**: feat-cross-platform-terminal
- **Children**: []
- **Created**: 2026-04-30

## Description
在 Settings 页面新增终端 Shell 配置区域，用户可以选择默认 Shell。新建终端 Tab 时使用用户选择的 Shell。设置持久化到 Settings YAML。

## User Value Points
1. 用户可在 Settings 中选择默认终端 Shell
2. 设置持久化，重启应用后保持

## Context Analysis
### Reference Code
- Settings 页面现有组件
- `XTerminal.tsx` — 终端创建逻辑
- `detect_shells` Command — 上游 Feature 提供的 Shell 列表
### Related Features
- feat-shell-detect (上游，提供 Shell 列表)

## Technical Solution

### Settings 存储
在现有 Settings YAML 中新增:
```yaml
terminal:
  default_shell: "pwsh"  # ShellType 枚举值或路径
```

### Settings UI
- 新增 "Terminal" 配置区域
- 下拉菜单显示 `detect_shells` 返回的 Shell 列表
- 显示 Shell 名称 + 路径（如 "PowerShell 7 (/usr/local/bin/pwsh)"）
- 标记当前默认 Shell

### 前端改动
- `XTerminal.tsx` 的 `shellForKind('bash')` 读取 Settings 中的 `default_shell`
- 终端 Tab 右键菜单增加 "Change Shell" 快捷选项

## Acceptance Criteria (Gherkin)
### User Story
作为用户，我希望在 Settings 中选择终端 Shell，这样我可以使用自己习惯的 Shell。

### Scenarios (Given/When/Then)

#### Scenario 1: 选择 Shell
```gherkin
Given 用户打开 Settings 页面
And Shell 检测已返回 [zsh, bash, fish]
When 用户在 "Default Shell" 下拉中选择 "fish"
Then 设置保存到 YAML
And 后续新建终端 Tab 使用 fish
```

#### Scenario 2: 设置持久化
```gherkin
Given 用户已选择 "PowerShell 7" 作为默认 Shell
When 用户重启应用
Then Settings 仍显示 "PowerShell 7"
And 新建终端使用 PowerShell 7
```

#### Scenario 3: Shell 不可用时的处理
```gherkin
Given 用户之前选择了 "fish"
And fish 已被卸载
When 新建终端 Tab
Then 显示错误提示 "Shell 'fish' not found, using default"
And 回退到系统默认 Shell
```

### UI/Interaction Checkpoints
- Settings Terminal 区域: Shell 下拉 + 路径显示
- 当前默认 Shell 带勾号标记
- 无效 Shell 时下拉项显示警告图标

### General Checklist
- [ ] Shell 列表加载时显示 loading 状态
- [ ] 首次使用（未配置 Shell）时自动选择系统默认

---

## Merge Record
- **Completed**: 2026-05-05
- **Merged Branch**: feature/feat-shell-settings-ui
- **Merge Commit**: c7f6df7
- **Archive Tag**: feat-shell-settings-ui-20260505
- **Conflicts**: None (clean rebase)
- **Verification**: All 3 Gherkin scenarios passed (code analysis)
- **Commits**: 1 implementation commit (e6465d2)
- **Files Changed**: 6 (lib.rs, XTerminal.tsx, SettingsView.tsx, i18n.ts, useSettings.ts, types.ts)
