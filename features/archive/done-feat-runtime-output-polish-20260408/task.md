# Tasks: feat-runtime-output-polish
## Task Breakdown

### 1. 弹窗拖拽与缩放
- [x] 添加 modalPos / isDraggingModal / dragOffset state
- [x] 实现 header onMouseDown 开始拖拽
- [x] 实现 window mousemove/mouseup 拖拽移动 + 边界限制
- [x] 添加 CSS resize: both 缩放支持
- [x] 添加最小尺寸限制 (400x300)

### 2. 内容智能渲染
- [x] 新增 renderSessionChunk() 函数，JSON 解析 + 类型判断
- [x] TOOL_RESULT 类型：提取 CONTENT 高亮渲染
- [x] tool_use 类型：显示工具名称摘要
- [x] assistant 类型：支持 markdown 渲染
- [x] 时间戳提取与格式化
- [x] 非 JSON 内容降级为原始文本
- [x] 长输出折叠/展开

### 3. 多 Runtime Session 分离查看
- [x] 后端: active_session_id 改为 active_sessions: HashMap<RuntimeId, SessionId>
- [x] 后端: get_active_session 接受 runtime_id 参数
- [x] 后端: clear_session_output 接受 runtime_id 参数
- [x] 后端: runtime_session_start / runtime_execute 按 runtime_id 追踪
- [x] 前端: StatusBar 每个 runtime card 显示 View Output（移除 claude-code 硬编码）
- [x] 前端: RuntimeOutputModal 接受 runtimeId + runtimeName props
- [x] 前端: 按 runtimeId 调用 get_active_session / clear_session_output

### 4. 关闭/重开内容保留
- [x] 移除 useEffect([visible]) 中的 chunks 清空逻辑
- [x] 保留 modalPos/modalSize 不随 visible 重置
- [x] Clear 按钮行为不变（清前端+后端+关闭）

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-08 | All 4 tasks implemented | Rust compiles, TypeScript passes, all changes in worktree |
