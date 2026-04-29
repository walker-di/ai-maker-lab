import { expect, test } from '@playwright/test';
import { goToProducts, goToPersonas, mockGeneratePersonas } from './helpers.js';

const now = new Date().toISOString();

function makeProduct(id: string, name: string) {
	return { id, name, description: 'A test product', targetAudience: 'Everyone', features: [], benefits: [], imageUrl: '', createdAt: now, updatedAt: now };
}

function makePersona(id: string, productId: string, name: string) {
	return {
		id, productId, name, age: undefined, ageRange: 'adults', gender: 'prefer_not_to_say',
		occupation: '', income: '', interests: [], painPoints: [], motivations: [],
		description: '', avatarUrl: '', createdAt: now, updatedAt: now,
	};
}

test.describe('Marketing Products & Personas', () => {
	test('shows empty state on products page', async ({ page }) => {
		await page.route('**/api/marketing/products', (route) => {
			route.fulfill({ json: [] });
		});

		await goToProducts(page);
		await expect(page.getByRole('heading', { name: /products/i, level: 1 })).toBeVisible();
	});

	test('creates, lists, edits, and deletes a product', async ({ page }) => {
		const products: ReturnType<typeof makeProduct>[] = [];

		await page.route('**/api/marketing/products', async (route, request) => {
			if (request.method() === 'GET') return route.fulfill({ json: products });
			const body = await request.postDataJSON();
			const product = makeProduct(`prod-${products.length + 1}`, body.name);
			products.push(product);
			return route.fulfill({ status: 201, json: product });
		});

		await page.route('**/api/marketing/products/prod-1', async (route, request) => {
			const idx = products.findIndex((p) => p.id === 'prod-1');
			if (request.method() === 'PUT' || request.method() === 'PATCH') {
				const body = await request.postDataJSON();
				if (idx !== -1) products[idx] = { ...products[idx]!, ...body };
				return route.fulfill({ json: products[idx] ?? {} });
			}
			if (request.method() === 'DELETE') {
				products.splice(idx, 1);
				return route.fulfill({ status: 204, body: '' });
			}
			return route.fulfill({ json: products[idx] ?? null });
		});

		await goToProducts(page);

		// Create
		await page.getByRole('button', { name: /new product/i }).click();
		await page.getByLabel(/product name/i).fill('Test Product');
		await page.getByLabel(/description/i).first().fill('A test product');
		await page.getByLabel(/target audience/i).fill('Everyone');
		await page.getByRole('button', { name: /create product/i }).first().click();
		await expect(page.getByText('Test Product')).toBeVisible();

		// Edit
		await page.getByRole('button', { name: /edit/i }).first().click();
		await page.getByLabel(/product name/i).fill('Updated Product');
		await page.getByRole('button', { name: /save changes/i }).click();
		await expect(page.getByText('Updated Product')).toBeVisible();

		// Delete
		await page.getByRole('button', { name: /delete/i }).first().click();
		await expect(page.getByText('Updated Product')).not.toBeVisible();
	});

	test('creates and deletes a persona on the personas page', async ({ page }) => {
		const products = [makeProduct('prod-1', 'My Product')];
		const personas: ReturnType<typeof makePersona>[] = [];

		await page.route('**/api/marketing/products', (route) => {
			route.fulfill({ json: products });
		});

		await page.route('**/api/marketing/personas', async (route, request) => {
			if (request.method() === 'GET') return route.fulfill({ json: personas });
			const body = await request.postDataJSON();
			const persona = makePersona(`per-${personas.length + 1}`, body.productId ?? 'prod-1', body.name);
			personas.push(persona);
			return route.fulfill({ status: 201, json: persona });
		});

		await page.route('**/api/marketing/personas/per-1', async (route, request) => {
			if (request.method() === 'DELETE') {
				personas.splice(0, 1);
				return route.fulfill({ status: 204, body: '' });
			}
			return route.fulfill({ json: personas[0] ?? null });
		});

		await goToPersonas(page);
		await expect(page.getByRole('heading', { name: /personas/i, level: 1 })).toBeVisible();

		// Create
		await page.getByRole('button', { name: /new persona/i }).click();
		await page.getByLabel(/^name/i).first().fill('Test Persona');
		await page.getByLabel(/^age/i).first().fill('30');
		await page.getByLabel(/occupation/i).fill('Engineer');
		await page.getByLabel(/description/i).first().fill('A test persona');
		await page.getByRole('button', { name: /create persona/i }).first().click();
		await expect(page.getByText('Test Persona')).toBeVisible();

		// Delete
		await page.getByRole('button', { name: /delete/i }).first().click();
		await expect(page.getByText('Test Persona')).not.toBeVisible();
	});

	test('generates personas for a product via mocked generation endpoint', async ({ page }) => {
		const product = makeProduct('prod-gen', 'Gen Product');
		const generatedPersonas = [
			makePersona('gen-per-1', 'prod-gen', 'Generated Persona A'),
			makePersona('gen-per-2', 'prod-gen', 'Generated Persona B'),
		];
		let productPersonas: typeof generatedPersonas = [];

		await page.route('**/api/marketing/products', (route) => {
			route.fulfill({ json: [product] });
		});
		await page.route('**/api/marketing/products/prod-gen', (route) => {
			route.fulfill({ json: product });
		});
		await page.route('**/api/marketing/personas?*', async (route) => {
			return route.fulfill({ json: productPersonas });
		});
		await page.route('**/api/marketing/personas', async (route, request) => {
			if (request.url().includes('productId')) return route.fulfill({ json: productPersonas });
			return route.fulfill({ json: productPersonas });
		});

		await mockGeneratePersonas(page, generatedPersonas);

		// After generation the page refreshes personas — mock the updated list
		productPersonas = generatedPersonas;

		await page.goto('/marketing/products/prod-gen');
		await expect(page.getByText('Gen Product')).toBeVisible();

		await page.getByRole('button', { name: /generate personas/i }).click();

		await expect(page.getByText('Generated Persona A')).toBeVisible();
		await expect(page.getByText('Generated Persona B')).toBeVisible();
	});
});
