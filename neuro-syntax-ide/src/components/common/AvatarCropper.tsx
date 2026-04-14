import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';

// ---------------------------------------------------------------------------
// AvatarCropper — pure Canvas API circular crop component
// ---------------------------------------------------------------------------

interface AvatarCropperProps {
  /** Data URL of the source image */
  src: string;
  /** Called with the cropped Base64 data URL */
  onCrop: (dataUrl: string) => void;
  /** Called when user cancels */
  onCancel: () => void;
}

const OUTPUT_SIZE = 256;

export const AvatarCropper: React.FC<AvatarCropperProps> = ({ src, onCrop, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Auto-fit: scale so the shorter dimension fills the canvas
      const canvasSize = 280;
      const fitScale = canvasSize / Math.min(img.width, img.height);
      setScale(fitScale);
      setOffset({ x: 0, y: 0 });
    };
    img.src = src;
  }, [src]);

  // Draw canvas preview
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 280;
    canvas.width = size;
    canvas.height = size;

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Save and clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();

    // Draw image centered
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const drawX = (size - drawW) / 2 + offset.x;
    const drawY = (size - drawH) / 2 + offset.y;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    ctx.restore();

    // Draw circular border overlay (darken outside)
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.restore();

    // Draw circle border
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, [scale, offset]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleConfirm = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = OUTPUT_SIZE;
    outCanvas.height = OUTPUT_SIZE;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) return;

    // Calculate crop area: centered circle mapped back to original image coords
    const canvasSize = 280;
    const circleRadius = canvasSize / 2;

    // Clip to circle
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    // Draw the same view into output canvas
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const drawX = (canvasSize - drawW) / 2 + offset.x;
    const drawY = (canvasSize - drawH) / 2 + offset.y;

    // Scale from preview coords to output coords
    const ratio = OUTPUT_SIZE / canvasSize;
    ctx.drawImage(
      img,
      drawX * ratio,
      drawY * ratio,
      drawW * ratio,
      drawH * ratio,
    );

    const dataUrl = outCanvas.toDataURL('image/png');
    onCrop(dataUrl);
  }, [scale, offset, onCrop]);

  // Mouse drag handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetStart.current = { ...offset };
  }, [offset]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({
      x: offsetStart.current.x + dx,
      y: offsetStart.current.y + dy,
    });
  }, [dragging]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface-container rounded-xl p-6 shadow-2xl flex flex-col items-center gap-4">
        <h3 className="text-sm font-headline font-bold text-on-surface">Crop Avatar</h3>
        <canvas
          ref={canvasRef}
          width={280}
          height={280}
          className="rounded-full cursor-move touch-none"
          style={{ width: 280, height: 280 }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        <div className="flex items-center gap-3 w-full">
          <span className="text-xs text-on-surface-variant shrink-0">Zoom</span>
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.05}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-surface-container-highest cursor-pointer accent-primary"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              'px-4 py-2 text-xs font-bold rounded-lg transition-all',
              'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high',
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={cn(
              'px-4 py-2 text-xs font-bold rounded-lg transition-all',
              'bg-primary text-on-primary hover:bg-primary/90',
            )}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};
