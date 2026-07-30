import { loginUrl, requireLogin, shareLink } from '@example/kit'
import { logger, router } from '#prewire'

/**
 * Support center consumers — the same kit navigation abstractions the
 * other two apps use, wired here to react-router. Support, like
 * storefront, deliberately does not use billing.
 */
export function openTicket(id: string): void {
  logger.info(`[support] open ticket ${id}`)
  router.push(`/tickets/${id}`)
}

export function ticketShareLink(id: string): string {
  return shareLink(`/tickets/${id}`)
}

export function guardInbox(isAuthenticated: boolean): void {
  if (!isAuthenticated) requireLogin('/inbox')
}

export { loginUrl }
