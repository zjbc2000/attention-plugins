/**
 * Sidebar row → session id lookup, shared by the badge scanner
 * (`sidebar-badge.ts`) and the host wiring in `index.ts`.
 *
 * Everything here is pure: vitest runs in the `node` environment for this
 * package (no jsdom), so DOM access stays in the scanner and only plain
 * strings/records cross this boundary.
 */
import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'

/** Structural subset of one sessions-snapshot row that this lookup needs. */
export interface SessionTitleRow {
  readonly id: SessionId
  /** Durable log-backed title — the string a sidebar row actually renders. */
  readonly title?: string
  /** Human-facing fallback label (project basename or session id when untitled). */
  readonly displayTitle?: string
}

const ROW_KEY_PREFIX = 'session:'

/**
 * Read a session id out of the row's `data-row-key`.
 *
 * DSH renders the sidebar list with `data-row-key="session:<id>"` on session
 * rows and `workspace:<key>` / `overflow:<key>` / `empty` on the others, so the
 * prefix is the discriminator. The value after the prefix is authoritative —
 * it is the live session id, not a guess — which is why it beats every
 * title-based match below (titles collide: two sessions can both be "天机").
 */
export function sessionIdFromRowKey(value: string | null | undefined): SessionId | null {
  if (typeof value !== 'string') return null
  const key = value.trim()
  if (!key.startsWith(ROW_KEY_PREFIX)) return null
  const id = key.slice(ROW_KEY_PREFIX.length).trim()
  return id === '' ? null : (id as SessionId)
}

/**
 * Read a session id out of a `data-*` attribute value, tolerating a
 * `session:`/`session-` prefix and the `session-<uuid>` directory naming.
 * Hosts that predate `data-row-key` expose nothing else machine-readable, so
 * this stays as the second-best channel.
 */
export function sessionIdFromAttribute(value: string | null | undefined): SessionId | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (raw === '') return null
  const stripped = raw.replace(/^session[:-]/i, '').trim()
  return /^[0-9a-f-]{10,}$/i.test(stripped) ? (stripped as SessionId) : null
}

function normalizeTitle(value: string | null | undefined): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

/**
 * Resolve the session id for a rendered sidebar row from its label text.
 *
 * The label is the durable title, optionally followed by sibling text (the
 * relative time, a pin marker) when the caller could not isolate the title
 * element. Titles of *any* length are eligible: short names such as 天机
 * (two characters) are exactly what user sessions get, and an earlier
 * `length < 4` guard silently dropped them — which is what made the badge
 * appear for long titles and vanish for short ones.
 *
 * `title` is preferred over `displayTitle` because the row renders the durable
 * title while `displayTitle` degrades to the project basename for untitled
 * sessions. A session whose title is a prefix of another's (天机 vs 天机显示)
 * must not steal the other row's badge, so the longest matching title wins.
 * Duplicate exact titles are resolved to the first matching row; callers with
 * `data-row-key` available never reach this path.
 */
export function resolveSessionByTitle(
  text: string,
  rows: Iterable<SessionTitleRow | null | undefined>,
): SessionId | null {
  const target = normalizeTitle(text)
  if (target === '') return null
  let best: SessionId | null = null
  let bestLength = 0
  for (const row of rows) {
    if (row == null || row.id == null) continue
    const label = normalizeTitle(row.title) || normalizeTitle(row.displayTitle)
    if (label === '') continue
    if (label.length > target.length) continue
    if (label !== target && !target.startsWith(label)) continue
    if (label.length > bestLength) {
      best = row.id
      bestLength = label.length
    }
  }
  return best
}
