import { logger, router } from '#prewire'

/**
 * Navigation logic abstracted in the shared kit, written once against
 * the router port. Every app in the product line reuses this flow while
 * binding the port to its own framework (Next.js, TanStack Router,
 * react-router) — the wiring is decided per app at build time.
 */
export function loginUrl(returnTo: string): string {
  return router.href(`/login?returnTo=${encodeURIComponent(returnTo)}`)
}

export function requireLogin(returnTo: string): void {
  logger.info(`[kit] not authenticated — redirecting to login (returnTo: ${returnTo})`)
  router.push(loginUrl(returnTo))
}
