/**
 * Canvas 2D renderer: tiles, z-sorted entities, bubbles.
 *
 * Ported from pixel-agents (MIT License).
 */

import {
  BUBBLE_FADE_DURATION_SEC,
  BUBBLE_SITTING_OFFSET_PX,
  BUBBLE_VERTICAL_OFFSET_PX,
  CHARACTER_SITTING_OFFSET_PX,
  CHARACTER_Z_SORT_OFFSET,
  FALLBACK_FLOOR_COLOR,
  HOVERED_OUTLINE_ALPHA,
  OUTLINE_Z_SORT_OFFSET,
  SELECTED_OUTLINE_ALPHA,
  WALL_COLOR,
} from '../pixelConstants';
import { getCachedSprite, getOutlineSprite } from '../sprites/pixelSpriteCache';
import {
  BUBBLE_PERMISSION_SPRITE,
  BUBBLE_WAITING_SPRITE,
  getCharacterSprites,
} from '../sprites/pixelSpriteData';
import type { Character, FurnitureInstance, SpriteData, TileType as TileTypeVal } from '../pixelTypes';
import { CharacterState, TILE_SIZE, TileType } from '../pixelTypes';
import { getCharacterSprite } from './pixelCharacters';
import { renderMatrixEffect } from './pixelMatrixEffect';

interface ZDrawable {
  zY: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

function renderTileGrid(
  ctx: CanvasRenderingContext2D,
  tileMap: TileTypeVal[][],
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const s = TILE_SIZE * zoom;
  const tmRows = tileMap.length;
  const tmCols = tmRows > 0 ? tileMap[0].length : 0;

  for (let r = 0; r < tmRows; r++) {
    for (let c = 0; c < tmCols; c++) {
      const tile = tileMap[r][c];

      if (tile === TileType.VOID) continue;

      if (tile === TileType.WALL) {
        ctx.fillStyle = WALL_COLOR;
      } else {
        // Use a warm floor color based on tile type
        const floorColors = ['#4A4A5C', '#3D3D4F', '#454558', '#424256', '#3F3F53', '#47475A', '#434357', '#404054', '#464659', '#444458'];
        ctx.fillStyle = floorColors[tile - 1] ?? FALLBACK_FLOOR_COLOR;
      }
      ctx.fillRect(offsetX + c * s, offsetY + r * s, s, s);
    }
  }
}

function renderScene(
  ctx: CanvasRenderingContext2D,
  furniture: FurnitureInstance[],
  characters: Character[],
  offsetX: number,
  offsetY: number,
  zoom: number,
  selectedAgentId: number | null,
  hoveredAgentId: number | null,
): void {
  const drawables: ZDrawable[] = [];

  for (const f of furniture) {
    const cached = getCachedSprite(f.sprite, zoom);
    const fx = offsetX + f.x * zoom;
    const fy = offsetY + f.y * zoom;
    if (f.mirrored) {
      drawables.push({
        zY: f.zY,
        draw: (c) => {
          c.save();
          c.translate(fx + cached.width, fy);
          c.scale(-1, 1);
          c.drawImage(cached, 0, 0);
          c.restore();
        },
      });
    } else {
      drawables.push({
        zY: f.zY,
        draw: (c) => {
          c.drawImage(cached, fx, fy);
        },
      });
    }
  }

  for (const ch of characters) {
    const sprites = getCharacterSprites(ch.palette, ch.hueShift);
    const spriteData = getCharacterSprite(ch, sprites);
    const cached = getCachedSprite(spriteData, zoom);
    const sittingOffset = ch.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0;
    const drawX = Math.round(offsetX + ch.x * zoom - cached.width / 2);
    const drawY = Math.round(offsetY + (ch.y + sittingOffset) * zoom - cached.height);
    const charZY = ch.y + TILE_SIZE / 2 + CHARACTER_Z_SORT_OFFSET;

    if (ch.matrixEffect) {
      const mDrawX = drawX;
      const mDrawY = drawY;
      const mSpriteData = spriteData;
      const mCh = ch;
      drawables.push({
        zY: charZY,
        draw: (c) => {
          renderMatrixEffect(c, mCh, mSpriteData, mDrawX, mDrawY, zoom);
        },
      });
      continue;
    }

    const isSelected = selectedAgentId !== null && ch.id === selectedAgentId;
    const isHovered = hoveredAgentId !== null && ch.id === hoveredAgentId;
    if (isSelected || isHovered) {
      const outlineAlpha = isSelected ? SELECTED_OUTLINE_ALPHA : HOVERED_OUTLINE_ALPHA;
      const outlineData = getOutlineSprite(spriteData);
      const outlineCached = getCachedSprite(outlineData, zoom);
      const olDrawX = drawX - zoom;
      const olDrawY = drawY - zoom;
      drawables.push({
        zY: charZY - OUTLINE_Z_SORT_OFFSET,
        draw: (c) => {
          c.save();
          c.globalAlpha = outlineAlpha;
          c.drawImage(outlineCached, olDrawX, olDrawY);
          c.restore();
        },
      });
    }

    drawables.push({
      zY: charZY,
      draw: (c) => {
        c.drawImage(cached, drawX, drawY);
      },
    });
  }

  drawables.sort((a, b) => a.zY - b.zY);

  for (const d of drawables) {
    d.draw(ctx);
  }
}

function renderBubbles(
  ctx: CanvasRenderingContext2D,
  characters: Character[],
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  for (const ch of characters) {
    if (!ch.bubbleType) continue;

    const sprite = ch.bubbleType === 'permission' ? BUBBLE_PERMISSION_SPRITE : BUBBLE_WAITING_SPRITE;

    let alpha = 1.0;
    if (ch.bubbleType === 'waiting' && ch.bubbleTimer < BUBBLE_FADE_DURATION_SEC) {
      alpha = ch.bubbleTimer / BUBBLE_FADE_DURATION_SEC;
    }

    const cached = getCachedSprite(sprite, zoom);
    const sittingOff = ch.state === CharacterState.TYPE ? BUBBLE_SITTING_OFFSET_PX : 0;
    const bubbleX = Math.round(offsetX + ch.x * zoom - cached.width / 2);
    const bubbleY = Math.round(
      offsetY + (ch.y + sittingOff - BUBBLE_VERTICAL_OFFSET_PX) * zoom - cached.height - 1 * zoom,
    );

    ctx.save();
    if (alpha < 1.0) ctx.globalAlpha = alpha;
    ctx.drawImage(cached, bubbleX, bubbleY);
    ctx.restore();
  }
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  tileMap: TileTypeVal[][],
  furniture: FurnitureInstance[],
  characters: Character[],
  zoom: number,
  panX: number,
  panY: number,
  selectedAgentId: number | null,
  hoveredAgentId: number | null,
): { offsetX: number; offsetY: number } {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const cols = tileMap.length > 0 ? tileMap[0].length : 0;
  const rows = tileMap.length;

  const mapW = cols * TILE_SIZE * zoom;
  const mapH = rows * TILE_SIZE * zoom;
  const offsetX = Math.floor((canvasWidth - mapW) / 2) + Math.round(panX);
  const offsetY = Math.floor((canvasHeight - mapH) / 2) + Math.round(panY);

  renderTileGrid(ctx, tileMap, offsetX, offsetY, zoom);
  renderScene(ctx, furniture, characters, offsetX, offsetY, zoom, selectedAgentId, hoveredAgentId);
  renderBubbles(ctx, characters, offsetX, offsetY, zoom);

  return { offsetX, offsetY };
}
