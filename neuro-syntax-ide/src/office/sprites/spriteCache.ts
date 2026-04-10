import type { SpriteData } from '../types';

const zoomCaches = new Map<number, WeakMap<SpriteData, HTMLCanvasElement>>();

// ── Outline sprite generation ─────────────────────────────────

const outlineCache = new WeakMap<SpriteData, SpriteData>();

/** Generate a 1px white outline SpriteData (2px larger in each dimension) */
export function getOutlineSprite(sprite: SpriteData): SpriteData {
  const cached = outlineCache.get(sprite);
  if (cached) return cached;

  const rows = sprite.length;
  const cols = sprite[0]?.length ?? 0;
  // Expanded grid: +2 in each dimension for 1px border
  const outline: string[][] = [];
  for (let r = 0; r < rows + 2; r++) {
    outline.push(new Array<string>(cols + 2).fill(''));
  }

  // For each opaque pixel, mark its 4 cardinal neighbors as white
  for (let r = 0; r < rows; r++) {
    const row = sprite[r];
    if (!row) continue;
    for (let c = 0; c < cols; c++) {
      if (row[c] === '') continue;
      const er = r + 1;
      const ec = c + 1;
      if (outline[er - 1][ec] === '') outline[er - 1][ec] = '#FFFFFF';
      if (outline[er + 1][ec] === '') outline[er + 1][ec] = '#FFFFFF';
      if (outline[er][ec - 1] === '') outline[er][ec - 1] = '#FFFFFF';
      if (outline[er][ec + 1] === '') outline[er][ec + 1] = '#FFFFFF';
    }
  }

  // Clear pixels that overlap with original opaque pixels
  for (let r = 0; r < rows; r++) {
    const row = sprite[r];
    if (!row) continue;
    for (let c = 0; c < cols; c++) {
      if (row[c] !== '') {
        outline[r + 1][c + 1] = '';
      }
    }
  }

  outlineCache.set(sprite, outline);
  return outline;
}

export function getCachedSprite(sprite: SpriteData, zoom: number): HTMLCanvasElement {
  // Guard against invalid/empty sprites
  if (!sprite || sprite.length === 0 || !sprite[0] || sprite[0].length === 0) {
    console.warn('[spriteCache] Invalid sprite, returning fallback', {
      valid: !!sprite,
      len: sprite?.length,
      row0: sprite?.[0]?.length,
    });
    const fallback = document.createElement('canvas');
    fallback.width = 1;
    fallback.height = 1;
    return fallback;
  }

  let cache = zoomCaches.get(zoom);
  if (!cache) {
    cache = new WeakMap();
    zoomCaches.set(zoom, cache);
  }

  const cached = cache.get(sprite);
  if (cached) return cached;

  const rows = sprite.length;
  const cols = sprite[0].length;
  const w = cols * zoom;
  const h = rows * zoom;

  // Guard against zero-dimension canvas
  if (w <= 0 || h <= 0) {
    console.warn('[spriteCache] Zero-dim canvas', { w, h, cols, rows, zoom });
    const fallback = document.createElement('canvas');
    fallback.width = 1;
    fallback.height = 1;
    return fallback;
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('[spriteCache] Failed to get 2d context');
    const fallback = document.createElement('canvas');
    fallback.width = 1;
    fallback.height = 1;
    return fallback;
  }
  ctx.imageSmoothingEnabled = false;

  for (let r = 0; r < rows; r++) {
    const row = sprite[r];
    if (!row) continue;
    for (let c = 0; c < cols; c++) {
      const color = row[c];
      if (color === '') continue;
      ctx.fillStyle = color;
      ctx.fillRect(c * zoom, r * zoom, zoom, zoom);
    }
  }

  // Verify canvas is usable
  if (canvas.width !== w || canvas.height !== h) {
    console.warn('[spriteCache] Canvas dim mismatch after drawing', {
      expected: { w, h },
      actual: { w: canvas.width, h: canvas.height },
    });
  }

  cache.set(sprite, canvas);
  return canvas;
}
