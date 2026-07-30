import { InjectionToken } from '@prewire/core'
import type { BillingPort, Logger, RouterPort } from './ports'

export const LOGGER = new InjectionToken<Logger>('logger')
export const ROUTER = new InjectionToken<RouterPort>('router')
export const BILLING = new InjectionToken<BillingPort>('billing')
