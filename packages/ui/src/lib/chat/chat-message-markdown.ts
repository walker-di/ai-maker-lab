import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const allowedTags = [
	...sanitizeHtml.defaults.allowedTags,
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'hr',
	'del',
	'img',
	'table',
	'thead',
	'tbody',
	'tfoot',
	'tr',
	'th',
	'td',
	'pre',
	'code',
];

const allowedAttributes = {
	...sanitizeHtml.defaults.allowedAttributes,
	a: [...(sanitizeHtml.defaults.allowedAttributes.a ?? []), 'target', 'rel'],
	code: ['class'],
	img: ['src', 'alt', 'title'],
};

/**
 * Repairs markdown produced before the streaming text-merge fix landed, where
 * adjacent text fragments around hosted-tool annotations (e.g. `source-url`)
 * were joined with a hard `\n\n` paragraph break. This left two visible
 * artifacts in already-persisted messages:
 *
 *   1. Bullet markers stranded on their own line ("-" alone) followed by a
 *      blank line and the bullet content as a separate paragraph.
 *   2. Sentence fragments split across paragraphs (e.g. ", with most sources
 *      showing rates …" as its own paragraph).
 *
 * We re-attach orphaned list-item content to its bullet marker, and merge
 * orphaned punctuation-leading fragments back into the previous paragraph.
 */
export function repairBrokenChatMarkdown(content: string): string {
	let result = content;

	result = result.replace(
		/^([ \t]*)([-*+]|\d+\.)[ \t]*\r?\n(?:[ \t]*\r?\n)+(?=\S)/gm,
		'$1$2 ',
	);

	result = result.replace(
		/(\S)[ \t]*\r?\n(?:[ \t]*\r?\n)+(?=[,.;:!?)\]}])/g,
		'$1',
	);

	return result;
}

export function renderChatMarkdown(content: string): string {
	if (!content.trim()) {
		return '';
	}

	const repaired = repairBrokenChatMarkdown(content);

	const parsed = marked.parse(repaired, {
		async: false,
		gfm: true,
	});

	const unsafeHtml = typeof parsed === 'string' ? parsed : '';

	return sanitizeHtml(unsafeHtml, {
		allowedTags,
		allowedAttributes,
		transformTags: {
			a: (tagName: string, attribs: Record<string, string>) => ({
				tagName,
				attribs: {
					...attribs,
					target: '_blank',
					rel: 'noreferrer noopener',
				},
			}),
		},
	});
}
