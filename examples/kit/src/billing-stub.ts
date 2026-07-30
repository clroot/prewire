import { injectable } from '@prewire/core'
import type { BillingPort } from './ports'
import { BILLING } from './tokens'

/**
 * Kit default for apps that intentionally do not support billing:
 * a throw stub, so an unintended reach fails loudly instead of silently
 * doing nothing. Apps that do support billing override it with a real
 * implementation (the stub is opened with `default: true`).
 */
export const billingStub = injectable(
  {},
  (): BillingPort => ({
    charge: () => {
      throw new Error(
        'BillingPort is not bound in this app — billing is intentionally unsupported here. ' +
          'Bind an implementation for BILLING in the app to enable it.',
      )
    },
  }),
  { provides: BILLING, default: true },
)
