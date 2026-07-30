import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { stopPrewireWatchers, withPrewire } from '../src/index'

const CORE_DIR = resolve(import.meta.dirname, '../../core')
const CTX = { defaultConfig: {} }

function scaffoldApp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'prewire-next-'))
  writeFileSync(
    join(dir, 'package.json'),
    `${JSON.stringify({ name: 'next-app', private: true, type: 'module' }, null, 2)}\n`,
  )
  mkdirSync(join(dir, 'src'))
  writeFileSync(
    join(dir, 'src/tokens.ts'),
    `import { InjectionToken } from '@prewire/core'
export const APP_NAME = new InjectionToken<string>('app name')
export const TAGLINE = new InjectionToken<string>('tagline')
`,
  )
  writeFileSync(
    join(dir, 'src/bindings.ts'),
    `import { injectable } from '@prewire/core'
import { APP_NAME } from './tokens'

export const appName = injectable({}, () => 'next-app', { provides: APP_NAME })
`,
  )
  writeFileSync(
    join(dir, 'prewire.json'),
    `${JSON.stringify({ include: ['src'], environments: ['live'], outDir: 'src/prewire' })}\n`,
  )
  mkdirSync(join(dir, 'node_modules/@prewire'), { recursive: true })
  symlinkSync(CORE_DIR, join(dir, 'node_modules/@prewire/core'), 'dir')
  return dir
}

afterEach(() => {
  stopPrewireWatchers()
})

describe('withPrewire', () => {
  it('runs codegen at config evaluation and returns the wrapped config', async () => {
    const dir = scaffoldApp()
    const configFn = withPrewire({ reactStrictMode: true }, { config: join(dir, 'prewire.json') })

    const config = await configFn('phase-production-build', CTX)
    expect(config).toEqual({ reactStrictMode: true })
    expect(existsSync(join(dir, 'src/prewire/container.live.gen.ts'))).toBe(true)
  })

  it('supports the function form of next config', async () => {
    const dir = scaffoldApp()
    const configFn = withPrewire((phase: string) => ({ phaseSeen: phase }), {
      config: join(dir, 'prewire.json'),
    })
    const config = await configFn('phase-production-build', CTX)
    expect(config).toEqual({ phaseSeen: 'phase-production-build' })
  })

  it('fails the command on a graph violation', async () => {
    const dir = scaffoldApp()
    writeFileSync(
      join(dir, 'src/bindings.ts'),
      `import { injectable } from '@prewire/core'
import { APP_NAME, TAGLINE } from './tokens'

export const appName = injectable(
  { tagline: TAGLINE },
  ({ tagline }) => 'next-app: ' + tagline,
  { provides: APP_NAME },
)
`,
    )
    const configFn = withPrewire({}, { config: join(dir, 'prewire.json') })
    await expect(configFn('phase-production-build', CTX)).rejects.toThrow('MISSING_BINDING')
  })

  it('keeps roots in sync during next dev via the source watcher', async () => {
    const dir = scaffoldApp()
    const root = join(dir, 'src/prewire/container.live.gen.ts')
    const configFn = withPrewire({}, { config: join(dir, 'prewire.json') })
    await configFn('phase-development-server', CTX)
    expect(readFileSync(root, 'utf8')).not.toContain('tagline')

    // A new binding appears while the dev server runs…
    writeFileSync(
      join(dir, 'src/tagline.ts'),
      `import { injectable } from '@prewire/core'
import { TAGLINE } from './tokens'

export const tagline = injectable({}, () => 'wired at build time', { provides: TAGLINE })
`,
    )

    // …and the watcher regenerates the composition root.
    let content = ''
    for (let i = 0; i < 50 && !content.includes('tagline'); i++) {
      await sleep(100)
      content = readFileSync(root, 'utf8')
    }
    expect(content).toContain('export const tagline')
  }, 10_000)
})
