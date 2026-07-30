# prewire examples — a product-line monorepo

A shared `kit` plus three business apps that consume it as source — each on a **different router framework**, all wired to the same ports:

- **`kit`** — ports (`RouterPort`, `BillingPort`, `Logger`), tokens, navigation logic written once against the port (`share-link`, `requireLogin`), and the kit's default bindings: a console logger and billing **throw stub** opened with `default: true`, and a router **test fake** (`environment: 'test'`) exposing `history`/`reset()` knobs.
- **`storefront`** (Next.js) — binds the router port with `next/navigation`; `next.config.ts` runs codegen through `withPrewire()`. It deliberately does **not** use billing: the kit stub stays in its root, unused call sites tree-shake away, and any unintended reach fails loudly.
- **`admin`** (TanStack Start) — binds the same router port with `@tanstack/react-router` and **overrides** the billing stub with a real implementation. Its vitest config wires the `test` environment with a single `prewireResolve({ env: 'test' })` line.
- **`support`** (react-router) — binds the same router port with `react-router`, built with **Vite + `@prewire/vite`** (the plugin runs codegen and injects the `#prewire` alias — no manual resolve line). Like storefront, it does not use billing.

One port, three framework bindings, decided per app at build time:

```
storefront → container.live.gen.ts → nextRouterBinding
admin      → container.live.gen.ts → tanstackRouterBinding
support    → container.live.gen.ts → reactRouterBinding
```

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

## Kit-internal consumers (dependency inversion via module resolution)

`kit/src/share-link.ts` imports `#prewire` from **inside the shared kit**. Kit never depends on app packages, yet each app's build resolves that very import to its own composition root: the app's generated tsconfig paths / bundler alias apply program-wide, so kit source compiled inside the storefront build gets storefront wiring, and the same file inside the admin test run gets the test root (proven in `admin/tests/billing-flow.test.ts`). For standalone typechecking, kit maps `#prewire` to `src/prewire-contract.ts` — a types-only declaration of what kit expects any app root to provide.
