/**
 * PixelAgentView -- Observatory Tab entry component.
 *
 * Full composition root based on the reference App.tsx, adapted for the
 * standalone Neuro Syntax IDE shell. No VS Code or extension messaging --
 * runs entirely in the browser/Tauri webview with demo agents for testing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { OfficeCanvas } from '../../office/components/OfficeCanvas';
import { BottomToolbar } from '../../office/components/BottomToolbar';
import { SettingsModal } from '../../office/components/SettingsModal';
import { ToolOverlay } from '../../office/components/ToolOverlay';
import { ZoomControls } from '../../office/components/ZoomControls';
import { EditorToolbar } from '../../office/editor/EditorToolbar';
import { EditorState } from '../../office/editor/editorState';
import { OfficeState } from '../../office/engine/officeState';
import { useEditorActions } from '../../office/hooks/useEditorActions';
import { useEditorKeyboard } from '../../office/hooks/useEditorKeyboard';
import { deserializeLayout } from '../../office/layout/layoutSerializer';
import { isRotatable } from '../../office/layout/furnitureCatalog';
import type { OfficeLayout, ToolActivity } from '../../office/types';
import { EditTool } from '../../office/types';

// ── Game state lives outside React ─────────────────────────────
const officeStateRef = { current: null as OfficeState | null };
const editorState = new EditorState();

function getOfficeState(): OfficeState {
  if (!officeStateRef.current) {
    officeStateRef.current = new OfficeState();
  }
  return officeStateRef.current;
}

// ── Demo Agent Helpers ─────────────────────────────────────────

const DEMO_TOOLS = ['Read', 'Write', 'Bash', 'Grep', 'Glob', 'Edit', 'Task'];
let demoToolIdx = 0;

/** Simulate agent activity by cycling tools */
function startDemoSimulation(office: OfficeState, agentIds: number[]): () => void {
  const tick = () => {
    for (const id of agentIds) {
      const tool = DEMO_TOOLS[demoToolIdx % DEMO_TOOLS.length];
      office.setAgentTool(id, tool);
      office.setAgentActive(id, true);
    }
    demoToolIdx++;
  };

  tick();
  const timer = setInterval(tick, 6000);

  // Return cleanup via a stored ref (component will call on unmount)
  return () => clearInterval(timer);
}

// ── Component ──────────────────────────────────────────────────

