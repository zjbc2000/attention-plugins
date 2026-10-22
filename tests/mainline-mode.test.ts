/**
 * Tests for the task mode setting (`mainlineMode`): classification helper and
 * the engine behaviour the production `isMainline` port produces.
 */
import { describe, it, expect } from 'vitest'
import { NotificationEngine, type NotificationEvent, type NotificationEnginePorts, type SessionDetail } from '../src/client/engine'
import { isMainlineSession, toggleMainlineSession, type MainlineMode, type SidelineMode } from '../src/settings'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'

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

function mockDetail(failed: boolean = false): SessionDetail {
  return {
    maxTurnErrorSeq: failed ? 1 : 0,
    failureMessage: failed ? 'Mock error' : null,
    lastAgentError: null,
    finalText: failed ? '' : 'Done',
  }
}

/** Production wiring snapshot: read live settings on every call. */
function createEngine(initial: {
  marked: readonly string[]
  mode: MainlineMode
  sideline: SidelineMode
}) {
  const state = { ...initial }
  const events: NotificationEvent[] = []
  const ports: NotificationEnginePorts = {
    titleOf: (id) => `Session ${id}`,
    detailOf: () => mockDetail(),
    isMainline: (id) => isMainlineSession(id, state.marked, state.mode),
    sidelineMode: () => state.sideline,
    emit: (event) => events.push(event),
    settle: () => Promise.resolve(),
  }
  return { engine: new NotificationEngine(ports), events, state }
}

describe('isMainlineSession', () => {
  it('mainline mode treats every unmarked session as side-line', () => {
    expect(isMainlineSession('A', [], 'mainline')).toBe(false)
    expect(isMainlineSession('B', [], 'mainline')).toBe(false)
  })

  it('balanced mode treats every session as main-line while nothing is marked', () => {
    expect(isMainlineSession('A', [], 'balanced')).toBe(true)
    expect(isMainlineSession('B', [], 'balanced')).toBe(true)
  })

  it('a marker always wins, in either mode', () => {
    expect(isMainlineSession('A', ['A'], 'mainline')).toBe(true)
    expect(isMainlineSession('B', ['A'], 'mainline')).toBe(false)
    expect(isMainlineSession('A', ['A'], 'balanced')).toBe(true)
    expect(isMainlineSession('B', ['A'], 'balanced')).toBe(false)
  })

  it('supports several markers at once', () => {
    expect(isMainlineSession('A', ['A', 'B'], 'mainline')).toBe(true)
    expect(isMainlineSession('B', ['A', 'B'], 'mainline')).toBe(true)
    expect(isMainlineSession('C', ['A', 'B'], 'mainline')).toBe(false)
    expect(isMainlineSession('C', ['A', 'B'], 'balanced')).toBe(false)
  })
})

describe('toggleMainlineSession', () => {
  it('adds an unmarked session and removes a marked one', () => {
    expect(toggleMainlineSession([], 'A')).toEqual(['A'])
    expect(toggleMainlineSession(['A', 'B'], 'C')).toEqual(['A', 'B', 'C'])
    expect(toggleMainlineSession(['A', 'B'], 'A')).toEqual(['B'])
    expect(toggleMainlineSession(['A'], 'A')).toEqual([])
  })

  it('does not mutate the input array', () => {
    const input = ['A']
    toggleMainlineSession(input, 'B')
    expect(input).toEqual(['A'])
  })
})

const sleep = () => new Promise(resolve => setTimeout(resolve, 150))

