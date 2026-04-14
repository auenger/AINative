import React, { useState, useCallback } from 'react';
import {
  Settings as SettingsIcon,
  Cpu,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  Zap,
  RefreshCw,
  User,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { useSettings } from '../../lib/useSettings';
import { ProfilePanel } from '../common/ProfilePanel';
import type { AppSettings, ProviderConfig } from '../../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type SettingsTab = 'general' | 'llm' | 'profile';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) return undefined as unknown as T;
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Toggle switch component. */
function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/40',
        checked ? 'bg-primary' : 'bg-surface-container-highest',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// General Settings Panel
// ---------------------------------------------------------------------------

function GeneralPanel({
  settings,
  onUpdate,
}: {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}) {
  const { t } = useTranslation();
  const interval = settings.app.auto_refresh_interval;
  const enabled = interval > 0;
  const displayInterval = enabled ? interval : 30;

  return (
    <div className="space-y-6">
      <div className="config-card">
        <h3 className="text-sm font-headline font-bold text-on-surface mb-1 flex items-center gap-2">
          <RefreshCw size={14} className="text-primary" />
          {t('settings.autoRefresh')}
        </h3>
        <p className="text-xs text-on-surface-variant opacity-60 mb-4">
          {t('settings.autoRefreshDesc')}
        </p>

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-on-surface-variant">{t('settings.enableAutoRefresh')}</span>
          <Toggle
            checked={enabled}
            onChange={(v) => {
              onUpdate({
                app: {
                  ...settings.app,
                  auto_refresh_interval: v ? 30 : 0,
                },
              });
            }}
          />
        </div>

        {enabled && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant">{t('settings.refreshInterval')}</span>
              <span className="text-xs font-mono text-primary font-bold">{displayInterval}s</span>
            </div>
            <input
              type="range"
              min={5}
              max={300}
              step={5}
              value={displayInterval}
              onChange={(e) => {
                onUpdate({
                  app: {
                    ...settings.app,
                    auto_refresh_interval: Number(e.target.value),
                  },
                });
              }}
              className="w-full h-1.5 rounded-full appearance-none bg-surface-container-highest cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] text-on-surface-variant opacity-50 font-mono">
              <span>5s</span>
              <span>150s</span>
              <span>300s</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LLM Provider Panel
// ---------------------------------------------------------------------------

function LlmPanel({
  settings,
  onUpdate,
}: {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}) {
  const { t } = useTranslation();
  const providerNames = Object.keys(settings.providers);
  const activeProvider = settings.llm.provider;

  // Connection test state per provider
  const [testState, setTestState] = useState<Record<string, { loading: boolean; models?: string[]; error?: string }>>({});
  // API key visibility toggle per provider
  const [keyVisible, setKeyVisible] = useState<Record<string, boolean>>({});

  const addProvider = useCallback(() => {
    const name = `provider-${Date.now()}`;
    const newProviders = {
      ...settings.providers,
      [name]: { api_key: '', api_base: '' },
    };
    onUpdate({ providers: newProviders });
  }, [settings.providers, onUpdate]);

  const removeProvider = useCallback((name: string) => {
    const newProviders = { ...settings.providers };
    delete newProviders[name];
    const newLlm = { ...settings.llm };
    if (newLlm.provider === name) {
      newLlm.provider = '';
      newLlm.model = '';
    }
    onUpdate({ providers: newProviders, llm: newLlm });
  }, [settings.providers, settings.llm, onUpdate]);

  const updateProvider = useCallback((name: string, field: keyof ProviderConfig, value: string) => {
    const newProviders = {
      ...settings.providers,
      [name]: { ...settings.providers[name], [field]: value },
    };
    onUpdate({ providers: newProviders });
  }, [settings.providers, onUpdate]);

  const renameProvider = useCallback((oldName: string, newName: string) => {
    if (oldName === newName || newName.trim() === '') return;
    const newProviders: Record<string, ProviderConfig> = {};
    for (const [k, v] of Object.entries(settings.providers)) {
      newProviders[k === oldName ? newName.trim() : k] = v;
    }
    const newLlm = { ...settings.llm };
    if (newLlm.provider === oldName) {
      newLlm.provider = newName.trim();
    }
    onUpdate({ providers: newProviders, llm: newLlm });
  }, [settings.providers, settings.llm, onUpdate]);

  const setActiveProvider = useCallback((name: string) => {
    onUpdate({ llm: { ...settings.llm, provider: name } });
  }, [settings.llm, onUpdate]);

  const testConnection = useCallback(async (name: string) => {
    const config = settings.providers[name];
    if (!config) return;
    setTestState(prev => ({ ...prev, [name]: { loading: true } }));

    try {
      const models = await invoke<string[]>('test_llm_connection', { provider: config });
      setTestState(prev => ({ ...prev, [name]: { loading: false, models } }));
    } catch (e: unknown) {
      setTestState(prev => ({
        ...prev,
        [name]: { loading: false, error: e instanceof Error ? e.message : String(e) },
      }));
    }
  }, [settings.providers]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="config-section-title flex items-center gap-2 !text-sm !tracking-normal !opacity-100 !text-on-surface !mb-0">
          <Zap size={14} className="text-primary" />
          {t('settings.llmProviders')}
        </h3>
        <button
          type="button"
          onClick={addProvider}
          className="config-action-btn text-primary hover:bg-primary/10 border border-primary/30"
        >
          <Plus size={14} /> {t('settings.addProvider')}
        </button>
      </div>

      {providerNames.length === 0 && (
        <div className="text-center py-8 text-on-surface-variant text-xs opacity-50">
          {t('settings.noProviders')}
        </div>
      )}

      {providerNames.map((name) => {
        const config = settings.providers[name];
        const isActive = name === activeProvider;
        const test = testState[name];
        const showKey = keyVisible[name] ?? false;

        return (
          <div
            key={name}
            className={cn(
              'config-card transition-all',
              isActive
                ? 'border-primary/40 bg-primary/5'
                : '',
            )}
          >
            {/* Header row */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveProvider(name)}
                className={cn(
                  'shrink-0 w-4 h-4 rounded-full border-2 transition-colors',
                  isActive ? 'border-primary bg-primary' : 'border-outline-variant/40',
                )}
                title={isActive ? t('settings.activeProvider') : t('settings.setActive')}
              />
              <input
                type="text"
                value={name}
                onChange={(e) => renameProvider(name, e.target.value)}
                className={cn(
                  'text-sm font-bold bg-transparent border-b border-transparent focus:border-primary outline-none flex-1 min-w-0',
                  isActive ? 'text-primary' : 'text-on-surface',
                )}
                placeholder={t('settings.providerName')}
              />
              <button
                type="button"
                onClick={() => removeProvider(name)}
                className="text-on-surface-variant opacity-40 hover:text-error hover:opacity-100 transition-all"
                title={t('settings.removeProvider')}
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* API Base */}
            <div className="mt-3">
              <label className="config-label">
                API Base URL
              </label>
              <input
                type="url"
                value={config.api_base}
                onChange={(e) => updateProvider(name, 'api_base', e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="config-input-mono"
              />
            </div>

            {/* API Key */}
            <div className="mt-3">
              <label className="config-label">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={config.api_key}
                  onChange={(e) => updateProvider(name, 'api_key', e.target.value)}
                  placeholder="sk-..."
                  className="config-input-mono pr-8"
                />
                <button
                  type="button"
                  onClick={() => setKeyVisible(prev => ({ ...prev, [name]: !prev[name] }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-50 hover:opacity-100 transition-opacity"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Test Connection */}
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => testConnection(name)}
                disabled={test?.loading || !config.api_base || !config.api_key}
                className={cn(
                  'config-action-btn',
                  test?.loading
                    ? 'text-on-surface-variant opacity-50 cursor-not-allowed'
                    : 'text-primary hover:bg-primary/10',
                )}
              >
                {test?.loading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : test?.models ? (
                  <CheckCircle2 size={12} className="text-green-500" />
                ) : test?.error ? (
                  <XCircle size={12} className="text-error" />
                ) : (
                  <Cpu size={12} />
                )}
                {t('settings.testConnection')}
              </button>

              {test?.models && (
                <span className="text-[10px] text-green-500 font-mono">
                  {test.models.length} {t('settings.modelsAvailable')}
                </span>
              )}
              {test?.error && (
                <span className="text-[10px] text-error font-mono truncate max-w-[200px]" title={test.error}>
                  {test.error}
                </span>
              )}
            </div>

            {/* Model select (only for active provider) */}
            {isActive && (
              <div className="mt-4 pt-3 border-t border-outline-variant/10">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="config-label">
                      {t('settings.model')}
                    </label>
                    <input
                      type="text"
                      value={settings.llm.model}
                      onChange={(e) => onUpdate({ llm: { ...settings.llm, model: e.target.value } })}
                      placeholder="gpt-4o / glm-4"
                      className="config-input-mono"
                    />
                  </div>
                  <div>
                    <label className="config-label">
                      {t('settings.temperature')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={settings.llm.temperature}
                      onChange={(e) => onUpdate({ llm: { ...settings.llm, temperature: Number(e.target.value) } })}
                      className="config-input-mono"
                    />
                  </div>
                  <div>
                    <label className="config-label">
                      {t('settings.maxTokens')}
                    </label>
                    <input
                      type="number"
                      min={100}
                      max={128000}
                      step={100}
                      value={settings.llm.max_tokens}
                      onChange={(e) => onUpdate({ llm: { ...settings.llm, max_tokens: Number(e.target.value) } })}
                      className="config-input-mono"
                    />
                  </div>
                  <div>
                    <label className="config-label">
                      {t('settings.contextWindow')}
                    </label>
                    <input
                      type="number"
                      min={1000}
                      max={2000000}
                      step={1000}
                      value={settings.llm.context_window_tokens}
                      onChange={(e) => onUpdate({ llm: { ...settings.llm, context_window_tokens: Number(e.target.value) } })}
                      className="config-input-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main SettingsView
// ---------------------------------------------------------------------------

export const SettingsView: React.FC = () => {
  const { t } = useTranslation();
  const { settings, loading, error, dirty, save, update } = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = useCallback(async () => {
    await save();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  }, [save]);

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: t('settings.general'), icon: <SettingsIcon size={14} /> },
    { id: 'llm', label: t('settings.llmProviders'), icon: <Zap size={14} /> },
    { id: 'profile', label: t('settings.profile.title'), icon: <User size={14} /> },
  ];

  return (
    <div className="flex-1 p-6 overflow-y-auto scroll-hide bg-surface">
      {/* Header */}
      <div className="max-w-3xl mx-auto">
        <div className="config-page-header flex items-end justify-between">
          <div>
            <h1 className="config-page-title text-3xl flex items-center gap-3">
              <SettingsIcon size={28} className="text-primary" />
              {t('settings.title')}
            </h1>
            <p className="config-page-subtitle">
              {t('settings.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || !dirty}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all',
              dirty && !loading
                ? 'bg-primary text-on-primary hover:bg-primary/90'
                : 'bg-surface-container-highest text-on-surface-variant opacity-50 cursor-not-allowed',
            )}
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 size={14} className="text-green-400" />
            ) : (
              <Save size={14} />
            )}
            {saveSuccess ? t('settings.saved') : t('settings.save')}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="max-w-3xl mx-auto mb-4">
          <div className="px-4 py-2 bg-error/10 border border-error/20 rounded-md text-xs text-error">
            {error}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-1 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                activeTab === tab.id ? 'config-tab-active' : 'config-tab-inactive',
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-3xl mx-auto">
        {activeTab === 'general' && (
          <GeneralPanel settings={settings} onUpdate={update} />
        )}
        {activeTab === 'llm' && (
          <LlmPanel settings={settings} onUpdate={update} />
        )}
        {activeTab === 'profile' && (
          <ProfilePanel settings={settings} onUpdate={update} />
        )}
      </div>
    </div>
  );
};
