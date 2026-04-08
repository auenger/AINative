# Feature: fix-terminal-io-resize 终端输入输出修复 + 动态调整

## Basic Information
- **ID**: fix-terminal-io-resize
- **Name**: 终端输入输出修复 + 面板动态调整
- **Priority**: 90
- **Size**: M
- **Dependencies**: []
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-07

## Description

终端面板存在三个关键问题影响基本可用性：

1. **PTY 输出/输入不通**：Rust 侧 PTY reader 使用 `BufReader::lines()` 按行读取，但终端输出（如 shell prompt `$ `、Claude Code 交互式 UI、进度条等）经常不以 `\n` 结尾，导致数据卡在 buffer 中无法 emit 到前端，表现为终端创建成功但看不到任何输出，也无法输入。
2. **终端高度不可动态调整**：EditorView 中终端面板高度硬编码为 240px（`animate={{ height: 240 }}`），无法拖拽调整。当运行 Claude Code 等交互式 CLI 时，固定高度导致体验极差。
3. **终端宽度未 100% 占满**：xterm.js 终端在某些场景下未完全占满可用宽度。

## User Value Points

1. **终端基本可用** — 修复 PTY I/O 后，用户可以在 IDE 内真正使用 Bash / Claude Code / Gemini CLI，看到实时输出并输入命令。
2. **终端面板可拖拽调整高度** — 用户可以自由拖拽终端面板的上下边界来调整高度，适应不同使用场景（快速命令 vs 全屏终端）。
3. **终端 100% 宽度显示** — 终端内容完整占满面板宽度，不留白边。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/XTerminal.tsx` — xterm.js 终端组件
- `neuro-syntax-ide/src/components/views/EditorView.tsx` — 编辑器视图，包含终端面板（line 1227-1339）
- `neuro-syntax-ide/src-tauri/src/lib.rs` — Rust PTY 管理（PtyManager, create_pty, write_to_pty 等，line 1896-2018）

### Root Cause Analysis

**Issue 1: PTY I/O 不通**
- `lib.rs:1966-1978`: PTY reader 使用 `BufReader::new(reader)` + `reader.lines()`
- `lines()` iterator 只在遇到 `\n` 时才 yield，导致无 `\n` 的终端输出（prompt、交互式 TUI）被 buffer 卡住
- 修复方案：改用逐字节读取或分块读取，实时 emit 收到的所有数据

**Issue 2: 高度不可调**
- `EditorView.tsx:1231`: `animate={{ height: 240 }}` 硬编码
- 需要添加拖拽手柄 + state 管理动态高度

**Issue 3: 宽度问题**
- XTerminal 容器 CSS 可能需要调整，确保 xterm 完全填满父容器

### Related Documents
### Related Features

## Technical Solution

### 修复 1: PTY Reader — 逐字节读取替代 lines()

```rust
// 修改前 (lib.rs ~line 1966):
let reader = BufReader::new(reader);
for line in reader.lines() { ... }

// 修改后: 使用分块读取，实时 emit
let mut buf = [0u8; 4096];
loop {
    match reader.read(&mut buf) {
        Ok(0) => break, // EOF
        Ok(n) => {
            let data = String::from_utf8_lossy(&buf[..n]);
            let payload = PtyOutputEvent { pty_id: emit_id.clone(), data: data.to_string() };
            let _ = ah.emit("pty-out", &payload);
        }
        Err(_) => break,
    }
}
```

注意：需要将 `reader` 从 `BufReader` 改为原始的 `impl Read`，因为 `BufReader` 的 `read()` 方法在内部缓冲区有数据时会立即返回，但如果终端输出了少量数据且没有 `\n`，`BufReader` 仍然会阻塞直到底层 read 返回。实际上关键问题是 `lines()` iterator 不会 yield 直到遇到 `\n`。改用 `read()` 方法可以每次底层有数据就立即返回。

更好的方案：使用 `read()` 直接读取原始字节，但保留 BufReader 只用于内部缓冲（避免系统调用开销），但不用 `lines()` API。

### 修复 2: 终端面板可拖拽调整高度

在 EditorView 中：
1. 添加 `terminalHeight` state（默认 240，最小 100，最大 ~80% 视口高度）
2. 添加拖拽手柄 div（在终端面板顶部 border 处）
3. 监听 mousedown/mousemove/mouseup 实现拖拽
4. 将 `animate={{ height: 240 }}` 改为 `style={{ height: terminalHeight }}`
5. 拖拽结束时触发 FitAddon.fit() 重算 xterm 尺寸

### 修复 3: 终端宽度 100%

检查 XTerminal 容器的 CSS 层级，确保：
- 终端面板 `flex-1` 正确继承
- xterm 容器 `w-full` 生效
- 拖拽 resize 后也触发 fit

## Acceptance Criteria (Gherkin)

### User Story
作为开发者，我希望 IDE 内的终端能正常显示输出和接受输入，并且可以自由调整终端面板大小，以便在编辑代码和使用终端之间找到最佳布局。

### Scenarios (Given/When/Then)

```gherkin
Scenario: 终端显示 shell prompt
  Given 用户打开了终端面板
  When Bash 终端创建完成
  Then 用户应该立即看到 shell prompt（如 "user@host ~ %"）
  And 终端光标应该闪烁等待输入

Scenario: 终端接受键盘输入
  Given Bash 终端已显示 prompt
  When 用户键入 "echo hello" 并按回车
  Then 终端应显示 "hello" 输出
  And 显示新的 prompt 等待下一个命令

Scenario: 终端显示无换行的输出
  Given Claude Code 终端已打开
  When Claude Code 输出交互式内容（如进度条、spinner）
  Then 所有输出都应实时显示，不卡在 buffer 中

Scenario: 拖拽调整终端高度
  Given 终端面板已打开（高度 240px）
  When 用户在终端面板顶部边缘按住鼠标并向上拖动
  Then 终端面板高度应跟随鼠标平滑变化
  And xterm 内容应自动 refit 到新尺寸
  And 高度不应小于 100px 或大于视口高度的 80%

Scenario: 终端宽度占满面板
  Given 终端面板已打开
  Then xterm 终端内容应 100% 占满面板宽度
  And 不应有水平方向的留白或溢出
```

### UI/Interaction Checkpoints
- 终端面板顶部有可见的拖拽手柄（通常是一条细线或带有 grab cursor 的区域）
- 拖拽时鼠标 cursor 变为 `row-resize`
- 拖拽结束后终端内容自动 refit

### General Checklist
- [x] PTY reader 不再依赖 `\n` 分隔
- [x] 拖拽 resize 不引入性能问题（requestAnimationFrame）
- [x] resize 后正确通知 Rust 侧 resize_pty

## Merge Record

- **Completed**: 2026-04-08
- **Branch**: feature/fix-terminal-io-resize
- **Merge Commit**: ac355e1
- **Archive Tag**: fix-terminal-io-resize-20260408
- **Conflicts**: none
- **Verification**: passed (code analysis, cargo check, 5/5 Gherkin scenarios)
- **Stats**: 3 files changed, 93 insertions, 8 deletions, 1 commit
