/**
 * Simplified furniture catalog for the pixel office.
 *
 * Uses hardcoded furniture sprite data instead of the full PNG-based asset loading pipeline.
 * This provides the essential furniture needed for the default office layout.
 */

import type { FurnitureCatalogEntry, SpriteData } from '../pixelTypes';

function emptySprite(w: number, h: number): SpriteData {
  return Array.from({ length: h }, () => new Array(w).fill(''));
}

function rectSprite(w: number, h: number, color: string): SpriteData {
  return Array.from({ length: h }, () => new Array(w).fill(color));
}

// -- Furniture sprite definitions (simplified pixel art) --

const DESK_COLOR = '#8B7355';
const DESK_TOP_COLOR = '#A0896C';
const CHAIR_COLOR = '#6B5B4F';
const CHAIR_BACK_COLOR = '#5A4A3F';
const PC_COLOR = '#333344';
const PC_SCREEN_OFF = '#222233';
const PC_SCREEN_ON = '#4488CC';
const BOOKSHELF_COLOR = '#7A6B5A';
const PLANT_POT_COLOR = '#8B6B4F';
const PLANT_GREEN = '#4A8B4A';
const SOFA_COLOR = '#6B6B8B';
const BIN_COLOR = '#666677';
const COFFEE_COLOR = '#8B6B3F';
const SMALL_TABLE_COLOR = '#7B6B55';

function makeDeskSprite(): SpriteData {
  const s = emptySprite(16, 24);
  // Top surface
  for (let r = 0; r < 4; r++) {
    for (let c = 2; c < 14; c++) {
      s[r][c] = DESK_TOP_COLOR;
    }
  }
  // Front panel
  for (let r = 4; r < 16; r++) {
    for (let c = 2; c < 14; c++) {
      s[r][c] = DESK_COLOR;
    }
  }
  // Legs
  for (let r = 16; r < 24; r++) {
    s[r][2] = DESK_COLOR;
    s[r][3] = DESK_COLOR;
    s[r][12] = DESK_COLOR;
    s[r][13] = DESK_COLOR;
  }
  return s;
}

function makeChairFrontSprite(): SpriteData {
  const s = emptySprite(16, 24);
  // Seat
  for (let r = 14; r < 18; r++) {
    for (let c = 4; c < 12; c++) {
      s[r][c] = CHAIR_COLOR;
    }
  }
  // Legs
  for (let r = 18; r < 24; r++) {
    s[r][4] = CHAIR_COLOR;
    s[r][5] = CHAIR_COLOR;
    s[r][10] = CHAIR_COLOR;
    s[r][11] = CHAIR_COLOR;
  }
  return s;
}

function makeChairSideSprite(): SpriteData {
  const s = emptySprite(16, 24);
  // Seat
  for (let r = 14; r < 18; r++) {
    for (let c = 5; c < 11; c++) {
      s[r][c] = CHAIR_COLOR;
    }
  }
  // Legs
  for (let r = 18; r < 24; r++) {
    s[r][5] = CHAIR_COLOR;
    s[r][6] = CHAIR_COLOR;
    s[r][9] = CHAIR_COLOR;
    s[r][10] = CHAIR_COLOR;
  }
  return s;
}

function makeChairBackSprite(): SpriteData {
  const s = makeChairFrontSprite();
  // Back rest
  for (let r = 6; r < 14; r++) {
    for (let c = 4; c < 12; c++) {
      s[r][c] = CHAIR_BACK_COLOR;
    }
  }
  return s;
}

function makePCFrontOffSprite(): SpriteData {
  const s = emptySprite(16, 32);
  // Monitor
  for (let r = 0; r < 12; r++) {
    for (let c = 2; c < 14; c++) {
      s[r][c] = PC_COLOR;
    }
  }
  // Screen (off)
  for (let r = 2; r < 10; r++) {
    for (let c = 4; c < 12; c++) {
      s[r][c] = PC_SCREEN_OFF;
    }
  }
  // Stand
  for (let r = 12; r < 16; r++) {
    s[r][7] = PC_COLOR;
    s[r][8] = PC_COLOR;
  }
  // Base
  for (let r = 16; r < 18; r++) {
    for (let c = 5; c < 11; c++) {
      s[r][c] = PC_COLOR;
    }
  }
  return s;
}

