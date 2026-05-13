## ADDED Requirements

### Requirement: Marketing Products are manageable

The desktop app SHALL provide a marketing Product workflow where users can create, list, view, edit, and delete Products through the migrated marketing feature area.

#### Scenario: User creates a Product

- **WHEN** a user submits a valid Product with required fields
- **THEN** the Product is persisted through the marketing application service
- **AND** the Product appears in the Product list without requiring a page reload

#### Scenario: User edits a Product

- **WHEN** a user updates an existing Product with valid fields
- **THEN** the persisted Product reflects the edited values
- **AND** Product list/detail UI displays the updated values

#### Scenario: User deletes a Product

- **WHEN** a user deletes an existing Product
- **THEN** the Product no longer appears in Product lists
- **AND** subsequent lookup by the deleted Product id reports a not-found result

#### Scenario: Invalid Product input is rejected

- **WHEN** a user submits a Product missing required fields
- **THEN** the UI shows a validation error
- **AND** no invalid Product is persisted

### Requirement: Marketing Personas are associated with Products

The desktop app SHALL provide a Persona workflow where users can create, list, view, edit, and delete Personas associated with a Product.

#### Scenario: User creates a Persona for a Product

- **WHEN** a user submits a valid Persona for an existing Product
- **THEN** the Persona is persisted with a Product association
- **AND** the Persona appears in that Product's Persona list

#### Scenario: Product Persona list is scoped

- **WHEN** a user views Personas for a Product
- **THEN** the list includes Personas associated with that Product
- **AND** the list excludes Personas associated with other Products

#### Scenario: Persona requires an existing Product

- **WHEN** a user or API request attempts to create a Persona for an unknown Product
- **THEN** the operation fails with a not-found or validation error
- **AND** no Persona is persisted

#### Scenario: User edits a Persona

- **WHEN** a user updates an existing Persona with valid fields
- **THEN** the persisted Persona reflects the edited values
- **AND** the Product-scoped Persona list displays the updated values

#### Scenario: User deletes a Persona

- **WHEN** a user deletes an existing Persona
- **THEN** the Persona no longer appears in its Product's Persona list

### Requirement: Persona generation uses an application port

The marketing feature SHALL support Persona generation through an application-layer provider port so provider-specific SDKs do not leak into shared domain, page models, shared UI, or API route business logic.

#### Scenario: User generates a Persona draft

- **WHEN** a user requests Persona generation for an existing Product
- **THEN** the application service invokes a Persona generation provider port with Product context
- **AND** returns a generated Persona draft or persisted generated Persona according to the use-case contract
- **AND** the UI displays the generated Persona result

#### Scenario: Persona generation provider fails

- **WHEN** the Persona generation provider returns an error
- **THEN** the application service maps the failure to a controlled use-case error
- **AND** the UI displays a user-visible error state
- **AND** no partial invalid Persona is persisted

#### Scenario: Live AI providers are not required for automated tests

- **WHEN** automated tests exercise Persona generation
- **THEN** tests use a mock provider implementation at the application port boundary
- **AND** tests do not call live Anthropic, OpenAI, Gemini, Replicate, or TTS APIs

### Requirement: Marketing persistence uses SurrealDB repositories

Products and Personas SHALL be persisted through SurrealDB-backed repository implementations in `packages/domain/src/infrastructure/database/marketing/**`.

#### Scenario: Repository tests use isolated mem databases

- **WHEN** repository tests run
- **THEN** each test file opens a real SurrealDB `mem://` connection with a unique namespace and database
- **AND** closes the connection after each test

#### Scenario: Repository outputs are browser-safe domain objects

- **WHEN** repository methods return Products or Personas
- **THEN** returned values are plain domain objects
- **AND** no SurrealDB `RecordId` object or table-specific record identifier leaks outside infrastructure

### Requirement: Marketing APIs are thin adapters

SvelteKit API routes under `apps/desktop-app/src/routes/api/marketing/**` SHALL act as thin HTTP adapters over marketing application services.

#### Scenario: API route handles Product creation

- **WHEN** an HTTP client posts a valid Product request to the marketing Product API
- **THEN** the route parses the request
- **AND** delegates Product creation to an application service
- **AND** returns a JSON response with the created Product

#### Scenario: API route handles invalid input

- **WHEN** an HTTP client sends invalid marketing request data
- **THEN** the route returns a controlled 4xx JSON response
- **AND** route code does not duplicate domain validation rules beyond request parsing

#### Scenario: API route does not construct provider/database details inline

- **WHEN** a marketing API route handles a request
- **THEN** runtime-specific repositories and providers are obtained from app/server composition
- **AND** the route does not import Drizzle, SQLite schema, or provider SDK clients directly

### Requirement: Frontend composition uses app-local adapters and page models

Marketing pages SHALL use route-local `.svelte.ts` page models and app-local transport adapters instead of constructing raw `/api/**` requests inside shared UI or page model business logic.

#### Scenario: Product page loads through a transport adapter

- **WHEN** the Product page model loads Products
- **THEN** it calls a marketing transport adapter method
- **AND** it does not construct a raw `/api/**` URL itself

#### Scenario: Persona page handles errors through model state

- **WHEN** Persona loading, saving, deleting, or generation fails
- **THEN** the page model exposes an error state for the Svelte component to render

### Requirement: Marketing UI is localized and reusable where appropriate

Visible marketing UI strings SHALL use existing paraglide i18n patterns, and reusable Product/Persona visual components SHALL live in `packages/ui` where they are not app-specific composition.

#### Scenario: Marketing UI uses localized strings

- **WHEN** marketing pages render visible labels, headings, actions, and errors
- **THEN** those strings are read from paraglide messages
- **AND** message keys exist for `en`, `es`, `pt`, and `ja`

#### Scenario: Shared UI does not import domain package

- **WHEN** reusable marketing UI components are added to `packages/ui`
- **THEN** they do not import `packages/domain`
- **AND** any necessary props use local structural type mirrors or primitive values

### Requirement: First-slice validation covers architecture seams

The migration slice SHALL include automated tests for the most important architecture seams: shared validation, SurrealDB repositories, application use cases, app-local adapters/page models, and at least one Product/Persona e2e flow.

#### Scenario: Validation commands pass for the slice

- **WHEN** the slice is complete
- **THEN** targeted domain tests pass
- **AND** desktop unit tests for marketing adapters/page models pass
- **AND** at least one marketing Playwright e2e flow passes
- **AND** `bun run check:desktop-app` passes
