import { useState } from 'react';

import { isSoundEnabled, setSoundEnabled } from '../notificationSound';
import { Button } from './ui/Button';
import { Checkbox } from './ui/Checkbox';
import { MenuItem } from './ui/MenuItem';
import { Modal } from './ui/Modal';

// Simple message stub - will be replaced with Tauri IPC
function postMessage(msg: unknown): void {
  console.log('[PixelAgent] postMessage:', msg);
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDebugMode: boolean;
  onToggleDebugMode: () => void;
  alwaysShowOverlay: boolean;
  onToggleAlwaysShowOverlay: () => void;
  externalAssetDirectories?: string[];
  watchAllSessions?: boolean;
  onToggleWatchAllSessions?: () => void;
  hooksEnabled?: boolean;
  onToggleHooksEnabled?: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  isDebugMode,
  onToggleDebugMode,
  alwaysShowOverlay,
  onToggleAlwaysShowOverlay,
  externalAssetDirectories = [],
  watchAllSessions = false,
  onToggleWatchAllSessions,
  hooksEnabled = false,
  onToggleHooksEnabled,
}: SettingsModalProps) {
  const [soundLocal, setSoundLocal] = useState(isSoundEnabled);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      <MenuItem
        onClick={() => {
          postMessage({ type: 'openSessionsFolder' });
          onClose();
        }}
      >
        Open Sessions Folder
      </MenuItem>
      <MenuItem
        onClick={() => {
          postMessage({ type: 'exportLayout' });
          onClose();
        }}
      >
        Export Layout
      </MenuItem>
      <MenuItem
        onClick={() => {
          postMessage({ type: 'importLayout' });
          onClose();
        }}
      >
        Import Layout
      </MenuItem>
      <MenuItem
        onClick={() => {
          postMessage({ type: 'addExternalAssetDirectory' });
          onClose();
        }}
      >
        Add Asset Directory
      </MenuItem>
      {externalAssetDirectories.map((dir) => (
        <div key={dir} className="flex items-center justify-between py-4 px-10 gap-8">
          <span
            className="text-xs text-text-muted overflow-hidden text-ellipsis whitespace-nowrap"
            title={dir}
          >
            {dir.split(/[/\\]/).pop() ?? dir}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => postMessage({ type: 'removeExternalAssetDirectory', path: dir })}
            className="shrink-0"
          >
            x
          </Button>
        </div>
      ))}
      <Checkbox
        label="Sound Notifications"
        checked={soundLocal}
        onChange={() => {
          const newVal = !isSoundEnabled();
          setSoundEnabled(newVal);
          setSoundLocal(newVal);
          postMessage({ type: 'setSoundEnabled', enabled: newVal });
        }}
      />
      {onToggleWatchAllSessions && (
        <Checkbox
          label="Watch All Sessions"
          checked={watchAllSessions}
          onChange={onToggleWatchAllSessions}
        />
      )}
      {onToggleHooksEnabled && (
        <Checkbox
          label="Instant Detection (Hooks)"
          checked={hooksEnabled}
          onChange={onToggleHooksEnabled}
        />
      )}
      <Checkbox
        label="Always Show Labels"
        checked={alwaysShowOverlay}
        onChange={onToggleAlwaysShowOverlay}
      />
      <Checkbox label="Debug View" checked={isDebugMode} onChange={onToggleDebugMode} />
    </Modal>
  );
}
