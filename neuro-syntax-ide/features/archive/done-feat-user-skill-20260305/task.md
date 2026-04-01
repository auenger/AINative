# Task List: feat-user-skill

## Implementation Tasks

- [x] 1. 添加用户技能绑定类型到 `src/types/user.ts`
  - UserSkillBinding 接口
  - UserWithSkills 接口
  - UserSkillState 接口

- [x] 2. 创建用户技能服务 `src/services/userSkillService.ts`
  - getUserSkills(userId) - 获取用户的所有技能
  - getUsersBySkill(skillId) - 获取拥有某技能的所有用户
  - assignSkill(userId, skillId, level) - 为用户分配技能
  - removeSkill(userId, skillId) - 移除用户技能
  - updateUserSkillLevel(userId, skillId, level) - 更新技能等级
  - getUserSkillIds(userId) - 获取用户技能ID列表
  - 初始化 mock_user_skills 数据

- [x] 3. 创建用户技能 Hook `src/hooks/useUserSkill.ts`
  - bindings 状态管理
  - 用户技能 CRUD 操作
  - loading/error 状态

- [x] 4. 创建用户技能绑定页面 `src/pages/UserSkill/index.tsx`
  - 用户选择下拉框
  - 技能选择（支持多选）
  - 技能等级选择
  - 用户技能列表展示
  - 移除技能功能
  - 更新等级功能

- [x] 5. 创建用户技能页面样式 `src/pages/UserSkill/UserSkill.css`
  - 用户选择区域样式
  - 技能列表样式
  - 技能徽章样式
  - 等级选择器样式

- [x] 6. 创建技能徽章组件 `src/components/UserSkillBadge/`
  - UserSkillBadge.tsx - 显示技能名称和等级
  - UserSkillBadge.css - 徽章样式（按等级颜色区分）
  - index.ts - 导出

- [x] 7. 添加路由配置到 `src/App.tsx`
  - /user-skill 路由

- [x] 8. 添加导航链接
  - 在侧边栏添加"用户技能"入口

## Testing Tasks

- [x] 编写 E2E 测试场景 (基于 Gherkin Scenarios)
  - Scenario 1: 为用户分配技能
  - Scenario 2: 分配已拥有的技能
  - Scenario 3: 移除用户技能
  - Scenario 4: 更新技能等级
  - Scenario 5: 查看用户技能列表
  - Scenario 6: 用户无技能时显示
- [x] 运行 E2E 测试验证 UI 功能
- [x] 验证页面交互和用户流程
