# Feature: fix-terminal-writer-tabs 终端 Writer 不可重复获取 & 新增终端失效

## Basic Information
- **ID**: fix-terminal-writer-tabs
- **Name**: 终端 Writer 不可重复获取 & 新增终端失效修复
- **Priority**: 90
- **Size**: S
- **Dependencies**: none
- **Parent**: null
- **Children**: none
- **Created**: 2026-04-03

## Description

编辑器 tab 终端存在两个阻断性 bug：

1. **终端输入报错**：任何键盘输入触发 `[Error] Failed to get writer: cannot take writer more than once`，终端完全不可用
2. **新增终端按钮无效**：点击终端区域 "+" 按钮无法添加新终端 tab

## Root Cause Analysis

### Bug 1: Writer 不可重复获取

**文件**: `neuro-syntax-ide/src-tauri/src/lib.rs:390-401`

`PtyManager::write()` 每次调用都执行 `instance.master.take_writer()`，该方法 **move** 了 writer 的所有权。首次调用后 writer 被 consume，后续所有调用均失败。

```rust
// 问题代码
fn write(&mut self, pty_id: &str, data: &str) -> Result<(), String> {
    let mut writer = instance.master.take_writer()?;  // 只能调用一次！
    writer.write_all(data.as_bytes())?;
}
```

**修复方案**: 在 `PtyInstance::create()` 阶段通过 `try_clone_writer()` 获取一个独立的 writer，存入 `PtyInstance` 结构体。`write()` 方法复用这个持久 writer。

### Bug 2: 新增终端 Tab 失效

需排查 EditorView.tsx 中 "+" 按钮的事件绑定和 tab 渲染逻辑是否正确联动。

## Acceptance Criteria (Gherkin)

### Scenario 1: 终端键盘输入正常工作
```gherkin
Given 用户已打开编辑器终端 tab
When 用户在终端中键入任意字符（如 "ls"）
Then 字符应正常显示在终端中
And 控制台不出现 "Failed to get writer" 错误
```

### Scenario 2: 终端执行命令正常
```gherkin
Given 终端可以正常输入
When 用户输入 "echo hello" 并按回车
Then 终端应输出 "hello"
And 终端持续可用，可继续输入下一条命令
```

### Scenario 3: 新增终端 Tab
```gherkin
Given 用户已打开编辑器并看到终端区域
When 用户点击终端 tab 栏的 "+" 按钮
Then 应出现下拉菜单（Bash / Claude CLI / Gemini CLI）
And 选择任一选项后，新 tab 出现在 tab 栏
And 新终端可正常输入和执行命令
```

### Scenario 4: 关闭 Tab 后回退
```gherkin
Given 终端有多个 tab
When 用户关闭当前活跃 tab
Then 自动切换到相邻 tab
And 若关闭最后一个 tab，自动创建新的 bash tab
```

## Technical Solution

### 1. Rust 侧修改 — `lib.rs`

**PtyInstance 结构体**：新增 `writer` 字段存储持久 writer

```rust
use std::io::Write;

struct PtyInstance {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}
```

**create() 方法**：创建时 clone writer

```rust
fn create(...) -> Result<(), String> {
    // ... 现有代码 ...
    let writer = pair.master
        .try_clone_writer()
        .map_err(|e| format!("Failed to clone writer: {}", e))?;

    self.instances.insert(pty_id, PtyInstance {
        master: pair.master,
        writer,
    });
    Ok(())
}
```

**write() 方法**：直接使用持久 writer

```rust
fn write(&mut self, pty_id: &str, data: &str) -> Result<(), String> {
    if let Some(instance) = self.instances.get_mut(pty_id) {
        instance.writer.write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write: {}", e))?;
        instance.writer.flush()
            .map_err(|e| format!("Failed to flush: {}", e))?;
        Ok(())
    } else {
        Err(format!("Pty '{}' not found", pty_id))
    }
}
```

### 2. 前端排查 — EditorView.tsx

排查 "+" 按钮的下拉菜单事件绑定，确保 `addTab()` 被正确调用，以及新 tab 的 XTerminal 组件正确渲染。

## General Checklist
- [x] Rust 侧 writer 修复完成
- [x] 编译通过（`cargo build`）
- [x] 前端新增终端 tab 功能正常
- [ ] 手动测试：终端可输入、可执行命令
- [ ] 手动测试：新增/关闭 tab 正常工作

## Merge Record
- **Completed**: 2026-04-03T19:00:00Z
- **Merged Branch**: feature/fix-terminal-writer-tabs
- **Merge Commit**: 5458f46
- **Archive Tag**: fix-terminal-writer-tabs-20260403
- **Conflicts**: none (clean rebase + merge)
- [ ] 编译通过（`cargo build`）
- [ ] 前端新增终端 tab 功能正常
- [ ] 手动测试：终端可输入、可执行命令
- [ ] 手动测试：新增/关闭 tab 正常工作
