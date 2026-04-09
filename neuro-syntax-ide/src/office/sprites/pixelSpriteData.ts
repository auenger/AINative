/**
 * Sprite data management for pixel characters.
 *
 * Ported from pixel-agents (MIT License).
 * Simplified: loads PNG assets via Canvas API instead of pngjs.
 */

import type { ColorValue, Direction, SpriteData } from '../pixelTypes';
import { Direction as Dir } from '../pixelTypes';
import { PALETTE_COUNT } from '../pixelConstants';

// -- Speech Bubble Sprites (inline) --

const BUBBLE_PERMISSION_DATA = {
  palette: { '_': '', 'B': '#555566', 'F': '#EEEEFF', 'A': '#CCA700' } as Record<string, string>,
  pixels: [
    ['B','B','B','B','B','B','B','B','B','B','B'],
    ['B','F','F','F','F','F','F','F','F','F','B'],
    ['B','F','F','F','F','F','F','F','F','F','B'],
    ['B','F','F','F','F','F','F','F','F','F','B'],
    ['B','F','F','F','F','F','F','F','F','F','B'],
    ['B','F','F','A','F','A','F','A','F','F','B'],
    ['B','F','F','F','F','F','F','F','F','F','B'],
    ['B','F','F','F','F','F','F','F','F','F','B'],
    ['B','F','F','F','F','F','F','F','F','F','B'],
    ['B','B','B','B','B','B','B','B','B','B','B'],
    ['_','_','_','_','B','B','B','_','_','_','_'],
    ['_','_','_','_','_','B','_','_','_','_','_'],
    ['_','_','_','_','_','_','_','_','_','_','_'],
  ],
};

const BUBBLE_WAITING_DATA = {
  palette: { '_': '', 'B': '#555566', 'F': '#EEEEFF', 'G': '#44BB66' } as Record<string, string>,
  pixels: [
    ['_','B','B','B','B','B','B','B','B','B','_'],
    ['B','F','F','F','F','F','F','F','F','F','B'],
    ['B','F','F','F','F','F','F','F','F','F','B'],
    ['B','F','F','F','F','F','F','F','G','F','B'],
    ['B','F','F','F','F','F','F','G','F','F','B'],
    ['B','F','F','G','F','F','G','F','F','F','B'],
    ['B','F','F','F','G','G','F','F','F','F','B'],
    ['B','F','F','F','F','F','F','F','F','F','B'],
    ['B','F','F','F','F','F','F','F','F','F','B'],
    ['_','B','B','B','B','B','B','B','B','B','_'],
    ['_','_','_','_','B','B','B','_','_','_','_'],
    ['_','_','_','_','_','B','_','_','_','_','_'],
    ['_','_','_','_','_','_','_','_','_','_','_'],
  ],
};

function resolveBubbleSprite(data: typeof BUBBLE_PERMISSION_DATA): SpriteData {
  return data.pixels.map((row) => row.map((key) => data.palette[key] ?? key));
}

export const BUBBLE_PERMISSION_SPRITE: SpriteData = resolveBubbleSprite(BUBBLE_PERMISSION_DATA);
export const BUBBLE_WAITING_SPRITE: SpriteData = resolveBubbleSprite(BUBBLE_WAITING_DATA);

// -- Loaded character sprites --

interface LoadedCharacterData {
  down: SpriteData[];
  up: SpriteData[];
  right: SpriteData[];
}

let loadedCharacters: LoadedCharacterData[] | null = null;

export function setCharacterTemplates(data: LoadedCharacterData[]): void {
  loadedCharacters = data;
  spriteCache.clear();
}

export function getLoadedCharacterCount(): number {
  return loadedCharacters ? loadedCharacters.length : PALETTE_COUNT;
}

function flipSpriteHorizontal(sprite: SpriteData): SpriteData {
  return sprite.map((row) => [...row].reverse());
}

// -- Sprite resolution + caching --

export interface CharacterSprites {
  walk: Record<Direction, [SpriteData, SpriteData, SpriteData, SpriteData]>;
  typing: Record<Direction, [SpriteData, SpriteData]>;
  reading: Record<Direction, [SpriteData, SpriteData]>;
}

