import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      nav: {
        project: 'Project',
        editor: 'Editor',
        explorer: 'Explorer',
        search: 'Search',
        tasks: 'Tasks',
        workflow: 'Workflow',
        missionControl: 'Mission Control',
        settings: 'Settings',
        person: 'Profile',
        runAi: 'Run AI',
        deploy: 'Deploy'
      },
      project: {
        title: 'Project Management',
        workspace: 'Workspace',
        selectWorkspace: 'Select Workspace',
        gitRemote: 'Git Remote',
        pmAgent: 'PM Agent',
        projectContext: 'Project Context',
        chatPlaceholder: 'Discuss project context with PM Agent...',
        initProject: 'Initialize Project Documentation',
        generateTask: 'Generate Tasks',
        splittingModules: 'Splitting Functional Modules...',
        businessTasks: 'Business Tasks',
        devTasks: 'Development Tasks',
        module: 'Module',
        subTask: 'Sub-task',
        dependencies: 'Dependencies',
        derivedFrom: 'Derived From',
        derivedTasks: 'Derived Dev Tasks',
        gitStatus: 'Git Status',
        pushChanges: 'Push Changes',
        updateRemote: 'Update from Remote',
        branch: 'Branch',
        changesDetected: 'Changes Detected',
        noChanges: 'No Changes',
        syncing: 'Syncing...'
      },
      editor: {
        explorer: 'Explorer',
        searchPlaceholder: 'Search workspace...',
        save: 'SAVE',
        run: 'RUN',
        quickConnect: 'Quick Connect',
        bashTerminal: 'Bash Terminal',
        claudeCode: 'Claude Code',
        geminiCli: 'Gemini CLI'
      },
      tasks: {
        title: 'Task Board',
        todo: 'Todo',
        inProgress: 'In Progress',
        inReview: 'In Review',
        completed: 'Completed',
        newTask: 'New Task',
        newAiTask: 'NEW AI TASK',
        stepDescribe: 'Describe',
        stepThinking: 'Thinking',
        stepReview: 'Review',
        stepConfirm: 'Confirm'
      },
      missionControl: {
        title: 'Mission Control',
        systemHealth: 'System Health',
        manageAgents: 'MANAGE AGENTS'
      },
      common: {
        active: 'Active',
        busy: 'Busy',
        success: 'Success',
        info: 'Info'
      }
    }
  },
  zh: {
    translation: {
      nav: {
        project: '项目',
        editor: '编辑器',
        explorer: '资源管理器',
        search: '搜索',
        tasks: '任务',
        workflow: '工作流',
        missionControl: '任务控制',
        settings: '设置',
        person: '个人资料',
        runAi: '运行 AI',
        deploy: '部署'
      },
      project: {
        title: '项目管理',
        workspace: '工作空间',
        selectWorkspace: '选择工作空间',
        gitRemote: 'Git 远程仓库',
        pmAgent: 'PM 代理',
        projectContext: '项目上下文',
        chatPlaceholder: '与 PM 代理讨论项目上下文...',
        initProject: '初始化项目文档',
        generateTask: '生成任务',
        splittingModules: '正在切分功能模块...',
        businessTasks: '业务任务',
        devTasks: '开发任务',
        module: '模块',
        subTask: '子任务',
        dependencies: '依赖关系',
        derivedFrom: '派生自',
        derivedTasks: '派生开发任务',
        gitStatus: 'Git 状态',
        pushChanges: '推送变更',
        updateRemote: '从远程更新',
        branch: '分支',
        changesDetected: '检测到变更',
        noChanges: '无变更',
        syncing: '正在同步...'
      },
      editor: {
        explorer: '资源管理器',
        searchPlaceholder: '搜索工作区...',
        save: '保存',
        run: '运行',
        quickConnect: '快速连接',
        bashTerminal: 'Bash 终端',
        claudeCode: 'Claude 代码',
        geminiCli: 'Gemini 命令行'
      },
      tasks: {
        title: '任务板',
        todo: '待办',
        inProgress: '进行中',
        inReview: '审核中',
        completed: '已完成',
        newTask: '新建任务',
        newAiTask: '新建 AI 任务',
        stepDescribe: '描述',
        stepThinking: '思考',
        stepReview: '审查',
        stepConfirm: '确认'
      },
      missionControl: {
        title: '任务控制',
        systemHealth: '系统健康度',
        manageAgents: '管理代理'
      },
      common: {
        active: '活跃',
        busy: '忙碌',
        success: '成功',
        info: '信息'
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
