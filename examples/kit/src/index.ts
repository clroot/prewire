// Ports and tokens, grouped by domain.
export type { Logger } from './logging/logger'
export { LOGGER } from './logging/logger'
export type { RouterFake, RouterPort } from './router/router'
export { ROUTER } from './router/router'
export type { BillingPort } from './billing/billing'
export { BILLING } from './billing/billing'
export type { Repository } from './records/repository'
export { REPOSITORY } from './records/repository'
export type { Customer } from './records/customer'

// Kit default bindings — every one deliberately opened with `default: true`.
export { consoleLogger } from './logging/console-logger'
export { routerFake } from './router/router-fake'
export { billingStub } from './billing/billing-stub'

// Kit-internal consumers — logic written once against the ports.
export { openShared, shareLink } from './navigation/share-link'
export { loginUrl, requireLogin } from './navigation/login'
