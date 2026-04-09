import { useEffect, useRef, useState } from 'react';

import { Button } from './ui/Button';
import { Dropdown, DropdownItem } from './ui/Dropdown';

// Simple message stub - will be replaced with Tauri IPC
export function postMessage(msg: unknown): void {
  console.log('[PixelAgent] postMessage:', msg);
}

interface BottomToolbarProps {
  isEditMode: boolean;
  onOpenClaude: () => void;
  onToggleEditMode: () => void;
  isSettingsOpen: boolean;
  onToggleSettings: () => void;
}

export function BottomToolbar({
  isEditMode,
  onOpenClaude,
  onToggleEditMode,
  isSettingsOpen,
  onToggleSettings,
}: BottomToolbarProps) {
  return (
    <div className="absolute bottom-10 left-10 z-20 flex items-center gap-4 pixel-panel p-4">
      <Button
        variant="accent"
        onClick={onOpenClaude}
        className="bg-accent hover:bg-accent-bright"
      >
        + Agent
      </Button>
      <Button
        variant={isEditMode ? 'active' : 'default'}
        onClick={onToggleEditMode}
        title="Edit office layout"
      >
        Layout
      </Button>
      <Button
        variant={isSettingsOpen ? 'active' : 'default'}
        onClick={onToggleSettings}
        title="Settings"
      >
        Settings
      </Button>
    </div>
  );
}
