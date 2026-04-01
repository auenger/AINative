# Spec: 基础排班管理 (feat-schedule-basic)

## 📋 需求概述

实现排班的基础管理功能，包括创建、编辑、删除单个排班，用户查看自己的排班，以及基于角色的权限控制。

## 🎯 功能需求

### 1. 核心数据模型

#### 1.1 排班记录 (UserSchedule)
| 字段 | 类型 | 说明 | 必填 |
|------|------|------|------|
| id | string | 唯一标识 | Y |
| userId | string | 用户ID | Y |
| date | string | 排班日期 (YYYY-MM-DD) | Y |
| shiftType | enum | 班次类型 (early/morning/afternoon/night) | Y |
| startTime | string | 开始时间 (HH:mm) | Y |
| endTime | string | 结束时间 (HH:mm) | Y |
| location | string | 工作地点 | Y |
| notes | string | 备注 | N |
| createdBy | string | 创建人 | Y |
| createdAt | string | 创建时间 | Y |
| updatedBy | string | 更新人 | N |
| updatedAt | string | 更新时间 | N |

#### 1.2 班次类型配置 (ShiftType)
| 班次代码 | 班次名称 | 默认时间段 |
|----------|----------|------------|
| early | 早班 | 06:00-14:00 |
| morning | 上午班 | 08:00-12:00 |
| afternoon | 下午班 | 14:00-18:00 |
| night | 晚班 | 18:00-02:00(+1) |

### 2. 功能模块

#### 2.1 列表视图
- 表格形式展示排班记录
- 支持按日期范围、用户、部门、班次筛选
- 支持创建、编辑、删除排班

#### 2.2 我的排班
- 普通用户查看自己的排班（只读）
- 列表形式展示

#### 2.3 排班表单
- 用户选择器（支持部门筛选）
- 日期选择器
- 班次选择器（下拉框，自动填充默认时间）
- 时间输入框（可修改默认时间）
- 地点输入框
- 备注输入框

#### 2.4 冲突检测
- 创建/编辑排班时检测同一用户同日是否有冲突
- 显示冲突提示，阻止保存

#### 2.5 权限控制
| 角色 | 查看自己 | 查看部门 | 管理部门 | 管理全部 |
|------|---------|---------|---------|---------|
| 普通用户 | ✓ | ✗ | ✗ | ✗ |
| 部门领导 | ✓ | ✓ | ✓ | ✗ |
| 管理员 | ✓ | ✓ | ✓ | ✓ |

#### 2.6 通知功能
- 排班创建/修改/删除后通知用户
- 通知内容包括：日期、班次、地点、备注

## 🔧 技术方案

### 前端实现

#### 新增页面
- `/schedules/list` - 排班列表管理
- `/schedules/my` - 我的排班

#### 新增组件
- `ScheduleList.tsx` - 列表视图组件
- `ScheduleForm.tsx` - 排班表单

#### 新增服务
- `scheduleService.ts` - 排班CRUD操作
- `scheduleConflictService.ts` - 冲突检测
- `scheduleNotificationService.ts` - 通知服务

### 后端实现 (Mock)
- 数据存储: `mock_schedules`
- API端点:
  - `GET /api/schedules` - 获取排班列表（支持权限过滤）
  - `GET /api/schedules/:id` - 获取单个排班
  - `POST /api/schedules` - 创建排班
  - `PUT /api/schedules/:id` - 更新排班
  - `DELETE /api/schedules/:id` - 删除排班
  - `GET /api/schedules/conflicts` - 冲突检测

### 数据存储
```typescript
// localStorage key: mock_schedules
interface Schedule {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  shiftType: 'early' | 'morning' | 'afternoon' | 'night';
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}

// 班次配置 (常量)
const SHIFT_CONFIG = {
  early: { name: '早班', defaultStart: '06:00', defaultEnd: '14:00', color: '#10b981' },
  morning: { name: '上午班', defaultStart: '08:00', defaultEnd: '12:00', color: '#3b82f6' },
  afternoon: { name: '下午班', defaultStart: '14:00', defaultEnd: '18:00', color: '#f59e0b' },
  night: { name: '晚班', defaultStart: '18:00', defaultEnd: '02:00', color: '#8b5cf6' }
};
```

