import React, { useState, useEffect } from 'react';
import { TopNav } from './components/TopNav';
import { SideNav } from './components/SideNav';
import { BottomPanel } from './components/BottomPanel';
import { StatusBar } from './components/StatusBar';
import { TaskBoard } from './components/views/TaskBoard';
import { WorkflowEditor } from './components/views/WorkflowEditor';
import { MissionControl } from './components/views/MissionControl';
import { EditorView } from './components/views/EditorView';
import { ProjectView } from './components/views/ProjectView';
import { ViewType, LogEntry } from './types';
import { cn } from './lib/utils';
import { useWorkspace } from './lib/useWorkspace';

const INITIAL_LOGS: LogEntry[] = [
  { timestamp: '14:20:01', level: 'INFO', message: 'Neuro Syntax Kernel v1.0.4 initialized.' },
  { timestamp: '14:20:05', level: 'SUCCESS', message: 'Connected to AI Cluster: Sentinel-Prime.' },
  { timestamp: '14:21:12', level: 'EXEC', message: 'Running background optimization on ./src/core/engine.ts' },
  { timestamp: '14:22:30', level: 'ACTIVE', message: 'Agent "Alpha" is analyzing the current workspace.' },
  { timestamp: '14:23:15', level: 'BUSY', message: 'Generating spec.md for the new task...' },
];

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>('project');
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [consoleVisible, setConsoleVisible] = useState(true);
  const workspace = useWorkspace();

  // Simulate incoming logs
  useEffect(() => {
    const timer = setInterval(() => {
      const newLog: LogEntry = {
        timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        level: Math.random() > 0.7 ? 'SUCCESS' : 'INFO',
        message: `System heartbeat detected. All modules nominal. [${Math.random().toString(36).substring(7)}]`
      };
      setLogs(prev => [newLog, ...prev].slice(0, 50));
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const renderView = () => {
    switch (activeView) {
      case 'project':
        return <ProjectView workspace={workspace} />;
      case 'editor':
        return <EditorView workspace={workspace} />;
      case 'tasks':
        return <TaskBoard />;
      case 'workflow':
        return <WorkflowEditor />;
      case 'mission-control':
        return <MissionControl />;
      default:
        return <ProjectView workspace={workspace} />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#020617] text-on-surface overflow-hidden selection:bg-primary/30">
      <TopNav />

      <div className="flex flex-1 overflow-hidden relative">
        <SideNav activeView={activeView} onViewChange={setActiveView} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col ml-16 overflow-hidden relative">
          <div className="flex-1 flex overflow-hidden">
            {/* Dynamic View Content */}
            {renderView()}
          </div>

          <BottomPanel
            logs={logs}
            visible={consoleVisible}
            onClose={() => setConsoleVisible(false)}
            onOpen={() => setConsoleVisible(true)}
          />
        </div>
      </div>

      <StatusBar workspacePath={workspace.workspacePath} />
    </div>
  );
};

export default App;
