# @example/admin

TanStack Start app of the product line — and the one app that supports billing.

- **Binds** the router port with `@tanstack/react-router` — [`src/bindings/tanstack-router.ts`](./src/bindings/tanstack-router.ts) (`environment: 'live'`).
- **Overrides** the kit billing stub with a real implementation — [`src/bindings/invoice-billing.ts`](./src/bindings/invoice-billing.ts): an unmarked binding shadowing the `default: true` stub, per the override contract.
- **Consumes** through the single specifier — [`src/billing-flow.ts`](./src/billing-flow.ts).
- **Test wiring is one line**: [`vitest.config.ts`](./vitest.config.ts) calls `prewireResolve({ env: 'test' })`, pointing `#prewire` at the test root, where the kit router fake (with `history`/`reset()` knobs) is bound. [`tests/billing-flow.test.ts`](./tests/billing-flow.test.ts) also proves the kit-internal consumer lands on this app's test root at runtime.

```sh
bun run build   # prewire codegen && tsc --noEmit
bun run test    # prewire codegen && vitest run
```
