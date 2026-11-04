/**
 * Tests for the update-check helpers: SemVer ordering (including prereleases)
 * and the npm registry fetch contract (ok / non-2xx / malformed payload).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  PLUGIN_VERSION,
  compareVersions,
  fetchLatestVersion,
  isNewerVersion,
} from '../src/client/version'

describe('compareVersions', () => {
  it('orders plain releases by major, minor and patch', () => {
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1)
    expect(compareVersions('1.3.0', '1.2.9')).toBe(1)
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1)
  })

  it('treats equal versions as equal, ignoring a leading v', () => {
    expect(compareVersions('0.2.1', 'v0.2.1')).toBe(0)
  })

  it('pads missing segments with zero', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0)
    expect(compareVersions('1.2', '1.2.1')).toBe(-1)
  })

  it('ranks a release above its prereleases', () => {
    expect(compareVersions('1.0.0', '1.0.0-rc.2')).toBe(1)
    expect(compareVersions('1.0.0-rc.2', '1.0.0')).toBe(-1)
  })

  it('compares prerelease identifiers numerically, then lexically', () => {
    expect(compareVersions('1.0.0-rc.2', '1.0.0-rc.10')).toBe(-1)
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1)
    expect(compareVersions('1.0.0-rc.1', '1.0.0-rc.1.1')).toBe(-1)
  })

  it('sorts numeric prerelease identifiers before alphanumeric ones', () => {
    expect(compareVersions('1.0.0-1', '1.0.0-alpha')).toBe(-1)
  })

  it('keeps prerelease ordering independent of the core version', () => {
    expect(compareVersions('0.2.1-rc.2', '0.2.1-rc.3')).toBe(-1)
  })
})

describe('isNewerVersion', () => {
  it('is true only for a strictly greater published version', () => {
    expect(isNewerVersion('0.2.2', '0.2.1')).toBe(true)
    expect(isNewerVersion('0.2.1', '0.2.1')).toBe(false)
    expect(isNewerVersion('0.2.0', '0.2.1')).toBe(false)
  })

  it('does not offer a prerelease as an update over a release', () => {
    expect(isNewerVersion('0.3.0-rc.1', '0.2.1')).toBe(true)
    expect(isNewerVersion('0.2.1-rc.1', '0.2.1')).toBe(false)
  })
})

describe('PLUGIN_VERSION', () => {
  it('is a version string even when the build-time define is absent', () => {
    expect(typeof PLUGIN_VERSION).toBe('string')
    expect(PLUGIN_VERSION).toMatch(/^\d+\.\d+\.\d+/)
  })
})

describe('fetchLatestVersion', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the version from the registry payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ name: 'attention-plugins', version: '9.9.9' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    await expect(fetchLatestVersion()).resolves.toBe('9.9.9')
  })

  it('throws on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })))
    await expect(fetchLatestVersion()).rejects.toThrow(/503/)
  })

  it('throws when the payload carries no version', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ name: 'attention-plugins' }), { status: 200 })),
    )
    await expect(fetchLatestVersion()).rejects.toThrow(/no version/)
  })
})
