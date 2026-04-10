# Tasks: fix-terminal-add-tab

## Task Breakdown

### 1. 问题诊断与定位
- [x] 运行 dev server 实际验证 "+" 按钮行为
- [x] 确认下拉菜单是否被 overflow-hidden 裁切
- [x] 确认 addTab 函数调用链是否完整执行
- [x] 确认 XTerminal mount 后 PTY 是否创建成功

### 2. 修复 "+" 按钮下拉菜单
- [x] 检查 tab bar 容器的 overflow 属性
- [x] 修复下拉菜单定位/z-index 确保可见
- [x] 验证点击菜单项后 addTab 正确触发

### 3. 加固 Tab 新增逻辑
- [x] 验证 addTab 状态更新（setTabs + setActiveTabId）
- [x] 确保新 tab 的 XTerminal 正确 mount 并创建 PTY
- [x] 添加新增 tab 后自动滚动到新 tab

### 4. 加固 Tab 切换稳定性
- [x] 验证 activeTabId 变化时 XTerminal active prop 正确传递
- [x] 确保 re-fit 在 tab 切换后正确执行
- [x] 确保非活跃终端保持内容不丢失

### 5. 测试验证
- [ ] 手动测试所有 Gherkin 场景
- [ ] 测试 bash / claude / gemini 三种 tab 类型
- [ ] 测试快速连续切换 tab 的稳定性
- [ ] 测试关闭 tab 后的自动切换

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-10 | Feature created | 问题分析与规划完成 |
| 2026-04-10 | Implementation complete | 下拉菜单移至 scroll 容器外 + auto-scroll + backdrop |
