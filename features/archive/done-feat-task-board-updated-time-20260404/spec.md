# Feature: feat-task-board-updated-time

## Basic Information
- **ID**: feat-task-board-updated-time
- **Name**: Task Board Updated 时间显示优化
- **Priority**: 60
- **Size**: S
- **Dependencies**: none
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-04

## Description

Task Board 模块中，BOARD/LIST 切换按钮右侧显示的 `Updated: 21:00:00` 时间戳存在以下问题：

1. **语义不清**：用户不知道这个时间代表什么（是文件刷新时间？数据修改时间？页面加载时间？）
2. **格式不友好**：只显示时分秒，没有日期，看起来很奇怪
3. **缺乏相对时间**：`21:00:00` 对用户来说缺乏上下文，不如"2 分钟前"直观

实际上这个时间来自 `queue.yaml` 的 `meta.last_updated` 字段，表示队列数据最后一次被修改的时间（如移动任务、创建 feature 等操作）。

## User Value Points

1. **时间显示语义清晰**：用户能直观理解这个时间代表什么含义
2. **时间格式友好**：显示智能格式化的时间（相对时间 + 绝对时间），而非裸的时分秒

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx:499-503` — 当前 Updated 时间显示逻辑
- `neuro-syntax-ide/src-tauri/src/lib.rs:1703, 3179` — `last_updated` 写入逻辑（`chrono::Utc::now().to_rfc3339()`）

### Related Documents
- `feature-workflow/queue.yaml` — `meta.last_updated` 字段存储位置

### Related Features
- 无

## Technical Solution

### 前端修改（TaskBoard.tsx）

修改 `TaskBoard.tsx` 第 499-503 行的时间显示逻辑：

1. **添加智能时间格式化函数** `formatUpdatedTime(date: Date): string`：
   - 60 秒内：`刚刚`
   - 60 分钟内：`X 分钟前`
   - 今天内：`今天 HH:mm`
   - 昨天：`昨天 HH:mm`
   - 今年内：`MM/DD HH:mm`
   - 往年：`YYYY/MM/DD HH:mm`

2. **更新显示文案**：将 `Updated:` 改为更明确的标签，如 `队列更新于` 或保留 `Updated` 但添加 tooltip 显示完整绝对时间

3. **添加 hover tooltip**：鼠标悬停时显示完整的绝对时间（如 `2026-04-04 21:00:00`）

### 不需要修改后端

后端的 `meta.last_updated` 逻辑已经正确（UTC RFC3339 格式），无需改动。

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望 Task Board 的时间显示清晰易懂，让我能快速了解数据最后更新的时间。

### Scenarios

```gherkin
Scenario: 刚刚更新队列数据
  Given 队列数据在 30 秒前被修改
  When 用户查看 Task Board
  Then BOARD/LIST 切换右侧显示 "刚刚"

Scenario: 几分钟前更新
  Given 队列数据在 5 分钟前被修改
  When 用户查看 Task Board
  Then BOARD/LIST 切换右侧显示 "5 分钟前"

Scenario: 今天早些时候更新
  Given 队列数据在今天 3 小时前被修改
  When 用户查看 Task Board
  Then BOARD/LIST 切换右侧显示 "今天 HH:mm"

Scenario: 昨天更新
  Given 队列数据在昨天被修改
  When 用户查看 Task Board
  Then BOARD/LIST 切换右侧显示 "昨天 HH:mm"

Scenario: hover 显示完整时间
  Given 队列数据在某个时间被修改
  When 用户将鼠标悬停在时间文本上
  Then 显示 tooltip 包含完整绝对时间 "YYYY/MM/DD HH:mm:ss"

Scenario: 队列从未更新
  Given queue.meta.last_updated 为空
  When 用户查看 Task Board
  Then 不显示任何时间信息
```

### UI/Interaction Checkpoints
- 时间文本位于 BOARD/LIST 切换按钮右侧
- 字号保持 9-10px，颜色为 text-outline
- tooltip 使用 title 属性或自定义 tooltip 组件

### General Checklist
- 不修改后端逻辑
- 保持现有样式风格一致

## Merge Record

- **Completed**: 2026-04-04
- **Merged Branch**: feature/feat-task-board-updated-time
- **Merge Commit**: ffa43e4
- **Archive Tag**: feat-task-board-updated-time-20260404
- **Conflicts**: none
- **Verification**: 6/6 Gherkin scenarios passed (code analysis)
- **Evidence**: features/archive/done-feat-task-board-updated-time-20260404/evidence/verification-report.md
- **Stats**: 1 commit, 1 file changed, +53/-5 lines
