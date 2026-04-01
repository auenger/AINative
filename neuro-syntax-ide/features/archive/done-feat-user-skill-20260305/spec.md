# Feature: feat-user-skill 用户绑定技能

## Basic Information
- **ID**: feat-user-skill
- **Name**: 用户绑定技能
- **Priority**: 80
- **Size**: S
- **Dependencies**: [feat-skill-mgmt]
- **Parent**: feat-skill-system
- **Children**: []
- **Created**: 2026-03-05T16:30:00

## Description
实现用户与技能的绑定功能，允许管理员为用户分配技能并设置技能等级。这是用户技能管理系统的核心功能，建立用户与技能之间的多对多关系。

## User Value Points
1. **为用户分配技能** - 管理员可以为用户添加一个或多个技能
2. **设置技能等级** - 每个用户技能可以设置等级（初级/中级/高级/专家）
3. **移除用户技能** - 管理员可以移除用户的某个技能
4. **查看用户技能列表** - 在用户管理页面显示用户拥有的所有技能
5. **技能统计** - 显示每个用户的技能数量

## Context Analysis
### Reference Code
- `src/types/user.ts` - 需要添加 UserSkillBinding 类型
- `src/services/userRoleService.ts` - 可参考用户角色绑定服务的实现
- `src/hooks/useUserRole.ts` - 可参考用户角色 hook 的实现
- `src/pages/UserRole/` - 可参考用户角色页面的实现

### Related Documents
- 项目使用 localStorage 模拟 API 数据
- 用户技能绑定数据存储在 `mock_user_skills` key 中

### Related Features
- feat-skill-mgmt (前置) - 提供技能数据
- feat-user-role (已完成) - 可参考用户绑定角色的实现模式

## Technical Solution

### 1. 数据结构设计
```typescript
// src/types/user.ts 中添加

export interface UserSkillBinding {
  userId: string;
  skillId: string;
  level: SkillLevel;
  assignedAt: string;
  assignedBy: string; // 操作人 userId
}

export interface UserWithSkills extends User {
  skills?: Skill[];
  skillIds?: string[];
  skillBindings?: UserSkillBinding[];
}

export interface UserSkillState {
  bindings: UserSkillBinding[];
  loading: boolean;
  error: string | null;
}
```

### 2. Mock 数据存储
- Key: `mock_user_skills`
- 数据类型: `UserSkillBinding[]`
- 初始数据: 预设一些用户技能绑定

### 3. API Service 设计
```typescript
// src/services/userSkillService.ts

- getUserSkills(userId: string): UserSkillBinding[]
- getUsersBySkill(skillId: string): UserSkillBinding[]
- assignSkill(userId: string, skillId: string, level: SkillLevel): UserSkillBinding
- removeSkill(userId: string, skillId: string): boolean
- updateUserSkillLevel(userId: string, skillId: string, level: SkillLevel): UserSkillBinding
- getUserSkillIds(userId: string): string[]
```

### 4. UI 组件结构
- `src/pages/UserSkill/index.tsx` - 用户技能绑定主页面
- `src/pages/UserSkill/UserSkill.css` - 页面样式
- `src/components/UserSkillBadge/` - 用户技能徽章组件
- `src/components/AssignSkillModal/` - 分配技能弹窗

## Acceptance Criteria (Gherkin)

### User Story
作为 系统管理员，我希望 能够为用户分配技能并设置等级，以便 记录和管理员工的能力信息。

### Scenarios

#### Scenario 1: 为用户分配技能
```gherkin
Given 管理员在用户技能管理页面
And 用户 "张三" 存在
And 技能 "React" 存在
When 管理员选择用户 "张三"
And 选择技能 "React" 设置等级 "高级"
And 点击分配按钮
Then "张三" 成功获得 "React" 技能
And 技能列表更新显示
```

#### Scenario 2: 分配已拥有的技能
```gherkin
Given 管理员在用户技能管理页面
And 用户 "张三" 已拥有 "React" 技能
When 管理员尝试为 "张三" 分配 "React" 技能
Then 显示提示 "该用户已拥有此技能"
And 可以选择更新技能等级
```

#### Scenario 3: 移除用户技能
```gherkin
Given 管理员在用户技能管理页面
And 用户 "张三" 拥有 "Vue" 技能
When 管理员点击 "Vue" 技能的移除按钮
And 确认移除操作
Then "张三" 不再拥有 "Vue" 技能
And 技能列表更新显示
```

#### Scenario 4: 更新技能等级
```gherkin
Given 管理员在用户技能管理页面
And 用户 "张三" 的 "React" 技能等级为 "中级"
When 管理员将等级修改为 "高级"
And 点击保存按钮
Then 技能等级更新为 "高级"
And 显示更新成功提示
```

#### Scenario 5: 查看用户技能列表
```gherkin
Given 用户 "张三" 拥有多个技能
When 管理员查看 "张三" 的技能列表
Then 显示所有技能名称和等级
And 技能按类别分组显示
```

#### Scenario 6: 用户无技能时显示
```gherkin
Given 用户 "李四" 没有任何技能
When 管理员查看 "李四" 的技能列表
Then 显示空状态提示 "该用户暂无技能"
And 显示添加技能引导按钮
```

### UI/Interaction Checkpoints
- [ ] 用户选择下拉框正常
- [ ] 技能选择支持多选
- [ ] 技能等级下拉选择正常
- [ ] 技能徽章按类别颜色区分
- [ ] 移除确认对话框正常
- [ ] 空状态显示友好

### General Checklist
- [ ] 功能完全实现
- [ ] 自测通过
- [ ] 无明显 bug
