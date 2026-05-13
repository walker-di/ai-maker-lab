import { describe, expect, it } from 'bun:test';
import {
  buildRibbonEdges,
  findRibbonIntersection,
  isLoopClosed,
} from './ribbon-geometry.js';
import { sampleCentripetal, type CenterlineCtrl } from './catmull-rom.js';

interface TrackFixture {
  halfWidth: number;
  samples: number;
  ctrl: CenterlineCtrl;
}

const TRACKS: Record<string, TrackFixture> = {
  'classic-twist': {
    halfWidth: 6.0,
    samples: 240,
    ctrl: [
      [0, 60], [50, 50], [70, 10], [60, -30], [30, -60],
      [-10, -55], [-30, -25], [-55, 0], [-50, 35], [-25, 55],
    ],
  },
  'lakeside-gp': {
    halfWidth: 7.0,
    samples: 280,
    ctrl: [
      [0, 90], [55, 85], [105, 55], [120, 5], [100, -45],
      [55, -75], [0, -82], [-55, -70], [-100, -40], [-115, 5],
      [-95, 55], [-50, 85],
    ],
  },
  'corkscrew-ridge': {
    halfWidth: 5.4,
    samples: 280,
    ctrl: [
      [0, 68], [38, 60], [62, 32], [72, -5], [58, -42],
      [22, -65], [-18, -65], [-52, -48], [-38, -22], [-58, 5],
      [-38, 28], [-55, 48],
    ],
  },
  'harbor-chicane': {
    halfWidth: 5.8,
    samples: 260,
    ctrl: [
      [-8, 70], [40, 72], [70, 55], [72, 20], [90, 0],
      [85, -30], [50, -55], [10, -60], [-25, -45], [-55, -20],
      [-80, 0], [-78, 35], [-50, 62],
    ],
  },
  'desert-bowl': {
    halfWidth: 7.6,
    samples: 300,
    ctrl: [
      [0, 110], [70, 95], [120, 55], [130, 0], [120, -55],
      [70, -95], [30, -100], [0, -90], [-30, -100], [-70, -95],
      [-120, -55], [-130, 0], [-120, 55], [-70, 95],
    ],
  },
  'forest-loop': {
    halfWidth: 6.2,
    samples: 280,
    ctrl: [
      [0, 90], [40, 78], [75, 35], [80, -5], [70, -50],
      [30, -80], [-15, -82], [-55, -55], [-75, -15], [-65, 20],
      [-80, 55], [-45, 85],
    ],
  },
};

describe('track presets are closed and non-self-intersecting', () => {
  for (const [key, preset] of Object.entries(TRACKS)) {
    it(`track "${key}" samples a closed loop`, () => {
      const pts = sampleCentripetal(preset.ctrl, preset.samples);
      expect(pts.length).toBe(preset.samples);
      expect(isLoopClosed(pts)).toBe(true);
    });

    it(`track "${key}" has no self-intersecting asphalt edges`, () => {
      const pts = sampleCentripetal(preset.ctrl, preset.samples);
      const err = findRibbonIntersection(pts, preset.halfWidth, key);
      if (err) console.log('  ' + err);
      expect(err).toBeNull();
    });

    it(`track "${key}" produces matched left and right edge counts`, () => {
      const pts = sampleCentripetal(preset.ctrl, preset.samples);
      const edges = buildRibbonEdges(pts, preset.halfWidth);
      expect(edges.left.length).toBe(pts.length);
      expect(edges.right.length).toBe(pts.length);
    });
  }
});
