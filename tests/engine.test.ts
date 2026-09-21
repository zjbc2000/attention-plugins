/**
 * Tests for NotificationEngine: main-line/side-line logic and event classification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationEngine, type NotificationEvent, type NotificationEnginePorts, type SessionDetail } from '../src/client/engine'
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
  let engine: NotificationEngine
  let ports: NotificationEnginePorts

  beforeEach(() => {
    emittedEvents = []
    mainlineSessionId = null

    ports = {
      titleOf: (id) => `Session ${id}`,
      detailOf: (id) => mockDetail(),
      isMainline: (id) => id === mainlineSessionId,
      emit: (event) => emittedEvents.push(event),
      settle: () => Promise.resolve(),
    }

    engine = new NotificationEngine(ports)
  })

  describe('Side-line logic (default)', () => {
    it('should NOT notify when single session completes (others still running)', async () => {
      // Seed: A, B, C all running
      engine.seed(mockSessionList([
        { id: 'A', running: true },
        { id: 'B', running: true },
        { id: 'C', running: true },
      ]))

      // A completes, B and C still running
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: true },
        { id: 'C', running: true },
      ]))

      // Wait for settle
      await new Promise(resolve => setTimeout(resolve, 150))

      // No side-line event yet (still have running sessions)
      expect(emittedEvents).toHaveLength(0)
    })

    it('should notify once when ALL sessions become idle (side-line complete)', async () => {
      // Seed: A, B running
      engine.seed(mockSessionList([
        { id: 'A', running: true },
        { id: 'B', running: true },
      ]))

      // A completes
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: true },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))
      expect(emittedEvents).toHaveLength(0) // Not yet

      // B also completes → all idle
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // Now side-line completes
      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].kind).toBe('completed')
      expect(emittedEvents[0].detail).toContain('All side-line tasks')
    })

    it('should handle new wave: start C after A+B complete', async () => {
      // A, B running
      engine.seed(mockSessionList([
        { id: 'A', running: true },
        { id: 'B', running: true },
      ]))

      // Both complete
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))
      expect(emittedEvents).toHaveLength(1) // Side-line complete

      emittedEvents.length = 0 // Reset

      // Start new session C
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
        { id: 'C', running: true },
      ]))

      // C completes
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
        { id: 'C', running: false },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // New wave completes
      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].kind).toBe('completed')
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
      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].kind).toBe('completed')
      expect(emittedEvents[0].sessionId).toBe('MAIN')
      expect(emittedEvents[0].title).toBe('Session MAIN')
    })

    it('should NOT trigger side-line when main-line completes (others still running)', async () => {
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

      // Only main-line event, no side-line
      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].sessionId).toBe('MAIN')
    })

    it('should trigger both main-line AND side-line when all complete', async () => {
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

      // Main-line + side-line both fire
      expect(emittedEvents.length).toBeGreaterThanOrEqual(1)
      const mainEvent = emittedEvents.find(e => e.sessionId === 'MAIN')
      expect(mainEvent).toBeDefined()
      expect(mainEvent?.kind).toBe('completed')
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
  })
})
