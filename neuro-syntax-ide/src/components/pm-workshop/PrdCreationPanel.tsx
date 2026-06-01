import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { FileText, Loader2, RotateCcw, FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { useAgentStream } from '../../lib/useAgentStream';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
import type { ChatMessage, FsChangeEvent } from '../../lib/useAgentStream';
import type {
  BMADSessionState,
  PRDDocument,
  PRDSection,
  PRDIntent,
  PRDStakeLevel,
  PRDMode,
  Assumption,
  StepProgressPayload,
} from '../../types';
import { PRD_SYSTEM_PROMPT } from '../../lib/bmad/prd-prompts';
import { parseStepProgressMarker, extractLatestStepProgress } from '../../lib/bmad/workshop-markers';
import { WorkshopChatPanel } from './WorkshopChatPanel';
import { WorkshopChatBubble } from './WorkshopChatBubble';
import { IntentSelector, type IntentOption } from './IntentSelector';
import { StakeCalibration, type StakeOption } from './StakeCalibration';
import { WorkModeSelector, type WorkModeOption } from './WorkModeSelector';
import { PRDDocumentPreview } from './PRDDocumentPreview';
import { ValidationReport, type ValidationReportData } from './ValidationReport';
import { FinalizationChecklist, type FinalizationStep } from './FinalizationChecklist';

// ─── Props ───

interface PrdCreationPanelProps {
  workspacePath: string;
  sessionState: BMADSessionState;
  onDocumentChange: (doc: PRDDocument) => void;
  /** If set, auto-starts the session and sends this prompt as the first message */
  autoStartPrompt?: string | null;
  /** Called after autoStartPrompt has been consumed */
  onAutoStartConsumed?: () => void;
  className?: string;
}

// ─── HTML-comment marker parsers ───

interface ParsedIntentSelector {
  options: IntentOption[];
}

interface ParsedStakeCalibration {
  options: StakeOption[];
}

interface ParsedWorkModeSelector {
  options: WorkModeOption[];
}

interface ParsedPrdSection {
  id: string;
  title: string;
  status: 'complete' | 'in-progress' | 'empty';
  content: string;
}

interface ParsedPrdComplete {
  title: string;
  sectionCount: number;
  assumptionCount: number;
  status: string;
}

interface ParsedValidationReport extends ValidationReportData {}

interface ParsedFinalizationStep {
  step: number;
  title: string;
  status: 'complete' | 'in-progress' | 'pending';
  note?: string;
}

interface ParsedPrdFinal {
  title: string;
  status: string;
  readyForFeature: boolean;
}

type PrdPayload =
  | { type: 'intent-selector'; data: ParsedIntentSelector }
  | { type: 'stake-calibration'; data: ParsedStakeCalibration }
  | { type: 'work-mode-selector'; data: ParsedWorkModeSelector }
  | { type: 'prd-section'; data: ParsedPrdSection }
  | { type: 'prd-complete'; data: ParsedPrdComplete }
  | { type: 'validation-report'; data: ParsedValidationReport }
  | { type: 'finalization-step'; data: ParsedFinalizationStep }
  | { type: 'prd-final'; data: ParsedPrdFinal };

function parsePrdMarker(content: string): { text: string; payload: PrdPayload | null; stepProgress: StepProgressPayload | null } {
  // Step 1: Extract step-progress marker (highest priority, self-closing)
  const { text: stepCleaned, stepProgress } = parseStepProgressMarker(content);

  // Step 2: Try each marker type in order of specificity on cleaned text
  const markers: Array<{ tag: string; type: PrdPayload['type'] }> = [
    { tag: 'intent-selector', type: 'intent-selector' },
    { tag: 'stake-calibration', type: 'stake-calibration' },
    { tag: 'work-mode-selector', type: 'work-mode-selector' },
    { tag: 'prd-section', type: 'prd-section' },
    { tag: 'prd-complete', type: 'prd-complete' },
    { tag: 'validation-report', type: 'validation-report' },
    { tag: 'finalization-step', type: 'finalization-step' },
    { tag: 'prd-final', type: 'prd-final' },
  ];

  for (const { tag, type } of markers) {
    const regex = new RegExp(
      `<!-- workshop:${tag} -->\\s*({[\\s\\S]*?})\\s*<!-- /workshop:${tag} -->`
    );
    const match = stepCleaned.match(regex);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        const cleanText = stepCleaned.replace(
          new RegExp(`<!-- workshop:${tag} -->[\\s\\S]*?<!-- /workshop:${tag} -->`),
          ''
        ).trim();
        return { text: cleanText, payload: { type, data } as PrdPayload, stepProgress };
      } catch {
        // ignore parse errors
      }
    }
  }

  return { text: stepCleaned, payload: null, stepProgress };
}

