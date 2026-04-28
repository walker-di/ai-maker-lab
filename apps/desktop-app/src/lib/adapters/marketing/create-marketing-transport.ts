import {
	HttpMarketingCatalogTransport,
	HttpMarketingAiTransport,
	HttpMarketingAssetTransport,
	HttpMarketingExportTransport,
	HttpMarketingStrategyTransport,
} from './http-marketing-transport.js';

export function createMarketingTransport() {
	return {
		catalog: new HttpMarketingCatalogTransport(),
		ai: new HttpMarketingAiTransport(),
		assets: new HttpMarketingAssetTransport(),
		export: new HttpMarketingExportTransport(),
		strategy: new HttpMarketingStrategyTransport(),
	};
}

export type MarketingTransport = ReturnType<typeof createMarketingTransport>;