export const PixelAgentView: React.FC = () => {
  const [layoutReady, setLayoutReady] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [alwaysShowOverlay, setAlwaysShowOverlay] = useState(false);

  // Simplified agent tracking for demo mode
  const [agents, setAgents] = useState<number[]>([]);
  const [agentTools, setAgentTools] = useState<Record<number, ToolActivity[]>>({});
  const demoTimerRef = useRef<(() => void) | null>(null);
  const demoAgentIdsRef = useRef<number[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  // ── Editor state + actions ────────────────────────────────────
  const editor = useEditorActions(getOfficeState, editorState);

  const isEditDirty = useCallback(
    () => editor.isEditMode && editor.isDirty,
    [editor.isEditMode, editor.isDirty],
  );

  // Keyboard shortcuts for editor
  const [editorTickForKeyboard, setEditorTickForKeyboard] = useState(0);
  useEditorKeyboard(
    editor.isEditMode,
    editorState,
    editor.handleDeleteSelected,
    editor.handleRotateSelected,
    editor.handleToggleState,
    editor.handleUndo,
    editor.handleRedo,
    useCallback(() => setEditorTickForKeyboard((n) => n + 1), []),
    editor.handleToggleEditMode,
  );

  // Consume the keyboard tick to trigger re-renders
  void editorTickForKeyboard;

  // ── Layout & asset loading ────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Load layout from bundled asset
      let layout: OfficeLayout | null = null;
      try {
        const resp = await fetch('/assets/pixel/default-layout.json');
        if (resp.ok) {
          const json = await resp.text();
          layout = deserializeLayout(json);
        }
      } catch {
        // Layout fetch failed, will use default
      }

      if (!mounted) return;

      const office = getOfficeState();
      if (layout) {
        office.rebuildFromLayout(layout);
        editor.setLastSavedLayout(layout);
      }

      // ── Create demo agents ────────────────────────────────────
      const agent1Id = 1;
      const agent2Id = 2;
      office.addAgent(agent1Id, 0, 0, undefined, true); // skip spawn for instant display
      office.addAgent(agent2Id, 1, 45, undefined, true);
      demoAgentIdsRef.current = [agent1Id, agent2Id];

      setAgents([agent1Id, agent2Id]);

      // Start demo simulation
      const cleanup = startDemoSimulation(office, [agent1Id, agent2Id]);
      demoTimerRef.current = cleanup;

      setLayoutReady(true);
    };

    init();

    return () => {
      mounted = false;
      if (demoTimerRef.current) {
        demoTimerRef.current();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ──────────────────────────────────────────────────
  const handleToggleDebugMode = useCallback(() => setIsDebugMode((prev) => !prev), []);

  const handleToggleAlwaysShowOverlay = useCallback(() => {
    setAlwaysShowOverlay((prev) => !prev);
  }, []);

  const handleClick = useCallback((agentId: number) => {
    // Select the agent in the office
    const os = getOfficeState();
    os.selectedAgentId = os.selectedAgentId === agentId ? null : agentId;
  }, []);

  const handleCloseAgent = useCallback((_id: number) => {
    // Demo mode: no-op (agents are not closable in demo)
    console.log('[PixelAgent] closeAgent not available in demo mode');
  }, []);

  // ── Render ────────────────────────────────────────────────────
  const officeState = getOfficeState();

  // Show "Rotate (R)" hint when a rotatable item is selected or being placed
  const showRotateHint =
    editor.isEditMode &&
    (() => {
      if (editorState.selectedFurnitureUid) {
        const item = officeState
          .getLayout()
          .furniture.find((f) => f.uid === editorState.selectedFurnitureUid);
        if (item && isRotatable(item.type)) return true;
      }
      if (
        editorState.activeTool === EditTool.FURNITURE_PLACE &&
        isRotatable(editorState.selectedFurnitureType)
      ) {
        return true;
      }
      return false;
    })();

  if (!layoutReady) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e]">
        <span className="text-slate-400 font-mono text-sm">Loading office...</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <OfficeCanvas
        officeState={officeState}
        onClick={handleClick}
        isEditMode={editor.isEditMode}
        editorState={editorState}
        onEditorTileAction={editor.handleEditorTileAction}
        onEditorEraseAction={editor.handleEditorEraseAction}
        onEditorSelectionChange={editor.handleEditorSelectionChange}
        onDeleteSelected={editor.handleDeleteSelected}
        onRotateSelected={editor.handleRotateSelected}
        onDragMove={editor.handleDragMove}
        editorTick={editor.editorTick}
        zoom={editor.zoom}
        onZoomChange={editor.handleZoomChange}
        panRef={editor.panRef}
      />

      {!isDebugMode && (
        <>
          <ZoomControls zoom={editor.zoom} onZoomChange={editor.handleZoomChange} />

          {/* Vignette overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'var(--vignette)' }}
          />

          {showRotateHint && (
            <div
              className="absolute left-1/2 -translate-x-1/2 z-11 bg-accent-bright text-white text-sm py-3 px-8 rounded-none border-2 border-accent shadow-pixel pointer-events-none whitespace-nowrap"
              style={{ top: editor.isDirty ? 64 : 8 }}
            >
              Rotate (R)
            </div>
          )}

          {editor.isEditMode &&
            (() => {
              const selUid = editorState.selectedFurnitureUid;
              const selColor = selUid
                ? (officeState.getLayout().furniture.find((f) => f.uid === selUid)?.color ?? null)
                : null;
              return (
                <EditorToolbar
                  activeTool={editorState.activeTool}
                  selectedTileType={editorState.selectedTileType}
                  selectedFurnitureType={editorState.selectedFurnitureType}
                  selectedFurnitureUid={selUid}
                  selectedFurnitureColor={selColor}
                  floorColor={editorState.floorColor}
                  wallColor={editorState.wallColor}
                  selectedWallSet={editorState.selectedWallSet}
                  onToolChange={editor.handleToolChange}
                  onTileTypeChange={editor.handleTileTypeChange}
                  onFloorColorChange={editor.handleFloorColorChange}
                  onWallColorChange={editor.handleWallColorChange}
                  onWallSetChange={editor.handleWallSetChange}
                  onSelectedFurnitureColorChange={editor.handleSelectedFurnitureColorChange}
                  onFurnitureTypeChange={editor.handleFurnitureTypeChange}
                />
              );
            })()}

          <ToolOverlay
            officeState={officeState}
            agents={agents}
            agentTools={agentTools}
            subagentCharacters={[]}
            containerRef={containerRef}
            zoom={editor.zoom}
            panRef={editor.panRef}
            onCloseAgent={handleCloseAgent}
            alwaysShowOverlay={alwaysShowOverlay}
          />
        </>
      )}

      <BottomToolbar
        isEditMode={editor.isEditMode}
        onOpenClaude={editor.handleOpenClaude}
        onToggleEditMode={editor.handleToggleEditMode}
        isSettingsOpen={isSettingsOpen}
        onToggleSettings={() => setIsSettingsOpen((v) => !v)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isDebugMode={isDebugMode}
        onToggleDebugMode={handleToggleDebugMode}
        alwaysShowOverlay={alwaysShowOverlay}
        onToggleAlwaysShowOverlay={handleToggleAlwaysShowOverlay}
      />
    </div>
  );
};
