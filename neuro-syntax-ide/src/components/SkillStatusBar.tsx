import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Package, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { ReadinessReport, SkillReadinessLevel } from '../types';

interface SkillStatusBarProps {
  workspacePath?: string;
  onStatusChange?: (level: SkillReadinessLevel, report: ReadinessReport) => void;
}

function readinessLevel(report: ReadinessReport): SkillReadinessLevel {
  if (report.ready) return 'ready';
  if (report.installed.length > 0) return 'partial';
  return 'none';
}

const levelConfig: Record<SkillReadinessLevel, { color: string; dot: string; label: string }> = {
  ready: { color: 'text-green-400', dot: 'bg-green-400', label: 'Skills Ready' },
  partial: { color: 'text-yellow-400', dot: 'bg-yellow-400', label: 'Skills Partial' },
  none: { color: 'text-red-400', dot: 'bg-red-400', label: 'No Skills' },
};

export const SkillStatusBar: React.FC<SkillStatusBarProps> = ({ workspacePath, onStatusChange }) => {
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [level, setLevel] = useState<SkillReadinessLevel>('none');

  const check = useCallback(async () => {
    if (!workspacePath) return;
    try {
      const r = await invoke<ReadinessReport>('check_skill_readiness', { projectPath: workspacePath });
      const l = readinessLevel(r);
      setReport(r);
      setLevel(l);
      onStatusChange?.(l, r);
    } catch {
      // silently ignore — skill check is non-critical
    }
  }, [workspacePath, onStatusChange]);

  useEffect(() => {
    check();
  }, [check]);

  const cfg = levelConfig[level];
  const missingCount = report?.missing.length ?? 0;

  return (
    <button
      onClick={check}
      className="flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
      title={report
        ? report.ready
          ? 'All skills installed'
          : `Missing ${missingCount} skill(s): ${report.missing.slice(0, 3).join(', ')}...`
        : 'Checking skills...'}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      <Package size={10} className={cfg.color} />
      <span className={cfg.color}>{cfg.label}</span>
      {!report?.ready && missingCount > 0 && (
        <span className="text-[8px] text-on-surface-variant">({missingCount} missing)</span>
      )}
    </button>
  );
};
