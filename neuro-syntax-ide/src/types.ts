export type ViewType = 'project' | 'editor' | 'tasks' | 'workflow' | 'mission-control' | 'settings' | 'person';

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
}

export interface WorkspaceResult {
  path: string;
  valid: boolean;
  error?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'in-review' | 'completed';
  type: 'business' | 'development';
  parentId?: string;
  derivedFromId?: string;
  dependencies?: string[];
  module?: string;
  tags: string[];
  aiStatus?: string;
  progress?: number;
  assignee?: string;
  time?: string;
  startDate?: string;
  endDate?: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'SUCCESS' | 'INFO' | 'DEBUG' | 'WARN' | 'EXEC' | 'ACTIVE' | 'BUSY' | 'ERROR';
  message: string;
}

/** State for a single open file tab in the editor. */
export interface OpenFileState {
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
  /** Monaco view state to preserve cursor & scroll on tab switch */
  viewState: unknown | null;
}
