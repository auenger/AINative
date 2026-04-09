/**
 * Pixel Agent Observatory — Type definitions
 *
 * Ported from pixel-agents (MIT License).
 * Original: https://github.com/pablodelucca/pixel-agents
 */

import {
  DEFAULT_COLS,
  DEFAULT_ROWS,
  MATRIX_EFFECT_DURATION_SEC,
  TILE_SIZE,
} from './pixelConstants';

export { TILE_SIZE, DEFAULT_COLS, DEFAULT_ROWS, MATRIX_EFFECT_DURATION_SEC as MATRIX_EFFECT_DURATION };

export const TileType = {
  WALL: 0,
  FLOOR_1: 1,
  FLOOR_2: 2,
  FLOOR_3: 3,
  FLOOR_4: 4,
  FLOOR_5: 5,
  FLOOR_6: 6,
  FLOOR_7: 7,
  FLOOR_8: 8,
  FLOOR_9: 9,
  VOID: 255,
} as const;
export type TileType = (typeof TileType)[keyof typeof TileType];

export const CharacterState = {
  IDLE: 'idle',
  WALK: 'walk',
  TYPE: 'type',
} as const;
export type CharacterState = (typeof CharacterState)[keyof typeof CharacterState];

export const Direction = {
  DOWN: 0,
  LEFT: 1,
  RIGHT: 2,
  UP: 3,
} as const;
export type Direction = (typeof Direction)[keyof typeof Direction];

/** 2D array of hex color strings: '' = transparent, '#RRGGBB' = opaque */
export type SpriteData = string[][];

export interface Seat {
  uid: string;
  seatCol: number;
  seatRow: number;
  facingDir: Direction;
  assigned: boolean;
}

export interface FurnitureInstance {
  sprite: SpriteData;
  x: number;
  y: number;
  zY: number;
  mirrored?: boolean;
}

export interface FurnitureCatalogEntry {
  type: string;
  label: string;
  footprintW: number;
  footprintH: number;
  sprite: SpriteData;
  isDesk: boolean;
  category?: string;
  orientation?: string;
  canPlaceOnSurfaces?: boolean;
  backgroundTiles?: number;
  mirrorSide?: boolean;
}

export interface PlacedFurniture {
  uid: string;
  type: string;
  col: number;
  row: number;
}

export interface OfficeLayout {
  version: 1;
  cols: number;
  rows: number;
  tiles: TileType[];
  furniture: PlacedFurniture[];
  tileColors?: Array<ColorValue | null>;
  layoutRevision?: number;
}

export interface Character {
  id: number;
  state: CharacterState;
  dir: Direction;
  x: number;
  y: number;
  tileCol: number;
  tileRow: number;
  path: Array<{ col: number; row: number }>;
  moveProgress: number;
  currentTool: string | null;
  palette: number;
  hueShift: number;
  frame: number;
  frameTimer: number;
  wanderTimer: number;
  wanderCount: number;
  wanderLimit: number;
  isActive: boolean;
  seatId: string | null;
  bubbleType: 'permission' | 'waiting' | null;
  bubbleTimer: number;
  seatTimer: number;
  isSubagent: boolean;
  parentAgentId: number | null;
  matrixEffect: 'spawn' | 'despawn' | null;
  matrixEffectTimer: number;
  matrixEffectSeeds: number[];
  folderName?: string;
}

/** Agent status from the runtime monitor, mapped to pixel character states */
export type PixelAgentStatus =
  | 'typing'    // assistant message
  | 'reading'   // Read/Grep/Glob tool
  | 'writing'   // Write/Edit tool
  | 'command'   // Bash tool
  | 'processing' // tool_result
  | 'waiting'   // waiting for user input
  | 'idle'      // no activity > 30s
  | 'offline';  // session ended

/** Color value for tile/furniture customization */
export interface ColorValue {
  h: number;
  s: number;
  b: number;
  c: number;
  colorize?: boolean;
}