function makePCFrontOnSprite(): SpriteData {
  const s = makePCFrontOffSprite();
  for (let r = 2; r < 10; r++) {
    for (let c = 4; c < 12; c++) {
      s[r][c] = PC_SCREEN_ON;
    }
  }
  return s;
}

function makePCSideSprite(): SpriteData {
  const s = emptySprite(16, 32);
  for (let r = 0; r < 12; r++) {
    for (let c = 4; c < 10; c++) {
      s[r][c] = PC_COLOR;
    }
  }
  for (let r = 2; r < 10; r++) {
    for (let c = 5; c < 9; c++) {
      s[r][c] = PC_SCREEN_OFF;
    }
  }
  for (let r = 12; r < 16; r++) {
    s[r][6] = PC_COLOR;
    s[r][7] = PC_COLOR;
  }
  for (let r = 16; r < 18; r++) {
    for (let c = 5; c < 9; c++) {
      s[r][c] = PC_COLOR;
    }
  }
  return s;
}

function makePCBackSprite(): SpriteData {
  return rectSprite(16, 32, '#444455');
}

function makeBookshelfSprite(): SpriteData {
  const s = rectSprite(16, 32, BOOKSHELF_COLOR);
  // Shelves
  for (let r of [10, 20]) {
    for (let c = 0; c < 16; c++) {
      s[r][c] = '#6A5B4A';
    }
  }
  // Books
  const bookColors = ['#CC4444', '#44CC44', '#4444CC', '#CCCC44', '#CC44CC'];
  for (let shelf = 0; shelf < 2; shelf++) {
    for (let c = 1; c < 15; c += 3) {
      const color = bookColors[(shelf * 5 + c) % bookColors.length];
      for (let r = shelf * 10 + 1; r < shelf * 10 + 9; r++) {
        s[r][c] = color;
        s[r][c + 1] = color;
      }
    }
  }
  return s;
}

function makePlantSprite(): SpriteData {
  const s = emptySprite(16, 24);
  // Pot
  for (let r = 18; r < 24; r++) {
    for (let c = 5; c < 11; c++) {
      s[r][c] = PLANT_POT_COLOR;
    }
  }
  // Greenery
  for (let r = 2; r < 18; r++) {
    for (let c = 4; c < 12; c++) {
      const dist = Math.abs(c - 8) + Math.abs(r - 10);
      if (dist < 8) s[r][c] = PLANT_GREEN;
    }
  }
  return s;
}

function makeSofaSprite(): SpriteData {
  const s = rectSprite(16, 16, SOFA_COLOR);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 16; c++) {
      s[r][c] = '#5B5B7B';
    }
  }
  return s;
}

function makeSmallTableSprite(): SpriteData {
  const s = emptySprite(16, 16);
  for (let r = 0; r < 4; r++) {
    for (let c = 2; c < 14; c++) {
      s[r][c] = SMALL_TABLE_COLOR;
    }
  }
  for (let r = 4; r < 14; r++) {
    s[r][2] = SMALL_TABLE_COLOR;
    s[r][3] = SMALL_TABLE_COLOR;
    s[r][12] = SMALL_TABLE_COLOR;
    s[r][13] = SMALL_TABLE_COLOR;
  }
  return s;
}

function makeBinSprite(): SpriteData {
  return rectSprite(16, 16, BIN_COLOR);
}

function makeCoffeeSprite(): SpriteData {
  const s = emptySprite(8, 8);
  for (let r = 2; r < 6; r++) {
    for (let c = 1; c < 6; c++) {
      s[r][c] = COFFEE_COLOR;
    }
  }
  s[2][6] = '#AAAAAA';
  s[3][6] = '#AAAAAA';
  s[4][6] = '#AAAAAA';
  return s;
}

