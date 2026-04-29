import type { Page } from '@playwright/test';

export async function goToProducts(page: Page): Promise<void> {
	await page.goto('/marketing/products');
}

export async function goToPersonas(page: Page): Promise<void> {
	await page.goto('/marketing/personas');
}

export async function goToProductDetail(page: Page, productId: string): Promise<void> {
	await page.goto(`/marketing/products/${productId}`);
}

export async function mockGeneratePersonas(page: Page, personas: object[]): Promise<void> {
	await page.route('**/api/marketing/products/*/personas/generate', (route) => {
		route.fulfill({ status: 201, json: personas });
	});
}