const spriteCache = new Map<string, CharacterSprites>();

function emptySprite(w: number, h: number): SpriteData {
  const rows: string[][] = [];
  for (let y = 0; y < h; y++) {
    rows.push(new Array(w).fill(''));
  }
  return rows;
}

// Simple placeholder character sprites (16x24 pixel characters)
// This serves as a fallback when PNGs are not loaded
function createFallbackCharacterSprites(): CharacterSprites {
  // Create a simple 16x32 sprite (matching the original pixel-agents format)
  const e = emptySprite(16, 32);
  const walkSet: [SpriteData, SpriteData, SpriteData, SpriteData] = [e, e, e, e];
  const pairSet: [SpriteData, SpriteData] = [e, e];
  return {
    walk: {
      [Dir.DOWN]: walkSet,
      [Dir.UP]: walkSet,
      [Dir.RIGHT]: walkSet,
      [Dir.LEFT]: walkSet,
    },
    typing: {
      [Dir.DOWN]: pairSet,
      [Dir.UP]: pairSet,
      [Dir.RIGHT]: pairSet,
      [Dir.LEFT]: pairSet,
    },
    reading: {
      [Dir.DOWN]: pairSet,
      [Dir.UP]: pairSet,
      [Dir.RIGHT]: pairSet,
      [Dir.LEFT]: pairSet,
    },
  };
}

// Hardcoded simple character sprite (16x24) as a visible fallback
function createSimpleCharacterSprite(bodyColor: string, headColor: string, isTyping: boolean): SpriteData {
  const w = 16;
  const h = 32;
  const sprite: string[][] = [];
  for (let y = 0; y < h; y++) {
    const row: string[] = new Array(w).fill('');
    sprite.push(row);
  }

  // Head (rows 4-11, cols 5-10)
  for (let r = 4; r <= 11; r++) {
    for (let c = 5; c <= 10; c++) {
      sprite[r][c] = headColor;
    }
  }

  // Eyes (rows 7-8)
  sprite[7][6] = '#222233';
  sprite[7][9] = '#222233';

  // Body (rows 12-19, cols 4-11)
  for (let r = 12; r <= 19; r++) {
    for (let c = 4; c <= 11; c++) {
      sprite[r][c] = bodyColor;
    }
  }

  // Legs (rows 20-23)
  for (let r = 20; r <= 23; r++) {
    sprite[r][5] = '#334455';
    sprite[r][6] = '#334455';
    sprite[r][9] = '#334455';
    sprite[r][10] = '#334455';
  }

  // Typing arms
  if (isTyping) {
    sprite[16][2] = headColor;
    sprite[16][3] = headColor;
    sprite[16][12] = headColor;
    sprite[16][13] = headColor;
  }

  return sprite;
}

const BODY_COLORS = ['#4466AA', '#AA4466', '#66AA44', '#AA6644', '#6644AA', '#44AA66'];
const HEAD_COLORS = ['#FFCCAA', '#FFE0CC', '#FFD4B8', '#F5C5A3', '#E8B898', '#DCA98D'];

