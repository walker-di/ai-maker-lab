#!/usr/bin/env bun
/**
 * Procedural placeholder sprite generator for the platformer experiment.
 *
 * Renders simple shapes (rect, roundRect, circle, triangle) in solid colors
 * to PNG files, matching the tile/entity tints declared in
 * `DEFAULT_BUNDLE` in `packages/ui/src/lib/platformer/engine/assets.ts`.
 *
 * Output directory: apps/desktop-app/static/platformer/assets/sprites/
 *
 * Usage:
 *   bun scripts/generate-platformer-sprites.ts
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, crc32 } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'apps/desktop-app/static/platformer/assets/sprites');

type Shape = 'rect' | 'roundRect' | 'circle' | 'triangle';

interface SpriteSpec {
  name: string;
  width: number;
  height: number;
  shape: Shape;
  /** 0xRRGGBB tint. */
  tint: number;
}

const TILES: SpriteSpec[] = [
  { name: 'tile-empty',     width: 16, height: 16, shape: 'rect',      tint: 0x000000 },
  { name: 'tile-ground',    width: 16, height: 16, shape: 'rect',      tint: 0x8b5a2b },
  { name: 'tile-brick',     width: 16, height: 16, shape: 'rect',      tint: 0xc97a4a },
  { name: 'tile-question',  width: 16, height: 16, shape: 'rect',      tint: 0xf5b133 },
  { name: 'tile-hardBlock', width: 16, height: 16, shape: 'rect',      tint: 0x6e6e6e },
  { name: 'tile-pipeTop',   width: 16, height: 16, shape: 'roundRect', tint: 0x2a9d3a },
  { name: 'tile-pipeBody',  width: 16, height: 16, shape: 'rect',      tint: 0x2a9d3a },
  { name: 'tile-flagPole',  width: 16, height: 16, shape: 'rect',      tint: 0xefefef },
  { name: 'tile-flagBase',  width: 16, height: 16, shape: 'rect',      tint: 0x4a4a4a },
  { name: 'tile-coinTile',  width: 16, height: 16, shape: 'circle',    tint: 0xf5d033 },
  { name: 'tile-hazard',    width: 16, height: 16, shape: 'triangle',  tint: 0xc23030 },
];

const ENTITIES: SpriteSpec[] = [
  { name: 'entity-player',         width: 14, height: 16, shape: 'roundRect', tint: 0x3273dc },
  { name: 'entity-walkerEnemy',    width: 14, height: 14, shape: 'roundRect', tint: 0xa44a3f },
  { name: 'entity-shellEnemy',     width: 14, height: 12, shape: 'roundRect', tint: 0x2dbe60 },
  { name: 'entity-flyingEnemy',    width: 14, height: 14, shape: 'triangle',  tint: 0xc73fb7 },
  { name: 'entity-fireBar',        width: 12, height: 12, shape: 'circle',    tint: 0xff7a00 },
  { name: 'entity-bulletShooter',  width: 14, height: 16, shape: 'rect',      tint: 0x444444 },
  { name: 'entity-coin',           width: 10, height: 12, shape: 'circle',    tint: 0xf5d033 },
  { name: 'entity-mushroom',       width: 14, height: 14, shape: 'roundRect', tint: 0xff5a5a },
  { name: 'entity-flower',         width: 14, height: 14, shape: 'circle',    tint: 0xff9a3f },
  { name: 'entity-star',           width: 14, height: 14, shape: 'triangle',  tint: 0xfff066 },
  { name: 'entity-oneUp',          width: 14, height: 14, shape: 'roundRect', tint: 0x33d27e },
  { name: 'entity-platformMoving', width: 32, height: 8,  shape: 'rect',      tint: 0xc8c8c8 },
  { name: 'entity-spring',         width: 14, height: 8,  shape: 'rect',      tint: 0x9e9e9e },
  { name: 'entity-fireball',       width: 8,  height: 8,  shape: 'circle',    tint: 0xff5a00 },
  { name: 'entity-bullet',         width: 10, height: 6,  shape: 'rect',      tint: 0x222222 },
];

function rasterize(spec: SpriteSpec): Uint8Array {
  // RGBA buffer, fully transparent by default.
  const { width, height, shape, tint } = spec;
  const r = (tint >> 16) & 0xff;
  const g = (tint >> 8) & 0xff;
  const b = tint & 0xff;
  const px = new Uint8Array(width * height * 4);

  function setPixel(x: number, y: number, alpha = 255): void {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = alpha;
  }

  switch (shape) {
    case 'rect':
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) setPixel(x, y);
      break;
    case 'roundRect': {
      const radius = Math.floor(Math.min(width, height) * 0.25);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const inX = x >= radius && x < width - radius;
          const inY = y >= radius && y < height - radius;
          if (inX || inY) {
            setPixel(x, y);
          } else {
            const cx = x < radius ? radius : width - radius - 1;
            const cy = y < radius ? radius : height - radius - 1;
            const dx = x - cx;
            const dy = y - cy;
            if (dx * dx + dy * dy <= radius * radius) setPixel(x, y);
          }
        }
      }
      break;
    }
    case 'circle': {
      const cx = (width - 1) / 2;
      const cy = (height - 1) / 2;
      const rr = Math.min(width, height) / 2;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy <= rr * rr) setPixel(x, y);
        }
      }
      break;
    }
    case 'triangle': {
      for (let y = 0; y < height; y++) {
        const t = y / (height - 1 || 1);
        const halfWidth = (t * width) / 2;
        const xStart = Math.floor(width / 2 - halfWidth);
        const xEnd = Math.ceil(width / 2 + halfWidth);
        for (let x = xStart; x < xEnd; x++) setPixel(x, y);
      }
      break;
    }
  }
  return px;
}

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type: string, data: Uint8Array): Uint8Array {
  const length = data.length;
  const out = new Uint8Array(8 + length + 4);
  const view = new DataView(out.buffer);
  view.setUint32(0, length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crcInput = new Uint8Array(4 + length);
  for (let i = 0; i < 4; i++) crcInput[i] = type.charCodeAt(i);
  crcInput.set(data, 4);
  view.setUint32(8 + length, crc32(crcInput));
  return out;
}

function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const filtered = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    filtered[y * (stride + 1)] = 0;
    filtered.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const compressed = new Uint8Array(deflateSync(filtered));
  const iend = new Uint8Array(0);

  const chunks = [chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', iend)];
  const total = PNG_MAGIC.length + chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  out.set(PNG_MAGIC, 0);
  let offset = PNG_MAGIC.length;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

async function writeSprite(spec: SpriteSpec): Promise<void> {
  const rgba = rasterize(spec);
  const png = encodePng(spec.width, spec.height, rgba);
  const path = join(OUT_DIR, `${spec.name}.png`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, png);
  console.log(`wrote ${path}`);
}

await mkdir(OUT_DIR, { recursive: true });
for (const spec of [...TILES, ...ENTITIES]) await writeSprite(spec);
console.log('done');
