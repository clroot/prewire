import { injectable } from '@prewire/core'
import type { RouterPort } from '@example/kit'
import { LOGGER, ROUTER } from '@example/kit'
import { redirect } from 'react-router'

/**
 * react-router binding of the same router port that storefront binds
 * with Next.js and admin binds with TanStack Router — third framework,
 * same kit navigation logic, chosen per app at build time. Scoped to
 * `live` so the kit test fake wins in the `test` root.
 */
export const reactRouter = injectable(
  { logger: LOGGER },
  ({ logger }): RouterPort => ({
    href: (to) => to,
    push: (to) => {
      logger.info(`[support] navigate → ${to}`)
      throw redirect(to)
    },
  }),
  { provides: ROUTER, environment: 'live' },
)
