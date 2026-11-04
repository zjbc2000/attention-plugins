/**
 * Tests for the task mode setting (`mainlineMode`): classification helper and
 * the engine behaviour the production `isMainline` port produces.
 *
 * The three modes decide *two* things: whether an unmarked completion rings on
 * its own (`now`), joins the wave summary (`aggregate`), or stays quiet
 * (`never`), and whether a wave summary may fire at all (`aggregateEnabled`,
 * which is mainline-only).
 */
import { describe, it, expect } from 'vitest'
import { NotificationEngine, type NotificationEvent, type NotificationEnginePorts, type SessionDetail } from '../src/client/engine'
import { isMainlineSession, toggleMainlineSession, type MainlineMode } from '../src/settings'
import { decideAlert } from '../src/policy'
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
}) {
  const state = { ...initial }
  const events: NotificationEvent[] = []
  const ports: NotificationEnginePorts = {
    titleOf: (id) => `Session ${id}`,
    detailOf: () => mockDetail(),
    alertAction: (kind, id) => decideAlert({
      kind,
      markedMainline: isMainlineSession(id, state.marked, state.mode),
      mainlineMode: state.mode,
      muted: false,
    }),
    runningChildren: () => 0,
    waitForSubagents: () => false,
    isMainline: (id) => isMainlineSession(id, state.marked, state.mode),
    aggregateEnabled: () => state.mode === 'mainline',
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

  it('silent mode has no main line at all, even with markers', () => {
    expect(isMainlineSession('A', [], 'silent')).toBe(false)
    expect(isMainlineSession('A', ['A'], 'silent')).toBe(false)
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

describe('three modes at a glance', () => {
  it('balanced mode alerts every task when nothing is marked', async () => {
    const { engine, events } = createEngine({ marked: [], mode: 'balanced' })

    engine.seed(mockSessionList([
      { id: 'A', running: true },
      { id: 'B', running: true },
    ]))

    // A completes while B keeps running: balanced rings it right away.
    engine.observe(mockSessionList([
      { id: 'A', running: false },
      { id: 'B', running: true },
    ]))
    await sleep()

    expect(events).toHaveLength(1)
    expect(events[0].sessionId).toBe('A')
    expect(events[0].title).toBe('Session A')

    // B completes: it rings on its own too; no aggregate "All tasks" event.
    engine.observe(mockSessionList([
      { id: 'A', running: false },
      { id: 'B', running: false },
    ]))
    await sleep()

    expect(events.map(e => e.sessionId)).toEqual(['A', 'B'])
    expect(events.some(e => e.title === 'All tasks')).toBe(false)
  })

  it('mainline mode pools unmarked completions into one wave summary', async () => {
    const { engine, events } = createEngine({ marked: [], mode: 'mainline' })

    engine.seed(mockSessionList([
      { id: 'A', running: true },
      { id: 'B', running: true },
    ]))

    // A completes while B still runs: pooled, nothing rings yet.
    engine.observe(mockSessionList([
      { id: 'A', running: false },
      { id: 'B', running: true },
    ]))
    await sleep()
    expect(events).toHaveLength(0)

    // B completes: the wave is idle, so the single summary alert goes out.
    engine.observe(mockSessionList([
      { id: 'A', running: false },
      { id: 'B', running: false },
    ]))
    await sleep()

    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('All tasks')
    expect(events[0].detail).toContain('All side-line tasks completed')
  })

  it('balanced mode rings unmarked sessions too — markers do not gate it', async () => {
    const { engine, events } = createEngine({ marked: ['B'], mode: 'balanced' })

    engine.seed(mockSessionList([
      { id: 'A', running: true },
      { id: 'B', running: true },
    ]))

    // A is unmarked, but balanced mode still rings it immediately.
    engine.observe(mockSessionList([
      { id: 'A', running: false },
      { id: 'B', running: true },
    ]))
    await sleep()
    expect(events.map(e => e.sessionId)).toEqual(['A'])
    expect(events[0].title).toBe('Session A')

    // The marked session rings as well; never a summary.
    engine.observe(mockSessionList([
      { id: 'A', running: false },
      { id: 'B', running: false },
    ]))
    await sleep()

    expect(events.map(e => e.sessionId)).toEqual(['A', 'B'])
    expect(events.some(e => e.title === 'All tasks')).toBe(false)
  })

  it('silent mode keeps completions quiet but still rings questions', async () => {
    const { engine, events } = createEngine({ marked: ['B'], mode: 'silent' })

    engine.seed(mockSessionList([
      { id: 'A', running: true },
      { id: 'B', running: true },
    ]))

    // Both finish, marked B included: no sound, no notification, no summary.
    engine.observe(mockSessionList([
      { id: 'A', running: false },
      { id: 'B', running: false },
    ]))
    await sleep()
    expect(events).toHaveLength(0)

    // A question is not a completion: it still alerts.
    engine.observePending(new Map([
      ['A', { key: 'q1', kind: 'question' as const, detail: 'Which branch?' }],
    ]))
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('question')
  })

  it('a wave with only main-line completions never triggers a summary', async () => {
    const { engine, events } = createEngine({ marked: ['A'], mode: 'mainline' })

    engine.seed(mockSessionList([{ id: 'A', running: true }]))

    engine.observe(mockSessionList([{ id: 'A', running: false }]))
    await sleep()

    expect(events.map(e => e.sessionId)).toEqual(['A'])
    expect(events.some(e => e.title === 'All tasks')).toBe(false)
  })

  it('switching to balanced mid-run promotes unmarked sessions immediately', async () => {
    const { engine, events, state } = createEngine({ marked: [], mode: 'mainline' })

    engine.observeStatus('A', true)
    engine.observeStatus('B', true)

    // Still mainline mode: nothing is marked, so A is pooled and silent.
    engine.observeStatus('A', false)
    await sleep()
    expect(events).toHaveLength(0)

    state.mode = 'balanced'

    // The pending completion of B now rings directly instead of waiting for
    // an aggregate that balanced mode never emits.
    engine.observeStatus('B', false)
    await sleep()
    expect(events).toHaveLength(1)
    expect(events[0].sessionId).toBe('B')
    expect(events[0].title).toBe('Session B')
  })
})


describe('multiple main-line markers', () => {
  it('each marked session alerts on its own while unmarked ones pool', async () => {
    const { engine, events } = createEngine({ marked: ['A', 'B'], mode: 'mainline' })

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

    // Side-line C finishes silently: it joins the pool.
    engine.observe(mockSessionList([
      { id: 'A', running: false },
      { id: 'B', running: true },
      { id: 'C', running: false },
    ]))
    await sleep()
    expect(events).toHaveLength(1)

    // Main line B finishes last: it alerts, and the wave it ended also pays
    // out the pooled C as one "All tasks" summary.
    engine.observe(mockSessionList([
      { id: 'A', running: false },
      { id: 'B', running: false },
      { id: 'C', running: false },
    ]))
    await sleep()

    expect(events.filter(e => e.title === 'All tasks')).toHaveLength(1)
    expect(events.filter(e => e.title !== 'All tasks').map(e => e.sessionId)).toEqual(['A', 'B'])
    expect(events.every(e => e.title === 'All tasks' ? e.detail === 'All side-line tasks completed' : true)).toBe(true)
  })

  it('balanced mode ignores markers: every completion alerts individually', async () => {
    const { engine, events } = createEngine({ marked: ['A', 'B'], mode: 'balanced' })

    engine.observeStatus('A', true)
    engine.observeStatus('B', true)
    engine.observeStatus('C', true)

    engine.observeStatus('A', false)
    await sleep()
    expect(events.map(e => e.sessionId)).toEqual(['A'])

    // C is unmarked, yet balanced mode still alerts it on its own.
    engine.observeStatus('C', false)
    await sleep()
    expect(events.map(e => e.sessionId)).toEqual(['A', 'C'])

    engine.observeStatus('B', false)
    await sleep()
    expect(events.map(e => e.sessionId)).toEqual(['A', 'C', 'B'])
    expect(events.some(e => e.title === 'All tasks')).toBe(false)
  })

  it('unmarking one of two main lines demotes only that session', async () => {
    const { engine, events, state } = createEngine({ marked: ['A', 'B'], mode: 'mainline' })

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
    expect(events[1].detail).toContain('All side-line tasks')
  })
})
