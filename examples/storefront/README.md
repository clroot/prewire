# @example/storefront

Next.js app of the product line.

- **Binds** the router port with `next/navigation` — [`src/bindings/next-router.ts`](./src/bindings/next-router.ts), scoped to `environment: 'live'` so the kit test fake wins in the test root.
- **Consumes** through the single specifier only — [`src/catalog.ts`](./src/catalog.ts) imports `{ logger, router }` from `#prewire` and reuses kit navigation logic.
- **Does not use billing** — deliberately. The kit's throw stub stays in the root: an unintended reach fails loudly, and the unused export tree-shakes out of the bundle.
- **Build integration**: [`next.config.ts`](./next.config.ts) wraps the config with `withPrewire()` — codegen runs when the config is evaluated, and `next dev` keeps the roots in sync with a source watcher. The `build` script also runs codegen explicitly so plain `tsc` workflows work without Next.

```sh
bun run build   # prewire codegen && tsc --noEmit
```