function makeHangingPlantSprite(): SpriteData {
  const s = emptySprite(16, 16);
  for (let r = 0; r < 8; r++) {
    for (let c = 3; c < 13; c++) {
      const dist = Math.abs(c - 8) + Math.abs(r - 4);
      if (dist < 6) s[r][c] = PLANT_GREEN;
    }
  }
  return s;
}

function makeClockSprite(): SpriteData {
  const s = emptySprite(16, 16);
  for (let r = 2; r < 14; r++) {
    for (let c = 2; c < 14; c++) {
      const dist = Math.sqrt((c - 8) ** 2 + (r - 8) ** 2);
      if (dist < 6) {
        s[r][c] = '#EEEEEE';
      } else if (dist < 7) {
        s[r][c] = '#555566';
      }
    }
  }
  // Hands
  s[7][8] = '#333333';
  s[6][8] = '#333333';
  s[8][9] = '#333333';
  return s;
}

function makePaintingSprite(): SpriteData {
  const s = emptySprite(16, 16);
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      if (r === 0 || r === 15 || c === 0 || c === 15) {
        s[r][c] = '#8B7355';
      } else {
        s[r][c] = '#6688AA';
      }
    }
  }
  return s;
}

function makeBenchSprite(): SpriteData {
  const s = rectSprite(16, 16, CHAIR_COLOR);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 16; c++) {
      s[r][c] = CHAIR_BACK_COLOR;
    }
  }
  return s;
}

// -- Catalog --

const catalogEntries = new Map<string, FurnitureCatalogEntry>();

function register(id: string, label: string, sprite: SpriteData, opts: Partial<FurnitureCatalogEntry> = {}): void {
  catalogEntries.set(id, {
    type: id,
    label,
    footprintW: opts.footprintW ?? 1,
    footprintH: opts.footprintH ?? 1,
    sprite,
    isDesk: opts.isDesk ?? false,
    category: opts.category ?? 'misc',
    orientation: opts.orientation,
    canPlaceOnSurfaces: opts.canPlaceOnSurfaces,
    backgroundTiles: opts.backgroundTiles,
    mirrorSide: opts.mirrorSide,
  });
}

// Register all furniture types used in the default layout
register('DESK_FRONT', 'Desk (Front)', makeDeskSprite(), { isDesk: true, category: 'desks', footprintH: 2, backgroundTiles: 1 });
register('DESK_SIDE', 'Desk (Side)', makeDeskSprite(), { isDesk: true, category: 'desks', footprintH: 2, backgroundTiles: 1 });
register('TABLE_FRONT', 'Table (Front)', makeDeskSprite(), { isDesk: true, category: 'desks', footprintH: 2, backgroundTiles: 1 });
register('SMALL_TABLE_FRONT', 'Small Table (Front)', makeSmallTableSprite(), { isDesk: true, category: 'desks' });
register('SMALL_TABLE_SIDE', 'Small Table (Side)', makeSmallTableSprite(), { isDesk: true, category: 'desks' });
register('COFFEE_TABLE', 'Coffee Table', makeSmallTableSprite(), { isDesk: true, category: 'desks' });

register('WOODEN_CHAIR_SIDE', 'Wooden Chair (Side)', makeChairSideSprite(), { category: 'chairs', orientation: 'side' });
register('WOODEN_CHAIR_FRONT', 'Wooden Chair (Front)', makeChairFrontSprite(), { category: 'chairs', orientation: 'front' });
register('WOODEN_CHAIR_BACK', 'Wooden Chair (Back)', makeChairBackSprite(), { category: 'chairs', orientation: 'back' });
register('CUSHIONED_BENCH', 'Cushioned Bench', makeBenchSprite(), { category: 'chairs', orientation: 'front', footprintH: 2, backgroundTiles: 1 });
register('SOFA_FRONT', 'Sofa (Front)', makeSofaSprite(), { category: 'chairs', orientation: 'front' });
register('SOFA_BACK', 'Sofa (Back)', makeSofaSprite(), { category: 'chairs', orientation: 'back' });
register('SOFA_SIDE', 'Sofa (Side)', makeSofaSprite(), { category: 'chairs', orientation: 'side' });

