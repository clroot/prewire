import { InjectionToken } from '@prewire/core'

/**
 * Framework-agnostic navigation port. Each app binds it to its own
 * router framework (Next.js, TanStack Router, react-router) — the
 * wiring is decided per app at build time.
 */
export interface RouterPort {
  href(to: string): string
  push(to: string): void
}

/** Test knob surface of the kit-provided router fake. */
export interface RouterFake extends RouterPort {
  readonly history: string[]
  reset(): void
}

export const ROUTER = new InjectionToken<RouterPort>('router')
