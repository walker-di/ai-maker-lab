import type { AttachmentClassification } from './types.js';
export { resolveHostedTools } from './tool-invocation-presentation.js';

export interface PendingAttachment {
	readonly localId: string;
	readonly file: File;
	readonly name: string;
	readonly mimeType: string;
	readonly size: number;
	readonly classification: AttachmentClassification;
}

let nextLocalId = 0;
function generateLocalId(): string {
	return `pending-${++nextLocalId}-${Date.now()}`;
}

// Browser-safe mirror of domain/shared/chat/attachment-classification.classifyMimeType.
// `packages/ui` cannot depend on `packages/domain`; keep these tables in sync with
// `packages/domain/src/shared/chat/attachment-classification.ts`.
const IMAGE_MIMES = new Set([
	'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
	'image/heic', 'image/heif', 'image/avif', 'image/tiff', 'image/bmp',
]);
const PDF_MIMES = new Set(['application/pdf']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']);
const TEXT_MIMES = new Set([
	'text/plain', 'text/csv', 'text/markdown', 'text/html', 'text/css', 'text/javascript',
	'application/json', 'application/xml', 'application/x-yaml', 'application/yaml',
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

function classifyFile(file: File): AttachmentClassification {
	const mime = file.type.toLowerCase().trim();
	if (IMAGE_MIMES.has(mime)) return 'image';
	if (PDF_MIMES.has(mime)) return 'pdf';
	if (VIDEO_MIMES.has(mime)) return 'video';
	if (TEXT_MIMES.has(mime)) return 'text';
	if (mime.startsWith('text/')) return 'text';

	const ext = file.name.includes('.') ? `.${file.name.split('.').pop()!.toLowerCase()}` : '';
	if (IMAGE_EXTENSIONS.has(ext)) return 'image';
	if (PDF_EXTENSIONS.has(ext)) return 'pdf';
	if (TEXT_EXTENSIONS.has(ext)) return 'text';

	return 'unsupported';
}

export function createChatComposerModel() {
	let draft = $state('');
	let isSending = $state(false);
	let pendingAttachments = $state<PendingAttachment[]>([]);

	return {
		get draft() {
			return draft;
		},
		set draft(value: string) {
			draft = value;
		},

		get isSending() {
			return isSending;
		},

		get pendingAttachments(): readonly PendingAttachment[] {
			return pendingAttachments;
		},

		get hasAttachments() {
			return pendingAttachments.length > 0;
		},

		get canSend() {
			const hasContent = draft.trim().length > 0 || pendingAttachments.length > 0;
			return hasContent && !isSending;
		},

		addFiles(files: FileList | File[]) {
			const fileArray = Array.from(files);
			for (const file of fileArray) {
				pendingAttachments = [
					...pendingAttachments,
					{
						localId: generateLocalId(),
						file,
						name: file.name,
						mimeType: file.type || 'application/octet-stream',
						size: file.size,
						classification: classifyFile(file),
					},
				];
			}
		},

		removeAttachment(localId: string) {
			pendingAttachments = pendingAttachments.filter((a) => a.localId !== localId);
		},

		clearAttachments() {
			pendingAttachments = [];
		},

		markSending() {
			isSending = true;
		},

		markReady() {
			isSending = false;
		},

		clear() {
			draft = '';
			pendingAttachments = [];
		},
	};
}

