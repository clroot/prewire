import { InjectionToken } from '@prewire/core'

/**
 * Billing port of the product line. Only some apps support billing —
 * the kit ships a loud throw stub as the default binding, and apps that
 * do support it override the stub with a real implementation.
 */
export interface BillingPort {
  /** Returns a receipt id. */
  charge(customerId: string, amountCents: number): Promise<string>
}

export const BILLING = new InjectionToken<BillingPort>('billing')
