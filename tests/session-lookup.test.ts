/**
 * Tests for the sidebar row → session id lookup (`session-lookup.ts`).
 *
 * Regression cover for the badge that "sometimes" appeared in the sidebar: the
 * old resolver required a title of at least 4 characters, so 2-character
 * session names (天机, 天时) never resolved and the scan actively removed their
 * badge. These cases pin the new contract: any title length resolves, the
 * longest matching title wins, and `data-row-key` beats title matching.
 */
import { describe, it, expect } from 'vitest'
import {
  resolveSessionByTitle,
  sessionIdFromAttribute,
  sessionIdFromRowKey,
  type SessionTitleRow,
} from '../src/client/session-lookup'

const TIANJI = 'e2739684-26ae-4fe7-a685-48fb729eea72'
const TIANJI_SHOW = '14d2e4e2-9a10-4c6b-8a2f-0c9c1c1a1b2c'
const TIANSHI = 'fba741c4-582a-4f47-afd1-4fb6452bffe3'

const rows: SessionTitleRow[] = [
  { id: TIANJI as SessionTitleRow['id'], title: '天机', displayTitle: '天机' },
  { id: TIANJI_SHOW as SessionTitleRow['id'], title: '天机显示', displayTitle: '天机显示' },
  { id: TIANSHI as SessionTitleRow['id'], title: '天时', displayTitle: '天时' },
  { id: 'blank-1' as SessionTitleRow['id'], displayTitle: 'weather-fuxi-project' },
]

describe('sessionIdFromRowKey', () => {
  it('reads the session id out of a session row key', () => {
    expect(sessionIdFromRowKey(`session:${TIANJI}`)).toBe(TIANJI)
  })

  it('ignores the other row kinds DSH renders', () => {
    expect(sessionIdFromRowKey('workspace:weather-fuxi-project')).toBeNull()
    expect(sessionIdFromRowKey('overflow:weather-fuxi-project')).toBeNull()
    expect(sessionIdFromRowKey('empty')).toBeNull()
  })

  it('rejects a bare prefix, blanks and non-strings', () => {
    expect(sessionIdFromRowKey('session:')).toBeNull()
    expect(sessionIdFromRowKey('   ')).toBeNull()
    expect(sessionIdFromRowKey(null)).toBeNull()
    expect(sessionIdFromRowKey(undefined)).toBeNull()
  })

  it('tolerates surrounding whitespace', () => {
    expect(sessionIdFromRowKey(`  session:${TIANJI}  `)).toBe(TIANJI)
  })
})

describe('sessionIdFromAttribute', () => {
  it('accepts a raw session id and the session- / session: prefixed forms', () => {
    expect(sessionIdFromAttribute(TIANJI)).toBe(TIANJI)
    expect(sessionIdFromAttribute(`session-${TIANSHI}`)).toBe(TIANSHI)
    expect(sessionIdFromAttribute(`session:${TIANJI}`)).toBe(TIANJI)
  })

  it('rejects non-id values', () => {
    expect(sessionIdFromAttribute('4分钟')).toBeNull()
    expect(sessionIdFromAttribute('')).toBeNull()
    expect(sessionIdFromAttribute(null)).toBeNull()
  })
})

describe('resolveSessionByTitle', () => {
  it('resolves a two-character title (the reported 天机 / 天时 bug)', () => {
    expect(resolveSessionByTitle('天机', rows)).toBe(TIANJI)
    expect(resolveSessionByTitle('天时', rows)).toBe(TIANSHI)
  })

  it('prefers the longest matching title over a prefix of it', () => {
    expect(resolveSessionByTitle('天机显示', rows)).toBe(TIANJI_SHOW)
  })

  it('matches a title followed by the row chrome text', () => {
    // textContent of a rendered row is title + relative time
    expect(resolveSessionByTitle('天机4分钟', rows)).toBe(TIANJI)
    expect(resolveSessionByTitle('天机显示3天', rows)).toBe(TIANJI_SHOW)
  })

  it('still resolves titles of four or more characters', () => {
    expect(resolveSessionByTitle('天时21分钟', rows)).toBe(TIANSHI)
  })

  it('never matches the blank-session placeholder label', () => {
    expect(resolveSessionByTitle('新会话', rows)).toBeNull()
    expect(resolveSessionByTitle('', rows)).toBeNull()
    expect(resolveSessionByTitle('   ', rows)).toBeNull()
  })

  it('ignores null rows and rows without any label', () => {
    const sparse = [null, { id: 'x' as SessionTitleRow['id'] }, ...rows]
    expect(resolveSessionByTitle('天机', sparse)).toBe(TIANJI)
  })

  it('does not match a title that merely contains the target', () => {
    expect(resolveSessionByTitle('3天', rows)).toBeNull()
  })
})
