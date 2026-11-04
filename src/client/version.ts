/**
 * Plugin identity + update check for the Attention settings panel.
 *
 * The installed version is baked in at build time (`__ATTENTION_VERSION__`,
 * injected by `bundle-client.mjs` from package.json). It deliberately falls
 * back to a neutral string when the bundle is loaded without that define
 * (e.g. the tsc-emitted modules in `lib/client/`), so nothing throws.
 *
 * The update check reads the public npm registry document. CORS is allowed
 * there (`access-control-allow-origin: *`), so the browser can call it without
 * a host route; offline / blocked networks surface as an error state instead
 * of hanging, because the fetch carries a timeout.
 */

export const GITHUB_REPO_URL = 'https://github.com/zjbc2000/attention-plugins'
export const ISSUES_URL = 'https://github.com/zjbc2000/attention-plugins/issues'
export const RELEASES_URL = 'https://github.com/zjbc2000/attention-plugins/releases/latest'
export const NPM_LATEST_URL = 'https://registry.npmjs.org/attention-plugins/latest'

/** How long the update check waits before it reports a failure. */
export const UPDATE_FETCH_TIMEOUT_MS = 8000

declare const __ATTENTION_VERSION__: string | undefined

/** Version of the running bundle (from package.json at build time). */
export const PLUGIN_VERSION: string =
  typeof __ATTENTION_VERSION__ === 'string' && __ATTENTION_VERSION__ !== ''
    ? __ATTENTION_VERSION__
    : '0.0.0-dev'

interface ParsedVersion {
  core: number[]
  /** Prerelease part after the first `-`, or '' for a release. */
  pre: string
}

function parseVersion(raw: string): ParsedVersion {
  const cleaned = String(raw ?? '').trim().replace(/^v/i, '')
  const dash = cleaned.indexOf('-')
  const core = (dash === -1 ? cleaned : cleaned.slice(0, dash)).split('.')
  const pre = dash === -1 ? '' : cleaned.slice(dash + 1)
  return {
    core: core.map(part => {
      const n = parseInt(part, 10)
      return Number.isFinite(n) ? n : 0
    }),
    pre,
  }
}

function comparePrerelease(a: string, b: string): number {
  const ai = a.split('.')
  const bi = b.split('.')
  const len = Math.max(ai.length, bi.length)
  for (let i = 0; i < len; i++) {
    const x = ai[i]
    const y = bi[i]
    // A shorter identifier list has lower precedence (1.0.0-rc < 1.0.0-rc.1).
    if (x === undefined) return -1
    if (y === undefined) return 1
    const xNumeric = /^\d+$/.test(x)
    const yNumeric = /^\d+$/.test(y)
    if (xNumeric && yNumeric) {
      const diff = Number(x) - Number(y)
      if (diff !== 0) return diff < 0 ? -1 : 1
    } else if (xNumeric) {
      return -1 // numeric identifiers sort before alphanumeric ones
    } else if (yNumeric) {
      return 1
    } else if (x !== y) {
      return x < y ? -1 : 1
    }
  }
  return 0
}

/**
 * Compare two SemVer-ish strings: negative when `a < b`, zero when equal,
 * positive when `a > b`. A release outranks its own prereleases.
 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  for (let i = 0; i < 3; i++) {
    const diff = (pa.core[i] ?? 0) - (pb.core[i] ?? 0)
    if (diff !== 0) return diff < 0 ? -1 : 1
  }
  if (pa.pre === pb.pre) return 0
  if (!pa.pre) return 1
  if (!pb.pre) return -1
  return comparePrerelease(pa.pre, pb.pre)
}

/** True when `latest` is a strictly newer version than `current`. */
export function isNewerVersion(latest: string, current: string): boolean {
  return compareVersions(latest, current) > 0
}

/**
 * Fetch the latest published version from the npm registry.
 * Throws on a non-2xx response, a malformed body, or a timeout.
 */
export async function fetchLatestVersion(timeoutMs = UPDATE_FETCH_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(NPM_LATEST_URL, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
    if (!response.ok) {
      throw new Error(`npm registry responded ${response.status}`)
    }
    const body = (await response.json()) as { version?: unknown }
    const version = typeof body?.version === 'string' ? body.version.trim() : ''
    if (!version) throw new Error('npm registry returned no version')
    return version
  } finally {
    clearTimeout(timer)
  }
}
