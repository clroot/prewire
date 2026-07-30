import { injectable } from '@prewire/core'
import type { BillingPort } from '@example/kit'
import { BILLING, LOGGER } from '@example/kit'

/**
 * Admin is the one app that supports billing: an unmarked binding
 * overrides the kit throw stub, which opened itself with `default: true`.
 */
export const invoiceBilling = injectable(
  { logger: LOGGER },
  ({ logger }): BillingPort => ({
    charge: (customerId, amountCents) => {
      logger.info(`[admin] charging ${customerId}: ${amountCents} cents`)
      return Promise.resolve(`inv_${customerId}_${amountCents}`)
    },
  }),
  { provides: BILLING },
)
