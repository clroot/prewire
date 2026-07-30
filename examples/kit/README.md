# @example/kit

The shared package of the product line. Consumed **as source** by every app (`exports` points at `src/`), so each app's build compiles kit code with its own wiring.

## Layout

Each domain directory holds a port, its token, and the kit's default binding side by side:

```
src/
├── logging/
│   ├── logger.ts           Logger port + LOGGER token
│   └── console-logger.ts   default binding (default: true — apps may override)
├── router/
│   ├── router.ts           RouterPort/RouterFake + ROUTER token
│   └── router-fake.ts      test-environment fake (environment: 'test', default: true)
├── billing/
│   ├── billing.ts          BillingPort + BILLING token
│   └── billing-stub.ts     loud throw stub (default: true)
├── navigation/             kit-internal consumers — logic on top of the ports
│   ├── share-link.ts       imports '#prewire' from INSIDE the kit
│   └── login.ts            loginUrl / requireLogin flow
├── prewire-contract.ts     types-only stand-in for '#prewire' (standalone typecheck)
└── index.ts                public surface
```

## The default-binding contract

Every kit binding here is marked `default: true` — the [Kotlin-`open` model](../../CLAUDE.md): closed by default, deliberately opened. An app may shadow an opened binding with one unmarked binding of its own; an unmarked duplicate for the same token is a **build error**, and so is a second unmarked binding.

- `console-logger` — a real default any app can keep or replace.
- `billing-stub` — a default for apps that intentionally do **not** support billing: reaching it throws loudly instead of silently doing nothing. Admin overrides it; storefront and support keep it.
- `router-fake` — scoped to `environment: 'test'`. In a test root it beats the universal defaults (environment-specific defaults win); in live roots the app's framework binding (an unmarked override scoped to `live`) wins.

## Kit-internal consumers

`navigation/share-link.ts` and `navigation/login.ts` import `#prewire` **from inside the kit**. The kit never depends on app packages — each app's generated tsconfig paths / bundler alias resolves that import to the app's own composition root, program-wide. Write the flow once, get per-app wiring for free.

For standalone typechecking (`bun run typecheck` in this package), `tsconfig.json` maps `#prewire` to [`prewire-contract.ts`](./src/prewire-contract.ts) — a types-only declaration of what the kit expects any app root to provide. It is never imported at runtime.

## Testing story

Bindings are module singletons, so the router fake exposes its own knobs instead of being swapped per render:

```ts
import type { RouterFake } from '@example/kit'
import { router } from '#prewire' // test root → the fake

const fake = router as RouterFake
fake.reset()
// …exercise code…
expect(fake.history).toEqual(['/expected/path'])
```

See [`admin/tests/billing-flow.test.ts`](../admin/tests/billing-flow.test.ts) for the full pattern.
