/**
 * Tests for NotificationEngine: three-way mode behaviour, main-line/side-line
 * classification and event classification.
 *
 * The engine itself only asks `ports.alertAction` what to do with one event
 * (`now` / `aggregate` / `never`) and `ports.aggregateEnabled` whether a pooled
 * wave may chime at all, so these tests compute the action from the same public
 * policy (`decideAlert`) the browser wiring uses.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { NotificationEngine, type NotificationEvent, type NotificationEnginePorts, type SessionDetail } from '../src/client/engine'
import type { MainlineMode } from '../src/settings'
import { decideAlert } from '../src/policy'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'

/** Mock sessions list state. */
function mockSessionList(sessions: Array<{ id: string; running: boolean }>): SessionListState {
  return {
    ids: sessions.map(s => s.id),
    byId: Object.fromEntries(sessions.map(s => [s.id, { id: s.id, running: s.running, title: `Session ${s.id}` }])),
    current: null,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
  } as any
}

/** Mock session detail (minimal for classification). */
function mockDetail(failed: boolean = false): SessionDetail {
  return {
    maxTurnErrorSeq: failed ? 1 : 0,
    failureMessage: failed ? 'Mock error' : null,
    lastAgentError: null,
    finalText: failed ? '' : 'Done',
  }
}

