/**
 * Additional tests for main-line/side-line logic with complex scenarios.
 * Ensures the new logic doesn't break DSH's original functionality.
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

/** Mock session detail. */
function mockDetail(failed: boolean = false): SessionDetail {
  return {
    maxTurnErrorSeq: failed ? 1 : 0,
    failureMessage: failed ? 'Mock error' : null,
    lastAgentError: null,
    finalText: failed ? '' : 'Done',
  }
}

describe('NotificationEngine - Main-line/Side-line Advanced', () => {
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

  describe('Complex main-line scenarios', () => {
    it('should allow switching main-line mid-run', async () => {
      mainlineSessionId = 'A'

      // Start A (main) and B (side)
      engine.seed(mockSessionList([
        { id: 'A', running: true },
        { id: 'B', running: true },
      ]))

      // Switch main-line from A to B while both running
      mainlineSessionId = 'B'

      // A completes (now it's side-line)
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: true },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // A should NOT notify (it's no longer main-line)
      expect(emittedEvents).toHaveLength(0)

      // B completes (it's main-line now)
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // B alerts as main-line
      expect(emittedEvents.length).toBeGreaterThanOrEqual(1)
      const mainEvent = emittedEvents.find(e => e.sessionId === 'B')
      expect(mainEvent).toBeDefined()
    })

    it('should handle multiple main-line sessions (only latest counts)', async () => {
      // Start A, B, C all running
      engine.seed(mockSessionList([
        { id: 'A', running: true },
        { id: 'B', running: true },
        { id: 'C', running: true },
      ]))

      // Mark A as main-line
      mainlineSessionId = 'A'

      // A completes
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: true },
        { id: 'C', running: true },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].sessionId).toBe('A')

      emittedEvents.length = 0

      // Now mark C as main-line (switch)
      mainlineSessionId = 'C'

      // C completes
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: true },
        { id: 'C', running: false },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // C alerts as main-line
      expect(emittedEvents.length).toBeGreaterThanOrEqual(1)
      const cEvent = emittedEvents.find(e => e.sessionId === 'C')
      expect(cEvent).toBeDefined()
    })

    it('should NOT break when main-line ID points to non-existent session', async () => {
      mainlineSessionId = 'GHOST' // Non-existent session

      // A and B running
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

      // Side-line completes (no crash, no main-line event for GHOST)
      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].detail).toContain('All side-line')
    })
  })

  describe('Side-line robustness', () => {
    it('should handle rapid consecutive completions', async () => {
      // Start 5 sessions
      engine.seed(mockSessionList([
        { id: 'A', running: true },
        { id: 'B', running: true },
        { id: 'C', running: true },
        { id: 'D', running: true },
        { id: 'E', running: true },
      ]))

      // A completes
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: true },
        { id: 'C', running: true },
        { id: 'D', running: true },
        { id: 'E', running: true },
      ]))

      // B and C complete together
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
        { id: 'C', running: false },
        { id: 'D', running: true },
        { id: 'E', running: true },
      ]))

      // D completes
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
        { id: 'C', running: false },
        { id: 'D', running: false },
        { id: 'E', running: true },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // Still E running, no side-line yet
      expect(emittedEvents).toHaveLength(0)

      // E completes → all idle
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
        { id: 'C', running: false },
        { id: 'D', running: false },
        { id: 'E', running: false },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // Side-line fires once
      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].kind).toBe('completed')
    })

    it('should handle interleaved start/stop cycles', async () => {
      // Wave 1: A starts
      engine.seed(mockSessionList([{ id: 'A', running: true }]))

      // A completes → side-line
      engine.observe(mockSessionList([{ id: 'A', running: false }]))

      await new Promise(resolve => setTimeout(resolve, 150))
      expect(emittedEvents).toHaveLength(1)
      emittedEvents.length = 0

      // Wave 2: B starts while A is idle
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: true },
      ]))

      // Wave 2: C also starts
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: true },
        { id: 'C', running: true },
      ]))

      // B completes
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
        { id: 'C', running: true },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))
      expect(emittedEvents).toHaveLength(0) // C still running

      // C completes → wave 2 done
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
        { id: 'C', running: false },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // Side-line fires for wave 2
      expect(emittedEvents).toHaveLength(1)
    })

    it('should NOT fire side-line when going from "no sessions" to "no sessions"', async () => {
      // Seed with no sessions
      engine.seed(mockSessionList([]))

      // Still no sessions
      engine.observe(mockSessionList([]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // No spurious notification
      expect(emittedEvents).toHaveLength(0)
    })

    it('should handle all sessions starting idle', async () => {
      // Seed all idle
      engine.seed(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
      ]))

      // Still all idle
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // No notification (no running → idle transition)
      expect(emittedEvents).toHaveLength(0)
    })
  })

  describe('Main-line suppression edge cases', () => {
    it('should suppress side-line when main-line causes "all idle"', async () => {
      mainlineSessionId = 'MAIN'

      // Only main-line running
      engine.seed(mockSessionList([{ id: 'MAIN', running: true }]))

      // Main completes → also causes "all idle"
      engine.observe(mockSessionList([{ id: 'MAIN', running: false }]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // Only main-line event, no duplicate side-line
      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].sessionId).toBe('MAIN')
      expect(emittedEvents[0].kind).toBe('completed')
    })

    it('should NOT suppress side-line when main-line completes but others still running', async () => {
      mainlineSessionId = 'MAIN'

      engine.seed(mockSessionList([
        { id: 'MAIN', running: true },
        { id: 'A', running: true },
        { id: 'B', running: true },
      ]))

      // Main completes, A and B still running
      engine.observe(mockSessionList([
        { id: 'MAIN', running: false },
        { id: 'A', running: true },
        { id: 'B', running: true },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // Main-line fires
      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].sessionId).toBe('MAIN')

      emittedEvents.length = 0

      // A and B complete → side-line
      engine.observe(mockSessionList([
        { id: 'MAIN', running: false },
        { id: 'A', running: false },
        { id: 'B', running: false },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // Side-line fires (no main-line this time)
      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].detail).toContain('All side-line')
    })

    it('should suppress side-line only in the SAME observe() call', async () => {
      mainlineSessionId = 'MAIN'

      engine.seed(mockSessionList([
        { id: 'MAIN', running: true },
        { id: 'A', running: true },
      ]))

      // Main completes (separate observe call)
      engine.observe(mockSessionList([
        { id: 'MAIN', running: false },
        { id: 'A', running: true },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))
      expect(emittedEvents).toHaveLength(1) // Main-line
      emittedEvents.length = 0

      // A completes (different observe call → no suppression)
      engine.observe(mockSessionList([
        { id: 'MAIN', running: false },
        { id: 'A', running: false },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // Side-line fires (not suppressed, different call)
      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].detail).toContain('All side-line')
    })
  })

  describe('Doesn\'t break DSH original behavior', () => {
    it('should work without any main-line (pure side-line mode)', async () => {
      // No main-line set
      mainlineSessionId = null

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
      expect(emittedEvents).toHaveLength(0)

      // B completes
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // Side-line fires
      expect(emittedEvents).toHaveLength(1)
    })

    it('should preserve turn-error detection for failed events', async () => {
      mainlineSessionId = 'A'
      let runStarted = false

      ports.detailOf = () => mockDetail(runStarted)

      engine.seed(mockSessionList([{ id: 'A', running: true }]))
      runStarted = true

      engine.observe(mockSessionList([{ id: 'A', running: false }]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // Failed event still fires for main-line
      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].kind).toBe('failed')
    })

    it('should preserve pending interaction detection', async () => {
      mainlineSessionId = 'A'

      engine.seed(mockSessionList([{ id: 'A', running: true }]))

      // Question interaction arrives
      engine.observePending(new Map([
        ['A', { key: 'q1', kind: 'question' as const, detail: 'What?' }],
      ]))

      // Question event fires (independent of main-line/side-line)
      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].kind).toBe('question')
    })

    it('should preserve session removal cleanup', async () => {
      mainlineSessionId = 'A'

      engine.seed(mockSessionList([
        { id: 'A', running: true },
        { id: 'B', running: true },
      ]))

      // A removed mid-run
      engine.observe(mockSessionList([
        { id: 'B', running: true },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // No crash, state cleaned
      expect(emittedEvents).toHaveLength(0)

      // B completes normally
      engine.observe(mockSessionList([
        { id: 'B', running: false },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // Side-line fires for B
      expect(emittedEvents).toHaveLength(1)
    })
  })

  describe('Performance and stress', () => {
    it('should handle 20 sessions completing in sequence', async () => {
      const sessions = Array.from({ length: 20 }, (_, i) => ({ id: `S${i}`, running: true }))
      engine.seed(mockSessionList(sessions))

      // Complete one by one
      for (let i = 0; i < 19; i++) {
        sessions[i].running = false
        engine.observe(mockSessionList(sessions))
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      expect(emittedEvents).toHaveLength(0) // Still one running

      // Last one completes
      sessions[19].running = false
      engine.observe(mockSessionList(sessions))

      await new Promise(resolve => setTimeout(resolve, 150))

      // Side-line fires once
      expect(emittedEvents).toHaveLength(1)
    })

    it('should handle rapid main-line switching', async () => {
      engine.seed(mockSessionList([
        { id: 'A', running: true },
        { id: 'B', running: true },
      ]))

      for (let i = 0; i < 10; i++) {
        mainlineSessionId = i % 2 === 0 ? 'A' : 'B'
        engine.observe(mockSessionList([
          { id: 'A', running: true },
          { id: 'B', running: true },
        ]))
      }

      // Both complete
      mainlineSessionId = 'A'
      engine.observe(mockSessionList([
        { id: 'A', running: false },
        { id: 'B', running: false },
      ]))

      await new Promise(resolve => setTimeout(resolve, 150))

      // Main-line fires (A was last main-line)
      expect(emittedEvents.length).toBeGreaterThanOrEqual(1)
      const mainEvent = emittedEvents.find(e => e.sessionId === 'A')
      expect(mainEvent).toBeDefined()
    })
  })
})
