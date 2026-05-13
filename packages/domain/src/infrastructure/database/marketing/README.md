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
