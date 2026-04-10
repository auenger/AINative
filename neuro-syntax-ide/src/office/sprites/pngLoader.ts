/**
 * PNG sprite loader — converts PNG assets into SpriteData for the rendering engine.
 *
 * The rendering engine was ported from a VS Code extension where sprites were
 * loaded by the extension host and sent via postMessage. In the standalone web
 * app, we load PNGs directly via fetch + Canvas API.
 */

import type { SpriteData } from '../types';
import { setCharacterTemplates, type LoadedCharacterData } from './spriteData';
import { setFloorSprites } from '../floorTiles';
import { setWallSprites } from '../wallTiles';
import { buildDynamicCatalog, type LoadedAssetData } from '../layout/furnitureCatalog';

// ── Core: PNG → SpriteData ─────────────────────────────────────

/** Convert a PNG file at the given URL to SpriteData (2D hex color array). */
async function pngToSpriteData(url: string): Promise<SpriteData> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${url}`);
  const blob = await resp.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const img = new Image();
    img.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(`Failed to get 2d context for: ${url}`);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;

    const rows: string[][] = [];
    for (let y = 0; y < height; y++) {
      const row: string[] = [];
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const a = data[i + 3];
        if (a === 0) {
          row.push('');
        } else {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          row.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
        }
      }
      rows.push(row);
    }
    return rows;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Extract a rectangular region from a SpriteData. */
function extractRegion(
  src: SpriteData,
  x: number,
  y: number,
  w: number,
  h: number,
): SpriteData {
  const rows: string[][] = [];
  for (let ry = y; ry < y + h; ry++) {
    rows.push(src[ry].slice(x, x + w));
  }
  return rows;
}

// ── Character sprites ──────────────────────────────────────────

const CHARACTER_COUNT = 6;
/** Sprite sheet: 7 columns × 3 rows × (16px wide × 32px tall) */
const CHAR_COLS = 7;
const CHAR_ROWS = 3;
const CHAR_FRAME_W = 16;
const CHAR_FRAME_H = 32;

/**
 * Load character sprite sheets.
 *
 * Each char_N.png is a sprite sheet:
 *   Row 0 = down,  Row 1 = up,  Row 2 = right
 *   Each row has 7 frames: [walk0, walk1, walk2, type0, type1, read0, read1]
 */
async function loadCharacterSprites(): Promise<void> {
  const characters: LoadedCharacterData[] = [];

  for (let i = 0; i < CHARACTER_COUNT; i++) {
    const url = `/assets/pixel/characters/char_${i}.png`;
    const sheet = await pngToSpriteData(url);

    // Extract frames from each direction row
    const down: SpriteData[] = [];
    const up: SpriteData[] = [];
    const right: SpriteData[] = [];

    for (let col = 0; col < CHAR_COLS; col++) {
      const x = col * CHAR_FRAME_W;
      down.push(extractRegion(sheet, x, 0 * CHAR_FRAME_H, CHAR_FRAME_W, CHAR_FRAME_H));
      up.push(extractRegion(sheet, x, 1 * CHAR_FRAME_H, CHAR_FRAME_W, CHAR_FRAME_H));
      right.push(extractRegion(sheet, x, 2 * CHAR_FRAME_H, CHAR_FRAME_W, CHAR_FRAME_H));
    }

    characters.push({ down, up, right });
  }

  setCharacterTemplates(characters);
  console.log(`[pngLoader] Loaded ${characters.length} character palettes`);
}

// ── Floor sprites ──────────────────────────────────────────────

const FLOOR_COUNT = 9;

async function loadFloorSprites(): Promise<void> {
  const sprites: SpriteData[] = [];
  for (let i = 0; i < FLOOR_COUNT; i++) {
    const url = `/assets/pixel/floors/floor_${i}.png`;
    sprites.push(await pngToSpriteData(url));
  }
  setFloorSprites(sprites);
  console.log(`[pngLoader] Loaded ${sprites.length} floor tile patterns`);
}

// ── Wall sprites ───────────────────────────────────────────────

/**
 * Wall sprite sheet: 4×4 grid of 16×32 sprites = 16 bitmask variants.
 * Bitmask: N=1, E=2, S=4, W=8 (row-major order).
 */
async function loadWallSprites(): Promise<void> {
  const sheet = await pngToSpriteData('/assets/pixel/walls/wall_0.png');

  // 4×4 grid of 16×32 sprites
  const set: SpriteData[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      set.push(extractRegion(sheet, col * 16, row * 32, 16, 32));
    }
  }

  setWallSprites([set]);
  console.log(`[pngLoader] Loaded wall sprites (${set.length} bitmask variants)`);
}

// ── Furniture sprites ──────────────────────────────────────────

interface ManifestNode {
  type: string;
  id?: string;
  name?: string;
  file?: string;
  width?: number;
  height?: number;
  footprintW?: number;
  footprintH?: number;
  category?: string;
  orientation?: string;
  state?: string;
  frame?: number;
  groupType?: string;
  members?: ManifestNode[];
  canPlaceOnWalls?: boolean;
  canPlaceOnSurfaces?: boolean;
  backgroundTiles?: number;
  mirrorSide?: boolean;
  rotationScheme?: string;
}

interface FlatAsset {
  id: string;
  label: string;
  category: string;
  width: number;
  height: number;
  footprintW: number;
  footprintH: number;
  isDesk: boolean;
  groupId?: string;
  orientation?: string;
  state?: string;
  canPlaceOnSurfaces?: boolean;
  backgroundTiles?: number;
  canPlaceOnWalls?: boolean;
  mirrorSide?: boolean;
  rotationScheme?: string;
  animationGroup?: string;
  frame?: number;
  file?: string;
}

/** Recursively flatten a manifest tree, inheriting properties from parent groups. */
function flattenManifest(
  node: ManifestNode,
  parentGroupId?: string,
  parentOrientation?: string,
  parentState?: string,
  parentRotationScheme?: string,
  parentAnimationGroup?: string,
  topCategoryId?: string,
  topCanPlaceOnSurfaces?: boolean,
  topCanPlaceOnWalls?: boolean,
  topBackgroundTiles?: number,
): FlatAsset[] {
  if (node.type === 'asset') {
    // Leaf node — build a flat catalog entry
    const groupId = parentGroupId;
    const orientation = node.orientation ?? parentOrientation;
    const state = node.state ?? parentState;

    // Detect animation group from parent
    let animationGroup = parentAnimationGroup;
    if (node.frame !== undefined && !animationGroup && groupId) {
      animationGroup = `${groupId}_anim`;
    }

    return [{
      id: node.id!,
      label: node.id!.replace(/_/g, ' '),
      category: (topCategoryId ?? node.category ?? 'misc') as string,
      width: node.width ?? 16,
      height: node.height ?? 16,
      footprintW: node.footprintW ?? 1,
      footprintH: node.footprintH ?? 1,
      isDesk: (topCategoryId ?? node.category) === 'desks',
      groupId,
      orientation,
      state,
      canPlaceOnSurfaces: topCanPlaceOnSurfaces ?? node.canPlaceOnSurfaces,
      backgroundTiles: topBackgroundTiles ?? node.backgroundTiles,
      canPlaceOnWalls: topCanPlaceOnWalls ?? node.canPlaceOnWalls,
      mirrorSide: node.mirrorSide,
      rotationScheme: parentRotationScheme,
      animationGroup,
      frame: node.frame,
      file: node.file ?? (node.id ? `${node.id}.png` : undefined),
    }];
  }

  if (node.type === 'group' && node.members) {
    const groupId = parentGroupId ?? node.id;
    const rotationScheme = parentRotationScheme ?? node.rotationScheme;

    // Determine what this group passes down to children
    let orientation = parentOrientation;
    let state = parentState;
    let animGroup = parentAnimationGroup;

    if (node.groupType === 'rotation') {
      // Rotation groups don't pass down orientation — each member has its own
    } else if (node.groupType === 'state') {
      state = undefined; // state members define their own state
      orientation = node.orientation ?? parentOrientation;
    } else if (node.groupType === 'animation') {
      animGroup = `${groupId}_${node.orientation ?? 'anim'}`;
      state = node.state ?? parentState;
      orientation = node.orientation ?? parentOrientation;
    } else {
      orientation = node.orientation ?? parentOrientation;
      state = node.state ?? parentState;
    }

    const results: FlatAsset[] = [];
    for (const child of node.members) {
      results.push(...flattenManifest(
        child,
        groupId,
        orientation,
        state,
        rotationScheme,
        animGroup,
        topCategoryId ?? node.category,
        topCanPlaceOnSurfaces ?? node.canPlaceOnSurfaces,
        topCanPlaceOnWalls ?? node.canPlaceOnWalls,
        topBackgroundTiles ?? node.backgroundTiles,
      ));
    }
    return results;
  }

  return [];
}

/** Known furniture directory names (from public/assets/pixel/furniture/). */
const FURNITURE_DIRS = [
  'BIN', 'BOOKSHELF', 'CACTUS', 'CLOCK', 'COFFEE', 'COFFEE_TABLE',
  'CUSHIONED_BENCH', 'CUSHIONED_CHAIR', 'DESK', 'DOUBLE_BOOKSHELF',
  'HANGING_PLANT', 'LARGE_PAINTING', 'LARGE_PLANT', 'PC',
  'PLANT', 'PLANT_2', 'POT', 'SMALL_PAINTING', 'SMALL_PAINTING_2',
  'SMALL_TABLE', 'SOFA', 'TABLE_FRONT', 'WHITEBOARD',
  'WOODEN_BENCH', 'WOODEN_CHAIR',
];

async function loadFurnitureSprites(): Promise<void> {
  const catalog: LoadedAssetData['catalog'] = [];
  const sprites: Record<string, SpriteData> = {};

  for (const dir of FURNITURE_DIRS) {
    try {
      const manifestUrl = `/assets/pixel/furniture/${dir}/manifest.json`;
      const resp = await fetch(manifestUrl);
      if (!resp.ok) continue;
      const manifest: ManifestNode = await resp.json();

      // Flatten the manifest tree
      const assets = flattenManifest(manifest);

      // Load each asset's PNG
      for (const asset of assets) {
        if (!asset.file) continue;
        const pngUrl = `/assets/pixel/furniture/${dir}/${asset.file}`;
        try {
          const spriteData = await pngToSpriteData(pngUrl);
          sprites[asset.id] = spriteData;
          catalog.push({
            id: asset.id,
            label: asset.label,
            category: asset.category,
            width: asset.width,
            height: asset.height,
            footprintW: asset.footprintW,
            footprintH: asset.footprintH,
            isDesk: asset.isDesk,
            groupId: asset.groupId,
            orientation: asset.orientation,
            state: asset.state,
            canPlaceOnSurfaces: asset.canPlaceOnSurfaces,
            backgroundTiles: asset.backgroundTiles,
            canPlaceOnWalls: asset.canPlaceOnWalls,
            mirrorSide: asset.mirrorSide,
            rotationScheme: asset.rotationScheme,
            animationGroup: asset.animationGroup,
            frame: asset.frame,
          });
        } catch {
          console.warn(`[pngLoader] Failed to load furniture sprite: ${pngUrl}`);
        }
      }
    } catch {
      console.warn(`[pngLoader] Failed to load manifest: ${dir}/manifest.json`);
    }
  }

  buildDynamicCatalog({ catalog, sprites });
  console.log(`[pngLoader] Loaded ${catalog.length} furniture assets from ${FURNITURE_DIRS.length} directories`);
}

// ── Master loader ──────────────────────────────────────────────

/** Load all sprite assets and initialize the rendering engine. */
export async function loadAllSprites(): Promise<void> {
  await Promise.all([
    loadCharacterSprites(),
    loadFloorSprites(),
    loadWallSprites(),
    loadFurnitureSprites(),
  ]);
  console.log('[pngLoader] All sprites loaded successfully');
}
