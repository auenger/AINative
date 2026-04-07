# Tasks: feat-editor-terminal-workspace

## Task Breakdown

完成

### 1. 前端：终端默认关闭
- [x] 修改 `EditorView.tsx` 中 `terminalOpen` 初始值从 `true` 改为 `false`
- [x] 验证终端关闭时右下角打开按钮正常显示

### 2. 前端：XTerminal 组件支持 cwd 参数
- [x] `XTerminalProps` 接口新增 `cwd?: string` 属性
- [x] `shellForKind` 或调用处将 `cwd` 传入 `create_pty` config
- [x] 浏览器模式忽略 cwd（无 PTY）

### 3. EditorView 传递 workspacePath 到终端
- [x] `EditorView` 中渲染 `XTerminal` 时传入 `cwd={workspacePath}`
- [x] `addTab` 创建新终端时记录 workspacePath
- [x] 未选择工作空间时 cwd 为空，终端使用默认 home 目录

### 4. Rust 后端： create_pty 支持 cwd（如尚未支持)
- [x] 检查 `create_pty` command 是否接受 `cwd` 字段
- [x] 如果未支持，在 PTY 创建时 `Command::new(shell).current_dir(cwd)` 设置工作目录
- [x] 无 cwd 时使用默认行为（用户 home）

### 5. 验证
- [x] Tauri 环境:终端默认关闭，打开后 cwd 为工作空间路径
- [x] 浏览器模式：终端默认关闭，打开后降级正常
- [x] 多终端标签行为一致
- [x] 切换工作空间后新终端使用新路径

## Progress Log
| Date | Progress | Notes |
| 2026-04-07 | All tasks implemented | Initial commit |