export function getCharacterSprites(paletteIndex: number, _hueShift = 0): CharacterSprites {
  const cacheKey = `${paletteIndex}:${_hueShift}`;
  const cached = spriteCache.get(cacheKey);
  if (cached) return cached;

  let sprites: CharacterSprites;

  if (loadedCharacters) {
    const char = loadedCharacters[paletteIndex % loadedCharacters.length];
    const d = char.down;
    const u = char.up;
    const rt = char.right;
    const flip = flipSpriteHorizontal;

    sprites = {
      walk: {
        [Dir.DOWN]: [d[0], d[1], d[2], d[1]],
        [Dir.UP]: [u[0], u[1], u[2], u[1]],
        [Dir.RIGHT]: [rt[0], rt[1], rt[2], rt[1]],
        [Dir.LEFT]: [flip(rt[0]), flip(rt[1]), flip(rt[2]), flip(rt[1])],
      },
      typing: {
        [Dir.DOWN]: [d[3], d[4]],
        [Dir.UP]: [u[3], u[4]],
        [Dir.RIGHT]: [rt[3], rt[4]],
        [Dir.LEFT]: [flip(rt[3]), flip(rt[4])],
      },
      reading: {
        [Dir.DOWN]: [d[5], d[6]],
        [Dir.UP]: [u[5], u[6]],
        [Dir.RIGHT]: [rt[5], rt[6]],
        [Dir.LEFT]: [flip(rt[5]), flip(rt[6])],
      },
    };
  } else {
    // Generate simple colored sprites as fallback
    const bodyColor = BODY_COLORS[paletteIndex % BODY_COLORS.length];
    const headColor = HEAD_COLORS[paletteIndex % HEAD_COLORS.length];
    const normal = createSimpleCharacterSprite(bodyColor, headColor, false);
    const typing = createSimpleCharacterSprite(bodyColor, headColor, true);
    const flipped = flipSpriteHorizontal(normal);
    const flippedTyping = flipSpriteHorizontal(typing);
    const empty = emptySprite(16, 32);

    sprites = {
      walk: {
        [Dir.DOWN]: [normal, normal, normal, normal],
        [Dir.UP]: [empty, empty, empty, empty],
        [Dir.RIGHT]: [normal, normal, normal, normal],
        [Dir.LEFT]: [flipped, flipped, flipped, flipped],
      },
      typing: {
        [Dir.DOWN]: [typing, typing],
        [Dir.UP]: [empty, empty],
        [Dir.RIGHT]: [typing, typing],
        [Dir.LEFT]: [flippedTyping, flippedTyping],
      },
      reading: {
        [Dir.DOWN]: [normal, normal],
        [Dir.UP]: [empty, empty],
        [Dir.RIGHT]: [normal, normal],
        [Dir.LEFT]: [flipped, flipped],
      },
    };
  }

  spriteCache.set(cacheKey, sprites);
  return sprites;
}

/**
 * Load character PNGs and convert to SpriteData using Canvas.
 */
export async function loadCharacterSprites(): Promise<boolean> {
  const characters: LoadedCharacterData[] = [];

  for (let i = 0; i < PALETTE_COUNT; i++) {
    try {
      const img = new Image();
      img.src = `/assets/pixel/characters/char_${i}.png`;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load char_${i}.png`));
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data, width } = imageData;

      // Each character PNG is 112x96: 7 frames x 16px, 3 rows x 32px
      // Frame order: walk1, walk2, walk3, type1, type2, read1, read2
      // Row 0 = down, Row 1 = up, Row 2 = right
      const framesPerRow = 7;
      const frameW = 16;
      const frameH = 32;
      const rows = 3;

      const extractFrame = (row: number, col: number): SpriteData => {
        const sprite: string[][] = [];
        for (let y = 0; y < frameH; y++) {
          const pixelRow: string[] = [];
          for (let x = 0; x < frameW; x++) {
            const px = (row * frameH + y) * width + (col * frameW + x);
            const r = data[px * 4];
            const g = data[px * 4 + 1];
            const b = data[px * 4 + 2];
            const a = data[px * 4 + 3];
            if (a < 2) {
              pixelRow.push('');
            } else {
              const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
              pixelRow.push(a < 255 ? `${hex}${a.toString(16).padStart(2, '0').toUpperCase()}` : hex);
            }
          }
          sprite.push(pixelRow);
        }
        return sprite;
      };

      const down: SpriteData[] = [];
      const up: SpriteData[] = [];
      const right: SpriteData[] = [];

      for (let f = 0; f < framesPerRow; f++) {
        down.push(extractFrame(0, f));
        up.push(extractFrame(1, f));
        right.push(extractFrame(2, f));
      }

      characters.push({ down, up, right });
    } catch {
      // If a character PNG fails to load, skip it
      console.warn(`[PixelAgent] Failed to load character ${i}, using fallback`);
    }
  }

  if (characters.length > 0) {
    setCharacterTemplates(characters);
    return true;
  }
  return false;
}
