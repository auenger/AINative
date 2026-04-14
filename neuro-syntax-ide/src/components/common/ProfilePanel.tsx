import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Mail, Camera, GitBranch, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { AvatarCropper } from './AvatarCropper';
import type { AppSettings, GitUserInfo } from '../../types';

// ---------------------------------------------------------------------------
// Tauri helpers (safe no-op outside Tauri)
// ---------------------------------------------------------------------------

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) return undefined as unknown as T;
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args);
}

// ---------------------------------------------------------------------------
// ProfilePanel — Settings > Profile tab
// ---------------------------------------------------------------------------

interface ProfilePanelProps {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({ settings, onUpdate }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [gitInfo, setGitInfo] = useState<GitUserInfo | null>(null);
  const [gitLoading, setGitLoading] = useState(false);

  // Load git user info on mount
  useEffect(() => {
    (async () => {
      setGitLoading(true);
      try {
        const result = await invoke<Record<string, string | null>>('read_git_user_info');
        setGitInfo({
          name: result.name ?? null,
          email: result.email ?? null,
        });
      } catch {
        // Graceful degradation — don't block UI
        setGitInfo(null);
      } finally {
        setGitLoading(false);
      }
    })();
  }, []);

  const handleAvatarClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    e.target.value = '';
  }, []);

  const handleCropComplete = useCallback((dataUrl: string) => {
    setCropSrc(null);
    onUpdate({
      user: {
        ...settings.user,
        avatar_base64: dataUrl,
      },
    });
  }, [settings.user, onUpdate]);

  const handleCropCancel = useCallback(() => {
    setCropSrc(null);
  }, []);

  const handleNameChange = useCallback((name: string) => {
    onUpdate({ user: { ...settings.user, name } });
  }, [settings.user, onUpdate]);

  const handleEmailChange = useCallback((email: string) => {
    onUpdate({ user: { ...settings.user, email } });
  }, [settings.user, onUpdate]);

  return (
    <div className="space-y-6">
      {/* Avatar Section */}
      <div className="config-card">
        <h3 className="text-sm font-headline font-bold text-on-surface mb-4 flex items-center gap-2">
          <Camera size={14} className="text-primary" />
          {t('settings.profile.avatar')}
        </h3>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleAvatarClick}
            className="relative group shrink-0"
          >
            {settings.user.avatar_base64 ? (
              <img
                src={settings.user.avatar_base64}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover border-2 border-outline-variant group-hover:border-primary transition-colors"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center border-2 border-outline-variant group-hover:border-primary transition-colors">
                <User size={32} className="text-on-surface-variant opacity-50" />
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <Camera size={16} className="text-white opacity-0 group-hover:opacity-80 transition-opacity" />
            </div>
          </button>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-on-surface">{t('settings.profile.avatarHint')}</span>
            <span className="text-[10px] text-on-surface-variant opacity-50">
              {t('settings.profile.avatarSize')}
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelected}
          />
        </div>
      </div>

      {/* Name & Email Section */}
      <div className="config-card">
        <h3 className="text-sm font-headline font-bold text-on-surface mb-4 flex items-center gap-2">
          <User size={14} className="text-primary" />
          {t('settings.profile.personalInfo')}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="config-label">
              {t('settings.profile.name')}
            </label>
            <div className="relative">
              <User size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-40" />
              <input
                type="text"
                value={settings.user.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t('settings.profile.namePlaceholder')}
                className="config-input-mono pl-8"
              />
            </div>
          </div>
          <div>
            <label className="config-label">
              {t('settings.profile.email')}
            </label>
            <div className="relative">
              <Mail size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-40" />
              <input
                type="email"
                value={settings.user.email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder={t('settings.profile.emailPlaceholder')}
                className="config-input-mono pl-8"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Git Info Section */}
      <div className="config-card">
        <h3 className="text-sm font-headline font-bold text-on-surface mb-4 flex items-center gap-2">
          <GitBranch size={14} className="text-primary" />
          {t('settings.profile.gitInfo')}
        </h3>
        {gitLoading ? (
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <Loader2 size={12} className="animate-spin" />
            {t('settings.profile.gitLoading')}
          </div>
        ) : gitInfo ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-on-surface-variant w-16 shrink-0">user.name</span>
              <span className="text-xs font-mono text-on-surface bg-surface-container-high px-2 py-1 rounded">
                {gitInfo.name || '—'}
              </span>
              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold">
                Git
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-on-surface-variant w-16 shrink-0">user.email</span>
              <span className="text-xs font-mono text-on-surface bg-surface-container-high px-2 py-1 rounded">
                {gitInfo.email || '—'}
              </span>
              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold">
                Git
              </span>
            </div>
            <p className="text-[10px] text-on-surface-variant opacity-50 mt-2">
              {t('settings.profile.gitReadOnly')}
            </p>
          </div>
        ) : (
          <p className="text-xs text-on-surface-variant opacity-50">
            {t('settings.profile.gitUnavailable')}
          </p>
        )}
      </div>

      {/* Crop modal */}
      {cropSrc && (
        <AvatarCropper
          src={cropSrc}
          onCrop={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
};
