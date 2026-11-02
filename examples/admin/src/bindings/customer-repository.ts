import { injectable } from '@prewire/core'
import type { Customer, Repository } from '@example/kit'
import { REPOSITORY } from '@example/kit'

const customers: Customer[] = [{ id: 'cus_42', name: 'Ada Lovelace' }]

/** Repository<Customer> — exported from the root as `customerRepository`. */
export const customerRepository = injectable(
  {},
  (): Repository<Customer> => ({
    findById: (id) => Promise.resolve(customers.find((c) => c.id === id)),
  }),
  { provides: REPOSITORY.of<Repository<Customer>>() },
)
