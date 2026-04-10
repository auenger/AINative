/**
 * Activity Zones — map tools to office locations.
 *
 * Scans the layout furniture and finds walkable tiles near zone-relevant
 * items (PCs → coding, bookshelves → reading, sofas → research).
 */

import { getCatalogEntry } from './furnitureCatalog';
import { isWalkable } from './tileMap';
import type { OfficeLayout, TileType as TileTypeVal } from '../types';

// ── Zone types ──────────────────────────────────────────────────

export type ZoneType = 'coding' | 'reading' | 'research';

export interface ActivityZone {
  tiles: Array<{ col: number; row: number }>;
}

// ── Furniture → Zone mapping ────────────────────────────────────

const FURNITURE_ZONE_MAP: Record<string, ZoneType> = {
  // Coding zone — near PCs / monitors
  PC_FRONT: 'coding',
  PC_SIDE: 'coding',
  PC_FRONT_OFF: 'coding',
  MONITOR: 'coding',
  // Reading zone — near bookshelves & benches
  BOOKSHELF: 'reading',
  DOUBLE_BOOKSHELF: 'reading',
  CUSHIONED_BENCH: 'reading',
  // Research zone — near sofas & coffee table
  SOFA_FRONT: 'research',
  SOFA_BACK: 'research',
  SOFA_SIDE: 'research',
  COFFEE_TABLE: 'research',
};

// ── Tool → Zone mapping ────────────────────────────────────────

export const TOOL_ZONE: Record<string, ZoneType> = {
  // Coding tools — stay at desk
  Bash: 'coding',
  Write: 'coding',
  Edit: 'coding',
  // Reading tools — go to bookshelf / bench area
  Read: 'reading',
  Grep: 'reading',
  Glob: 'reading',
  // Research tools — go to sofa / lounge area
  WebSearch: 'research',
  WebFetch: 'research',
  Task: 'research',
  Agent: 'research',
};

export const DEFAULT_ZONE: ZoneType = 'coding';

/** Get the zone for a given tool name. */
export function getToolZone(tool: string): ZoneType {
  return TOOL_ZONE[tool] ?? DEFAULT_ZONE;
}

// ── Zone computation ────────────────────────────────────────────

/** 8-directional neighbour offsets */
const DIRS = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
];

/**
 * Compute activity zones by scanning layout furniture and finding
 * adjacent walkable tiles.
 *
 * Call once after layout is loaded / rebuilt.
 */
export function computeActivityZones(
  layout: OfficeLayout,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
): Record<ZoneType, ActivityZone> {
  const zones: Record<ZoneType, ActivityZone> = {
    coding: { tiles: [] },
    reading: { tiles: [] },
    research: { tiles: [] },
  };

  for (const item of layout.furniture) {
    // Resolve zone from furniture type prefix
    let zone: ZoneType | undefined;
    for (const [prefix, z] of Object.entries(FURNITURE_ZONE_MAP)) {
      // Strip rotation / mirror suffix (e.g. "SOFA_SIDE:left" → match "SOFA_SIDE")
      const baseType = item.type.split(':')[0];
      if (baseType === prefix || baseType.startsWith(prefix)) {
        zone = z;
        break;
      }
    }
    if (!zone) continue;

    const entry = getCatalogEntry(item.type);
    if (!entry) continue;

    // Collect walkable tiles adjacent to this furniture item
    const seen = new Set<string>();
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        for (const [dy, dx] of DIRS) {
          const col = item.col + dc + dx;
          const row = item.row + dr + dy;
          if (col < 0 || col >= layout.cols || row < 0 || row >= layout.rows) continue;
          const key = `${col},${row}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (isWalkable(col, row, tileMap, blockedTiles)) {
            zones[zone].tiles.push({ col, row });
          }
        }
      }
    }
  }

  return zones;
}
