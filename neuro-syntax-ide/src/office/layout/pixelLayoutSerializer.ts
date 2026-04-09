/**
 * Layout serialization: converts OfficeLayout to runtime data structures.
 *
 * Ported from pixel-agents (MIT License).
 */

import type {
  FurnitureInstance,
  OfficeLayout,
  PlacedFurniture,
  Seat,
  TileType as TileTypeVal,
} from '../pixelTypes';
import { DEFAULT_COLS, DEFAULT_ROWS, Direction, TILE_SIZE, TileType } from '../pixelTypes';
import { getCatalogEntry, getOrientationInGroup } from './pixelFurnitureCatalog';

export function layoutToTileMap(layout: OfficeLayout): TileTypeVal[][] {
  const map: TileTypeVal[][] = [];
  for (let r = 0; r < layout.rows; r++) {
    const row: TileTypeVal[] = [];
    for (let c = 0; c < layout.cols; c++) {
      row.push(layout.tiles[r * layout.cols + c]);
    }
    map.push(row);
  }
  return map;
}

export function layoutToFurnitureInstances(furniture: PlacedFurniture[]): FurnitureInstance[] {
  const instances: FurnitureInstance[] = [];
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type);
    if (!entry) continue;
    const x = item.col * TILE_SIZE;
    const y = item.row * TILE_SIZE;
    const spriteH = entry.sprite.length;
    let zY = y + spriteH;

    if (entry.category === 'chairs') {
      if (entry.orientation === 'back') {
        zY = (item.row + entry.footprintH) * TILE_SIZE + 1;
      } else {
        zY = (item.row + 1) * TILE_SIZE;
      }
    }

    let mirrored = false;
    if (entry.mirrorSide) {
      const orientInGroup = getOrientationInGroup(item.type);
      if (orientInGroup === 'left') {
        mirrored = true;
      }
    }

    instances.push({ sprite: entry.sprite, x, y, zY, ...(mirrored ? { mirrored: true } : {}) });
  }
  return instances;
}

export function getBlockedTiles(furniture: PlacedFurniture[]): Set<string> {
  const tiles = new Set<string>();
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type);
    if (!entry) continue;
    const bgRows = entry.backgroundTiles || 0;
    for (let dr = 0; dr < entry.footprintH; dr++) {
      if (dr < bgRows) continue;
      for (let dc = 0; dc < entry.footprintW; dc++) {
        tiles.add(`${item.col + dc},${item.row + dr}`);
      }
    }
  }
  return tiles;
}

function orientationToFacing(orientation: string): Direction {
  switch (orientation) {
    case 'front': return Direction.DOWN;
    case 'back': return Direction.UP;
    case 'left': return Direction.LEFT;
    case 'right':
    case 'side': return Direction.RIGHT;
    default: return Direction.DOWN;
  }
}

export function layoutToSeats(furniture: PlacedFurniture[]): Map<string, Seat> {
  const seats = new Map<string, Seat>();

  const deskTiles = new Set<string>();
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type);
    if (!entry || !entry.isDesk) continue;
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        deskTiles.add(`${item.col + dc},${item.row + dr}`);
      }
    }
  }

  const dirs: Array<{ dc: number; dr: number; facing: Direction }> = [
    { dc: 0, dr: -1, facing: Direction.UP },
    { dc: 0, dr: 1, facing: Direction.DOWN },
    { dc: -1, dr: 0, facing: Direction.LEFT },
    { dc: 1, dr: 0, facing: Direction.RIGHT },
  ];

  for (const item of furniture) {
    const entry = getCatalogEntry(item.type);
    if (!entry || entry.category !== 'chairs') continue;

    let seatCount = 0;
    const bgRows = entry.backgroundTiles ?? 0;
    for (let dr = bgRows; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const tileCol = item.col + dc;
        const tileRow = item.row + dr;

        let facingDir: Direction = Direction.DOWN;
        if (entry.orientation) {
          facingDir = orientationToFacing(entry.orientation);
        } else {
          for (const d of dirs) {
            if (deskTiles.has(`${tileCol + d.dc},${tileRow + d.dr}`)) {
              facingDir = d.facing;
              break;
            }
          }
        }

        const seatUid = seatCount === 0 ? item.uid : `${item.uid}:${seatCount}`;
        seats.set(seatUid, {
          uid: seatUid,
          seatCol: tileCol,
          seatRow: tileRow,
          facingDir,
          assigned: false,
        });
        seatCount++;
      }
    }
  }

  return seats;
}

export function createDefaultLayout(): OfficeLayout {
  const W = TileType.WALL;
  const F1 = TileType.FLOOR_1;
  const F2 = TileType.FLOOR_2;

  const tiles: TileTypeVal[] = [];
  for (let r = 0; r < DEFAULT_ROWS; r++) {
    for (let c = 0; c < DEFAULT_COLS; c++) {
      if (r === 0 || r === DEFAULT_ROWS - 1 || c === 0 || c === DEFAULT_COLS - 1) {
        tiles.push(W);
      } else if (c < 10) {
        tiles.push(F1);
      } else {
        tiles.push(F2);
      }
    }
  }

  return { version: 1, cols: DEFAULT_COLS, rows: DEFAULT_ROWS, tiles, furniture: [] };
}

/** Load layout from JSON string */
export function deserializeLayout(json: string): OfficeLayout | null {
  try {
    const obj = JSON.parse(json);
    if (obj && obj.version === 1 && Array.isArray(obj.tiles)) {
      return obj as OfficeLayout;
    }
  } catch {
    // ignore
  }
  return null;
}
