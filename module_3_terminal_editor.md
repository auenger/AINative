# Module 3: 原生终端与集成编辑器 (Terminal & Editor)

## 1. 模块边界与目标
**责任范围**：在桌面应用内提供真实的开发者执行环境，代替单纯的 UI Mockup。支持真实多标签页的 Monaco Editor 代码编辑，以及基于伪终端 (Pty) 挂载的 `Bash`、`Claude CLI` 服务。
**不包含逻辑**：不负责监控系统的硬件指标。

## 2. 核心技术栈
*   **前端代码编辑**：`@monaco-editor/react` (提供绝佳的 VS Code 级性能与高亮提示)。
*   **前端终端仿真**：`xterm.js` 及其配套插件扩展 (`xterm-addon-fit`, `xterm-addon-web-links`)。
*   **Rust 底层通信引擎**：
    *   [`portable-pty`](https://github.com/wez/wezterm/tree/main/pty) (建立独立伪终端，跨 macOS 与 Windows)。
    *   `tokio` 的 mpsc channels 配合异步跨线程数据分发。

## 3. 实现细节与步骤规划

### Step 1: Monaco 代码容器嵌入
*   根据 Module 1 建立的文件树选择，双击任意代码/文本文件时，前端调用 Tauri 读取文本。
*   按文件拓展名映射 Monaco Editor 的 `language` 设定（比如 `.tsx`，`.yaml`，`.md`）。
*   利用 Rust 的 `std::fs::write` 提供一键保存 (Save) 功能，并与应用全局的快捷键系统绑定 (Cmd/Ctrl + S)。

### Step 2: 独立 Pty 进程的派生 (Rust)
*   **概念原理**：常规浏览器无法启动 Shell（比如 `npm run dev`）。需要 Rust 在 OS 中创建一个幽灵 Shell 并霸占其 Stdout 和 Stdin。
*   通过 `portable-pty` 派生一个子进程（mac 环境默认挂载 `zsh` 或用户默认 Shell，Windows 挂 `powershell.exe`）。
*   如果前端选择了 "Claude" 或 "Gemini" tab，则该子进程默认带参启动对应的 CLI 工具（例如执行 `claude` 命令）。

### Step 3: 前后端高频管道互流 (Pty Streaming)
*   **Rust -> Xterm (Stdout输出)**：
    Rust 捕获 Pty 终端输出的乱码与色彩转义字符 (ANSI 代码)，切块转换为二进制或 Base64 字符串，通过不停的 Tauri Event `window.emit("pty-out", data)` 发送给前端，`xterm.write(data)` 直接冲刷进屏幕。
*   **Xterm -> Rust (Stdin打字交互)**：
    捕捉前端 `xterm.onData()`（即用户按键），通过 Tauri Command `invoke('write_to_pty', { data })` 将字符传入 Rust，Rust 再将字符推入到 Pty 的写入管道端。

## 4. 并行开发与 API 契约
*   **并行建议**：前端开发 `xterm.js` CSS 预设环境时可写简单的 echo Mock。后端 Rust 并行打样一个命令行的 pty 验证示例，跑通后再挂接进 Tauri。
*   **关键痛点注意**：Xterm 与 Pty 之间存在高度防抖（Debounce）计算和窗口调整事件同步 (Window Resize `PtySize`) 的处理，需确保 `resize` 正确传递，否则终端折行会崩溃。
