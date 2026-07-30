import { billing, router } from '#prewire'

/**
 * Consumer of the billing port — environment-blind static import from the
 * single specifier, same shape as every other call site in the product
 * line.
 */
export async function chargeAndShowReceipt(
  customerId: string,
  amountCents: number,
): Promise<string> {
  const receiptId = await billing.charge(customerId, amountCents)
  router.push(`/billing/receipts/${receiptId}`)
  return receiptId
}
