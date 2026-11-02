/** Admin-only record — the kit never sees this type. */
export interface Invoice {
  id: string
  customerId: string
  amountCents: number
}
