import { describe, expect, test } from 'vitest';
import { renderChatMarkdown, repairBrokenChatMarkdown } from './chat-message-markdown.js';

describe('renderChatMarkdown', () => {
	test('renders a tight bulleted list with content inside each list item', () => {
		const html = renderChatMarkdown(
			[
				'Here are some details:',
				'',
				'- XE shows the mid-market rate at $1 = R$4.9905',
				'- TradingView reports 4.9896 BRL',
				'- Bloomberg shows 4.9918 BRL',
			].join('\n'),
		);

		expect(html).toContain('<ul>');
		expect(html).toContain('<li>XE shows the mid-market rate at $1 = R$4.9905</li>');
		expect(html).toContain('<li>TradingView reports 4.9896 BRL</li>');
		expect(html).toContain('<li>Bloomberg shows 4.9918 BRL</li>');
		expect(html).not.toContain('<li></li>');
	});

	test('renders a loose bulleted list (blank lines between items) without orphaning markers', () => {
		const html = renderChatMarkdown(
			[
				'- XE shows the mid-market rate at $1 = R$4.9905',
				'',
				'- TradingView reports 4.9896 BRL',
				'',
				'- Bloomberg shows 4.9918 BRL',
			].join('\n'),
		);

		expect(html).toContain('<ul>');
		expect(html).toContain('XE shows the mid-market rate at $1 = R$4.9905');
		expect(html).toContain('TradingView reports 4.9896 BRL');
		expect(html).toContain('Bloomberg shows 4.9918 BRL');
		expect(html).not.toContain('<li></li>');
	});

	test('keeps single newlines as soft breaks instead of injecting <br> inside lists', () => {
		const html = renderChatMarkdown(
			['- first line', '  continuation of the same item', '- second item'].join('\n'),
		);

		expect(html).not.toContain('<br>');
		expect(html).toContain('<li>');
	});

	test('returns empty string for empty input', () => {
		expect(renderChatMarkdown('')).toBe('');
		expect(renderChatMarkdown('   \n  ')).toBe('');
	});

	test('repairs broken pattern persisted in old messages with orphaned bullet markers', () => {
		const broken = [
			'Here are some key details about the current rate:',
			'',
			'-',
			'',
			'XE shows the mid-market rate at $1 = R$4.9905',
			'',
			'-',
			'',
			'TradingView reports 4.9896 BRL with a 0.15% increase in the past 24 hours',
			'',
			'-',
			'',
			'Bloomberg shows 4.9918 BRL',
		].join('\n');

		const html = renderChatMarkdown(broken);

		expect(html).not.toContain('<li></li>');
		expect(html).toMatch(/<li>(?:<p>)?XE shows the mid-market rate at \$1 = R\$4\.9905/);
		expect(html).toMatch(/<li>(?:<p>)?TradingView reports 4\.9896 BRL with a 0\.15% increase in the past 24 hours/);
		expect(html).toMatch(/<li>(?:<p>)?Bloomberg shows 4\.9918 BRL/);
	});

	test('merges orphaned punctuation-leading fragments back into the previous paragraph', () => {
		const broken = [
			'The current USD/BRL exchange rate is 4.9865',
			'',
			', with most sources showing rates around **4.99 BRL per 1 USD**.',
		].join('\n');

		const html = renderChatMarkdown(broken);

		expect(html).toContain(
			'The current USD/BRL exchange rate is 4.9865, with most sources showing rates around <strong>4.99 BRL per 1 USD</strong>.',
		);
	});

	test('repair leaves well-formed markdown unchanged', () => {
		const clean = [
			'Here are details:',
			'',
			'- one',
			'- two',
			'- three',
			'',
			'A paragraph after.',
		].join('\n');

		expect(repairBrokenChatMarkdown(clean)).toBe(clean);
	});
});