register('PC_FRONT_OFF', 'PC (Front, Off)', makePCFrontOffSprite(), { category: 'electronics', footprintH: 2, backgroundTiles: 1, canPlaceOnSurfaces: true });
register('PC_FRONT_ON', 'PC (Front, On)', makePCFrontOnSprite(), { category: 'electronics', footprintH: 2, backgroundTiles: 1, canPlaceOnSurfaces: true });
register('PC_FRONT_ON_1', 'PC (Front, On 1)', makePCFrontOnSprite(), { category: 'electronics', footprintH: 2, backgroundTiles: 1, canPlaceOnSurfaces: true });
register('PC_FRONT_ON_2', 'PC (Front, On 2)', makePCFrontOnSprite(), { category: 'electronics', footprintH: 2, backgroundTiles: 1, canPlaceOnSurfaces: true });
register('PC_FRONT_ON_3', 'PC (Front, On 3)', makePCFrontOnSprite(), { category: 'electronics', footprintH: 2, backgroundTiles: 1, canPlaceOnSurfaces: true });
register('PC_SIDE', 'PC (Side)', makePCSideSprite(), { category: 'electronics', footprintH: 2, backgroundTiles: 1, canPlaceOnSurfaces: true, orientation: 'side', mirrorSide: true });
register('PC_SIDE:left', 'PC (Side, Left)', makePCSideSprite(), { category: 'electronics', footprintH: 2, backgroundTiles: 1, canPlaceOnSurfaces: true, orientation: 'left' });
register('PC_BACK', 'PC (Back)', makePCBackSprite(), { category: 'electronics', footprintH: 2, backgroundTiles: 1, orientation: 'back' });

register('BOOKSHELF', 'Bookshelf', makeBookshelfSprite(), { category: 'storage' });
register('DOUBLE_BOOKSHELF', 'Double Bookshelf', makeBookshelfSprite(), { category: 'storage' });

register('PLANT', 'Plant', makePlantSprite(), { category: 'decor' });
register('PLANT_2', 'Plant 2', makePlantSprite(), { category: 'decor' });
register('HANGING_PLANT', 'Hanging Plant', makeHangingPlantSprite(), { category: 'decor' });
register('CACTUS', 'Cactus', makePlantSprite(), { category: 'decor' });

register('SOFA_SIDE:left', 'Sofa (Side, Left)', makeSofaSprite(), { category: 'chairs', orientation: 'left' });
register('BIN', 'Bin', makeBinSprite(), { category: 'misc' });
register('COFFEE', 'Coffee', makeCoffeeSprite(), { category: 'misc', canPlaceOnSurfaces: true });
register('CLOCK', 'Clock', makeClockSprite(), { category: 'decor', canPlaceOnSurfaces: true });
register('SMALL_PAINTING', 'Small Painting', makePaintingSprite(), { category: 'decor' });
register('SMALL_PAINTING_2', 'Small Painting 2', makePaintingSprite(), { category: 'decor' });
register('LARGE_PAINTING', 'Large Painting', makePaintingSprite(), { category: 'decor' });

register('POT', 'Pot', makePlantSprite(), { category: 'decor' });
register('WHITEBOARD', 'Whiteboard', makePaintingSprite(), { category: 'misc' });

export function getCatalogEntry(type: string): FurnitureCatalogEntry | null {
  return catalogEntries.get(type) ?? null;
}

export function getOnStateType(type: string): string {
  // For PC types, return the ON variant
  if (type === 'PC_FRONT_OFF') return 'PC_FRONT_ON';
  return type;
}

export function getAnimationFrames(type: string): string[] | null {
  if (type === 'PC_FRONT_ON') {
    return ['PC_FRONT_ON_1', 'PC_FRONT_ON_2', 'PC_FRONT_ON_3'];
  }
  return null;
}

export function getOrientationInGroup(type: string): string {
  if (type.endsWith(':left')) return 'left';
  if (type.includes('_SIDE')) return 'side';
  if (type.includes('_BACK')) return 'back';
  if (type.includes('_FRONT')) return 'front';
  return 'front';
}
