/**
 * Tests for `src/client/notification.ts`.
 *
 * Regression cover for two user-reported defects (omdsh-dev/dsh-notification#3,
 * dingyi222666/dsh-session-notification#4):
 *  1. every event kind shared one notification tag, so a question/permission
 *     alert silently REPLACED an unread completed alert (Chromium/Windows same
 *     tag semantics). Tags must be scoped by kind AND session id.
 *  2. clicking a notification did nothing: no focus, no callback, no dismiss.
 *
 * Runs in the default `node` environment, so `window` is a stub whose prototype
 * is `globalThis` (mirroring the browser's `window === globalThis`) and the
 * Notification API is a fake class installed with `vi.stubGlobal`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotificationType } from '../src/settings'
import {
  buildNotificationOptions,
  canNotify,
  notificationTag,
  requestPermission,
  showNotification,
} from '../src/client/notification'

const KINDS: NotificationType[] = ['completed', 'failed', 'question', 'permission']
const SESSION = 'session-2006-11-04'
const OTHER_SESSION = 'session-2007-12-25'

class FakeNotification {
  static permission: NotificationPermission = 'granted'
  static instances: FakeNotification[] = []
  static requestPermission = vi.fn(async (): Promise<NotificationPermission> => 'granted')

  title: string
  options: NotificationOptions & { renotify?: boolean }
  onclick: ((this: Notification, ev: Event) => unknown) | null = null
  closeCalls = 0

  constructor(title: string, options: NotificationOptions = {}) {
    this.title = title
    this.options = options
    FakeNotification.instances.push(this)
  }

  close(): void {
    this.closeCalls += 1
  }
}

/** Install a `window` stub that inherits the globals, like a real browser. */
function installWindowStub(): void {
  const win = Object.create(globalThis) as Window & typeof globalThis
  win.focus = () => {}
  vi.stubGlobal('window', win)
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeNotification.permission = 'granted'
  FakeNotification.instances = []
  vi.stubGlobal('Notification', FakeNotification)
  installWindowStub()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('notificationTag', () => {
  it('scopes the tag by kind so a question cannot replace a completed alert', () => {
    const tags = KINDS.map((kind) => notificationTag(kind, SESSION))

    for (let i = 0; i < KINDS.length; i += 1) {
      for (let j = i + 1; j < KINDS.length; j += 1) {
        expect(tags[i], `${KINDS[i]} vs ${KINDS[j]}`).not.toBe(tags[j])
      }
    }
    expect(new Set(tags).size).toBe(KINDS.length)
    expect(notificationTag('completed', SESSION)).toBe(`attention-plugins:completed:${SESSION}`)
  })

  it('scopes the tag by session id, while same kind + same session still merges', () => {
    for (const kind of KINDS) {
      expect(notificationTag(kind, SESSION)).not.toBe(notificationTag(kind, OTHER_SESSION))
    }
    // Same kind, same session: identical tag on purpose (renotify one alert).
    expect(notificationTag('question', SESSION)).toBe(notificationTag('question', SESSION))
  })
})

describe('buildNotificationOptions', () => {
  it('always renotifies and never sets silent (renotify needs silence off)', () => {
    for (const kind of KINDS) {
      const options = buildNotificationOptions(kind)
      expect(options.renotify).toBe(true)
      expect(options.silent).not.toBe(true)
      expect(options.icon).toBe('/favicon.ico')
    }
  })

  it('locks interaction only for question and permission', () => {
    expect(buildNotificationOptions('question').requireInteraction).toBe(true)
    expect(buildNotificationOptions('permission').requireInteraction).toBe(true)
    expect(buildNotificationOptions('completed').requireInteraction).toBe(false)
    expect(buildNotificationOptions('failed').requireInteraction).toBe(false)
  })
})

describe('showNotification', () => {
  it('applies the kind/session tag plus body to the constructed notification', () => {
    expect(showNotification('permission', SESSION, 'Approve?', 'Need your ok')).toBe(true)

    const [instance] = FakeNotification.instances
    expect(FakeNotification.instances).toHaveLength(1)
    expect(instance.title).toBe('Approve?')
    expect(instance.options.body).toBe('Need your ok')
    expect(instance.options.tag).toBe(`attention-plugins:permission:${SESSION}`)
    expect(instance.options.renotify).toBe(true)
  })

  it('focuses the window, forwards the session id to onClick, and closes on click', () => {
    const focusSpy = vi.spyOn(window, 'focus')
    const onClick = vi.fn()

    expect(showNotification('question', SESSION, 'Needs input', 'Answer please', onClick)).toBe(true)
    const [instance] = FakeNotification.instances
    expect(instance.onclick).toBeTypeOf('function')

    ;(instance.onclick as () => void)()

    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledWith(SESSION)
    expect(instance.closeCalls).toBe(1)
  })

  it('still closes on click when no onClick callback was supplied', () => {
    const focusSpy = vi.spyOn(window, 'focus')
    expect(showNotification('completed', SESSION, 'Done', 'All good')).toBe(true)

    ;(FakeNotification.instances[0].onclick as () => void)()

    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(FakeNotification.instances[0].closeCalls).toBe(1)
  })

  it('auto-closes completed after 5s, but leaves question open past 10s', () => {
    expect(showNotification('completed', SESSION, 'Done', 'Completed')).toBe(true)
    expect(showNotification('question', SESSION, 'Needs answer', 'Waiting')).toBe(true)
    const [completed, question] = FakeNotification.instances

    vi.advanceTimersByTime(4999)
    expect(completed.closeCalls).toBe(0)
    expect(question.closeCalls).toBe(0)

    vi.advanceTimersByTime(1)
    expect(completed.closeCalls).toBe(1)
    expect(question.closeCalls).toBe(0)

    vi.advanceTimersByTime(5001) // 10s total
    expect(question.closeCalls).toBe(0)
    expect(completed.closeCalls).toBe(1) // never closed twice
  })

  it('also auto-closes failed after 5s', () => {
    expect(showNotification('failed', SESSION, 'Failed', 'Session errored')).toBe(true)
    const [failed] = FakeNotification.instances

    vi.advanceTimersByTime(5000)
    expect(failed.closeCalls).toBe(1)
  })

  it('returns false and constructs nothing when permission is denied', () => {
    FakeNotification.permission = 'denied'

    expect(canNotify()).toBe(false)
    expect(showNotification('completed', SESSION, 'Done', 'Completed')).toBe(false)
    expect(FakeNotification.instances).toHaveLength(0)
  })

  it('warns and returns false when the Notification constructor throws', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    class ThrowingNotification {
      static permission = 'granted'
      constructor() {
        throw new Error('boom')
      }
    }
    vi.stubGlobal('Notification', ThrowingNotification)

    expect(showNotification('completed', SESSION, 'Done', 'Completed')).toBe(false)
    expect(warnSpy).toHaveBeenCalled()
    expect(String(warnSpy.mock.calls[0][0])).toContain('[attention-plugins]')
  })
})

describe('requestPermission', () => {
  it('returns true immediately when already granted, without prompting', async () => {
    FakeNotification.permission = 'granted'

    await expect(requestPermission()).resolves.toBe(true)
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled()
  })

  it('returns false immediately when denied, without prompting', async () => {
    FakeNotification.permission = 'denied'

    await expect(requestPermission()).resolves.toBe(false)
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled()
  })
})
