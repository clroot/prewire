# @example/support

react-router app of the product line — the third framework binding of the same router port, built with **Vite**.

- **Binds** the router port with `react-router` — [`src/bindings/react-router.ts`](./src/bindings/react-router.ts) (`environment: 'live'`).
- **Consumes** through the single specifier — [`src/main.ts`](./src/main.ts) reuses the kit's `shareLink` and `requireLogin` flows unchanged.
- **Does not use billing** — like storefront, the kit throw stub stays in place.
- **Build integration**: [`vite.config.ts`](./vite.config.ts) adds the `prewire()` plugin from `@prewire/vite` — it runs codegen (graph violations fail the build) and injects the `#prewire` alias from the generated manifest, so this app has **zero manual resolve wiring**.

```sh
bun run build   # vite build (plugin runs codegen) && tsc --noEmit
```
