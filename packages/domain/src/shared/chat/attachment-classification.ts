import type { AttachmentClassification } from './chat-types.js';
import type { ModelInputPolicy, ModalityInputPolicy } from './model-input-policy.js';

const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/tiff',
  'image/bmp',
]);

const PDF_MIMES = new Set([
  'application/pdf',
]);

const VIDEO_MIMES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
]);

const TEXT_MIMES = new Set([
  'text/plain',
  'text/csv',
  'text/markdown',
  'text/html',
  'text/css',
  'text/javascript',
  'application/json',
  'application/xml',
  'application/x-yaml',
  'application/yaml',
]);

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.csv', '.json', '.yaml', '.yml', '.xml',
  '.html', '.css', '.js', '.ts', '.jsx', '.tsx', '.svelte',
  '.py', '.rb', '.rs', '.go', '.java', '.kt', '.swift',
  '.c', '.cpp', '.h', '.hpp', '.sh', '.bash', '.zsh',
  '.toml', '.ini', '.cfg', '.env', '.log', '.sql',
]);

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.heic', '.heif', '.avif', '.tif', '.tiff', '.bmp',
]);

const PDF_EXTENSIONS = new Set(['.pdf']);

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.webm', '.mov', '.avi',
]);

export function classifyMimeType(mimeType: string, fileName: string): AttachmentClassification {
  const normalized = mimeType.toLowerCase().trim();

  if (IMAGE_MIMES.has(normalized)) return 'image';
  if (PDF_MIMES.has(normalized)) return 'pdf';
  if (VIDEO_MIMES.has(normalized)) return 'video';
  if (TEXT_MIMES.has(normalized)) return 'text';

  if (normalized.startsWith('text/')) return 'text';

  const ext = extractExtension(fileName);
  if (ext && IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (ext && PDF_EXTENSIONS.has(ext)) return 'pdf';
  if (ext && VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (ext && TEXT_EXTENSIONS.has(ext)) return 'text';

  return 'unsupported';
}

export function classificationToModality(
  classification: AttachmentClassification,
): keyof ModelInputPolicy {
  switch (classification) {
    case 'text': return 'text';
    case 'image': return 'image';
    case 'pdf': return 'pdf';
    case 'video': return 'video';
    case 'unsupported': return 'file';
  }
}

export function getModalityPolicy(
  inputPolicy: ModelInputPolicy,
  classification: AttachmentClassification,
): ModalityInputPolicy {
  const modality = classificationToModality(classification);
  return inputPolicy[modality];
}

function extractExtension(fileName: string): string | null {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot < 0) return null;
  return fileName.slice(lastDot).toLowerCase();
}
