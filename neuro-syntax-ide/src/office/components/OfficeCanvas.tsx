import { useCallback, useEffect, useRef } from 'react';

import { PAN_MARGIN_FRACTION } from '../constants';
import { startGameLoop } from '../engine/gameLoop';
import type { OfficeState } from '../engine/officeState';
import type { SelectionRenderState } from '../engine/renderer';
import { renderFrame } from '../engine/renderer';
import { TILE_SIZE } from '../types';

interface OfficeCanvasProps {
  officeState: OfficeState;
  onClick: (agentId: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  panRef: React.MutableRefObject<{ x: number; y: number }>;
}

export function OfficeCanvas({
  officeState,
  zoom,
  panRef,
}: OfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const clampPan = useCallback(
    (px: number, py: number): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: px, y: py };
      const layout = officeState.getLayout();
      const mapW = layout.cols * TILE_SIZE * zoom;
      const mapH = layout.rows * TILE_SIZE * zoom;
      const marginX = canvas.width * PAN_MARGIN_FRACTION;
      const marginY = canvas.height * PAN_MARGIN_FRACTION;
      const maxPanX = mapW / 2 + canvas.width / 2 - marginX;
      const maxPanY = mapH / 2 + canvas.height / 2 - marginY;
      return {
        x: Math.max(-maxPanX, Math.min(maxPanX, px)),
        y: Math.max(-maxPanY, Math.min(maxPanY, py)),
      };
    },
    [officeState, zoom],
  );

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    resizeCanvas();

    const observer = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    const stop = startGameLoop(canvas, {
      update: (dt) => {
        officeState.update(dt);
      },
      render: (ctx) => {
        const w = canvas.width;
        const h = canvas.height;

        const selectionRender: SelectionRenderState = {
          selectedAgentId: null,
          hoveredAgentId: null,
          hoveredTile: null,
          seats: officeState.seats,
          characters: officeState.characters,
        };

        renderFrame(
          ctx,
          w,
          h,
          officeState.tileMap,
          officeState.furniture,
          officeState.getCharacters(),
          zoom,
          panRef.current.x,
          panRef.current.y,
          selectionRender,
          undefined,
          officeState.getLayout().tileColors,
          officeState.getLayout().cols,
          officeState.getLayout().rows,
        );
      },
    });

    return () => {
      stop();
      observer.disconnect();
    };
  }, [officeState, resizeCanvas, zoom, panRef]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      // Disable pan scrolling in PixelAgentView (observatory mode)
      e.preventDefault();
    },
    [],
  );

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-bg">
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        className="block"
      />
    </div>
  );
}
