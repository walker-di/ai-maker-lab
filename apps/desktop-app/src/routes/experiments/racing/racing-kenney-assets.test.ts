import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const routeSourcePath = fileURLToPath(new URL('./+page.svelte', import.meta.url));
const racingStaticDir = fileURLToPath(new URL('../../../../static/racing/', import.meta.url));
const extractedAssetsDir = path.join(racingStaticDir, 'extracted');
const licensePath = path.join(racingStaticDir, 'License.txt');

const sceneryAssetMatchers = {
	cone: [/^cone(?:-flat)?\.glb$/],
	barrier: [/^barrier(?:Red|White|Wall)\.glb$/],
	light: [/^(?:lightPost(?:Large|Modern)|lightRed(?:Double)?)\.glb$/],
	billboard: [/^billboard\.glb$/],
	flag: [/^flag(?:Checkers(?:Small)?|Green|Red)\.glb$/],
	fence: [/^fence(?:Straight|Curved)\.glb$/],
	grandStand: [/^grandStand(?:Awning|Covered)?\.glb$/],
	pitBuilding: [/^pits(?:Garage(?:Closed)?|Office|OfficeRoof)\.glb$/],
	pylon: [/^pylon\.glb$/],
	banner: [/^bannerTower(?:Green|Red)\.glb$/],
	radar: [/^radarEquipment\.glb$/],
	overhead: [/^overhead(?:Lights)?\.glb$/],
} as const;

describe('racing Kenney asset bundle', () => {
	test('ships Kenney attribution and the public-domain license notice', () => {
		expect(existsSync(licensePath)).toBe(true);

		const licenseText = readFileSync(licensePath, 'utf8');
		expect(licenseText).toContain("Kenney's free game asset packs");
		expect(licenseText).toContain('Kenney Racing Kit');
		expect(licenseText).toContain('Kenney Car Kit');
		expect(licenseText).toContain('CC0 1.0 Universal');
		expect(licenseText).toContain('static/racing/extracted/');
	});

	test('surfaces Kenney attribution in the racing route footer', () => {
		const routeSource = readFileSync(routeSourcePath, 'utf8');
		expect(routeSource).toContain('Racing assets by Kenney.');
		expect(routeSource).toContain('/racing/License.txt');
	});

	test('keeps a Kenny GLB on disk for each scenery asset family', () => {
		expect(existsSync(extractedAssetsDir)).toBe(true);

		const extractedEntries = readdirSync(extractedAssetsDir, { withFileTypes: true })
			.filter((entry) => entry.isFile())
			.map((entry) => entry.name);

		expect(extractedEntries.some((name) => name.endsWith('.glb'))).toBe(true);

		for (const [kind, matchers] of Object.entries(sceneryAssetMatchers)) {
			expect(
				extractedEntries.some((entry) => matchers.some((matcher) => matcher.test(entry))),
				`expected a Kenny ${kind} asset in ${extractedAssetsDir}`,
			).toBe(true);
		}
	});
});
