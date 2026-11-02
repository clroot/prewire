import { customerRepository, invoiceRepository, invoiceSummary } from '#prewire'
import { describe, expect, it } from 'vitest'

describe('generic port specializations', () => {
  it('wires one binding per type argument of the same token', async () => {
    expect(await customerRepository.findById('cus_42')).toEqual({
      id: 'cus_42',
      name: 'Ada Lovelace',
    })
    expect(await invoiceRepository.findById('inv_1')).toMatchObject({ amountCents: 1900 })
  })

  it('injects each specialization into the matching dep', async () => {
    expect(await invoiceSummary.describe('inv_1')).toBe('inv_1: Ada Lovelace owes 1900 cents')
  })
})
