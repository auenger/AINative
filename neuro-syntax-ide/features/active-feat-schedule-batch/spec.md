# Spec: 批量操作 (feat-schedule-batch)

## 📋 需求概述

为排班管理提供批量操作功能，支持一次为多个用户创建多天的排班记录，提高排班效率。

## 🎯 功能需求

### 1. 功能模块

#### 1.1 批量排班表单
- 批量选择用户（支持按部门筛选）
- 指定日期范围（开始日期 - 结束日期）
- 选择班次类型
- 填写工作地点
- 填写备注
- 预览将要创建的排班数量

#### 1.2 批量创建逻辑
- 为每个用户在日期范围内每天创建一条排班记录
- 自动跳过已有排班的日期（冲突处理）
- 显示批量创建结果（成功/跳过/失败数量）

#### 1.3 权限控制
- 管理员：可以为所有用户批量排班
- 部门领导：只能为本部门员工批量排班

## 🔧 技术方案

### 前端实现

#### 新增组件
- `ScheduleBatchForm.tsx` - 批量排班表单
  - 多用户选择器（支持部门筛选）
  - 日期范围选择器
  - 班次选择器
  - 地点输入框
  - 备注输入框
  - 预览功能

#### 新增服务
- 扩展 `scheduleService.ts`
  - `batchCreateSchedules()` - 批量创建排班

### 后端实现 (Mock)

#### API端点
- `POST /api/schedules/batch` - 批量创建排班

#### 请求格式
```typescript
interface BatchCreateRequest {
  userIds: string[];        // 用户ID列表
  startDate: string;        // 开始日期 YYYY-MM-DD
  endDate: string;          // 结束日期 YYYY-MM-DD
  shiftType: ShiftType;     // 班次类型
  location: string;         // 工作地点
  notes?: string;           // 备注
  createdBy: string;        // 创建人
}
```

#### 响应格式
```typescript
interface BatchCreateResponse {
  success: number;          // 成功创建数量
  skipped: number;          // 跳过数量（已有排班）
  failed: number;           // 失败数量
  details: {
    userId: string;
    date: string;
    status: 'success' | 'skipped' | 'failed';
    message?: string;
  }[];
}
```

## ✅ 验收标准

### Gherkin Scenarios

```gherkin
Feature: 批量排班操作

  Scenario: 管理员批量创建排班
    Given 管理员登录系统
    And 用户"张三"、"李四"、"王五"存在
    And 这些用户在"2024-03-15"至"2024-03-20"期间没有排班
    When 管理员点击"批量排班"按钮
    And 管理员选择用户"张三"、"李四"、"王五"
    And 管理员选择日期范围"2024-03-15"至"2024-03-20"
    And 管理员选择班次"早班"
    And 管理员填写工作地点"总部大楼"
    And 管理员点击"预览"
    Then 系统显示"将为3个用户创建6天排班，共18条记录"
    And 管理员点击"确认创建"
    Then 系统显示"成功创建18条排班记录"
    And 所有用户收到排班通知

  Scenario: 批量创建时跳过已有排班的日期
    Given 管理员登录系统
    And 用户"张三"、"李四"存在
    And "张三"在"2024-03-15"已有排班
    And "李四"在"2024-03-15"至"2024-03-20"期间没有排班
    When 管理员为"张三"、"李四"批量创建排班
    And 日期范围为"2024-03-15"至"2024-03-20"
    Then 系统为"李四"创建6条排班记录
    And 系统跳过"张三"在"2024-03-15"的排班
    And 系统显示"成功创建6条，跳过1条"

  Scenario: 部门领导为本部门员工批量排班
    Given 部门领导"王经理"登录系统
    And "王经理"是"技术部"的部门领导
    And "技术部"有员工"张三"、"李四"
    And "销售部"有员工"赵六"
    When "王经理"点击"批量排班"
    Then 用户选择器只显示"技术部"员工
    And "王经理"不能选择"销售部"的员工
    And "王经理"为"张三"、"李四"批量创建排班
    Then 系统成功创建排班

  Scenario: 批量排班预览功能
    Given 管理员登录系统
    And 用户"张三"、"李四"存在
    When 管理员选择用户"张三"、"李四"
    And 管理员选择日期范围"2024-03-15"至"2024-03-17"
    And 管理员选择班次"早班"
    And 管理员点击"预览"
    Then 系统显示预览列表
    And 预览显示每个用户每天的排班计划
    And 预览显示总记录数"6条"

  Scenario: 取消批量排班
    Given 管理员登录系统
    And 管理员已填写批量排班表单
    When 管理员点击"预览"查看预览
    And 管理员点击"取消"按钮
    Then 系统关闭批量排班表单
    And 不创建任何排班记录
```

### 功能验收清单

- [ ] 管理员可以批量选择用户
- [ ] 支持按部门筛选用户
- [ ] 支持指定日期范围
- [ ] 支持选择班次类型
- [ ] 支持预览将要创建的排班
- [ ] 批量创建排班成功
- [ ] 自动跳过已有排班的日期
- [ ] 显示批量创建结果
- [ ] 部门领导只能为本部门员工批量排班
- [ ] 批量创建后用户收到通知

## 📦 依赖

- feat-schedule-basic: 基础排班管理（必须先完成）
- feat-user-department: 用户部门绑定（用于部门筛选）
- feat-user-dept-leader: 部门领导功能（用于权限控制）

## 🏷️ 元数据

- **Feature ID**: feat-schedule-batch
- **Feature Name**: 批量操作
- **Parent**: feat-user-schedule
- **创建时间**: 2024-03-06
- **优先级**: 50
- **规模**: S (Small)
- **状态**: pending
- **包含UI组件**: 是
- **包含后端API**: 是
- **包含Gherkin场景**: 是
