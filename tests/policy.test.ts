/**
 * Tests for the pure alert policy: which events may interrupt, whether the
 * current session counts, and the subagent helpers.
 *
 * The three-way `mainlineMode` is the whole rule set:
 * - `mainline`: a marked main line rings at once, an unmarked completion joins
 *   the single "All tasks" aggregate;
 * - `balanced`: every completion rings at once;
 * - `silent`: no completion rings at all (no sound, no notification, and no
 *   aggregate either); questions and permission requests still ring.
 */
import { describe, it, expect } from 'vitest'
import {
  countRunningChildren,
  decideAlert,
  shouldAlertCurrentSession,
  shouldWaitForSubagents,
} from '../src/policy'
import type { MainlineMode, NotificationType } from '../src/settings'

const base = {
  kind: 'completed' as NotificationType,
  markedMainline: false,
  mainlineMode: 'mainline' as MainlineMode,
  muted: false,
}

const modes: MainlineMode[] = ['mainline', 'balanced', 'silent']
const kinds: NotificationType[] = ['completed', 'failed', 'question', 'permission']

describe('decideAlert', () => {
  it('never alerts for a muted session, whatever the event, mode or marker', () => {
    for (const kind of kinds) {
      for (const mainlineMode of modes) {
        for (const markedMainline of [false, true]) {
          expect(decideAlert({ kind, mainlineMode, markedMainline, muted: true })).toBe('never')
        }
      }
    }
  })

  it('always alerts questions and permission requests immediately, in every mode', () => {
    for (const kind of ['question', 'permission'] as const) {
      for (const mainlineMode of modes) {
        expect(decideAlert({ ...base, kind, mainlineMode })).toBe('now')
        expect(decideAlert({ ...base, kind, mainlineMode, markedMainline: true })).toBe('now')
      }
    }
  })

  it('stays completely silent for completions and failures in silent mode', () => {
    expect(decideAlert({ ...base, kind: 'completed', mainlineMode: 'silent' })).toBe('never')
    expect(decideAlert({ ...base, kind: 'failed', mainlineMode: 'silent' })).toBe('never')
    // No aggregate substitute either: a marker does not get past silent mode.
    expect(decideAlert({ ...base, kind: 'completed', mainlineMode: 'silent', markedMainline: true }))
      .toBe('never')
    expect(decideAlert({ ...base, kind: 'failed', mainlineMode: 'silent', markedMainline: true }))
      .toBe('never')
  })

  it('alerts a marked main-line immediately in both mainline and balanced mode', () => {
    for (const kind of ['completed', 'failed'] as const) {
      expect(decideAlert({ ...base, kind, markedMainline: true })).toBe('now')
      expect(decideAlert({ ...base, kind, mainlineMode: 'balanced', markedMainline: true })).toBe('now')
    }
  })

  it('aggregates an unmarked completion in mainline mode', () => {
    expect(decideAlert({ ...base, kind: 'completed' })).toBe('aggregate')
    expect(decideAlert({ ...base, kind: 'failed' })).toBe('aggregate')
  })

  it('alerts an unmarked completion immediately in balanced mode', () => {
    expect(decideAlert({ ...base, kind: 'completed', mainlineMode: 'balanced' })).toBe('now')
    expect(decideAlert({ ...base, kind: 'failed', mainlineMode: 'balanced' })).toBe('now')
  })
})

describe('shouldAlertCurrentSession', () => {
  it('always alerts in "always" mode', () => {
    expect(shouldAlertCurrentSession('always', { hidden: false, focused: true })).toBe(true)
    expect(shouldAlertCurrentSession('always', { hidden: true, focused: false })).toBe(true)
  })

  it('stays quiet in "hidden" mode while the page is visible', () => {
    expect(shouldAlertCurrentSession('hidden', { hidden: false, focused: false })).toBe(false)
    expect(shouldAlertCurrentSession('hidden', { hidden: true, focused: true })).toBe(true)
  })

  it('alerts in "unfocused" mode when the window lost focus (split screen)', () => {
    expect(shouldAlertCurrentSession('unfocused', { hidden: false, focused: false })).toBe(true)
    expect(shouldAlertCurrentSession('unfocused', { hidden: true, focused: true })).toBe(true)
    expect(shouldAlertCurrentSession('unfocused', { hidden: false, focused: true })).toBe(false)
  })
})

describe('subagent helpers', () => {
  it('waits only when enabled and children are still running', () => {
    expect(shouldWaitForSubagents(true, 1)).toBe(true)
    expect(shouldWaitForSubagents(true, 0)).toBe(false)
    expect(shouldWaitForSubagents(false, 3)).toBe(false)
  })

  it('counts only running direct children of one session', () => {
    const rows = [
      { id: 'p', running: true },
      { id: 'c1', parentSessionId: 'p', running: true },
      { id: 'c2', parentSessionId: 'p', running: false },
      { id: 'c3', parentSessionId: 'other', running: true },
      { id: 'c4', parentSessionId: 'p' },
    ]
    expect(countRunningChildren('p', rows)).toBe(1)
    expect(countRunningChildren('other', rows)).toBe(1)
    expect(countRunningChildren('missing', rows)).toBe(0)
    expect(countRunningChildren('p', [])).toBe(0)
  })
})
