import { shareLink } from '@example/kit'
import { logger, router } from '#prewire'

/**
 * Consumer call sites are environment-blind: one static import from the
 * single specifier, no Context/Provider, no React surface. Storefront
 * never imports `billing` — the kit stub stays unused here and gets
 * tree-shaken from the app bundle.
 */
export function openProduct(slug: string): void {
  logger.info(`[storefront] open product ${slug}`)
  router.push(`/products/${slug}`)
}

export function productHref(slug: string): string {
  return router.href(`/products/${slug}`)
}

/** Uses a kit-internal consumer — wired to THIS app's root by the build. */
export function productShareLink(slug: string): string {
  return shareLink(`/products/${slug}`)
}
