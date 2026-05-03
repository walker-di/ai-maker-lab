export type RtsAtlasSheet = 'landscape' | 'towersGrey' | 'towersRed' | 'towersBrown';

export interface RtsAtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type RtsAtlasFrameMap = Readonly<Record<RtsAtlasSheet, Readonly<Record<string, RtsAtlasFrame>>>>;

export const RTS_ATLAS_URLS: Readonly<Record<RtsAtlasSheet, string>> = {
  landscape: '/rts/towerDefense/Spritesheet/landscape_sheet.png',
  towersGrey: '/rts/towerDefense/Spritesheet/towers_grey_sheet.png',
  towersRed: '/rts/towerDefense/Spritesheet/towers_red_sheet.png',
  towersBrown: '/rts/towerDefense/Spritesheet/towers_brown_sheet.png',
};

// Hand-pruned from Kenney Tower Defense XML atlases. Keeping only used frames
// avoids shipping XML parsing in the RTS runtime.
export const RTS_ATLAS_FRAMES: RtsAtlasFrameMap = {
  landscape: {
    'landscape_13.png': { x: 796, y: 214, w: 132, h: 99 },
    'landscape_22.png': { x: 928, y: 115, w: 132, h: 115 },
    'landscape_25.png': { x: 1192, y: 297, w: 132, h: 99 },
    'landscape_30.png': { x: 1456, y: 99, w: 132, h: 99 },
    'rocks_1.png': { x: 0, y: 0, w: 133, h: 99 },
    'rocks_2.png': { x: 0, y: 99, w: 133, h: 99 },
    'rocks_3.png': { x: 133, y: 0, w: 133, h: 102 },
    'rocks_4.png': { x: 133, y: 102, w: 133, h: 102 },
    'rocks_5.png': { x: 133, y: 204, w: 133, h: 99 },
    'rocks_6.png': { x: 133, y: 303, w: 133, h: 99 },
    'rocks_7.png': { x: 1588, y: 198, w: 132, h: 99 },
    'rocks_8.png': { x: 133, y: 402, w: 133, h: 99 },
    'crystals_1.png': { x: 1720, y: 198, w: 132, h: 112 },
    'crystals_2.png': { x: 1852, y: 114, w: 132, h: 121 },
    'crystals_3.png': { x: 0, y: 297, w: 133, h: 127 },
    'crystals_4.png': { x: 1852, y: 0, w: 132, h: 114 },
    'trees_1.png': { x: 266, y: 241, w: 133, h: 111 },
    'trees_2.png': { x: 399, y: 127, w: 133, h: 121 },
    'trees_3.png': { x: 266, y: 352, w: 133, h: 113 },
    'trees_4.png': { x: 399, y: 0, w: 133, h: 127 },
    'trees_5.png': { x: 1324, y: 99, w: 132, h: 126 },
    'trees_6.png': { x: 399, y: 248, w: 133, h: 124 },
    'trees_7.png': { x: 399, y: 372, w: 133, h: 121 },
    'trees_8.png': { x: 532, y: 0, w: 133, h: 118 },
    'trees_9.png': { x: 532, y: 118, w: 133, h: 116 },
    'trees_10.png': { x: 1456, y: 297, w: 132, h: 130 },
    'trees_11.png': { x: 266, y: 0, w: 133, h: 118 },
    'trees_12.png': { x: 266, y: 118, w: 133, h: 123 },
  },
  towersGrey: {
    'tower_00.png': { x: 187, y: 150, w: 89, h: 100 },
    'tower_07.png': { x: 0, y: 0, w: 103, h: 78 },
    'tower_15.png': { x: 447, y: 156, w: 79, h: 79 },
  },
  towersBrown: {
    'tower_15.png': { x: 365, y: 82, w: 87, h: 74 },
  },
  towersRed: {
    'tower_15.png': { x: 186, y: 306, w: 89, h: 74 },
  },
};

export interface RtsAtlasLoadResult {
  textures: Readonly<Record<RtsAtlasSheet, unknown>>;
  failed: boolean;
}

let loadPromise: Promise<RtsAtlasLoadResult> | null = null;

export async function loadRtsAtlases(): Promise<RtsAtlasLoadResult> {
  if (!loadPromise) {
    loadPromise = (async () => {
      const pixi = await import(/* @vite-ignore */ 'pixi.js') as { Assets: { load: (url: string) => Promise<unknown> } };
      const entries = await Promise.all(
        Object.entries(RTS_ATLAS_URLS).map(async ([sheet, url]) => {
          try {
            return [sheet, await pixi.Assets.load(url)] as const;
          } catch (_error) {
            return [sheet, null] as const;
          }
        }),
      );
      const textures = Object.fromEntries(entries) as Record<RtsAtlasSheet, unknown>;
      const failed = Object.values(textures).some((texture) => texture == null);
      return { textures, failed };
    })();
  }
  return loadPromise;
}

export function getSpriteFrame(sheet: RtsAtlasSheet, frameName: string): RtsAtlasFrame | null {
  return RTS_ATLAS_FRAMES[sheet][frameName] ?? null;
}
