import React, { useState } from 'react';
import { 
  Plus, 
  MoreHorizontal, 
  Sparkles, 
  CheckCircle2, 
  Layout, 
  ChevronDown, 
  ChevronRight, 
  Link2, 
  User, 
  Clock, 
  Tag,
  Briefcase,
  Code2,
  Info,
  X,
  GitBranch,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Task } from '../../types';
import { cn } from '../../lib/utils';

const mockTasks: Task[] = [
  // Business Tasks
  { 
    id: 'b1', 
    title: 'Core Architecture Design', 
    description: 'Define the high-level architecture for the AI-first IDE, focusing on extensibility and performance.',
    status: 'completed', 
    type: 'business',
    module: 'Core Architecture',
    tags: ['Architecture', 'Design'],
    aiStatus: 'Done',
    startDate: '2026-03-20',
    endDate: '2026-03-25'
  },
  { 
    id: 'b2', 
    title: 'Plugin System Specification', 
    description: 'Detailed specification for the plugin system, including API definitions and security model.',
    status: 'in-progress', 
    type: 'business',
    module: 'Core Architecture',
    parentId: 'b1',
    tags: ['Plugins', 'Spec'],
    aiStatus: 'Refining...',
    startDate: '2026-03-24',
    endDate: '2026-03-30'
  },
  { 
    id: 'b3', 
    title: 'User Experience Strategy', 
    description: 'Define the core UX principles and user flows for the IDE.',
    status: 'todo', 
    type: 'business',
    module: 'UI/UX',
    tags: ['UX', 'Strategy'],
    aiStatus: 'Idle',
    startDate: '2026-03-28',
    endDate: '2026-04-05'
  },
  
  // Development Tasks
  { 
    id: 'd1', 
    title: 'Implement IPC Bridge', 
    description: 'Develop the Inter-Process Communication bridge for secure plugin execution.',
    status: 'in-progress', 
    type: 'development',
    module: 'Core Architecture',
    derivedFromId: 'b2',
    dependencies: ['b2'],
    tags: ['IPC', 'Node.js'],
    aiStatus: 'CODING...',
    progress: 45,
    startDate: '2026-03-26',
    endDate: '2026-04-02'
  },
  { 
    id: 'd2', 
    title: 'Theme Engine Prototype', 
    description: 'Create a working prototype of the CSS-in-JS theme engine.',
    status: 'todo', 
    type: 'development',
    module: 'UI/UX',
    derivedFromId: 'b3',
    dependencies: ['b3'],
    tags: ['CSS', 'React'],
    aiStatus: 'Queued',
    startDate: '2026-04-01',
    endDate: '2026-04-10'
  },
  { 
    id: 'd3', 
    title: 'Gemini API Integration', 
    description: 'Integrate Google Gemini API for intelligent code completion.',
    status: 'in-review', 
    type: 'development',
    module: 'AI Integration',
    derivedFromId: 'b2',
    tags: ['Gemini', 'API'],
    aiStatus: 'Validating...',
    startDate: '2026-03-25',
    endDate: '2026-04-05'
  }
];

