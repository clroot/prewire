import { withPrewire } from '@prewire/next'

// Codegen runs while this config is evaluated; `next dev` additionally
// keeps the composition roots in sync via a source watcher.
export default withPrewire({ reactStrictMode: true })
