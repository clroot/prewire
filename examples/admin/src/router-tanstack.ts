import { injectable } from '@prewire/core'
import type { RouterPort } from '@example/kit'
import { LOGGER, ROUTER } from '@example/kit'
import { redirect } from '@tanstack/react-router'

/**
 * TanStack Router binding of the same router port the storefront binds
 * with Next.js — one port, two frameworks, chosen per app at build time.
 * Scoped to `live` so the kit test fake wins in the `test` root.
 */
export const tanstackRouter = injectable(
  { logger: LOGGER },
  ({ logger }): RouterPort => ({
    href: (to) => to,
    push: (to) => {
      logger.info(`[admin] navigate → ${to}`)
      throw redirect({ to })
    },
  }),
  { provides: ROUTER, environment: 'live' },
)
