import React from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Layout, 
  FlaskConical, 
  FileText, 
  Shield, 
  Terminal, 
  GripVertical,
  ChevronDown,
  Wand2,
  Bolt,
  CheckCircle2,
  ClipboardList
} from 'lucide-react';
import { cn } from '../../lib/utils';

// Custom icons for those not in lucide or needing specific look
const ArchitectureIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <path d="M9 3v18" /><path d="M15 3v18" /><path d="M3 9h18" /><path d="M3 15h18" />
  </svg>
);

export const WorkflowEditor: React.FC = () => {
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Sidebar: Skill Library */}
      <aside className="w-64 bg-surface-container-low flex flex-col border-r border-outline-variant/10">
        <div className="p-4 border-b border-outline-variant/10">
          <h2 className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">Skill Library</h2>
          <p className="text-[10px] text-outline mt-1">.claude/skills/*</p>
        </div>
        <div className="p-2 flex flex-col gap-1 overflow-y-auto scroll-hide">
          {[
            { icon: Layout, label: 'Refactor', color: 'text-primary' },
            { icon: FlaskConical, label: 'Add Tests', color: 'text-tertiary' },
            { icon: FileText, label: 'Doc Gen', color: 'text-secondary' },
            { icon: Shield, label: 'Security Audit', color: 'text-primary' },
            { icon: Terminal, label: 'Shell Script', color: 'text-on-surface-variant' },
          ].map((skill) => (
            <div key={skill.label} className="flex items-center gap-3 p-2 hover:bg-surface-container-high rounded cursor-grab group">
              <skill.icon size={14} className={skill.color} />
              <span className="text-xs font-medium text-on-surface-variant">{skill.label}</span>
              <GripVertical size={10} className="ml-auto opacity-0 group-hover:opacity-100 text-outline" />
            </div>
          ))}
        </div>
        <div className="mt-auto p-4 border-t border-outline-variant/10">
          <button className="w-full py-2 border border-dashed border-outline-variant text-[10px] font-bold uppercase tracking-tighter text-outline hover:text-primary hover:border-primary transition-colors">
            + Import Skill
          </button>
        </div>
      </aside>

      {/* Central Node Canvas */}
      <section className="flex-1 relative overflow-hidden node-grid cursor-crosshair">
        {/* Workflow View Controls */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <div className="bg-surface-container-highest/80 backdrop-blur-md p-1 rounded-sm flex gap-1 border border-outline-variant/20 shadow-xl">
            <button className="p-1 hover:bg-primary-container/20 text-on-surface-variant rounded-sm"><ZoomIn size={14} /></button>
            <button className="p-1 hover:bg-primary-container/20 text-on-surface-variant rounded-sm"><ZoomOut size={14} /></button>
            <div className="w-[1px] bg-outline-variant/30 my-1"></div>
            <button className="p-1 hover:bg-primary-container/20 text-on-surface-variant rounded-sm"><Maximize size={14} /></button>
          </div>
          <div className="bg-surface-container-highest/80 backdrop-blur-md px-3 py-1 rounded-sm border border-outline-variant/20 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-tertiary"></div>
            <span className="font-headline text-[10px] font-bold uppercase tracking-wider">Live Preview: Active</span>
          </div>
        </div>

        {/* Nodes & Connection Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <path className="filter drop-shadow-[0_0_4px_#00e3fd]" d="M 180 150 C 250 150, 250 250, 320 250" fill="none" stroke="#00e3fd" strokeWidth="2"></path>
          <path d="M 520 250 C 600 250, 600 120, 680 120" fill="none" opacity="0.4" stroke="#58a6ff" strokeWidth="2"></path>
          <path d="M 520 250 C 600 250, 600 380, 680 380" fill="none" opacity="0.4" stroke="#58a6ff" strokeWidth="2"></path>
        </svg>

        {/* Node 1: Entry Trigger */}
        <div className="absolute top-[100px] left-[40px] w-36 bg-surface-container-high border-l-4 border-secondary shadow-2xl rounded-sm p-3 z-10">
          <div className="flex items-center gap-2 mb-2">
            <Bolt size={14} className="text-secondary" />
            <span className="text-[10px] font-black font-headline uppercase tracking-tighter">On Commit</span>
          </div>
          <div className="text-[9px] text-outline mb-3 font-mono">trigger.git_hook</div>
          <div className="flex justify-end">
            <div className="w-2 h-2 bg-secondary rounded-full -mr-4 border-2 border-surface-container-high"></div>
          </div>
        </div>

        {/* Node 2: Skill Execution (Selected) */}
        <div className="absolute top-[200px] left-[320px] w-48 bg-surface-container-high border-l-4 border-primary ring-2 ring-primary/40 shadow-2xl rounded-sm z-10">
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Layout className="text-primary w-[14px] h-[14px]" />
              <span className="text-[10px] font-black font-headline uppercase tracking-tighter">Refactor Module</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[8px] text-outline font-mono">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-secondary rounded-full -ml-4 border border-surface-container-high"></div>
                  <span>Source</span>
                </div>
                <span>output_src</span>
                <div className="w-1.5 h-1.5 bg-primary rounded-full -mr-4 border border-surface-container-high"></div>
              </div>
            </div>
          </div>
          <div className="bg-primary/10 px-3 py-1 flex items-center gap-2">
            <Wand2 size={10} className="text-primary" />
            <span className="text-[9px] text-primary font-bold">AI Skill Active</span>
          </div>
        </div>

        {/* Node 3: Condition/Task */}
        <div className="absolute top-[80px] left-[680px] w-40 bg-surface-container-high border-l-4 border-outline shadow-2xl rounded-sm p-3 z-10">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList size={14} className="text-outline" />
            <span className="text-[10px] font-black font-headline uppercase tracking-tighter">Review Result</span>
          </div>
          <div className="flex items-center gap-1 mb-3">
            <div className="w-1.5 h-1.5 bg-primary rounded-full -ml-4 border border-surface-container-high"></div>
            <span className="text-[8px] font-mono text-outline">input</span>
          </div>
        </div>

        {/* Node 4: Output */}
        <div className="absolute top-[340px] left-[680px] w-40 bg-surface-container-high border-l-4 border-tertiary shadow-2xl rounded-sm p-3 z-10">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} className="text-tertiary" />
            <span className="text-[10px] font-black font-headline uppercase tracking-tighter">PR Update</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-primary rounded-full -ml-4 border border-surface-container-high"></div>
            <span className="text-[8px] font-mono text-outline">diff_payload</span>
          </div>
        </div>
      </section>

      {/* Right Sidebar: Properties */}
      <aside className="w-72 bg-surface-container-low border-l border-outline-variant/10 flex flex-col">
        <div className="p-4 border-b border-outline-variant/10">
          <h2 className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">Properties</h2>
          <p className="text-[10px] text-primary mt-1 font-mono">RefactorModule_1</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 scroll-hide">
          <div className="space-y-3">
            <label className="block">
              <span className="text-[10px] font-bold text-outline uppercase tracking-tighter">Skill Binding</span>
              <div className="mt-1 bg-surface-container-lowest border border-outline-variant/30 p-2 flex items-center justify-between rounded-sm">
                <span className="text-xs text-on-surface">refactor.claude</span>
                <ChevronDown size={12} className="text-outline" />
              </div>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold text-outline uppercase tracking-tighter">Model Profile</span>
              <select className="mt-1 w-full bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface p-2 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none">
                <option>Claude 3.5 Sonnet</option>
                <option>Claude 3 Opus (High Precision)</option>
                <option>Neuro-Custom-LMM</option>
              </select>
            </label>
          </div>
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-outline uppercase tracking-tighter border-b border-outline-variant/10 pb-1">Input Schema</h3>
            <div className="space-y-2">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-on-surface-variant font-mono">target_path</span>
                <input className="bg-surface-container-lowest border border-outline-variant/30 text-[10px] p-2 font-mono text-secondary-container rounded-sm" type="text" defaultValue="./src/lib/**" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-on-surface-variant font-mono">complexity_threshold</span>
                <input className="accent-primary h-1 bg-surface-container-lowest" type="range" />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-outline uppercase tracking-tighter">Auto-Validate</span>
              <div className="w-8 h-4 bg-primary/20 rounded-full relative cursor-pointer">
                <div className="absolute right-0 top-0 w-4 h-4 bg-primary rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 bg-surface-container-lowest">
          <button className="w-full bg-primary text-on-primary font-headline text-[10px] font-bold py-2 rounded-sm uppercase tracking-widest hover:brightness-110">
            Execute Node
          </button>
        </div>
      </aside>
    </div>
  );
};
