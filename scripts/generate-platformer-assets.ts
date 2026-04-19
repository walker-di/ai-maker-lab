#!/usr/bin/env bun
/**
 * Procedural placeholder asset generator for the platformer experiment.
 *
 * Produces:
 *   - WAV-format SFX (short beeps with different pitches)
 *   - WAV-format music tracks (looping chord progressions)
 *
 * Output directory: apps/desktop-app/static/platformer/assets/
 *
 * Usage:
 *   bun scripts/generate-platformer-assets.ts
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSET_ROOT = join(ROOT, 'apps/desktop-app/static/platformer/assets');
const SFX_DIR = join(ASSET_ROOT, 'sfx');
const MUSIC_DIR = join(ASSET_ROOT, 'music');

const SAMPLE_RATE = 22_050;

function encodeWav(samples: Float32Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const numSamples = samples.length;
  const bytesPerSample = 2;
  const byteLength = 44 + numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);
  let offset = 0;
  function writeStr(s: string): void {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
    offset += s.length;
  }
  function writeUint32(v: number): void { view.setUint32(offset, v, true); offset += 4; }
  function writeUint16(v: number): void { view.setUint16(offset, v, true); offset += 2; }

  writeStr('RIFF');
  writeUint32(byteLength - 8);
  writeStr('WAVE');
  writeStr('fmt ');
  writeUint32(16);
  writeUint16(1);
  writeUint16(1);
  writeUint32(sampleRate);
  writeUint32(sampleRate * bytesPerSample);
  writeUint16(bytesPerSample);
  writeUint16(8 * bytesPerSample);
  writeStr('data');
  writeUint32(numSamples * bytesPerSample);

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Uint8Array(buffer);
}

function adsr(i: number, total: number, attack = 0.02, release = 0.15): number {
  const t = i / total;
  if (t < attack) return t / attack;
  if (t > 1 - release) return Math.max(0, (1 - t) / release);
  return 1;
}

function osc(t: number, freq: number, kind: 'sine' | 'square' | 'triangle' = 'sine'): number {
  const phase = (t * freq) % 1;
  switch (kind) {
    case 'square': return phase < 0.5 ? 1 : -1;
    case 'triangle': return 4 * Math.abs(phase - 0.5) - 1;
    case 'sine':
    default: return Math.sin(phase * Math.PI * 2);
  }
}

interface BeepSpec {
  durationMs: number;
  freqStart: number;
  freqEnd?: number;
  shape?: 'sine' | 'square' | 'triangle';
  amplitude?: number;
}

function renderBeep(spec: BeepSpec): Float32Array {
  const samples = Math.floor((spec.durationMs / 1000) * SAMPLE_RATE);
  const out = new Float32Array(samples);
  const shape = spec.shape ?? 'square';
  const amplitude = spec.amplitude ?? 0.6;
  const freqEnd = spec.freqEnd ?? spec.freqStart;
  for (let i = 0; i < samples; i++) {
    const t = i / SAMPLE_RATE;
    const ratio = i / samples;
    const f = spec.freqStart + (freqEnd - spec.freqStart) * ratio;
    out[i] = osc(t, f, shape) * adsr(i, samples) * amplitude;
  }
  return out;
}

function renderChord(durationMs: number, freqs: number[], shape: 'sine' | 'square' | 'triangle' = 'sine', amplitude = 0.18): Float32Array {
  const samples = Math.floor((durationMs / 1000) * SAMPLE_RATE);
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;
    for (const f of freqs) s += osc(t, f, shape);
    out[i] = (s / freqs.length) * adsr(i, samples, 0.05, 0.05) * amplitude;
  }
  return out;
}

function renderMusic(progression: number[][], stepMs = 600): Float32Array {
  const chunks = progression.map((freqs) => renderChord(stepMs, freqs));
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function writeWav(path: string, samples: Float32Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, encodeWav(samples));
  console.log(`wrote ${path} (${samples.length} samples)`);
}

const SFX: Record<string, BeepSpec> = {
  jump:          { durationMs: 180, freqStart: 440, freqEnd: 880, shape: 'square' },
  bump:          { durationMs: 80,  freqStart: 220, freqEnd: 110, shape: 'square' },
  coin:          { durationMs: 220, freqStart: 988, freqEnd: 1318, shape: 'sine' },
  powerUp:       { durationMs: 350, freqStart: 392, freqEnd: 988,  shape: 'square' },
  stomp:         { durationMs: 140, freqStart: 330, freqEnd: 110,  shape: 'square' },
  death:         { durationMs: 600, freqStart: 392, freqEnd: 130,  shape: 'triangle' },
  oneUp:         { durationMs: 480, freqStart: 523, freqEnd: 1046, shape: 'sine' },
  pause:         { durationMs: 120, freqStart: 660, freqEnd: 660,  shape: 'sine' },
  levelComplete: { durationMs: 700, freqStart: 523, freqEnd: 1568, shape: 'square' },
  gameOver:      { durationMs: 900, freqStart: 392, freqEnd: 65,   shape: 'triangle' },
  fireball:      { durationMs: 100, freqStart: 880, freqEnd: 1320, shape: 'square' },
};

// Frequencies in Hz, simple loops we can repeat.
const MUSIC: Record<string, number[][]> = {
  overworld: [
    [262, 330, 392], // C major
    [294, 370, 440], // D minor (close enough)
    [349, 440, 523], // F major
    [392, 494, 587], // G major
  ],
  underground: [
    [110, 165, 220], // A minor
    [98, 147, 196],  // G major
    [87, 130, 165],  // F major
    [82, 123, 165],  // E minor
  ],
};

await mkdir(ASSET_ROOT, { recursive: true });

for (const [id, spec] of Object.entries(SFX)) {
  const samples = renderBeep(spec);
  await writeWav(join(SFX_DIR, `${id}.wav`), samples);
}

for (const [id, progression] of Object.entries(MUSIC)) {
  const samples = renderMusic(progression, 600);
  await writeWav(join(MUSIC_DIR, `${id}.wav`), samples);
}

console.log('done');
