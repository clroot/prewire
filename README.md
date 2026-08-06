# prewire

> Prewire your app — compile-time DI for TypeScript frontends. Wired at build time, zero runtime container.

**Status: early 0.x, [published to npm](https://www.npmjs.com/package/@prewire/core) — APIs may still change between minor versions**

## What

Just like Quarkus ArC generates bean wiring at build time, prewire analyzes your
TypeScript sources and **generates** the DI wiring code. No runtime container,
no `reflect-metadata`, no `experimentalDecorators`.

You write the nodes of the graph — `injectable()` declarations whose
dependencies are a static object literal mapping names to tokens, never
constructed by hand. `prewire codegen` discovers the declarations across your
codebase, assembles them in dependency order, validates the graph (a missing,
circular, or conflicting binding is a **build error**), and emits a plain,
readable composition root per app and environment.

prewire ships the mechanism only. Ports, adapters, and domain abstractions are
things you build on top of it.

## The headline: one core, many apps

prewire is built for **monorepo product lines** — one shared kit consumed as
source by several business apps, where the kit must stay closed while each app
extends it differently.

The kit declares a port, and a default that fails loudly on purpose:

```ts
// kit/src/billing.ts
import { injectable, InjectionToken } from '@prewire/core'

export interface BillingPort {
  charge(customerId: string, amountCents: number): Promise<string>
}

export const BILLING = new InjectionToken<BillingPort>('billing')

// Billing is unsupported unless an app says otherwise. `default: true`
// deliberately opens this binding for override — closed by default,
// like Kotlin's `open`.
export const billingStub = injectable(
  {},
  (): BillingPort => ({
    charge: () => {
      throw new Error('billing is not supported in this app')
    },
  }),
  { provides: BILLING, default: true },
)
```

The one app that supports billing overrides the stub — no marker needed on the
overriding side, because the kit already opened the token:

```ts
// apps/admin/src/bindings/invoice-billing.ts
export const invoiceBilling = injectable(
  { logger: LOGGER },
  ({ logger }): BillingPort => ({
    charge: async (customerId, amountCents) => {
      logger.info(`charging ${customerId}`)
      return createInvoice(customerId, amountCents)
    },
  }),
  { provides: BILLING },
)
```

Codegen runs **per app** — each app scans its own dependency graph (app + kit)
and gets its own composition root:

```ts
// apps/storefront/src/prewire/container.live.gen.ts (generated)
export const billing = /* @__PURE__ */ billingStubBinding.factory({})
```

```ts
// apps/admin/src/prewire/container.live.gen.ts (generated)
export const billing = /* @__PURE__ */ invoiceBillingBinding.factory({ logger })
```

Consumers — including code **inside the kit** — only ever write one import:

```ts
// kit/src/receipts.ts — kit source, not app source
import { billing } from '#prewire'
```

The kit never depends on app packages, yet each app's build resolves that
import to its own root (generated per-app tsconfig paths / bundler alias).
Dependency inversion happens in module resolution, at build time.

## The override contract

- Only bindings marked `default: true` may be overridden — an unmarked
  duplicate for the same token is a **build error**.
- Exactly one unmarked binding wins over any number of opened defaults; two
  unmarked bindings are a build error.
- Among defaults, an environment-specific binding beats a universal one; a tie
  is a build error.

Deterministic, compile-time, order-independent — think of it as Spring's
`@ConditionalOnMissingBean` without the runtime bean-ordering roulette.

## Environments are a user-defined axis

`environment` values are yours to define — business apps of a product line,
`server`/`client` across the RSC boundary, `dev`/`test`/`prod`, native
platforms. One root is generated per environment, and one and the same
`#prewire` specifier resolves to the right root per build graph (package.json
subpath imports with export conditions, a bundler alias, tsconfig paths).

The server/client split falls out of the same mechanism:

```ts
export const dbUserRepository = injectable(
  { db: DATABASE },
  ({ db }): UserRepository => ({ findById: (id) => db.queryUser(id) }),
  { provides: USER_REPOSITORY, environment: 'server' },
)

export const fetchUserRepository = injectable(
  {},
  (): UserRepository => ({ findById: (id) => fetch(`/api/users/${id}`).then((r) => r.json()) }),
  { provides: USER_REPOSITORY, environment: 'client' },
)
```

A singleton is nothing more than a module-level `const`, so unused bindings
tree-shake away — and the client artifact **structurally** cannot leak server
code, because it never imports the server modules in the first place. A token
that only has a server binding has no export in the client artifact at all:
reaching for it from client code is a build error, not a runtime surprise.

Testing rides the same axis. A kit can bind a fake with knobs under
`environment: 'test'` (`default: true`), and a vitest config points `#prewire`
at the test root with one line:

```ts
// vitest.config.ts
import { prewireResolve } from '@prewire/cli/resolve'

export default defineConfig({
  resolve: { alias: prewireResolve({ env: 'test' }) },
})
```

And because factories are plain functions, unit tests can skip the container
entirely — hand them fakes directly, no `vi.mock`, no module-path strings:

```ts
const repo = dbUserRepository.factory({ db: fakeDb })
expect(await repo.findById('42')).toEqual(fakeUser)
```

## Install

```sh
bun add @prewire/core        # tokens + injectable()
bun add -d @prewire/cli      # prewire codegen
bun add -d @prewire/vite     # optional — Vite/webpack/rspack integration
bun add -d @prewire/next     # optional — Next.js integration
```

(npm/pnpm/yarn equivalents work the same.)

## Running codegen

Standalone CLI, or automated through the build integrations:

```sh
prewire codegen --watch        # standalone, next to any dev server
```

- `@prewire/vite` — an [unplugin](https://unplugin.unjs.io/) covering
  Vite/webpack/rspack: runs codegen, fails the build on graph violations, and
  injects the `#prewire` alias automatically.
- `@prewire/next` — `withPrewire()` wraps next.config: codegen at config
  evaluation, plus a source watcher during `next dev` (Turbopack exposes no
  bundler hooks; prewire emits files, so it doesn't need any).

### Resolving `#prewire` in a source-consumed monorepo

Node subpath imports (`#…`) are package-local by spec, so shared packages
consumed **as source** — Next `transpilePackages`, Vite `optimizeDeps.exclude`,
a bundler that compiles workspace TS directly — cannot resolve `#prewire` to
the importing app's root through `package.json` `imports`. That resolution has
to come from the app's module resolver, and the app's tsconfig `paths` is
enough: Next 16 / Turbopack applies it to transpiled workspace sources too.

```jsonc
// apps/<app>/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "#prewire": ["./prewire/container.live.gen.ts"], // ← declare it here
    },
  },
}
```

```jsonc
// packages/kit/tsconfig.json — standalone typecheck only
{
  "compilerOptions": {
    "paths": { "#prewire": ["./src/prewire-contract.ts"] },
  },
}
```

`tsconfigPaths: true` (the default) emits `prewire.paths.gen.json` for the app
tsconfig to `extends`. That only works when the app declares **no** `paths` of
its own: TypeScript's `extends` replaces `compilerOptions.paths` wholesale
rather than merging it, so an app with `@/*` or `~/*` aliases would drop the
generated mapping. Set `tsconfigPaths: false` and declare the one entry inline,
as above.

## Why

- **Zero runtime container** — all wiring is generated, eject-able code;
  unused bindings tree-shake away.
- **Build-time graph validation** — missing, circular, or conflicting
  bindings fail the build, not the user session.
- **Deterministic extension for shared code** — kit defaults + explicit
  `default: true` openness give a product line one core and per-app wiring.
- **Environment-conditional bindings on a user-defined axis** — business
  apps, server/client, test — same token, different implementation per build.

## When not to use prewire

prewire's value scales with **bindings × environments × entry points**. A
single app on a single environment with a handful of bindings does not need
it — a hand-written composition root (one file that calls your factories in
order) is simpler and just as safe. Reach for prewire when the same ports are
wired differently across apps, environments, or test setups, and keeping N
roots in sync by hand starts to hurt.

## Packages

| Package                                                        | Description                                                                                    |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [`@prewire/core`](https://www.npmjs.com/package/@prewire/core) | `InjectionToken` and the `injectable()` binding declaration — plain data, zero runtime         |
| [`@prewire/cli`](https://www.npmjs.com/package/@prewire/cli)   | `prewire codegen` — scans sources, validates the graph, emits per-app composition roots        |
| [`@prewire/vite`](https://www.npmjs.com/package/@prewire/vite) | unplugin build integration (Vite/webpack/rspack) — automatic codegen + `#prewire` alias        |
| [`@prewire/next`](https://www.npmjs.com/package/@prewire/next) | `withPrewire()` next.config wrapper — codegen at config time, source watcher during `next dev` |

## Examples

[`examples/`](./examples) is a product-line monorepo: one shared kit, three
apps on three different router frameworks (Next.js, TanStack Router,
react-router), all wired to the same navigation port. It demonstrates every
mechanism above — start with the [examples README](./examples/README.md).

## Non-goals

- A runtime container implementation (not having one _is_ the product)
- Shipping domain abstractions — ports and adapters such as navigation or
  storage are things **you** build on top of prewire; this repo only covers
  them in examples

## Development

```sh
bun install
bun run build      # turbo run build
bun run typecheck
bun run test
```

Inspired by [Quarkus ArC](https://quarkus.io/guides/cdi-reference), Angular Ivy AOT, and Dagger.