## ✅ 验收标准

### Gherkin Scenarios

```gherkin
Feature: 基础排班管理

  Scenario: 管理员创建单个排班
    Given 管理员登录系统
    And 用户"张三"存在
    When 管理员访问排班列表页面
    And 管理员点击"新增排班"
    And 管理员选择用户"张三"
    And 管理员选择日期"2024-03-15"
    And 管理员选择班次"早班"
    And 管理员填写工作地点"总部大楼"
    And 管理员填写备注"负责前台接待"
    And 管理员点击"保存"
    Then 系统显示"排班创建成功"
    And 排班记录保存成功
    And 用户"张三"收到排班通知

  Scenario: 管理员编辑排班
    Given 管理员登录系统
    And 用户"张三"在"2024-03-15"有早班排班
    When 管理员点击该排班的"编辑"按钮
    And 管理员将班次改为"晚班"
    And 管理员点击"保存"
    Then 系统显示"排班更新成功"
    And 排班记录已更新
    And 用户"张三"收到排班变更通知

  Scenario: 管理员删除排班
    Given 管理员登录系统
    And 用户"张三"在"2024-03-15"有早班排班
    When 管理员点击该排班的"删除"按钮
    And 管理员确认删除
    Then 系统显示"排班删除成功"
    And 排班记录已移除
    And 用户"张三"收到排班取消通知

  Scenario: 部门领导查看和管理本部门排班
    Given 部门领导"王经理"登录系统
    And "王经理"是"技术部"的部门领导
    And "技术部"有员工"张三"、"李四"
    When "王经理"访问排班列表页面
    Then "王经理"只能看到"技术部"员工的排班
    And "王经理"可以创建/编辑/删除本部门排班

  Scenario: 冲突检测阻止重复排班
    Given 管理员登录系统
    And 用户"张三"在"2024-03-15"已有早班排班
    When 管理员尝试为"张三"在"2024-03-15"创建晚班排班
    Then 系统显示冲突提示"该用户在此日期已有排班"
    And 系统阻止保存操作

  Scenario: 用户查看自己的排班
    Given 用户"张三"登录系统
    And "张三"有排班记录
    When "张三"访问"我的排班"页面
    Then "张三"能看到自己的所有排班
    And 排班以列表形式展示
    And "张三"不能编辑或删除自己的排班

  Scenario: 普通用户无法访问排班管理页面
    Given 普通用户"张三"登录系统
    When "张三"尝试访问排班管理页面 "/schedules/list"
    Then 系统重定向到无权限页面或首页
    And 显示"您没有访问此页面的权限"

  Scenario: 排班筛选功能
    Given 管理员登录系统
    And 系统中有多个排班记录
    When 管理员选择日期范围"2024-03-01"至"2024-03-31"
    And 管理员选择班次"早班"
    And 管理员点击"查询"
    Then 系统只显示指定日期范围内的早班排班记录
```

### 功能验收清单

- [ ] 普通用户可以查看自己的排班（只读）
- [ ] 部门领导可以查看和管理本部门排班
- [ ] 管理员可以管理所有用户排班
- [ ] 支持创建单个排班（日期、班次、地点、备注）
- [ ] 支持编辑排班
- [ ] 支持删除排班
- [ ] 同一用户同一天不能有多个排班（冲突检测）
- [ ] 列表视图支持筛选（日期范围、用户、部门、班次）
- [ ] 排班变更后通知用户
- [ ] 权限控制正确生效

## 📦 依赖

- feat-user-department: 用户部门绑定（用于部门领导权限判断）
- feat-user-dept-leader: 部门领导功能（用于权限控制）
- feat-notification-history: 通知历史（用于排班通知）

## 🏷️ 元数据

- **Feature ID**: feat-schedule-basic
- **Feature Name**: 基础排班管理
- **Parent**: feat-user-schedule
- **创建时间**: 2024-03-06
- **优先级**: 80
- **规模**: M (Medium)
- **状态**: pending
- **包含UI组件**: 是
- **包含后端API**: 是
- **包含Gherkin场景**: 是
