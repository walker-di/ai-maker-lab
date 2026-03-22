# @ai-maker-lab/ui

`packages/ui` is the shared Svelte UI library consumed by `app/desktop-app`.

## Responsibility

- own reusable Shadcn-based UI primitives and shared styling tokens
- keep presentation logic close to components when it is UI-specific
- avoid app shell concerns such as routing, Paraglide runtime wiring, or platform adapters

## Current exports

- `Button`
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
- `ShowcaseHeader`
- `ShowcasePage`
- `styles.css`

## Boundaries

- may depend on `@ai-maker-lab/domain`
- must not call `/api/**` or import app routes
- should stay reusable across future apps
