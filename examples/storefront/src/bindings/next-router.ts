import { injectable } from '@prewire/core'
import type { RouterPort } from '@example/kit'
import { LOGGER, ROUTER } from '@example/kit'
import { redirect } from 'next/navigation'

/**
 * Next.js binding of the router port, scoped to the `live` environment so
 * the kit test fake wins in the `test` root.
 */
export const nextRouter = injectable(
  { logger: LOGGER },
  ({ logger }): RouterPort => ({
    href: (to) => to,
    push: (to) => {
      logger.info(`[storefront] navigate → ${to}`)
      redirect(to)
    },
  }),
  { provides: ROUTER, environment: 'live' },
)
