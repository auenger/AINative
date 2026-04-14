import React from 'react';
import { History, Bell, Share2, Languages, Sun, Moon, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../lib/useSettings';

export const TopNav: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { settings } = useSettings();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'zh' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <header
      className="flex items-center w-full px-2 gap-4 h-10 bg-surface-container z-40 border-b border-outline-variant/10 pl-16"
    >
      <div className="flex items-center gap-3">
        <span className="font-black text-blue-500 tracking-widest font-headline text-sm px-2">NEURO SYNTAX</span>
      </div>
      <div className="flex-grow"></div>
      <div className="flex items-center gap-4 px-2">
        <div className="flex items-center gap-3 text-on-surface-variant">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1 hover:text-on-surface transition-colors"
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 hover:text-on-surface transition-colors"
            title="Switch Language"
          >
            <Languages size={14} />
            <span className="text-[10px] font-bold uppercase">{i18n.language}</span>
          </button>
          <History size={14} className="hover:text-on-surface cursor-pointer" />
          <Bell size={14} className="hover:text-on-surface cursor-pointer" />
          <Share2 size={14} className="hover:text-on-surface cursor-pointer" />
        </div>
        <div className="flex gap-1">
          <button className="bg-surface-container-high text-on-surface text-[10px] px-2 py-1 hover:brightness-125 font-headline">
            {t('nav.runAi')}
          </button>
          <button className="bg-primary-container text-on-primary-container text-[10px] px-3 py-1 hover:brightness-110 font-headline font-bold uppercase tracking-wider rounded-sm">
            {t('nav.deploy')}
          </button>
        </div>
        {settings.user.avatar_base64 ? (
          <img
            className="w-6 h-6 rounded-full border border-outline-variant object-cover"
            src={settings.user.avatar_base64}
            alt="User"
          />
        ) : (
          <div className="w-6 h-6 rounded-full border border-outline-variant bg-surface-container-high flex items-center justify-center">
            <User size={12} className="text-on-surface-variant opacity-50" />
          </div>
        )}
      </div>
    </header>
  );
};