describe('NotificationEngine', () => {
  let emittedEvents: NotificationEvent[]
  let mainlineSessionId: string | null
  let mainlineMode: MainlineMode
  let mutedSessionId: string | null
  let waitForSubagents: boolean
  let childrenRunning: Map<string, number>
  let engine: NotificationEngine
  let ports: NotificationEnginePorts

  /** Pooled summary alerts in the order they were emitted. */
  const aggregates = () => emittedEvents.filter(e => e.title === 'All tasks')
  /** Per-session alerts (everything the aggregate did not cover). */
  const individual = () => emittedEvents.filter(e => e.title !== 'All tasks')

  beforeEach(() => {
    emittedEvents = []
    mainlineSessionId = null
    mainlineMode = 'mainline' // production default
    mutedSessionId = null
    waitForSubagents = false
    childrenRunning = new Map()

    ports = {
      titleOf: (id) => `Session ${id}`,
      detailOf: (id) => mockDetail(),
      alertAction: (kind, id) => decideAlert({
        kind,
        markedMainline: id === mainlineSessionId,
        mainlineMode,
        muted: id === mutedSessionId,
      }),
      runningChildren: (id) => childrenRunning.get(id) ?? 0,
      waitForSubagents: () => waitForSubagents,
      isMainline: (id) => id === mainlineSessionId,
      aggregateEnabled: () => mainlineMode === 'mainline',
      emit: (event) => emittedEvents.push(event),
      settle: () => Promise.resolve(),
    }

    engine = new NotificationEngine(ports)
  })

  describe('Balanced mode (every completion alerts)', () => {
    beforeEach(() => {
      mainlineMode = 'balanced'
    })

    it('should notify for every unmarked session as it completes', async () => {
      // Seed: A, B, C all running, none marked main-line
      engine.seed(mockSessionList([
        { id: 'A', running: true },
        { id: 'B', running: true },
        { id: 'C', running: true },
      ]))

      // A completes while B and C keep running
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: true },
        { id: 'C', running: true },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // Balanced mode alerts A on its own — no "wait for everyone" behaviour
      expect(individual()).toHaveLength(1)
      expect(individual()[0].kind).toBe('completed')
      expect(individual()[0].sessionId).toBe('A')
      expect(individual()[0].title).toBe('Session A')
      expect(individual()[0].detail).toBe('Done')
      expect(aggregates()).toHaveLength(0)
    })

    it('should ring once per finished task (N tasks = N alerts)', async () => {
      engine.seed(mockSessionList([
        { id: 'A', running: true },
        { id: 'B', running: true },
        { id: 'C', running: true },
      ]))

      for (const done of ['A', 'B', 'C']) {
        engine.observe(mockSessionList([
          { id: 'A', running: done === 'A' ? false : true },
          { id: 'B', running: done === 'B' ? false : true },
          { id: 'C', running: done === 'C' ? false : true },
        ]))
        await new Promise(resolve => setTimeout(resolve, 150))
      }

      expect(emittedEvents.map(e => e.sessionId)).toEqual(['A', 'B', 'C'])
      // No aggregate "All tasks" alert is added on top.
      expect(aggregates()).toHaveLength(0)
    })

    it('should NOT emit the aggregate "All tasks" alert', async () => {
      engine.seed(mockSessionList([
        { id: 'A', running: true },
        { id: 'B', running: true },
      ]))

      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: true },
      ]))
      await new Promise(resolve => setTimeout(resolve, 150))

      // B is the last one running: the all-idle edge must stay silent
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
      ]))
      await new Promise(resolve => setTimeout(resolve, 150))

      expect(emittedEvents.map(e => e.sessionId)).toEqual(['A', 'B'])
      expect(aggregates()).toHaveLength(0)
    })

    it('should classify an unmarked failure like any other run', async () => {
      let runStarted = false
      ports.detailOf = () => mockDetail(runStarted)

      engine.seed(mockSessionList([{ id: 'A', running: true }]))
      runStarted = true

      engine.observe(mockSessionList([{ id: 'A', running: false }]))
      await new Promise(resolve => setTimeout(resolve, 150))

      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].kind).toBe('failed')
      expect(emittedEvents[0].sessionId).toBe('A')
    })

    it('should alert a marked main-line and an unmarked session identically', async () => {
      mainlineSessionId = 'MAIN'

      engine.seed(mockSessionList([
        { id: 'MAIN', running: true },
        { id: 'A', running: true },
      ]))

      // Both complete at once
      engine.observe(mockSessionList([
        { id: 'MAIN', running: false },
        { id: 'A', running: false },
      ]))
      await new Promise(resolve => setTimeout(resolve, 150))

      expect(emittedEvents.map(e => e.sessionId).sort()).toEqual(['A', 'MAIN'])
      expect(aggregates()).toHaveLength(0)
    })
  })

  describe('Mainline mode aggregation (unmarked completions pool)', () => {
    it('should NOT notify when a single unmarked session completes (others still running)', async () => {
      // Seed: A, B, C all running, none marked main-line
      engine.seed(mockSessionList([
        { id: 'A', running: true },
        { id: 'B', running: true },
        { id: 'C', running: true },
      ]))

      // A completes, B and C still running: it joins the aggregate instead of
      // ringing on its own.
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: true },
        { id: 'C', running: true },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(emittedEvents).toHaveLength(0)
    })

    it('should notify once when ALL sessions become idle (side-line complete)', async () => {
      engine.seed(mockSessionList([
        { id: 'A', running: true },
        { id: 'B', running: true },
      ]))

      // A completes while B keeps running: pooled, stays quiet.
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: true },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))
      expect(emittedEvents).toHaveLength(0)

      // B also completes → all idle: the wave's one summary alert.
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(aggregates()).toHaveLength(1)
      expect(aggregates()[0].kind).toBe('completed')
      expect(aggregates()[0].title).toBe('All tasks')
      expect(aggregates()[0].detail).toContain('All side-line tasks')
      // No unmarked session rang on its own.
      expect(individual()).toHaveLength(0)
    })

    it('should handle new wave: a later unmarked completion aggregates again', async () => {
      engine.seed(mockSessionList([
        { id: 'A', running: true },
        { id: 'B', running: true },
      ]))

      // Both complete together → one pooled summary for the wave.
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))
      expect(aggregates()).toHaveLength(1)

      emittedEvents.length = 0

      // New wave: C starts and completes on its own.
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
        { id: 'C', running: true },
      ]))

      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
        { id: 'C', running: false },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(aggregates()).toHaveLength(1)
      expect(aggregates()[0].kind).toBe('completed')
      expect(individual()).toHaveLength(0)
    })

    it('should honour a mid-run switch from mainline to balanced', async () => {
      engine.seed(mockSessionList([
        { id: 'A', running: true },
        { id: 'B', running: true },
      ]))

      // Mainline mode: A is unmarked, so its completion is pooled and silent.
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: true },
      ]))
      await new Promise(resolve => setTimeout(resolve, 150))
      expect(emittedEvents).toHaveLength(0)

      // User switches to balanced while B is still running: B now rings on its
      // own completion instead of waiting for the all-idle aggregate.
      mainlineMode = 'balanced'

      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
      ]))
      await new Promise(resolve => setTimeout(resolve, 150))

      expect(emittedEvents.map(e => e.sessionId)).toEqual(['B'])
      expect(aggregates()).toHaveLength(0)
    })

    it('should honour a mid-run switch from balanced to mainline', async () => {
      mainlineMode = 'balanced'

      engine.seed(mockSessionList([
        { id: 'A', running: true },
        { id: 'B', running: true },
      ]))

      // Balanced: A rings on its own.
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: true },
      ]))
      await new Promise(resolve => setTimeout(resolve, 150))
      expect(emittedEvents.map(e => e.sessionId)).toEqual(['A'])

      // Back to mainline while B runs: B is unmarked again and is pooled.
      mainlineMode = 'mainline'

      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
      ]))
      await new Promise(resolve => setTimeout(resolve, 150))

      expect(individual().map(e => e.sessionId)).toEqual(['A'])
      expect(aggregates()).toHaveLength(1)
    })
  })

  describe('Silent mode', () => {
    beforeEach(() => {
      mainlineMode = 'silent'
    })

    it('should stay silent for completions, failures and markers alike', async () => {
      mainlineSessionId = 'MAIN'
      let runStarted = false
      ports.detailOf = () => mockDetail(runStarted)

      engine.seed(mockSessionList([
        { id: 'MAIN', running: true },
        { id: 'A', running: true },
      ]))

      // MAIN fails, A completes: neither completion may ring.
      runStarted = true
      engine.observe(mockSessionList([
        { id: 'MAIN', running: false },
        { id: 'A', running: false },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(emittedEvents).toHaveLength(0)
      expect(aggregates()).toHaveLength(0)
    })

    it('should still alert questions and permission requests', () => {
      engine.observePending(new Map([
        ['A', { key: 'q1', kind: 'question' as const, detail: 'What next?' }],
      ]))
      engine.observePending(new Map([
        ['A', { key: 'a1', kind: 'approval' as const, detail: 'Allow tool X?' }],
      ]))

      expect(emittedEvents.map(e => e.kind)).toEqual(['question', 'permission'])
    })
  })

  describe('Main-line logic', () => {
    it('should notify immediately when main-line session completes', async () => {
      mainlineSessionId = 'MAIN'

      // Seed: MAIN + A running
      engine.seed(mockSessionList([
        { id: 'MAIN', running: true },
        { id: 'A', running: true },
      ]))

      // MAIN completes (A still running)
      engine.observe(mockSessionList([
        { id: 'MAIN', running: false },
        { id: 'A', running: true },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // Main-line alerts immediately
      expect(individual()).toHaveLength(1)
      expect(individual()[0].kind).toBe('completed')
      expect(individual()[0].sessionId).toBe('MAIN')
      expect(individual()[0].title).toBe('Session MAIN')
      expect(aggregates()).toHaveLength(0)
    })

    it('should NOT trigger the aggregate when main-line completes (others still running)', async () => {
      mainlineSessionId = 'MAIN'

      engine.seed(mockSessionList([
        { id: 'MAIN', running: true },
        { id: 'A', running: true },
      ]))

      // MAIN completes
      engine.observe(mockSessionList([
        { id: 'MAIN', running: false },
        { id: 'A', running: true },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // Only the main-line event, no summary yet.
      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].sessionId).toBe('MAIN')
    })

    it('should trigger both main-line AND the pooled summary when all complete', async () => {
      mainlineSessionId = 'MAIN'

      engine.seed(mockSessionList([
        { id: 'MAIN', running: true },
        { id: 'A', running: true },
      ]))

      // Both complete at once
      engine.observe(mockSessionList([
        { id: 'MAIN', running: false },
        { id: 'A', running: false },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // The main line rings for itself; the unmarked sibling only reaches the
      // user through the wave's single summary alert.
      expect(individual().map(e => e.sessionId)).toEqual(['MAIN'])
      expect(individual()[0].kind).toBe('completed')
      expect(aggregates()).toHaveLength(1)
      expect(aggregates()[0].title).toBe('All tasks')
    })

    it('should not ring the summary for a wave that only had a main line', async () => {
      mainlineSessionId = 'MAIN'

      engine.seed(mockSessionList([{ id: 'MAIN', running: true }]))
      engine.observe(mockSessionList([{ id: 'MAIN', running: false }]))

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(individual()).toHaveLength(1)
      expect(aggregates()).toHaveLength(0)
    })
  })

  describe('Event classification: completed vs failed', () => {
    it('should emit "completed" for successful session', async () => {
      mainlineSessionId = 'A'
      ports.detailOf = () => mockDetail(false) // Success

      engine.seed(mockSessionList([{ id: 'A', running: true }]))
      engine.observe(mockSessionList([{ id: 'A', running: false }]))

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].kind).toBe('completed')
      expect(emittedEvents[0].detail).toContain('Done')
    })

    it('should emit "failed" for session with errors', async () => {
      mainlineSessionId = 'A'
      let runStarted = false

      ports.detailOf = () => {
        // Before run: no error; after run: error
        return mockDetail(runStarted)
      }

      engine.seed(mockSessionList([{ id: 'A', running: true }]))
      runStarted = true

      engine.observe(mockSessionList([{ id: 'A', running: false }]))

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].kind).toBe('failed')
      expect(emittedEvents[0].detail).toContain('Mock error')
    })

    // The production wiring cannot read error state from the session list row
    // (SessionSummary has no error fields), so failure classification rides on
    // the api-session/error remote event. These cover that path directly.
    it('should emit "failed" when api-session/error arrives during the run', async () => {
      mainlineSessionId = 'A'
      // Detail stays clean: only the error event marks the failure.
      ports.detailOf = () => mockDetail(false)

      engine.seed(mockSessionList([{ id: 'A', running: true }]))
      engine.observeError('A', 'Provider returned 500')

      engine.observe(mockSessionList([{ id: 'A', running: false }]))

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].kind).toBe('failed')
      expect(emittedEvents[0].detail).toBe('Provider returned 500')
    })

    it('should still emit "completed" when an error predates the run', async () => {
      mainlineSessionId = 'A'
      ports.detailOf = () => mockDetail(false)

      // Error from an earlier, already-finished run.
      engine.observeError('A', 'Old failure')

      engine.seed(mockSessionList([{ id: 'A', running: true }]))
      engine.observe(mockSessionList([{ id: 'A', running: false }]))

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].kind).toBe('completed')
    })

    it('should detect a failure repeated with an identical message', async () => {
      mainlineSessionId = 'A'
      ports.detailOf = () => mockDetail(false)

      // First run fails.
      engine.seed(mockSessionList([{ id: 'A', running: true }]))
      engine.observeError('A', 'Same message')
      engine.observe(mockSessionList([{ id: 'A', running: false }]))
      await new Promise(resolve => setTimeout(resolve, 150))

      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].kind).toBe('failed')

      // Second run fails with the byte-identical message: comparing messages
      // alone would swallow this, counting occurrences must not.
      engine.observe(mockSessionList([{ id: 'A', running: true }]))
      engine.observeError('A', 'Same message')
      engine.observe(mockSessionList([{ id: 'A', running: false }]))
      await new Promise(resolve => setTimeout(resolve, 150))

      expect(emittedEvents).toHaveLength(2)
      expect(emittedEvents[1].kind).toBe('failed')
    })

    it('should classify an unmarked completion for the aggregate', async () => {
      // No marker: in mainline mode the completion is pooled, and the pooled
      // summary carries the completed kind (not a per-session failure).
      let runStarted = false
      ports.detailOf = () => mockDetail(runStarted)

      engine.seed(mockSessionList([{ id: 'A', running: true }]))
      runStarted = true
      engine.observe(mockSessionList([{ id: 'A', running: false }]))

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(individual()).toHaveLength(0)
      expect(aggregates()).toHaveLength(1)
      expect(aggregates()[0].kind).toBe('completed')
      expect(aggregates()[0].detail).toContain('All side-line tasks')
    })
  })

  describe('Edge cases', () => {
    it('should handle session removal during run', async () => {
      engine.seed(mockSessionList([
        { id: 'A', running: true },
        { id: 'B', running: true },
      ]))

      // A removed mid-run
      engine.observe(mockSessionList([
        { id: 'B', running: true },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // No crash, no spurious events
      expect(emittedEvents).toHaveLength(0)
    })

    it('should not notify for sessions idle at seed time', async () => {
      // A already idle at seed
      engine.seed(mockSessionList([
        { id: 'A', running: false },
      ]))

      // Still idle
      engine.observe(mockSessionList([
        { id: 'A', running: false },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // No notification for pre-existing idle
      expect(emittedEvents).toHaveLength(0)
    })

    it('should handle rapid start/stop cycles', async () => {
      mainlineSessionId = 'A'

      engine.seed(mockSessionList([{ id: 'A', running: false }]))

      // Start
      engine.observe(mockSessionList([{ id: 'A', running: true }]))

      // Stop quickly
      engine.observe(mockSessionList([{ id: 'A', running: false }]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // Should emit once
      expect(emittedEvents.length).toBeGreaterThanOrEqual(1)
      expect(emittedEvents[0].sessionId).toBe('A')
    })
  })

  describe('Pending interactions (question/permission)', () => {
    it('should emit "question" on new question interaction', () => {
      const pending = new Map([
        ['A', { key: 'q1', kind: 'question' as const, detail: 'What next?' }],
      ])

      engine.observePending(pending)

      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].kind).toBe('question')
      expect(emittedEvents[0].detail).toBe('What next?')
    })

    it('should emit "permission" for approval interactions', () => {
      const pending = new Map([
        ['A', { key: 'a1', kind: 'approval' as const, detail: 'Allow tool X?' }],
      ])

      engine.observePending(pending)

      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].kind).toBe('permission')
      expect(emittedEvents[0].detail).toBe('Allow tool X?')
    })

    it('should NOT re-emit for same interaction key', () => {
      const pending = new Map([
        ['A', { key: 'q1', kind: 'question' as const, detail: 'What?' }],
      ])

      engine.observePending(pending)
      expect(emittedEvents).toHaveLength(1)

      // Same key again
      engine.observePending(pending)
      expect(emittedEvents).toHaveLength(1) // No duplicate
    })

    it('should emit on interaction replacement (new key)', () => {
      engine.observePending(new Map([
        ['A', { key: 'q1', kind: 'question' as const, detail: 'First' }],
      ]))

      expect(emittedEvents).toHaveLength(1)

      // New key = replacement
      engine.observePending(new Map([
        ['A', { key: 'q2', kind: 'question' as const, detail: 'Second' }],
      ]))

      expect(emittedEvents).toHaveLength(2)
      expect(emittedEvents[1].detail).toBe('Second')
    })

    it('should record the first snapshot silently, then notify on changes', () => {
      // Already-pending request at page load: recorded, not announced.
      engine.observePending(new Map([
        ['A', { key: 'q1', kind: 'question' as const, detail: 'Already open' }],
      ]), { silent: true })

      expect(emittedEvents).toHaveLength(0)

      // A genuinely new request after load still notifies.
      engine.observePending(new Map([
        ['A', { key: 'q2', kind: 'question' as const, detail: 'New one' }],
      ]))

      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].detail).toBe('New one')
    })

    it('should clear the de-dup key once the interaction is answered', () => {
      engine.observePending(new Map([
        ['A', { key: 'q1', kind: 'question' as const, detail: 'What?' }],
      ]))
      expect(emittedEvents).toHaveLength(1)

      // Answered: the session drops out of the pending map.
      engine.observePending(new Map())

      // The same key reappearing later is a new request, not a duplicate.
      engine.observePending(new Map([
        ['A', { key: 'q1', kind: 'question' as const, detail: 'What?' }],
      ]))

      expect(emittedEvents).toHaveLength(2)
    })

    it('should stop tracking pending state for removed sessions', () => {
      engine.observePending(new Map([
        ['A', { key: 'q1', kind: 'question' as const, detail: 'What?' }],
      ]))
      expect(emittedEvents).toHaveLength(1)

      engine.observeRemoved('A')

      engine.observePending(new Map([
        ['A', { key: 'q1', kind: 'question' as const, detail: 'What?' }],
      ]))

      expect(emittedEvents).toHaveLength(2)
    })

    it('should keep a muted session silent for questions too', () => {
      mutedSessionId = 'A'

      engine.observePending(new Map([
        ['A', { key: 'q1', kind: 'question' as const, detail: 'What?' }],
      ]))

      expect(emittedEvents).toHaveLength(0)
    })
  })

  describe('Subagent deferral', () => {
    it('should defer a main-line completion until its children stop running', async () => {
      mainlineSessionId = 'A'
      waitForSubagents = true
      childrenRunning.set('A', 1)

      engine.seed(mockSessionList([{ id: 'A', running: true }]))
      engine.observe(mockSessionList([{ id: 'A', running: false }]))

      await new Promise(resolve => setTimeout(resolve, 150))
      expect(emittedEvents).toHaveLength(0)

      // Last child goes idle: the held completion is released.
      childrenRunning.set('A', 0)
      engine.observeStatus('child', false)

      await new Promise(resolve => setTimeout(resolve, 150))
      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].sessionId).toBe('A')
    })

    it('should alert immediately when subagent waiting is disabled', async () => {
      mainlineSessionId = 'A'
      waitForSubagents = false
      childrenRunning.set('A', 1)

      engine.seed(mockSessionList([{ id: 'A', running: true }]))
      engine.observe(mockSessionList([{ id: 'A', running: false }]))

      await new Promise(resolve => setTimeout(resolve, 150))
      expect(emittedEvents).toHaveLength(1)
    })
  })
})
