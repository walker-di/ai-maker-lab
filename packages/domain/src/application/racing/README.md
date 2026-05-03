# Racing Application Use Cases

Application-layer orchestration for the racing experiment. Defines the
`RacingTransport` port consumed by the route's transport adapter, plus
five use cases covering session bookkeeping, lap recording, best-lap
lookup, and setup persistence.

## Boundaries

- May import from `domain/shared/racing` and `domain/shared` cross-cutting
  primitives. Must not import from `domain/infrastructure/**` or any
  adapter / app code.
- Server-side composition (`apps/desktop-app/src/lib/server/racing-service.ts`)
  wires Surreal-backed repositories from `domain/infrastructure/database/racing/`
  into the use cases. The use cases themselves never see SurrealDB.

## Modules

- `RacingTransport.ts` — `RacingTransport` port, plus the three repository
  ports (`IRacingSessionRepository`, `ILapResultRepository`,
  `IRacingSetupRepository`).
- `use-cases/start-session.ts` — `createStartSession`.
- `use-cases/record-lap.ts` — `createRecordLap`.
- `use-cases/get-best-lap.ts` — `createGetBestLap`.
- `use-cases/setup.ts` — `createGetSetup`, `createSetSetup` (clamp setup
  values through the domain validator on the way through).
