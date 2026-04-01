# Task List: feat-notification-history

## Implementation Tasks

### 数据层

- [ ] 添加通知历史筛选类型到 `src/types/notification.ts`
  - NotificationHistoryFilters 接口
  - NotificationHistoryItem 接口

- [ ] 扩展通知服务 `src/services/notificationService.ts`
  - getNotificationHistory(userId, filters) - 获取历史通知
  - batchMarkAsRead(notificationIds) - 批量标记已读
  - batchDelete(notificationIds) - 批量删除
  - searchNotifications(keyword) - 搜索通知

### UI 组件

- [ ] 创建通知历史页面 `src/pages/NotificationHistory/index.tsx`
  - 通知历史列表
  - 筛选面板
  - 搜索框
  - 批量操作按钮
  - 分页组件

- [ ] 创建通知历史页面样式 `src/pages/NotificationHistory/NotificationHistory.css`
  - 列表样式
  - 筛选面板样式
  - 批量选择样式

- [ ] 创建筛选组件 `src/components/NotificationFilters/`
  - NotificationFilters.tsx - 筛选组件
  - NotificationFilters.css - 样式
  - index.ts - 导出

### 路由配置

- [ ] 添加路由配置到 `src/App.tsx`
  - /notification-history 路由

### 导航集成

- [ ] 添加导航链接
  - 在通知列表页添加"查看历史"入口

## Testing Tasks

- [ ] 编写 E2E 测试场景 (基于 Gherkin Scenarios)
  - Scenario 1: 查看通知历史
  - Scenario 2: 按类型筛选
  - Scenario 3: 按状态筛选
  - Scenario 4: 按日期范围筛选
  - Scenario 5: 关键词搜索
  - Scenario 6: 批量标记已读
  - Scenario 7: 批量删除
- [ ] 运行 E2E 测试验证 UI 功能
- [ ] 验证页面交互和用户流程
