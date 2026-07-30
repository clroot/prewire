# prewire examples — a product-line monorepo

A shared `kit` plus two business apps that consume it as source:

- **`kit`** — ports (`RouterPort`, `BillingPort`, `Logger`), tokens, and the kit's default bindings: a console logger and billing **throw stub** opened with `default: true`, and a router **test fake** (`environment: 'test'`) exposing `history`/`reset()` knobs.
- **`storefront`** (Next.js) — binds the router port with `next/navigation`. It deliberately does **not** use billing: the kit stub stays in its root, unused call sites tree-shake away, and any unintended reach fails loudly.
- **`admin`** (TanStack Start) — binds the same router port with `@tanstack/react-router` and **overrides** the billing stub with a real implementation. Its vitest config wires the `test` environment with a single `prewireResolve({ env: 'test' })` line.

Each app runs its own codegen (`prewire codegen` in the build scripts) over its own dependency graph (`src` + `../kit/src`) and gets its own composition roots:

```
src/prewire/container.live.gen.ts   ← per-app, per-environment, plain factories
src/prewire/container.test.gen.ts
prewire.paths.gen.json              ← app-axis resolution (tsconfig paths)
package.json "imports"              ← environment-axis resolution (conditions)
```

Consumers only ever write:

```ts
import { billing, router } from '#prewire'
```

Same import in every app and environment — different wiring, decided at build time.
