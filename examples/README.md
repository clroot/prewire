# prewire examples — a product-line monorepo

One shared `kit`, three business apps. Every app consumes the kit as source and runs on a **different router framework** — yet all navigation logic is written once in the kit, against a port:

| App                          | Framework      | Build integration              | Uses billing?          |
| ---------------------------- | -------------- | ------------------------------ | ---------------------- |
| [`storefront`](./storefront) | Next.js        | `withPrewire()` (next.config)  | No — kit throw stub    |
| [`admin`](./admin)           | TanStack Start | CLI + `prewireResolve` (tests) | **Yes — overrides it** |
| [`support`](./support)       | react-router   | Vite + `@prewire/vite`         | No — kit throw stub    |

```
examples/
├── kit/                    shared package (ports, tokens, defaults, kit-side logic)
│   └── src/
│       ├── logging/        Logger port + token · console default binding
│       ├── router/         RouterPort + token · test fake with knobs
│       ├── billing/        BillingPort + token · loud throw stub
│       ├── records/        generic Repository<T> port + token · Customer record
│       ├── navigation/     kit-internal consumers of '#prewire'
│       └── prewire-contract.ts
├── storefront/             Next.js app
├── admin/                  TanStack Start app (+ vitest suite)
└── support/                react-router app (real vite build)
```

## The one-minute tour

**1. Consumers only ever write one import.** Same line in every app, every environment ([`storefront/src/catalog.ts`](./storefront/src/catalog.ts), [`admin/src/billing-flow.ts`](./admin/src/billing-flow.ts), [`support/src/main.ts`](./support/src/main.ts)):

```ts
import { billing, router } from '#prewire'
```

**2. Each app declares its own bindings** in `src/bindings/`, and codegen assembles a per-app composition root:

```
storefront → container.live.gen.ts → nextRouterBinding      (next/navigation)
admin      → container.live.gen.ts → tanstackRouterBinding  (@tanstack/react-router)
support    → container.live.gen.ts → reactRouterBinding     (react-router)
```

**3. The kit itself consumes `#prewire`** ([`kit/src/navigation/share-link.ts`](./kit/src/navigation/share-link.ts)) — kit never depends on app packages, yet each app's build resolves that import to its own root. That is the dependency inversion the whole design rides on.

## Mechanism → where to look

| Mechanism                                                | Files                                                                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Deliberate openness (`default: true`, Kotlin-open model) | [`kit/src/logging/console-logger.ts`](./kit/src/logging/console-logger.ts)                                                                             |
| App override of a kit default                            | [`admin/src/bindings/invoice-billing.ts`](./admin/src/bindings/invoice-billing.ts)                                                                     |
| Loud throw stub for intended non-support                 | [`kit/src/billing/billing-stub.ts`](./kit/src/billing/billing-stub.ts)                                                                                 |
| Generic port specializations (`TOKEN.of<Type>()`)        | [`kit/src/records/repository.ts`](./kit/src/records/repository.ts), [`admin/src/invoices/invoice-summary.ts`](./admin/src/invoices/invoice-summary.ts) |
| Environment-axis test fake with knobs                    | [`kit/src/router/router-fake.ts`](./kit/src/router/router-fake.ts)                                                                                     |
| One-line test wiring (`prewireResolve`)                  | [`admin/vitest.config.ts`](./admin/vitest.config.ts)                                                                                                   |
| Kit-internal `#prewire` consumer + standalone typecheck  | [`kit/src/navigation/`](./kit/src/navigation), [`kit/src/prewire-contract.ts`](./kit/src/prewire-contract.ts)                                          |
| Next.js integration (`withPrewire`)                      | [`storefront/next.config.ts`](./storefront/next.config.ts)                                                                                             |
| Vite integration (auto codegen + alias)                  | [`support/vite.config.ts`](./support/vite.config.ts)                                                                                                   |

## Running

```sh
bun install
bun run build   # per-app codegen + typecheck (support runs a real vite build)
bun run test    # admin's vitest suite exercises the test root and the fake's knobs
```

Generated artifacts (`src/prewire/*.gen.ts`, `prewire.*.gen.json`) are gitignored — run a build once and read them; they are plain, eject-able wiring code.
