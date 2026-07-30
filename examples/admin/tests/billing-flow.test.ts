import type { RouterFake } from '@example/kit'
import { openShared } from '@example/kit'
import { router } from '#prewire'
import { beforeEach, describe, expect, it } from 'vitest'
import { chargeAndShowReceipt } from '../src/billing-flow'

// In the test root the ROUTER token is bound to the kit fake
// (environment: 'test', default: true), so the module singleton exposes
// its knobs here. The cast narrows the port type to the fake.
const fake = router as RouterFake

describe('chargeAndShowReceipt', () => {
  beforeEach(() => {
    fake.reset()
  })

  it('charges through the admin invoice implementation', async () => {
    const receiptId = await chargeAndShowReceipt('cus_42', 1900)
    expect(receiptId).toBe('inv_cus_42_1900')
  })

  it('records navigation in the router fake history', async () => {
    const receiptId = await chargeAndShowReceipt('cus_7', 500)
    expect(fake.history).toEqual([`/billing/receipts/${receiptId}`])
  })
})

describe('kit-internal consumer', () => {
  beforeEach(() => {
    fake.reset()
  })

  it('resolves #prewire inside kit source to this app root', () => {
    // openShared lives in @example/kit and imports '#prewire' itself —
    // in this test run it lands on the SAME test root as app code does.
    openShared('/shared/report')
    expect(fake.history).toEqual(['/shared/report'])
  })
})