// ─── Extract assumptions from content ───

function extractAssumptions(sections: PRDSection[]): Assumption[] {
  const assumptions: Assumption[] = [];
  for (const section of sections) {
    const regex = /\[ASSUMPTION:\s*([^\]]+)\]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(section.content)) !== null) {
      assumptions.push({
        id: `asm-${assumptions.length}`,
        text: match[1].trim(),
        confirmed: false,
      });
    }
  }
  return assumptions;
}

// ─── PRD Phase ───

type PrdPhase = 'discovery' | 'writing' | 'validation' | 'finalization';

// ─── Markdown → PRDSection parser ───

function parseMarkdownToPrdSections(content: string): { title: string; sections: PRDSection[] } {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

  const headingRegex = /^##\s+(.+)$/gm;
  const headings: { title: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRegex.exec(content)) !== null) {
    headings.push({ title: m[1].trim(), index: m.index });
  }

  if (headings.length === 0) {
    const body = content.replace(/^#\s+.*$/m, '').trim();
    return {
      title,
      sections: body ? [{ id: 'full', title, status: 'complete' as const, content: body }] : [],
    };
  }

  const sections: PRDSection[] = headings.map((h, i) => {
    const start = content.indexOf('\n', h.index) + 1;
    const end = i + 1 < headings.length ? headings[i + 1].index : content.length;
    const body = content.slice(start, end).trim();
    return {
      id: h.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: h.title,
      status: (body ? 'complete' : 'empty') as 'complete' | 'empty',
      content: body,
    };
  });

  return { title, sections };
}

// ─── Component ───

