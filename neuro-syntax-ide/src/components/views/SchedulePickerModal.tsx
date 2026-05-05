import React, { useState, useMemo } from 'react';
import { Clock, Calendar, PlayCircle, Zap, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import type { ScheduleAction, FeatureNode } from '../../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SchedulePickerModalProps {
  /** The feature to schedule (null if scheduling all-pending). */
  feature: FeatureNode | null;
  /** Whether this is for all-pending mode. */
  isAllPending?: boolean;
  /** Called when user confirms the schedule. */
  onConfirm: (params: {
    featureId: string | 'all-pending';
    triggerAt: string;
    action: ScheduleAction;
  }) => void;
  /** Called when user cancels. */
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SchedulePickerModal: React.FC<SchedulePickerModalProps> = ({
  feature,
  isAllPending = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();

  // Default trigger: 1 hour from now
  const defaultDate = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  }, []);

  const [dateValue, setDateValue] = useState(formatDateInput(defaultDate));
  const [timeValue, setTimeValue] = useState(formatTimeInput(defaultDate));
  const [action, setAction] = useState<ScheduleAction>('run-feature');

  // Validate: trigger must be in the future
  const triggerAt = useMemo(() => {
    try {
      return new Date(`${dateValue}T${timeValue}`).toISOString();
    } catch {
      return '';
    }
  }, [dateValue, timeValue]);

  const isValid = useMemo(() => {
    if (!triggerAt) return false;
    const triggerTime = new Date(triggerAt).getTime();
    return triggerTime > Date.now();
  }, [triggerAt]);

  const handleConfirm = () => {
    if (!isValid || !triggerAt) return;
    onConfirm({
      featureId: isAllPending ? 'all-pending' : feature!.id,
      triggerAt,
      action,
    });
  };

  const formatDisplayTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative bg-surface-container-low border border-outline-variant/20",
          "rounded-xl shadow-2xl max-w-sm w-full p-6",
          "backdrop-blur-xl"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
            <Clock size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-on-surface">
              {t('scheduler.title', 'Schedule Trigger')}
            </h3>
            <p className="text-[10px] text-on-surface-variant">
              {isAllPending
                ? t('scheduler.subtitleAll', 'Set a one-shot timer for all pending features')
                : t('scheduler.subtitle', 'Set a one-shot timer for {{name}}', { name: feature?.name || '' })}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-surface-container-high rounded-lg transition-colors"
          >
            <X size={16} className="text-outline" />
          </button>
        </div>

        {/* Feature info */}
        {feature && !isAllPending && (
          <div className="mb-4 p-2.5 rounded-lg bg-surface-container-high/50 border border-outline-variant/5">
            <span className="text-[9px] font-bold text-outline uppercase tracking-tighter">{feature.id}</span>
            <p className="text-[11px] font-medium text-on-surface truncate">{feature.name}</p>
          </div>
        )}

        {isAllPending && (
          <div className="mb-4 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-primary" />
              <span className="text-[11px] font-bold text-primary">
                {t('scheduler.allPending', 'All Pending Features')}
              </span>
            </div>
          </div>
        )}

        {/* Date & Time */}
        <div className="mb-4 space-y-3">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-outline">
            {t('scheduler.triggerTime', 'Trigger Time')}
          </h4>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[8px] text-on-surface-variant uppercase tracking-wider block mb-1">
                {t('scheduler.date', 'Date')}
              </label>
              <input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className={cn(
                  "w-full px-3 py-2 rounded-lg text-[11px] bg-surface-container-high text-on-surface",
                  "border border-outline-variant/20 focus:border-primary/50 focus:ring-1 focus:ring-primary/30",
                  "outline-none transition-all"
                )}
              />
            </div>
            <div className="flex-1">
              <label className="text-[8px] text-on-surface-variant uppercase tracking-wider block mb-1">
                {t('scheduler.time', 'Time')}
              </label>
              <input
                type="time"
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                className={cn(
                  "w-full px-3 py-2 rounded-lg text-[11px] bg-surface-container-high text-on-surface",
                  "border border-outline-variant/20 focus:border-primary/50 focus:ring-1 focus:ring-primary/30",
                  "outline-none transition-all"
                )}
              />
            </div>
          </div>
        </div>

        {/* Past time warning */}
        {triggerAt && !isValid && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#ffb4ab]/10 border border-[#ffb4ab]/20">
            <AlertCircle size={12} className="text-[#ffb4ab]" />
            <span className="text-[10px] text-[#ffb4ab] font-medium">
              {t('scheduler.pastTimeWarning', 'Please select a future time')}
            </span>
          </div>
        )}

        {/* Action selection */}
        <div className="mb-5 space-y-2">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-outline">
            {t('scheduler.action', 'Action')}
          </h4>
          <div className="flex gap-2">
            <button
              onClick={() => setAction('run-feature')}
              className={cn(
                "flex-1 p-2.5 rounded-lg border-2 text-center transition-all",
                action === 'run-feature'
                  ? 'border-primary bg-primary/5'
                  : 'border-outline-variant/10 hover:border-primary/30'
              )}
            >
              <PlayCircle size={14} className={cn("mx-auto mb-1", action === 'run-feature' ? 'text-primary' : 'text-outline')} />
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-wider block",
                action === 'run-feature' ? 'text-primary' : 'text-on-surface-variant'
              )}>
                {t('scheduler.runFeature', 'Run Feature')}
              </span>
            </button>
            <button
              onClick={() => setAction('dev-agent')}
              className={cn(
                "flex-1 p-2.5 rounded-lg border-2 text-center transition-all",
                action === 'dev-agent'
                  ? 'border-secondary bg-secondary/5'
                  : 'border-outline-variant/10 hover:border-secondary/30'
              )}
            >
              <Zap size={14} className={cn("mx-auto mb-1", action === 'dev-agent' ? 'text-secondary' : 'text-outline')} />
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-wider block",
                action === 'dev-agent' ? 'text-secondary' : 'text-on-surface-variant'
              )}>
                {t('scheduler.devAgent', 'Dev Agent')}
              </span>
            </button>
          </div>
        </div>

        {/* Trigger preview */}
        {triggerAt && isValid && (
          <div className="mb-4 p-2.5 rounded-lg bg-secondary/5 border border-secondary/10">
            <div className="flex items-center gap-2">
              <Calendar size={12} className="text-secondary" />
              <span className="text-[10px] text-on-surface-variant">
                {t('scheduler.willTrigger', 'Will trigger at')}{' '}
                <span className="font-bold text-on-surface">{formatDisplayTime(triggerAt)}</span>
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-[11px] font-bold bg-surface-container-highest text-on-surface hover:bg-surface-variant transition-all border border-outline-variant/20"
          >
            {t('scheduler.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid || !triggerAt}
            className={cn(
              "flex items-center gap-1.5 px-5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all",
              isValid && triggerAt
                ? "bg-secondary text-on-primary hover:bg-secondary/90"
                : "bg-surface-container-highest text-outline cursor-not-allowed"
            )}
          >
            <Clock size={12} />
            {t('scheduler.confirm', 'Schedule')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
