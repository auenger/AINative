# Feature: feat-material-basic 物料基础信息管理

## Basic Information
- **ID**: feat-material-basic
- **Name**: 物料基础信息管理
- **Priority**: 85
- **Size**: S
- **Dependencies**: []
- **Parent**: feat-material-warehouse-system
- **Children**: []
- **Created**: 2026-03-07

## Description
用户可以维护物料的基础信息，包括创建、查看、编辑、删除物料。物料属性包含：物料名称、物料编码、规格型号、计量单位、物料类别等。这是物料管理的核心基础功能。

## User Value Points
1. **物料信息创建** - 用户可以创建新的物料记录
2. **物料信息查看** - 用户可以查看物料列表和详情
3. **物料信息编辑** - 用户可以修改现有物料信息
4. **物料信息删除** - 用户可以删除不需要的物料

## Context Analysis
### Reference Code
- `src/components/role/RoleManagement.tsx` - 参考角色管理的列表和CRUD操作模式
- `src/components/skill/SkillManagement.tsx` - 参考技能管理的表单处理
- `src/types/role.ts` - 参考类型定义模式

### Related Documents
- 无

### Related Features
- feat-role-mgmt (角色管理) - 参考其CRUD操作模式
- feat-skill-mgmt (技能管理) - 参考其表单验证逻辑

## Technical Solution
待实现时填充

## Acceptance Criteria (Gherkin)

### User Story
作为 **仓库管理员**，我希望 **管理物料的基础信息**，以便 **准确记录和维护所有可存储的物料数据**

### Scenarios

#### Scenario 1: 成功创建物料
```gherkin
Given 用户在物料管理页面
When 用户输入物料信息:
  | 物料名称 | 办公椅 |
  | 物料编码 | CH-001 |
  | 规格 | 人体工学 |
  | 单位 | 把 |
  | 类别 | 办公用品 |
And 点击"保存"按钮
Then 物料创建成功
And 页面显示"物料创建成功"提示
And 物料列表中显示新创建的物料
And 新物料包含所有输入的信息
```

#### Scenario 2: 创建物料时编码重复
```gherkin
Given 物料编码 "CH-001" 已存在
And 用户在物料创建页面
When 用户输入物料编码 "CH-001"
And 点击"保存"按钮
Then 显示错误提示"物料编码已存在"
And 物料未创建
And 用户停留在创建页面
```

#### Scenario 3: 编辑物料信息
```gherkin
Given 物料 "CH-001" 存在
And 用户在物料编辑页面
When 用户修改物料名称为"高级办公椅"
And 点击"保存"按钮
Then 物料信息更新成功
And 物料列表显示更新后的名称
And 显示"物料信息更新成功"提示
```

#### Scenario 4: 删除物料
```gherkin
Given 物料 "CH-001" 存在
And 用户在物料管理页面
When 用户点击物料 "CH-001" 的"删除"按钮
And 确认删除操作
Then 物料被删除
And 物料列表中不再显示该物料
And 显示"物料删除成功"提示
```

#### Scenario 5: 查看物料列表
```gherkin
Given 系统中有以下物料:
  | 物料编码 | 物料名称 | 单位 |
  | CH-001  | 办公椅   | 把  |
  | CH-002  | 办公桌   | 张  |
  | CH-003  | 文件柜   | 个  |
And 用户在物料管理页面
Then 显示物料列表
And 列表包含所有 3 个物料
And 列表按物料编码排序显示
```

#### Scenario 6: 搜索物料
```gherkin
Given 系统中有多个物料
And 用户在物料管理页面
When 用户在搜索框输入"办公椅"
Then 显示名称或编码包含"办公椅"的物料
And 其他物料被过滤掉
```

### UI/Interaction Checkpoints
- [ ] 物料列表页面布局清晰，显示编码、名称、规格、单位、类别
- [ ] 创建/编辑表单有必填项验证
- [ ] 删除操作有二次确认弹窗
- [ ] 搜索功能实时响应
- [ ] 响应式设计适配不同屏幕

### General Checklist
- [x] 物料CRUD功能全部实现
- [x] 物料编码唯一性验证
- [x] localStorage mock 数据存储
- [x] 自测无明显bug
- [x] 代码符合项目规范（TypeScript + 函数组件）

## Merge Record
- **Completed**: 2026-03-07
- **Merged to**: main
- **Merge commit**: 32c3a1f
- **Feature commit**: 742634d
- **Archive tag**: feat-material-basic-20260307

## Implementation Summary

### Files Created
- `src/types/material.ts` - Material 类型定义
- `src/services/mock/materialService.ts` - Mock 服务 (localStorage)
- `src/hooks/useMaterial.ts` - React Hook
- `src/pages/Material/index.tsx` - 物料管理页面
- `src/pages/Material/Material.css` - 样式文件

### Files Modified
- `src/App.tsx` - 添加 `/materials` 路由
- `src/pages/Dashboard/index.tsx` - 添加导航按钮

## Development Stats
- **Duration**: ~30 minutes
- **Commits**: 1
- **Files changed**: 7
- **Code changes**: +895 / -0
