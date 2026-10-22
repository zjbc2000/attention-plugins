/**
 * Tests for `normalizeSettings`: defaults merge, legacy single-marker
 * migration, and malformed list cleanup.
 */
import { describe, it, expect } from 'vitest'
import { defaultSettings, normalizeSettings } from '../src/settings'

describe('normalizeSettings', () => {
  it('returns the defaults for an empty config', () => {
    expect(normalizeSettings({})).toEqual(defaultSettings)
  })

  it('migrates the legacy single marker to a one-item list', () => {
    expect(normalizeSettings({ mainlineSessionId: 'A' }).mainlineSessionIds).toEqual(['A'])
  })

  it('drops the legacy field from the normalized result', () => {
    const result = normalizeSettings({ mainlineSessionId: 'A' })
    expect('mainlineSessionId' in result).toBe(false)
  })

  it('keeps an existing marker list and filters invalid entries', () => {
    const raw = { mainlineSessionIds: ['A', '', 42, 'B'] } as any
    expect(normalizeSettings(raw).mainlineSessionIds).toEqual(['A', 'B'])
  })

  it('prefers an explicit empty list over a stale legacy marker', () => {
    const raw = { mainlineSessionIds: [], mainlineSessionId: 'A' }
    expect(normalizeSettings(raw).mainlineSessionIds).toEqual([])
  })

  it('merges partial type settings with defaults', () => {
    const raw = { types: { completed: { enabled: false, sound: 'none' } } } as any
    const result = normalizeSettings(raw)
    expect(result.types.completed).toEqual({ enabled: false, sound: 'none' })
    expect(result.types.failed).toEqual(defaultSettings.types.failed)
  })
})
