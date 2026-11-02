import { injectable, InjectionToken } from '@prewire/core'
import type { Customer, Repository } from '@example/kit'
import { REPOSITORY } from '@example/kit'
import type { Invoice } from './invoice'

export interface InvoiceSummary {
  describe(invoiceId: string): Promise<string>
}

export const INVOICE_SUMMARY = new InjectionToken<InvoiceSummary>('invoiceSummary')

/**
 * Depends on two specializations of the same generic port. Each dep is
 * matched by its type argument — `customers` gets the Repository<Customer>
 * binding, `invoices` the Repository<Invoice> one.
 */
export const invoiceSummary = injectable(
  {
    customers: REPOSITORY.of<Repository<Customer>>(),
    invoices: REPOSITORY.of<Repository<Invoice>>(),
  },
  ({ customers, invoices }): InvoiceSummary => ({
    describe: async (invoiceId) => {
      const invoice = await invoices.findById(invoiceId)
      if (!invoice) return `invoice ${invoiceId} not found`
      const customer = await customers.findById(invoice.customerId)
      return `${invoice.id}: ${customer?.name ?? invoice.customerId} owes ${invoice.amountCents} cents`
    },
  }),
  { provides: INVOICE_SUMMARY },
)