export const TaskBoard: React.FC = () => {
  const { t } = useTranslation();
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'board' | 'timeline'>('board');

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'todo': return 'bg-surface-container-highest text-on-surface-variant';
      case 'in-progress': return 'bg-primary/20 text-primary border-primary/30';
      case 'in-review': return 'bg-secondary/20 text-secondary border-secondary/30';
      case 'completed': return 'bg-tertiary/20 text-tertiary border-tertiary/30';
      default: return 'bg-surface-container-highest text-on-surface-variant';
    }
  };

  const renderTaskCard = (task: Task) => {
    const isExpanded = expandedTasks.includes(task.id);
    const hasDependencies = task.dependencies && task.dependencies.length > 0;
    
    // Find derived tasks if this is a business task
    const derivedTasks = task.type === 'business' 
      ? mockTasks.filter(t => t.derivedFromId === task.id)
      : [];
    
    // Find parent business task if this is a development task
    const derivedFrom = task.type === 'development' && task.derivedFromId
      ? mockTasks.find(t => t.id === task.derivedFromId)
      : null;

    return (
      <motion.div 
        key={task.id}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "p-4 rounded-xl border border-outline-variant/10 bg-surface-container-low hover:border-outline-variant/40 transition-all group cursor-pointer",
          task.status === 'in-progress' && "ring-1 ring-primary/30 shadow-lg shadow-primary/5"
        )}
        onClick={() => setSelectedTask(task)}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border",
                getStatusColor(task.status)
              )}>
                {task.status}
              </span>
              <span className="text-[9px] font-bold text-outline uppercase tracking-tighter">
                {task.id}
              </span>
            </div>
            <h3 className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">
              {task.title}
            </h3>
          </div>
          <button className="p-1 hover:bg-surface-container-high rounded transition-colors">
            <MoreHorizontal size={14} className="text-outline" />
          </button>
        </div>

        {/* Derived Relationship Indicator */}
        {derivedFrom && (
          <div className="flex items-center gap-2 mb-3 bg-secondary/5 p-1.5 rounded border border-secondary/10">
            <GitBranch size={10} className="text-secondary" />
            <span className="text-[9px] font-bold text-secondary uppercase tracking-tighter">
              {t('tasks.derivedFrom')}: {derivedFrom.id}
            </span>
          </div>
        )}

        {derivedTasks.length > 0 && (
          <div className="flex items-center gap-2 mb-3 bg-primary/5 p-1.5 rounded border border-primary/10">
            <GitBranch size={10} className="text-primary rotate-180" />
            <span className="text-[9px] font-bold text-primary uppercase tracking-tighter">
              {t('tasks.derivedTasks')}: {derivedTasks.length}
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-1 mb-4">
          {task.tags.map(tag => (
            <span key={tag} className="text-[9px] bg-surface-container-highest px-1.5 py-0.5 rounded text-on-surface-variant font-medium">
              #{tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-surface-container-highest flex items-center justify-center border border-outline-variant/10 overflow-hidden">
              <img 
                src={`https://picsum.photos/seed/${task.id}/32/32`} 
                alt="Avatar" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="text-[10px] text-on-surface-variant font-medium">Agent-Alpha</span>
          </div>
          
          {hasDependencies && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(task.id);
              }}
              className="flex items-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 px-2 py-1 rounded transition-all"
            >
              <Link2 size={12} />
              {task.dependencies?.length} {t('tasks.dependencies')}
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          )}
        </div>

        <AnimatePresence>
          {isExpanded && hasDependencies && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 pt-3 border-t border-outline-variant/10 space-y-2 overflow-hidden"
            >
              {task.dependencies?.map(depId => {
                const depTask = mockTasks.find(t => t.id === depId);
                return (
                  <div key={depId} className="flex flex-col gap-1 p-2 rounded bg-surface-container-high/50 border border-outline-variant/5 hover:border-primary/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="text-[9px] font-bold text-primary">{depId}</span>
                      </div>
                      <span className={cn(
                        "text-[8px] font-bold uppercase px-1 rounded",
                        getStatusColor(depTask?.status || 'todo')
                      )}>
                        {depTask?.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-on-surface-variant truncate font-medium">
                      {depTask?.title || 'Unknown Task'}
                    </span>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  const renderModuleGroup = (moduleName: string, tasks: Task[]) => {
    return (
      <div key={moduleName} className="space-y-4 mb-8">
        <div className="flex items-center gap-3 px-2">
          <div className="h-[1px] flex-1 bg-outline-variant/10"></div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline">
            {moduleName}
          </span>
          <div className="h-[1px] flex-1 bg-outline-variant/10"></div>
        </div>
        <div className="space-y-3">
          {tasks.map(task => renderTaskCard(task))}
        </div>
      </div>
    );
  };

  const renderTimelineView = () => {
    const startDate = new Date('2026-03-15');
    const endDate = new Date('2026-04-15');
    const days = [];
    let current = new Date(startDate);
    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    const getDayOffset = (dateStr?: string) => {
      if (!dateStr) return 0;
      const date = new Date(dateStr);
      const diffTime = Math.abs(date.getTime() - startDate.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const getDuration = (start?: string, end?: string) => {
      if (!start || !end) return 1;
      const s = new Date(start);
      const e = new Date(end);
      const diffTime = Math.abs(e.getTime() - s.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    };

    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-surface-container-low/30 rounded-2xl border border-outline-variant/10">
        <div className="flex border-b border-outline-variant/10 bg-surface-container-high/50 shrink-0">
          <div className="w-64 border-r border-outline-variant/10 p-4 font-bold text-xs uppercase tracking-widest text-outline">Tasks</div>
          <div className="flex-1 overflow-x-auto flex scroll-hide">
            {days.map((day, i) => (
              <div key={i} className="min-w-[40px] border-r border-outline-variant/5 p-2 text-center flex flex-col items-center justify-center">
                <span className="text-[8px] text-outline uppercase">{day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span className="text-[10px] font-bold text-on-surface">{day.getDate()}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scroll-hide">
          {mockTasks.map((task, i) => (
            <div key={task.id} className="flex border-b border-outline-variant/5 hover:bg-surface-container-high/20 transition-colors group">
              <div className="w-64 border-r border-outline-variant/10 p-3 flex items-center gap-3 shrink-0">
                <div className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  task.type === 'business' ? "bg-secondary" : "bg-primary"
                )} />
                <div className="truncate">
                  <p className="text-[10px] font-bold text-outline uppercase tracking-tighter leading-none mb-1">{task.id}</p>
                  <p className="text-xs font-medium text-on-surface truncate">{task.title}</p>
                </div>
              </div>
              <div className="flex-1 relative min-h-[48px] flex items-center">
                <div className="absolute inset-0 flex">
                  {days.map((_, j) => (
                    <div key={j} className="min-w-[40px] border-r border-outline-variant/5 h-full opacity-20" />
                  ))}
                </div>
                <motion.div 
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ 
                    width: `${getDuration(task.startDate, task.endDate) * 40}px`,
                    opacity: 1,
                    x: `${getDayOffset(task.startDate) * 40}px`
                  }}
                  className={cn(
                    "h-6 rounded-full relative z-10 flex items-center px-3 shadow-sm border",
                    task.type === 'business' 
                      ? "bg-secondary/20 border-secondary/30 text-secondary" 
                      : "bg-primary/20 border-primary/30 text-primary"
                  )}
                >
                  <span className="text-[9px] font-bold truncate uppercase tracking-tighter">{task.status}</span>
                  {task.progress && (
                    <div className="absolute bottom-0 left-0 h-0.5 bg-current opacity-30 rounded-full" style={{ width: `${task.progress}%` }} />
                  )}
                </motion.div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const modules = Array.from(new Set(mockTasks.map(t => t.module || 'General')));

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
      <header className="h-14 bg-surface-container-low flex items-center justify-between px-6 border-b border-outline-variant/10 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="font-headline text-lg font-bold tracking-tight text-on-surface">{t('tasks.title')}</h1>
          <div className="h-4 w-px bg-outline-variant/30"></div>
          <div className="flex items-center gap-2 bg-surface-container-lowest p-1 rounded-lg border border-outline-variant/10 shadow-inner">
            <button 
              onClick={() => setViewMode('board')}
              className={cn(
                "px-4 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all",
                viewMode === 'board' 
                  ? "bg-primary/20 text-primary shadow-sm" 
                  : "text-outline hover:text-on-surface"
              )}
            >
              Board
            </button>
            <button 
              onClick={() => setViewMode('timeline')}
              className={cn(
                "px-4 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all",
                viewMode === 'timeline' 
                  ? "bg-primary/20 text-primary shadow-sm" 
                  : "text-outline hover:text-on-surface"
              )}
            >
              Timeline
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowNewTaskModal(true)}
            className="group relative flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 px-5 py-2 rounded-xl text-xs font-bold hover:bg-primary/20 hover:-translate-y-0.5 active:translate-y-0 transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:animate-shimmer" />
            <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
            <span className="relative z-10 uppercase tracking-widest">{t('tasks.newTask')}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        {viewMode === 'board' ? (
          <>
            {/* Business Tasks Column */}
            <div className="flex-1 flex flex-col min-w-[400px]">
              <div className="flex items-center gap-3 mb-6 px-2">
                <div className="p-2 bg-secondary/10 rounded-lg">
                  <Briefcase size={18} className="text-secondary" />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface">
                    {t('project.businessTasks')}
                  </h2>
                  <p className="text-[10px] text-outline uppercase tracking-tighter">Strategic & Functional Requirements</p>
                </div>
                <div className="ml-auto bg-surface-container-high px-2 py-0.5 rounded text-[10px] font-bold text-outline">
                  {mockTasks.filter(t => t.type === 'business').length}
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 scroll-hide">
                {modules.map(module => {
                  const moduleTasks = mockTasks.filter(t => t.type === 'business' && (t.module || 'General') === module);
                  if (moduleTasks.length === 0) return null;
                  return renderModuleGroup(module, moduleTasks);
                })}
              </div>
            </div>

            <div className="w-[1px] bg-outline-variant/10 self-stretch"></div>

            {/* Development Tasks Column */}
            <div className="flex-1 flex flex-col min-w-[400px]">
              <div className="flex items-center gap-3 mb-6 px-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Code2 size={18} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface">
                    {t('project.devTasks')}
                  </h2>
                  <p className="text-[10px] text-outline uppercase tracking-tighter">Implementation & Technical Execution</p>
                </div>
                <div className="ml-auto bg-surface-container-high px-2 py-0.5 rounded text-[10px] font-bold text-outline">
                  {mockTasks.filter(t => t.type === 'development').length}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 scroll-hide">
                {modules.map(module => {
                  const moduleTasks = mockTasks.filter(t => t.type === 'development' && (t.module || 'General') === module);
                  if (moduleTasks.length === 0) return null;
                  return renderModuleGroup(module, moduleTasks);
                })}
              </div>
            </div>
          </>
        ) : (
          renderTimelineView()
        )}
      </div>

      {/* Task Details Modal */}
      <AnimatePresence>
        {selectedTask && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTask(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, x: 50 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ scale: 0.9, opacity: 0, x: 50 }}
              className="relative w-full max-w-xl bg-surface-container-low border border-outline-variant/20 rounded-xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-high/30">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    selectedTask.type === 'business' ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"
                  )}>
                    {selectedTask.type === 'business' ? <Briefcase size={20} /> : <Code2 size={20} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest">{selectedTask.id}</h3>
                    <p className="text-[10px] text-outline uppercase tracking-tighter">{selectedTask.type} Task</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedTask(null)}
                  className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-on-surface leading-tight">
                    {selectedTask.title}
                  </h2>
                  <div className="flex items-center gap-4 text-xs text-on-surface-variant">
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} className="text-outline" />
                      <span>Created 2 days ago</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User size={14} className="text-outline" />
                      <span>Assigned to Agent-Alpha</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-outline">Description</h4>
                  <p className="text-sm text-on-surface-variant leading-relaxed opacity-80">
                    {selectedTask.description || 'No description provided for this task.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-outline">Status</h4>
                    <div className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold",
                      getStatusColor(selectedTask.status)
                    )}>
                      <div className="w-2 h-2 rounded-full bg-current" />
                      {selectedTask.status.toUpperCase()}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-outline">Module</h4>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-outline-variant/10 bg-surface-container-high text-xs font-bold text-on-surface">
                      <Layout size={14} className="text-outline" />
                      {selectedTask.module}
                    </div>
                  </div>
                </div>

                {/* Derived Relationship in Modal */}
                {selectedTask.type === 'development' && selectedTask.derivedFromId && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-outline">{t('tasks.derivedFrom')}</h4>
                    <div className="p-3 rounded-lg bg-secondary/5 border border-secondary/10 flex items-center justify-between group cursor-pointer hover:bg-secondary/10 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-secondary/10 rounded text-secondary">
                          <Briefcase size={14} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-secondary uppercase tracking-tighter">{selectedTask.derivedFromId}</p>
                          <p className="text-xs font-medium text-on-surface">
                            {mockTasks.find(t => t.id === selectedTask.derivedFromId)?.title || 'Unknown Business Task'}
                          </p>
                        </div>
                      </div>
                      <ArrowRight size={14} className="text-secondary opacity-0 group-hover:opacity-100 transition-all" />
                    </div>
                  </div>
                )}

                {selectedTask.type === 'business' && mockTasks.some(t => t.derivedFromId === selectedTask.id) && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-outline">{t('tasks.derivedTasks')}</h4>
                    <div className="space-y-2">
                      {mockTasks.filter(t => t.derivedFromId === selectedTask.id).map(devTask => (
                        <div key={devTask.id} className="p-3 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-between group cursor-pointer hover:bg-primary/10 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-primary/10 rounded text-primary">
                              <Code2 size={14} />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-primary uppercase tracking-tighter">{devTask.id}</p>
                              <p className="text-xs font-medium text-on-surface">{devTask.title}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded",
                              getStatusColor(devTask.status)
                            )}>
                              {devTask.status}
                            </span>
                            <ArrowRight size={14} className="text-primary opacity-0 group-hover:opacity-100 transition-all" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-outline">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTask.tags.map(tag => (
                      <span key={tag} className="flex items-center gap-1.5 px-3 py-1 bg-surface-container-highest rounded-full text-xs font-medium text-on-surface-variant border border-outline-variant/5">
                        <Tag size={12} className="opacity-50" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-surface-container-high/30 border-t border-outline-variant/10 flex justify-end gap-3">
                <button 
                  onClick={() => setSelectedTask(null)}
                  className="px-6 py-2 bg-surface-container-highest text-on-surface rounded-lg text-xs font-bold hover:bg-surface-variant transition-all border border-outline-variant/10"
                >
                  Close
                </button>
                <button className="px-6 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20">
                  Edit Task
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Task Type Selection Modal */}
      <AnimatePresence>
        {showNewTaskModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewTaskModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-surface-container-low border border-outline-variant/20 rounded-xl shadow-2xl overflow-hidden p-8"
            >
              <div className="text-center space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-on-surface">Create New Task</h3>
                  <p className="text-xs text-on-surface-variant opacity-70">Select the type of task you want to create</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <button 
                    onClick={() => setShowNewTaskModal(false)}
                    className="flex items-center gap-4 p-4 rounded-xl border border-secondary/20 bg-secondary/5 hover:bg-secondary/10 transition-all group text-left"
                  >
                    <div className="p-3 bg-secondary/10 rounded-lg text-secondary group-hover:scale-110 transition-transform">
                      <Briefcase size={24} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-on-surface">{t('project.businessTasks')}</h4>
                      <p className="text-[10px] text-on-surface-variant opacity-70">Define requirements and business logic</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setShowNewTaskModal(false)}
                    className="flex items-center gap-4 p-4 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all group text-left"
                  >
                    <div className="p-3 bg-primary/10 rounded-lg text-primary group-hover:scale-110 transition-transform">
                      <Code2 size={24} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-on-surface">{t('project.devTasks')}</h4>
                      <p className="text-[10px] text-on-surface-variant opacity-70">Technical implementation and coding</p>
                    </div>
                  </button>
                </div>

                <button 
                  onClick={() => setShowNewTaskModal(false)}
                  className="w-full py-2 text-xs font-bold text-outline hover:text-on-surface transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
