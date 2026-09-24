/**
 * Tests for the pending-interaction projection: the bridge between DSH's UI
 * status snapshot (questions / approvals) and the notification engine.
 *
 * Regression cover for the bug where questions never notified: the engine had
 * `observePending`, but nothing in the browser wiring ever fed it, because the
 * session controller emits no event for questions or approvals.
 */
import { describe, it, expect } from 'vitest'
import { collectPending, pendingDetail } from '../src/client/pending'

describe('pendingDetail', () => {
  it('reads the first question text of a question interaction', () => {
    expect(pendingDetail({
      kind: 'question',
      questions: [{ id: 'q1', question: 'Which database should I use?' }],
    })).toBe('Which database should I use?')
  })

  it('treats plan-review as a question presentation', () => {
    expect(pendingDetail({
      kind: 'plan-review',
      questions: [{ id: 'p1', question: 'Approve this plan?' }],
    })).toBe('Approve this plan?')
  })

  it('reads the tool and reason of an approval interaction', () => {
    expect(pendingDetail({
      kind: 'approval',
      toolName: 'Bash',
      reason: 'rm -rf build/',
    })).toBe('Bash — rm -rf build/')
  })

  it('falls back to whichever approval field is present', () => {
    expect(pendingDetail({ kind: 'approval', toolName: 'Bash' })).toBe('Bash')
    expect(pendingDetail({ kind: 'approval', reason: 'needs network' })).toBe('needs network')
  })

  it('returns an empty string rather than undefined for malformed payloads', () => {
    expect(pendingDetail({})).toBe('')
    expect(pendingDetail({ kind: 'question', questions: [] })).toBe('')
    expect(pendingDetail({ kind: 'question', questions: [{ id: 'q1' }] })).toBe('')
    expect(pendingDetail({ kind: 'question', questions: 'nope' })).toBe('')
  })
})

describe('collectPending', () => {
  it('maps question and approval interactions onto engine facts', () => {
    const facts = collectPending([
      ['A', { pendingInteraction: { key: 'q1', kind: 'question', questions: [{ question: 'What next?' }] } }],
      ['B', { pendingInteraction: { key: 'a1', kind: 'approval', toolName: 'Bash', reason: 'why' } }],
    ])

    expect(facts.get('A')).toEqual({ key: 'q1', kind: 'question', detail: 'What next?' })
    expect(facts.get('B')).toEqual({ key: 'a1', kind: 'approval', detail: 'Bash — why' })
  })

  it('skips sessions with no pending interaction', () => {
    const facts = collectPending([
      ['A', { pendingInteraction: undefined }],
      ['B', {}],
      ['C', undefined],
    ])

    expect(facts.size).toBe(0)
  })

  it('skips interactions without a usable key (the only de-dup axis)', () => {
    const facts = collectPending([
      ['A', { pendingInteraction: { kind: 'question', questions: [{ question: 'x' }] } }],
      ['B', { pendingInteraction: { key: 42, kind: 'question' } }],
      ['C', { pendingInteraction: { key: '', kind: 'question' } }],
    ])

    expect(facts.size).toBe(0)
  })

  it('ignores unknown interaction kinds by treating them as questions', () => {
    const facts = collectPending([
      ['A', { pendingInteraction: { key: 'x1', kind: 'something-new', questions: [{ question: 'hi' }] } }],
    ])

    expect(facts.get('A')?.kind).toBe('question')
  })

  it('accepts the live SessionStatusSnapshot map directly', () => {
    const snapshot = new Map<string, { pendingInteraction?: { key: string; kind: string; questions: { question: string }[] } }>([
      ['A', { pendingInteraction: { key: 'q1', kind: 'question', questions: [{ question: 'Pick one' }] } }],
      ['B', {}],
    ])

    const facts = collectPending(snapshot)

    expect([...facts.keys()]).toEqual(['A'])
    expect(facts.get('A')?.detail).toBe('Pick one')
  })
})
