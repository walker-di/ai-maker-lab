import { describe, expect, test } from 'bun:test';
import {
  classifyMimeType,
  classificationToModality,
  getModalityPolicy,
} from './attachment-classification.js';
import { DEFAULT_INPUT_POLICY, VIDEO_CAPABLE_INPUT_POLICY } from './model-input-policy.js';

describe('classifyMimeType', () => {
  test('classifies image types', () => {
    expect(classifyMimeType('image/jpeg', 'photo.jpg')).toBe('image');
    expect(classifyMimeType('image/png', 'screenshot.png')).toBe('image');
    expect(classifyMimeType('image/gif', 'anim.gif')).toBe('image');
    expect(classifyMimeType('image/webp', 'pic.webp')).toBe('image');
    expect(classifyMimeType('image/svg+xml', 'icon.svg')).toBe('image');
    expect(classifyMimeType('image/heic', 'photo.heic')).toBe('image');
    expect(classifyMimeType('image/avif', 'photo.avif')).toBe('image');
  });

  test('classifies pdf', () => {
    expect(classifyMimeType('application/pdf', 'doc.pdf')).toBe('pdf');
  });

  test('classifies video types', () => {
    expect(classifyMimeType('video/mp4', 'clip.mp4')).toBe('video');
    expect(classifyMimeType('video/webm', 'clip.webm')).toBe('video');
    expect(classifyMimeType('video/quicktime', 'clip.mov')).toBe('video');
  });

  test('classifies text mime types', () => {
    expect(classifyMimeType('text/plain', 'notes.txt')).toBe('text');
    expect(classifyMimeType('text/csv', 'data.csv')).toBe('text');
    expect(classifyMimeType('application/json', 'config.json')).toBe('text');
    expect(classifyMimeType('application/yaml', 'config.yaml')).toBe('text');
  });

  test('classifies by extension when mime is generic', () => {
    expect(classifyMimeType('application/octet-stream', 'script.py')).toBe('text');
    expect(classifyMimeType('application/octet-stream', 'code.ts')).toBe('text');
    expect(classifyMimeType('application/octet-stream', 'file.sql')).toBe('text');
    expect(classifyMimeType('application/octet-stream', 'screen-shot.png')).toBe('image');
    expect(classifyMimeType('application/octet-stream', 'capture.heic')).toBe('image');
  });

  test('classifies text/* subtypes', () => {
    expect(classifyMimeType('text/x-python', 'script.py')).toBe('text');
  });

  test('returns unsupported for unknown types', () => {
    expect(classifyMimeType('application/octet-stream', 'archive.bin')).toBe('unsupported');
    expect(classifyMimeType('application/zip', 'file.zip')).toBe('unsupported');
  });
});

describe('classificationToModality', () => {
  test('maps classifications to policy modality keys', () => {
    expect(classificationToModality('text')).toBe('text');
    expect(classificationToModality('image')).toBe('image');
    expect(classificationToModality('pdf')).toBe('pdf');
    expect(classificationToModality('video')).toBe('video');
    expect(classificationToModality('unsupported')).toBe('file');
  });
});

describe('getModalityPolicy', () => {
  test('returns pass-through for supported modalities', () => {
    const policy = getModalityPolicy(DEFAULT_INPUT_POLICY, 'image');
    expect(policy.outcome).toBe('pass-through');
  });

  test('returns reject for video in default policy', () => {
    const policy = getModalityPolicy(DEFAULT_INPUT_POLICY, 'video');
    expect(policy.outcome).toBe('reject');
  });

  test('returns pass-through for video in video-capable policy', () => {
    const policy = getModalityPolicy(VIDEO_CAPABLE_INPUT_POLICY, 'video');
    expect(policy.outcome).toBe('pass-through');
  });

  test('returns file policy for unsupported classification', () => {
    const policy = getModalityPolicy(DEFAULT_INPUT_POLICY, 'unsupported');
    expect(policy.outcome).toBe('pass-through');
  });
});
