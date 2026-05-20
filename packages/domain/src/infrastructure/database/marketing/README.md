# infrastructure/database/marketing

SurrealDB repository implementations for the Marketing domain.

## Responsibility
Each `Surreal*Repository.ts` maps between SurrealDB records and domain types, implementing the corresponding `I*Repository` port from `application/marketing/ports.ts`.

## Table names
| Repository | SurrealDB table |
|---|---|
| `SurrealProductRepository` | `marketing_product` |
| `SurrealPersonaRepository` | `marketing_persona` |
| `SurrealCampaignRepository` | `marketing_campaign` |
| `SurrealCreativeRepository` | `marketing_creative` |
| `SurrealCustomerJourneyMapRepository` | `marketing_customer_journey_map` |
| `SurrealStoryRepository` | `marketing_story` |
| `SurrealSceneRepository` | `marketing_scene` |
| `SurrealClipRepository` | `marketing_clip` |
| `SurrealBgmRepository` | `marketing_bgm_file` |
| `SurrealCanvasTemplateRepository` | `marketing_canvas_template` |
| `SurrealStrategyRepository` | `marketing_strategy` |
| `SurrealSceneTransitionRepository` | `marketing_scene_transition` |

## ID handling
- All repositories use `createRecordId(TABLE, id)` for single-record operations.
- All `toX()` mapping functions call `normalizeRecordIdValue(String(record.id))` to strip the SurrealDB `RecordId` wrapper and return a plain string.

## Executable schema
`schema.ts` defines the first executable SurrealDB schema for the migrated marketing slice. The schema is applied lazily by the Product, Persona, and Customer Journey Map repositories before they read or write data.

These tables are `SCHEMAFULL` with explicit fields and indexes for the repository query patterns. Domain objects still expose browser-safe plain string IDs; the database fields are therefore typed as scalar strings rather than `record<table>` links for this slice. Keep that convention consistent unless all marketing repositories are migrated together to stored Surreal record links with repository-boundary normalization.

## Customer journey map relationship model
`marketing_customer_journey_map` reuses existing marketing entities by storing reference fields:

- `productId` is required.
- `personaId`, `campaignId`, and `creativeId` are optional.

These are simple one-hop filters such as `SELECT * FROM marketing_customer_journey_map WHERE productId = $productId`, so they should be indexed fields rather than graph edges. A graph relation would add write amplification without useful relationship metadata or multi-hop traversal for this feature.

Executable SurrealDB schema shape:

```sql
DEFINE TABLE OVERWRITE marketing_customer_journey_map SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS productId ON marketing_customer_journey_map TYPE string;
DEFINE FIELD personaId ON marketing_customer_journey_map TYPE option<string>;
DEFINE FIELD campaignId ON marketing_customer_journey_map TYPE option<string>;
DEFINE FIELD creativeId ON marketing_customer_journey_map TYPE option<string>;
DEFINE FIELD name ON marketing_customer_journey_map TYPE string;
DEFINE FIELD description ON marketing_customer_journey_map TYPE option<string>;
DEFINE FIELD scenario ON marketing_customer_journey_map TYPE option<string>;
DEFINE FIELD goals ON marketing_customer_journey_map TYPE array<string>;
DEFINE FIELD status ON marketing_customer_journey_map TYPE string;
DEFINE FIELD tags ON marketing_customer_journey_map TYPE array<string>;
DEFINE FIELD stages ON marketing_customer_journey_map TYPE array;
DEFINE FIELD lanes ON marketing_customer_journey_map TYPE array;
DEFINE FIELD cells ON marketing_customer_journey_map TYPE array;
DEFINE FIELD touchpoints ON marketing_customer_journey_map TYPE array;
DEFINE FIELD emotionPoints ON marketing_customer_journey_map TYPE array;
DEFINE FIELD opportunities ON marketing_customer_journey_map TYPE array;
DEFINE FIELD createdAt ON marketing_customer_journey_map TYPE string;
DEFINE FIELD updatedAt ON marketing_customer_journey_map TYPE string;
DEFINE INDEX IF NOT EXISTS idx_marketing_customer_journey_map_product ON marketing_customer_journey_map FIELDS productId;
DEFINE INDEX IF NOT EXISTS idx_marketing_customer_journey_map_product_created ON marketing_customer_journey_map FIELDS productId, createdAt;
DEFINE INDEX IF NOT EXISTS idx_marketing_customer_journey_map_persona ON marketing_customer_journey_map FIELDS personaId;
DEFINE INDEX IF NOT EXISTS idx_marketing_customer_journey_map_campaign ON marketing_customer_journey_map FIELDS campaignId;
DEFINE INDEX IF NOT EXISTS idx_marketing_customer_journey_map_creative ON marketing_customer_journey_map FIELDS creativeId;
DEFINE INDEX IF NOT EXISTS idx_marketing_customer_journey_map_created ON marketing_customer_journey_map FIELDS createdAt;
```

The repository follows the surrounding marketing persistence convention of storing IDs as normalized strings. If this area later moves to typed Surreal `record<table>` links, update all marketing repositories consistently rather than only this table.

## Customer journey map scope
Customer Journey Map persistence currently exists as preparatory infrastructure for later marketing workflows. It has shared types, an application service, repository tests, and schema coverage, but no desktop UI/API route is guaranteed by the `migrate-marketing-products-personas` first-slice OpenSpec change. Add a dedicated OpenSpec change before exposing it as a user-facing route.

## Product deletion policy
`SurrealProductRepository.delete` removes only the Product row. Child-existence enforcement lives in `ProductService.delete` (application layer), which rejects deletion when Personas exist. This keeps the repository a thin persistence adapter.

## Testing
Repository tests must use an isolated `mem://` SurrealDB connection:
```ts
const db = await createDbConnection({ host: 'mem://', ns: 'test_ns', db: `test_${Date.now()}` });
// ... tests ...
await db.close();
```
Use a unique `db` name per test file (or `afterEach` close) to prevent cross-test pollution.
