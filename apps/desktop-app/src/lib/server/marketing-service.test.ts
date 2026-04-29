import { describe, expect, test } from 'bun:test';
import { toMarketingErrorResponse } from './marketing-service.js';
import { Marketing } from 'domain/shared';

describe('toMarketingErrorResponse', () => {
	test('maps provider response_format schema errors to 502', async () => {
		const response = toMarketingErrorResponse(
			new Error("Invalid schema for response_format: Missing 'title'"),
		);

		expect(response.status).toBe(502);
		await expect(response.json()).resolves.toMatchObject({
			error: "Invalid schema for response_format: Missing 'title'",
		});
	});

	test('maps AI generation failures to 502', async () => {
		const response = toMarketingErrorResponse(
			new Error('No object generated: output did not match the schema'),
		);
		expect(response.status).toBe(502);
	});

	test('maps OpenAI quota errors (with issues array) to 502', async () => {
		const quotaError = Object.assign(new Error('API error'), {
			issues: [
				{ message: 'You exceeded your current quota, please check your plan and billing details.' },
				{ message: 'You exceeded your current quota, please check your plan and billing details.' },
			],
		});

		const response = toMarketingErrorResponse(quotaError);

		expect(response.status).toBe(502);
		const body = await response.json() as { error: string };
		expect(body.error).toBe('API error');
	});

	test('maps real Zod v4 validation errors to 400', async () => {
		let zodError: unknown;
		try {
			Marketing.CreateProductDtoSchema.parse({ name: '' });
		} catch (e) {
			zodError = e;
		}

		const response = toMarketingErrorResponse(zodError);

		expect(response.status).toBe(400);
		const body = await response.json() as { error: string };
		expect(body.error).toStartWith('Validation failed:');
		expect(body.error).toContain('name');
	});

	test('does not crash on issues array without path (non-Zod errors)', async () => {
		const weirdError = Object.assign(new Error('Something went wrong'), {
			issues: [{ code: 'custom', message: 'something failed' }],
		});

		const response = toMarketingErrorResponse(weirdError);

		expect(response.status).toBe(500);
		const body = await response.json() as { error: string };
		expect(body.error).toBe('Something went wrong');
	});
});
