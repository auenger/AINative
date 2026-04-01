# 任务清单: 基础排班管理 (feat-schedule-basic)

## 阶段一：基础数据模型与服务层

### 1.1 数据模型定义
- [ ] 在 `src/types/` 下创建 `schedule.ts` 类型定义文件
- [ ] 定义 `UserSchedule` 接口（包含所有字段）
- [ ] 定义 `ShiftType` 枚举和 `ShiftConfig` 常量
- [ ] 定义 `ScheduleFilter` 筛选条件接口
- [ ] 定义 `ScheduleFormData` 表单接口

### 1.2 Mock数据层
- [ ] 创建 `src/services/mock/scheduleService.ts`
- [ ] 实现 `getSchedules()` - 获取排班列表（支持权限过滤和筛选）
- [ ] 实现 `getScheduleById()` - 获取单个排班
- [ ] 实现 `createSchedule()` - 创建排班
- [ ] 实现 `updateSchedule()` - 更新排班
- [ ] 实现 `deleteSchedule()` - 删除排班
- [ ] 实现 `checkScheduleConflict()` - 冲突检测
- [ ] 初始化 mock 数据结构

### 1.3 业务服务层
- [ ] 创建 `src/services/scheduleConflictService.ts` - 冲突检测服务
- [ ] 创建 `src/services/scheduleNotificationService.ts` - 通知服务
- [ ] 创建 `src/hooks/useSchedules.ts` - 排班数据Hook
- [ ] 创建 `src/hooks/useScheduleConflict.ts` - 冲突检测Hook

## 阶段二：UI组件开发

### 2.1 排班表单组件
- [ ] 创建 `src/components/schedule/ScheduleForm.tsx`
  - [ ] 用户选择器（支持部门筛选）
  - [ ] 日期选择器
  - [ ] 班次选择器（下拉框）
  - [ ] 时间输入框（开始/结束时间，根据班次自动填充）
  - [ ] 地点输入框
  - [ ] 备注输入框
  - [ ] 表单验证

### 2.2 列表视图组件
- [ ] 创建 `src/components/schedule/ScheduleList.tsx`
  - [ ] 排班表格展示
  - [ ] 筛选器（日期范围、用户、部门、班次）
  - [ ] 编辑/删除操作按钮
  - [ ] 新增排班按钮
  - [ ] 权限控制（根据角色显示/隐藏操作）

## 阶段三：页面开发

### 3.1 排班列表管理页面
- [ ] 创建 `src/pages/SchedulesListPage.tsx`
  - [ ] 整合列表视图组件
  - [ ] 权限控制（管理员/部门领导）
  - [ ] 新增/编辑排班入口

### 3.2 我的排班页面
- [ ] 创建 `src/pages/MySchedulePage.tsx`
  - [ ] 仅展示当前用户排班
  - [ ] 列表视图
  - [ ] 只读模式

### 3.3 路由配置
- [ ] 在 `App.tsx` 中添加排班相关路由
  - [ ] `/schedules/list` - 排班列表管理（需权限）
  - [ ] `/schedules/my` - 我的排班

## 阶段四：权限控制

### 4.1 权限判断
- [ ] 实现 `canViewScheduleList()` - 查看排班列表权限
- [ ] 实现 `canManageSchedule()` - 管理排班权限
- [ ] 实现 `canManageDepartmentSchedule()` - 管理部门排班权限
- [ ] 集成到 ProtectedRoute 组件

### 4.2 数据权限过滤
- [ ] 根据用户角色过滤排班数据
  - [ ] 普通用户：仅看自己的排班
  - [ ] 部门领导：看本部门排班
  - [ ] 管理员：看所有排班

## 阶段五：通知功能

### 5.1 通知集成
- [ ] 创建排班时发送通知
- [ ] 修改排班时发送通知
- [ ] 删除排班时发送通知
- [ ] 通知内容包含：日期、班次、地点、备注

## 阶段六：E2E测试

### 6.1 核心功能测试
- [ ] 编写 E2E 测试场景（基于 Gherkin Scenarios）
  - [ ] 管理员创建单个排班
  - [ ] 管理员编辑排班
  - [ ] 管理员删除排班
  - [ ] 部门领导查看和管理本部门排班
  - [ ] 冲突检测阻止重复排班
  - [ ] 用户查看自己的排班
  - [ ] 普通用户无法访问排班管理页面
  - [ ] 排班筛选功能

### 6.2 运行测试验证
- [ ] 运行 E2E 测试验证 UI 功能
- [ ] 验证页面交互和用户流程

## 阶段七：集成与验收

### 7.1 样式调整
- [ ] 确保页面样式与整体风格一致
- [ ] 响应式布局适配

### 7.2 功能验收
- [ ] 所有功能验收清单项完成
- [ ] E2E 测试通过
- [ ] 无明显Bug

## 开发注意事项

1. **参考现有实现**：
   - 参考 `feat-user-dept-leader` 的权限控制实现
   - 参考 `feat-notification-history` 的通知集成方式
   - 复用现有的表格和模态框组件

2. **时间处理**：
   - 使用 `YYYY-MM-DD` 格式存储日期
   - 使用 `HH:mm` 格式存储时间
   - 注意跨天班次的处理（如晚班）

3. **冲突检测**：
   - 同一用户同一天只能有一个排班
   - 在创建和编辑时进行检测
   - 提供清晰的冲突提示

4. **权限控制**：
   - 普通用户只能访问 `/schedules/my`
   - 部门领导和管理员可以访问 `/schedules/list`
   - 数据根据角色自动过滤
