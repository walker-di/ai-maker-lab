import { Platformer } from 'domain/application';
import {
	JsonBuiltInWorldRepository,
	type SurrealDbAdapter,
	SurrealPlayerProgressRepository,
	SurrealUserMapRepository
} from 'domain/infrastructure';

export function createMapCatalogService(adapter: SurrealDbAdapter): Platformer.MapCatalogService {
	return new Platformer.MapCatalogService(
		new JsonBuiltInWorldRepository(),
		new SurrealUserMapRepository(adapter),
		new SurrealPlayerProgressRepository(adapter)
	);
}
