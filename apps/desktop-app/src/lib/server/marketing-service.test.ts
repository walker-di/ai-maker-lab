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
});