export const PrdCreationPanel: React.FC<PrdCreationPanelProps> = ({
  workspacePath,
  sessionState,
  onDocumentChange,
  autoStartPrompt,
  onAutoStartConsumed,
  className,
}) => {
  const { t } = useTranslation();

  // ─── State ───
  const [isStarted, setIsStarted] = useState(false);
  const [prdPhase, setPrdPhase] = useState<PrdPhase>('discovery');
  const [intent, setIntent] = useState<PRDIntent | null>(null);
  const [stakeLevel, setStakeLevel] = useState<PRDStakeLevel | null>(null);
  const [mode, setMode] = useState<PRDMode | null>(null);

  // File-based PRD rendering: detect, read, and watch PRD markdown files
  const [prdFilePath, setPrdFilePath] = useState<string | null>(null);
  const [prdFileContent, setPrdFileContent] = useState('');

  // Agent marker-based sections (from <!-- workshop:prd-section --> markers)
  const [prdTitle, setPrdTitle] = useState('');
  const [prdSections, setPrdSections] = useState<PRDSection[]>([]);
  const [assumptions, setAssumptions] = useState<Assumption[]>([]);
  const [validationReport, setValidationReport] = useState<ValidationReportData | null>(null);
  const [finalizationSteps, setFinalizationSteps] = useState<FinalizationStep[]>([
    { step: 1, title: '决策日志审计', status: 'pending' },
    { step: 2, title: '输入协调', status: 'pending' },
    { step: 3, title: '评审检查点', status: 'pending' },
    { step: 4, title: '待办分流', status: 'pending' },
    { step: 5, title: '文档润色', status: 'pending' },
    { step: 6, title: '外部交付', status: 'pending' },
    { step: 7, title: '收尾', status: 'pending' },
  ]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // Step progress state
  const [stepProgress, setStepProgress] = useState<StepProgressPayload | null>(null);

  // Drag-to-resize state
  const [splitRatio, setSplitRatio] = useState(0.45);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // ─── Agent Stream ───
  const agent = useAgentStream({
    runtimeId: 'claude-code',
    systemPrompt: PRD_SYSTEM_PROMPT,
    greetingMessage: t('workshop.prdGreeting'),
    useSessions: true,
    persistMessages: true,
    storageKey: 'prd-creation-workshop',
  });

  // ─── Sync runtime from settings on mount ───
  useEffect(() => {
    if (!isTauri) return;
    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const s: { agent_runtime?: string } = await invoke('read_settings');
        if (s.agent_runtime) agent.setRuntimeId(s.agent_runtime);
      } catch { /* ignore */ }
    })();
  }, []);

  // ─── Auto-start from Party Mode report ───
  const autoStartRef = useRef(false);
  useEffect(() => {
    if (!autoStartPrompt || autoStartRef.current) return;
    autoStartRef.current = true;

    const autoStart = async () => {
      setIsStarted(true);
      await agent.startSession();
      agent.sendMessage(autoStartPrompt);
      onAutoStartConsumed?.();
    };
    autoStart();
  }, [autoStartPrompt]);

  // ─── File-based PRD: parse markdown content into sections ───
  const fileParsed = useMemo(() => {
    if (!prdFileContent) return { title: '', sections: [] as PRDSection[] };
    return parseMarkdownToPrdSections(prdFileContent);
  }, [prdFileContent]);

  // ─── File-based PRD: scan for PRD markdown files on mount ───
  const prdFilePathRef = useRef<string | null>(null);
  useEffect(() => {
    if (!workspacePath || !isTauri) return;

    (async () => {
      const { invoke } = await import('@tauri-apps/api/core');

      // Priority 1: PRODUCT.md at workspace root
      const candidates = [
        `${workspacePath}/PRODUCT.md`,
      ];

      for (const path of candidates) {
        try {
          const content = await invoke<string>('read_file', { path });
          if (content && content.trim().length > 0) {
            setPrdFilePath(path);
            prdFilePathRef.current = path;
            setPrdFileContent(content);
            return;
          }
        } catch { /* not found */ }
      }

      // Priority 2: scan docs/ for *-prd.md files
      try {
        interface FileNode {
          name: string;
          path: string;
          is_dir: boolean;
          children?: FileNode[];
        }
        const tree = await invoke<FileNode[]>('read_file_tree', { path: `${workspacePath}/docs` });
        const prdFiles = (tree || [])
          .filter((n) => !n.is_dir && n.name.endsWith('.md'))
          .sort((a, b) => a.name.localeCompare(b.name));

        if (prdFiles.length > 0) {
          const latest = prdFiles[prdFiles.length - 1];
          try {
            const content = await invoke<string>('read_file', { path: latest.path });
            setPrdFilePath(latest.path);
            prdFilePathRef.current = latest.path;
            setPrdFileContent(content);
          } catch { /* ignore */ }
        }
      } catch { /* no docs directory */ }
    })();
  }, [workspacePath]);

  // ─── File-based PRD: watch for file changes → auto-refresh ───
  useEffect(() => {
    if (!prdFilePath || !isTauri) return;

    let unlisten: (() => void) | null = null;
    (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      const { invoke } = await import('@tauri-apps/api/core');

      unlisten = await listen<FsChangeEvent>('fs://workspace-changed', async (event) => {
        const watchedPath = prdFilePathRef.current;
        if (!watchedPath) return;

        const changed = event.payload.paths.some((p) => {
          if (p === watchedPath) return true;
          // Handle relative/absolute path mismatches
          return p.endsWith('/' + watchedPath.split('/').pop()!);
        });

        if (changed) {
          try {
            const content = await invoke<string>('read_file', { path: watchedPath });
            setPrdFileContent(content);
          } catch { /* ignore read errors */ }
        }
      });
    })();

    return () => { unlisten?.(); };
  }, [prdFilePath]);

  // ─── File-based PRD: available .md files for dropdown ───
  const [mdFiles, setMdFiles] = useState<{ name: string; path: string; isPrd: boolean }[]>([]);
  const [fileDropdownOpen, setFileDropdownOpen] = useState(false);

  // Scan workspace for .md files on mount
  useEffect(() => {
    if (!workspacePath || !isTauri) return;

    (async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      interface FileNode { name: string; path: string; is_dir: boolean; children?: FileNode[] }

      const prdNamePattern = /^(product|prd)/i;
      const allFiles: { name: string; path: string; isPrd: boolean }[] = [];

      // Scan root .md files
      try {
        const rootTree = await invoke<FileNode[]>('read_file_tree', { path: workspacePath });
        for (const n of (rootTree || [])) {
          if (!n.is_dir && n.name.endsWith('.md')) {
            allFiles.push({ name: n.name, path: n.path, isPrd: prdNamePattern.test(n.name) });
          }
        }
      } catch { /* ignore */ }

      // Scan docs/ .md files
      try {
        const docsTree = await invoke<FileNode[]>('read_file_tree', { path: `${workspacePath}/docs` });
        for (const n of (docsTree || [])) {
          if (!n.is_dir && n.name.endsWith('.md')) {
            allFiles.push({ name: n.name, path: n.path, isPrd: prdNamePattern.test(n.name) || n.name.includes('-prd') });
          }
        }
      } catch { /* no docs dir */ }

      // Sort: PRD/Product files first, then alphabetically
      allFiles.sort((a, b) => {
        if (a.isPrd && !b.isPrd) return -1;
        if (!a.isPrd && b.isPrd) return 1;
        return a.name.localeCompare(b.name);
      });

      setMdFiles(allFiles);
    })();
  }, [workspacePath]);

  // Load a file by path
  const loadPrdFile = useCallback(async (path: string) => {
    if (!isTauri) return;
    const { invoke } = await import('@tauri-apps/api/core');
    try {
      const content = await invoke<string>('read_file', { path });
      setPrdFilePath(path);
      prdFilePathRef.current = path;
      setPrdFileContent(content);
      setFileDropdownOpen(false);
    } catch { /* ignore */ }
  }, []);

  // ─── Refresh file list helper ───
  const refreshMdFiles = useCallback(async () => {
    if (!workspacePath || !isTauri) return;
    const { invoke } = await import('@tauri-apps/api/core');
    interface FileNode { name: string; path: string; is_dir: boolean; children?: FileNode[] }
    const prdNamePattern = /^(product|prd)/i;
    const allFiles: { name: string; path: string; isPrd: boolean }[] = [];
    try {
      const rootTree = await invoke<FileNode[]>('read_file_tree', { path: workspacePath });
      for (const n of (rootTree || [])) {
        if (!n.is_dir && n.name.endsWith('.md')) {
          allFiles.push({ name: n.name, path: n.path, isPrd: prdNamePattern.test(n.name) });
        }
      }
    } catch { /* ignore */ }
    try {
      const docsTree = await invoke<FileNode[]>('read_file_tree', { path: `${workspacePath}/docs` });
      for (const n of (docsTree || [])) {
        if (!n.is_dir && n.name.endsWith('.md')) {
          allFiles.push({ name: n.name, path: n.path, isPrd: prdNamePattern.test(n.name) || n.name.includes('-prd') });
        }
      }
    } catch { /* no docs dir */ }
    allFiles.sort((a, b) => {
      if (a.isPrd && !b.isPrd) return -1;
      if (!a.isPrd && b.isPrd) return 1;
      return a.name.localeCompare(b.name);
    });
    setMdFiles(allFiles);
  }, [workspacePath]);

  // ─── Watch for file_write tool results → auto-refresh & load ───
  const lastFileWriteRef = useRef('');
  useEffect(() => {
    for (let i = agent.messages.length - 1; i >= 0; i--) {
      const msg = agent.messages[i];
      if (msg.isToolCall && msg.toolName === 'file_write' && msg.toolStatus === 'success' && msg.content) {
        if (msg.content !== lastFileWriteRef.current) {
          lastFileWriteRef.current = msg.content;
          // Extract path from content (format: "Writing {path}" or "Writing {path}")
          const pathMatch = msg.content.match(/Writing\s+(.+)/);
          const writtenPath = pathMatch ? pathMatch[1].trim() : '';
          if (writtenPath && isTauri) {
            const fullPath = writtenPath.startsWith('/') ? writtenPath : `${workspacePath}/${writtenPath}`;
            // Load the written file + refresh file list
            (async () => {
              await refreshMdFiles();
              await loadPrdFile(fullPath);
            })();
          } else {
            // Path unknown — just refresh the file list
            refreshMdFiles();
          }
        }
        break;
      }
    }
  }, [agent.messages, workspacePath, refreshMdFiles, loadPrdFile]);

  // ─── Merged sections: file content > agent markers ───
  const displayTitle = fileParsed.title || prdTitle;
  const displaySections = fileParsed.sections.length > 0 ? fileParsed.sections : prdSections;

  // ─── Parse messages for PRD payloads ───
  const parsedMessages = useMemo(() => {
    return agent.messages.map((msg) => {
      if (msg.role === 'assistant' && !msg.isToolCall) {
        const { text, payload, stepProgress: sp } = parsePrdMarker(msg.content);
        return { ...msg, content: text, workshopPayload: payload, stepProgress: sp };
      }
      return msg;
    });
  }, [agent.messages]);

  // ─── Track latest step-progress from all messages ───
  useEffect(() => {
    const latest = extractLatestStepProgress(parsedMessages);
    if (latest) {
      setStepProgress(latest);
    }
  }, [parsedMessages]);

  // ─── Watch for structured payloads from agent ───
  const lastProcessedRef = useRef<string>('');
  useEffect(() => {
    const lastMsg = parsedMessages[parsedMessages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return;
    if (lastMsg.content === lastProcessedRef.current) return;
    lastProcessedRef.current = lastMsg.content;

    const payload = (lastMsg as any).workshopPayload as PrdPayload | null | undefined;
    if (!payload) return;

    switch (payload.type) {
      case 'prd-section': {
        const sec = payload.data as ParsedPrdSection;
        setPrdSections((prev) => {
          const existing = prev.findIndex((s) => s.id === sec.id);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = { ...updated[existing], ...sec };
            return updated;
          }
          return [...prev, { id: sec.id, title: sec.title, status: sec.status, content: sec.content }];
        });
        if (sec.status === 'in-progress') {
          setActiveSectionId(sec.id);
        }
        break;
      }
      case 'prd-complete': {
        const data = payload.data as ParsedPrdComplete;
        setPrdTitle(data.title);
        setPrdPhase('validation');
        break;
      }
      case 'validation-report': {
        const report = payload.data as ParsedValidationReport;
        setValidationReport(report);
        break;
      }
      case 'finalization-step': {
        const step = payload.data as ParsedFinalizationStep;
        setFinalizationSteps((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex((s) => s.step === step.step);
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], ...step };
          }
          return updated;
        });
        break;
      }
      case 'prd-final': {
        const data = payload.data as ParsedPrdFinal;
        if (data.readyForFeature) {
          setPrdPhase('finalization');
        }
        break;
      }
    }
  }, [parsedMessages]);

  // ─── Update PRD document state for parent ───
  useEffect(() => {
    if (prdSections.length > 0) {
      const extractedAssumptions = extractAssumptions(prdSections);
      setAssumptions(extractedAssumptions);

      onDocumentChange({
        title: prdTitle,
        sections: prdSections,
        assumptions: extractedAssumptions,
        stakeLevel: stakeLevel ?? 'hobby',
        mode: mode ?? 'fast-path',
        timestamp: Date.now(),
      });
    }
  }, [prdSections, prdTitle, stakeLevel, mode, onDocumentChange]);

  // ─── Drag-to-resize handler ───
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = Math.min(0.75, Math.max(0.25, (ev.clientX - rect.left) / rect.width));
      setSplitRatio(ratio);
    };

    const handleMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // ─── Assumption handlers ───
  const handleConfirmAssumption = useCallback((id: string) => {
    setAssumptions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, confirmed: true } : a))
    );
  }, []);

  const handleEditAssumption = useCallback((id: string, newText: string) => {
    setAssumptions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, text: newText } : a))
    );
  }, []);

  // ─── Save PRD to workspace ───
  const handleSavePrd = useCallback(async () => {
    if (!prdSections.length || !prdTitle) return;

    const prdContent = [
      `# ${prdTitle}`,
      '',
      `> PRD Document | Stake Level: ${stakeLevel ?? 'hobby'} | Mode: ${mode ?? 'fast-path'}`,
      `> Generated: ${new Date().toISOString()}`,
      '',
      ...prdSections.map((s) => `## ${s.title}\n\n${s.content}`),
    ].join('\n\n');

    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const filename = prdTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'prd';
        await invoke('write_text_file', {
          path: `${workspacePath}/docs/${filename}-prd.md`,
          content: prdContent,
        });
      } catch (e) {
        console.error('[PRD] Error saving PRD file:', e);
      }
    }
  }, [prdTitle, prdSections, stakeLevel, mode, workspacePath]);

  // ─── Discovery selection handlers ───
  const handleIntentSelect = useCallback((id: string) => {
    setIntent(id as PRDIntent);
    agent.sendMessage(id);
  }, [agent]);

  const handleStakeSelect = useCallback((id: string) => {
    setStakeLevel(id as PRDStakeLevel);
    agent.sendMessage(id);
  }, [agent]);

  const handleModeSelect = useCallback((id: string) => {
    setMode(id as PRDMode);
    setPrdPhase('writing');
    agent.sendMessage(id);
  }, [agent]);

  // ─── Send message handler ───
  const handleSendMessage = useCallback((text: string) => {
    agent.sendMessage(text);
  }, [agent]);

  // ─── Create Feature handler ───
  const handleCreateFeature = useCallback(async () => {
    // Build PRD content as markdown
    const prdContent = prdSections
      .map((s) => `## ${s.title}\n\n${s.content}`)
      .join('\n\n');

    // Generate a slug from the PRD title
    const slug = prdTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || `prd-${Date.now()}`;
    const featureId = `feat-${slug}`;

    // Use the createFeature IPC (matches CreateFeatureRequest in Rust)
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('create_feature_from_agent', {
          parentId: 'feat-bmad-workshop',
          plan: {
            id: featureId,
            name: prdTitle,
            priority: 50,
            size: 'M',
            dependencies: [],
            description: prdContent,
            valuePoints: [],
            tasks: [],
          },
        });
      } catch (e) {
        console.error('[PRD] Error creating feature:', e);
      }
    }
  }, [prdTitle, prdSections]);

  // ─── Custom message renderer ───
  const renderWorkshopMessage = useCallback(
    (msg: ChatMessage, _idx: number): React.ReactNode | null => {
      if (msg.role !== 'assistant') return null;

      const payload = msg.workshopPayload as PrdPayload | null | undefined;
      if (!payload) return null;

      // Render cleaned text (marker removed) as a chat bubble before the payload component
      const textBubble = msg.content?.trim() ? (
        <WorkshopChatBubble msg={msg} />
      ) : null;

      let payloadNode: React.ReactNode = null;
      switch (payload.type) {
        case 'intent-selector':
          payloadNode = (
            <IntentSelector
              options={payload.data.options}
              onSelect={handleIntentSelect}
              disabled={agent.isStreaming}
            />
          );
          break;

        case 'stake-calibration':
          payloadNode = (
            <StakeCalibration
              options={payload.data.options}
              onSelect={handleStakeSelect}
              disabled={agent.isStreaming}
            />
          );
          break;

        case 'work-mode-selector':
          payloadNode = (
            <WorkModeSelector
              options={payload.data.options}
              onSelect={handleModeSelect}
              disabled={agent.isStreaming}
            />
          );
          break;

        case 'validation-report':
          payloadNode = <ValidationReport report={payload.data} />;
          break;

        case 'prd-final':
          payloadNode = (
            <FinalizationChecklist
              steps={finalizationSteps}
              allComplete={finalizationSteps.every((s) => s.status === 'complete')}
              onCreateFeature={handleCreateFeature}
            />
          );
          break;

        default:
          break;
      }

      if (!payloadNode) return textBubble;
      if (!textBubble) return payloadNode;
      return <>{textBubble}{payloadNode}</>;
    },
    [handleIntentSelect, handleStakeSelect, handleModeSelect, agent.isStreaming, finalizationSteps, handleCreateFeature],
  );

  // ─── Build right panel for chat (validation report in chat context) ───
  const chatRightPanel = useMemo(() => {
    if (prdPhase === 'discovery' || !prdSections.length) return undefined;
    return undefined; // PRD preview is in the split view, not in chat right panel
  }, [prdPhase, prdSections]);

  // ─── Welcome screen ───
  if (!isStarted || agent.connectionState === 'disconnected') {
    return (
      <div className={cn("flex flex-col h-full w-full bg-surface", className)}>
        <div className="flex items-center justify-between px-4 py-2 bg-surface-container-low border-b border-outline-variant/10 shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            <span className="text-xs font-headline font-bold text-on-surface">创建 PRD</span>
          </div>
          <div className="flex items-center gap-2">
            {sessionState.brainstormOutput && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-secondary/20 text-secondary">
                Brainstorm
              </span>
            )}
            {sessionState.partyInsights && sessionState.partyInsights.length > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-tertiary/20 text-tertiary">
                {sessionState.partyInsights.length} 条洞察
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="p-4 rounded-2xl bg-surface-container-high">
              <FileText size={32} className="text-primary" />
            </div>
            <h2 className="text-sm font-headline font-bold text-on-surface">创建 PRD</h2>
            <p className="text-[10px] text-on-surface-variant max-w-xs text-center leading-relaxed">
              AI 引导的 PRD 创建，支持辅导模式。导入头脑风暴创意和多角色洞察，构建完整的产品需求文档。
            </p>
          </div>

          {/* Context badges */}
          <div className="flex items-center gap-2 mb-4">
            {sessionState.brainstormOutput && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-secondary/20 text-secondary">
                {sessionState.brainstormOutput.ideas.length} 条头脑风暴创意
              </span>
            )}
            {sessionState.partyInsights && sessionState.partyInsights.length > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-tertiary/20 text-tertiary">
                {sessionState.partyInsights.length} 条圆桌洞察
              </span>
            )}
          </div>

          {!(sessionState.brainstormOutput || sessionState.partyInsights?.length) && (
            <p className="text-[9px] text-on-surface-variant/60 italic mb-4">
              请先完成头脑风暴或多角色圆桌，将输出导入此处
            </p>
          )}

          <button
            onClick={async () => {
              setIsStarted(true);
              await agent.startSession();
            }}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors"
          >
            开始创建 PRD
          </button>
        </div>
      </div>
    );
  }

  // ─── Main split layout: Chat left, PRD Preview right ───
  return (
    <div className={cn("flex flex-col h-full w-full bg-surface", className)}>
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-container-low border-b border-outline-variant/10 shrink-0">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-primary" />
          <span className="text-xs font-headline font-bold text-on-surface">创建 PRD</span>
          {prdPhase !== 'discovery' && (
            <span className={cn(
              'px-1.5 py-0.5 text-[9px] font-bold rounded',
              prdPhase === 'writing' ? 'bg-primary/10 text-primary' :
              prdPhase === 'validation' ? 'bg-warning/10 text-warning' :
              'bg-tertiary/10 text-tertiary',
            )}>
              {prdPhase}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {intent && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-surface-container-high text-on-surface-variant">
              {intent}
            </span>
          )}
          {stakeLevel && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-surface-container-high text-on-surface-variant">
              {stakeLevel}
            </span>
          )}
          {mode && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-primary/10 text-primary">
              {mode === 'fast-path' ? 'Fast' : 'Coaching'}
            </span>
          )}
          {prdSections.length > 0 && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-primary/20 text-primary">
              {prdSections.filter((s) => s.status === 'complete').length}/{prdSections.length}
            </span>
          )}
          {prdFilePath && (
            <span className="px-1.5 py-0.5 text-[9px] rounded bg-surface-container-high text-on-surface-variant truncate max-w-[180px]" title={prdFilePath}>
              {prdFilePath.split('/').pop()}
            </span>
          )}
          <div className="relative">
            <button
              onClick={() => setFileDropdownOpen((v) => !v)}
              className={cn(
                "flex items-center gap-1 px-1.5 py-1 rounded-md transition-colors text-[9px]",
                fileDropdownOpen
                  ? "bg-surface-container-high text-on-surface"
                  : "hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface",
              )}
              title="选择 PRD 文件"
            >
              <FolderOpen size={12} />
              {mdFiles.length > 0 && <span className="max-w-[100px] truncate">{prdFilePath?.split('/').pop() || '选择文件'}</span>}
            </button>
            {fileDropdownOpen && mdFiles.length > 0 && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFileDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-64 max-h-64 overflow-y-auto rounded-lg border border-outline-variant/20 bg-surface-container-low shadow-lg">
                  {mdFiles.map((f) => (
                    <button
                      key={f.path}
                      onClick={() => loadPrdFile(f.path)}
                      className={cn(
                        "flex items-center gap-2 w-full px-3 py-1.5 text-[10px] text-left transition-colors",
                        f.path === prdFilePath
                          ? "bg-primary/10 text-primary font-bold"
                          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                      )}
                    >
                      <FileText size={10} className={cn("shrink-0", f.isPrd ? "text-primary" : "text-on-surface-variant/50")} />
                      <span className="truncate flex-1">{f.name}</span>
                      {f.isPrd && (
                        <span className="text-[8px] px-1 rounded bg-primary/10 text-primary shrink-0">PRD</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => {
              agent.newSession();
              setIsStarted(false);
              setPrdPhase('discovery');
              setIntent(null);
              setStakeLevel(null);
              setMode(null);
              setPrdTitle('');
              setPrdSections([]);
              setAssumptions([]);
              setValidationReport(null);
              setStepProgress(null);
            }}
            className="p-1.5 rounded-md hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-on-surface"
            title="新建会话"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Split Layout */}
      <div ref={containerRef} className="flex-1 overflow-hidden flex">
        {/* Left: Chat Panel */}
        <div
          className="flex shrink-0 overflow-hidden"
          style={displaySections.length > 0 ? { width: `${splitRatio * 100}%` } : { width: '100%' }}
        >
          <WorkshopChatPanel
            messages={parsedMessages}
            isStreaming={agent.isStreaming}
            onSendMessage={handleSendMessage}
            placeholder={
              prdPhase === 'discovery'
                ? 'Describe your product idea...'
                : prdPhase === 'writing'
                  ? 'Share your thoughts or answer the agent\'s questions...'
                  : prdPhase === 'validation'
                    ? 'Review the validation report and suggest improvements...'
                    : 'Finalize your PRD...'
            }
            renderWorkshopMessage={renderWorkshopMessage}
            agentStatus={agent.agentStatus}
            stepProgress={stepProgress}
          />
        </div>

        {/* Drag divider */}
        {displaySections.length > 0 && (
        <div
          onMouseDown={handleMouseDown}
          className="w-1.5 cursor-col-resize bg-outline-variant/10 hover:bg-primary/30 transition-colors shrink-0"
        />
        )}

        {/* Right: PRD Preview */}
        {displaySections.length > 0 && (
        <div className="flex-1 overflow-hidden">
          <PRDDocumentPreview
            title={displayTitle}
            sections={displaySections}
            assumptions={assumptions}
            onConfirmAssumption={handleConfirmAssumption}
            onEditAssumption={handleEditAssumption}
            activeSectionId={activeSectionId ?? undefined}
            onSectionClick={setActiveSectionId}
          />
        </div>
        )}
      </div>
    </div>
  );
};