describe('balanced mode engine behaviour', () => {
  it('batch side-line mode still alerts every task when nothing is marked', async () => {
    const { engine, events } = createEngine({ marked: [], mode: 'balanced', sideline: 'batch' })

    engine.seed(mockSessionList([
      { id: 'A', running: true },
      { id: 'B', running: true },
    ]))

    // A completes while B keeps running
    engine.observe(mockSessionList([
      { id: 'A', running: false },
      { id: 'B', running: true },
    ]))
    await sleep()

    // Balanced mode makes A main-line, so it alerts immediately instead of
    // waiting for the "all idle" aggregate.
    expect(events).toHaveLength(1)
    expect(events[0].sessionId).toBe('A')
    expect(events[0].title).toBe('Session A')

    // B completes: it alerts on its own too; no aggregate "All tasks" event.
    engine.observe(mockSessionList([
      { id: 'A', running: false },
      { id: 'B', running: false },
    ]))
    await sleep()

    expect(events).toHaveLength(2)
    expect(events.map(e => e.sessionId)).toEqual(['A', 'B'])
    expect(events.some(e => e.title === 'All tasks')).toBe(false)
  })

  it('mainline mode with batch keeps the old aggregate-per-batch behaviour', async () => {
    const { engine, events } = createEngine({ marked: [], mode: 'mainline', sideline: 'batch' })

    engine.seed(mockSessionList([
      { id: 'A', running: true },
      { id: 'B', running: true },
    ]))

    engine.observe(mockSessionList([
      { id: 'A', running: false },
      { id: 'B', running: true },
    ]))
    await sleep()
    expect(events).toHaveLength(0)

    engine.observe(mockSessionList([
      { id: 'A', running: false },
      { id: 'B', running: false },
    ]))
    await sleep()

    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('All tasks')
  })

  it('a marked main-line behaves identically in both modes', async () => {
    const { engine, events } = createEngine({ marked: ['B'], mode: 'balanced', sideline: 'batch' })

    engine.observeStatus('A', true)
    engine.observeStatus('B', true)

    engine.observeStatus('A', false)
    await sleep()
    // A is side-line in balanced mode as well: silent while B runs.
    expect(events).toHaveLength(0)

    engine.observeStatus('B', false)
    await sleep()

    // The main line alerts; no aggregate follows it.
    expect(events).toHaveLength(1)
    expect(events[0].sessionId).toBe('B')
  })

  it('switching to balanced mid-run promotes unmarked sessions immediately', async () => {
    const { engine, events, state } = createEngine({ marked: [], mode: 'mainline', sideline: 'batch' })

    engine.observeStatus('A', true)
    engine.observeStatus('B', true)

    // Still mainline mode: nothing is marked, so A is silent.
    engine.observeStatus('A', false)
    await sleep()
    expect(events).toHaveLength(0)

    state.mode = 'balanced'

    engine.observeStatus('B', false)
    await sleep()
    expect(events).toHaveLength(1)
    expect(events[0].sessionId).toBe('B')
  })
})


describe('multiple main-line markers', () => {
  it('each marked session alerts on its own in batch side-line mode', async () => {
    const { engine, events } = createEngine({ marked: ['A', 'B'], mode: 'mainline', sideline: 'batch' })

    engine.seed(mockSessionList([
      { id: 'A', running: true },
      { id: 'B', running: true },
      { id: 'C', running: true },
    ]))

    // Main line A finishes while B/C still run: alerts immediately.
    engine.observe(mockSessionList([
      { id: 'A', running: false },
      { id: 'B', running: true },
      { id: 'C', running: true },
    ]))
    await sleep()
    expect(events.map(e => e.sessionId)).toEqual(['A'])

    // Side-line C finishes silently.
    engine.observe(mockSessionList([
      { id: 'A', running: false },
      { id: 'B', running: true },
      { id: 'C', running: false },
    ]))
    await sleep()
    expect(events).toHaveLength(1)

    // Main line B finishes last: alerts, and no aggregate "All tasks" follows.
    engine.observe(mockSessionList([
      { id: 'A', running: false },
      { id: 'B', running: false },
      { id: 'C', running: false },
    ]))
    await sleep()
    expect(events.map(e => e.sessionId)).toEqual(['A', 'B'])
    expect(events.some(e => e.title === 'All tasks')).toBe(false)
  })

  it('markers make balanced mode behave exactly like mainline mode', async () => {
    const { engine, events } = createEngine({ marked: ['A', 'B'], mode: 'balanced', sideline: 'batch' })

    engine.observeStatus('A', true)
    engine.observeStatus('B', true)
    engine.observeStatus('C', true)

    engine.observeStatus('A', false)
    await sleep()
    expect(events.map(e => e.sessionId)).toEqual(['A'])

    engine.observeStatus('C', false)
    await sleep()
    // C is now side-line even in balanced mode, because markers exist.
    expect(events).toHaveLength(1)

    engine.observeStatus('B', false)
    await sleep()
    expect(events.map(e => e.sessionId)).toEqual(['A', 'B'])
  })

  it('unmarking one of two main lines demotes only that session', async () => {
    const { engine, events, state } = createEngine({ marked: ['A', 'B'], mode: 'mainline', sideline: 'batch' })

    engine.observeStatus('A', true)
    engine.observeStatus('B', true)

    // A keeps its marker: alerts individually.
    engine.observeStatus('A', false)
    await sleep()
    expect(events.map(e => e.sessionId)).toEqual(['A'])

    // B loses its marker while it is still running; its completion is now
    // side-line and announced only through the aggregate.
    state.marked = ['A']
    engine.observeStatus('B', false)
    await sleep()
    expect(events).toHaveLength(2)
    expect(events[1].title).toBe('All tasks')
  })
})
