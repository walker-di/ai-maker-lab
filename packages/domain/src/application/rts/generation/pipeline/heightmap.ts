import {
  SeededRng,
  type AltitudeMap,
  type Generation,
} from '../../../../shared/rts/index.js';

interface NoiseGrid {
  cols: number;
  rows: number;
  data: number[];
}

function whiteNoise(rng: SeededRng, cols: number, rows: number): NoiseGrid {
  const data = new Array(cols * rows);
  for (let i = 0; i < data.length; i++) data[i] = rng.float();
  return { cols, rows, data };
}

function sampleSmooth(grid: NoiseGrid, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const get = (xi: number, yi: number) => {
    const cx = ((xi % grid.cols) + grid.cols) % grid.cols;
    const cy = ((yi % grid.rows) + grid.rows) % grid.rows;
    return grid.data[cy * grid.cols + cx]!;
  };
  const v00 = get(x0, y0);
  const v10 = get(x0 + 1, y0);
  const v01 = get(x0, y0 + 1);
  const v11 = get(x0 + 1, y0 + 1);
  const a = v00 + (v10 - v00) * sx;
  const b = v01 + (v11 - v01) * sx;
  return a + (b - a) * sy;
}

export function generateHeightmap(
  rng: SeededRng,
  size: { cols: number; rows: number },
  maxAltitude: number,
  roughness: Generation.AltitudeRoughness,
  amplitude: number,
): AltitudeMap {
  // Octaves and persistence per roughness.
  const profile = (() => {
    if (roughness === 'flat') return { octaves: 2, persistence: 0.4, baseFreq: 0.1 };
    if (roughness === 'rolling') return { octaves: 4, persistence: 0.5, baseFreq: 0.16 };
    return { octaves: 5, persistence: 0.6, baseFreq: 0.22 };
  })();

  const grids: NoiseGrid[] = [];
  for (let i = 0; i < profile.octaves; i++) {
    const oct = rng.fork(`octave-${i}`);
    grids.push(whiteNoise(oct, Math.max(4, Math.ceil(size.cols * profile.baseFreq * (i + 1))), Math.max(4, Math.ceil(size.rows * profile.baseFreq * (i + 1)))));
  }

  const levels: number[][] = [];
  for (let row = 0; row < size.rows; row++) {
    const line: number[] = [];
    for (let col = 0; col < size.cols; col++) {
      let total = 0;
      let amp = 1;
      let norm = 0;
      for (let i = 0; i < grids.length; i++) {
        const grid = grids[i]!;
        const fx = (col / size.cols) * grid.cols;
        const fy = (row / size.rows) * grid.rows;
        total += sampleSmooth(grid, fx, fy) * amp;
        norm += amp;
        amp *= profile.persistence;
      }
      const n = (total / norm) * amplitude;
      const lvl = Math.max(0, Math.min(maxAltitude, Math.round(n * (maxAltitude + 0.999))));
      line.push(lvl);
    }
    levels.push(line);
  }
  return { levels };
}
