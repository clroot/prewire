import { injectable } from '@prewire/core'
import type { Repository } from '@example/kit'
import { REPOSITORY } from '@example/kit'
import type { Invoice } from '../invoices/invoice'

const invoices: Invoice[] = [{ id: 'inv_1', customerId: 'cus_42', amountCents: 1900 }]

/**
 * Repository<Invoice> — same token as the customer repository, a
 * different specialization, so no override contract between the two.
 * Exported from the root as `invoiceRepository`.
 */
export const invoiceRepository = injectable(
  {},
  (): Repository<Invoice> => ({
    findById: (id) => Promise.resolve(invoices.find((i) => i.id === id)),
  }),
  { provides: REPOSITORY.of<Repository<Invoice>>() },
)
