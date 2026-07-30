import { injectable } from '@prewire/core'
import type { RouterFake } from './ports'
import { ROUTER } from './tokens'

/**
 * Kit-provided router fake for the `test` environment. Bindings are
 * module singletons, so the fake exposes its own knobs (`history`,
 * `reset()`) instead of being swapped per render.
 */
export const routerFake = injectable(
  {},
  (): RouterFake => {
    const history: string[] = []
    return {
      history,
      href: (to) => to,
      push: (to) => {
        history.push(to)
      },
      reset: () => {
        history.length = 0
      },
    }
  },
  { provides: ROUTER, environment: 'test', default: true },
)
