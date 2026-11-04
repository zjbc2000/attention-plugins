/**
 * Browser notification utilities for attention-plugins.
 * Uses the Notification API to show system notifications when the user
 * is not looking at the DSH tab.
 */
import type { NotificationType } from '../settings.js'

/** How long `completed` / `failed` notifications stay on screen (ms). */
const AUTO_CLOSE_MS = 5000

/**
 * `NotificationOptions` plus `renotify`.
 *
 * `renotify` is part of the Notifications spec (Chromium/Edge use it to sound
 * again when replacing a same-tag notification), but TypeScript 6's bundled
 * `lib.dom.d.ts` omits it, hence this local extension. It stays assignable to
 * plain `NotificationOptions` for callers.
 */
export type AttentionNotificationOptions = NotificationOptions & { renotify?: boolean }

/**
 * Per-kind, per-session notification tag.
 *
 * A single shared tag used to let one kind of notification replace another
 * (Chromium/Windows replace notifications with the same tag), so a pending
 * "question"/"permission" alert could silently swallow an unread "completed"
 * one. Scoping the tag by kind keeps same-kind renotify (one alert per session
 * and event type) while different kinds coexist.
 */
export function notificationTag(kind: NotificationType, sessionId: string): string {
  return `attention-plugins:${kind}:${sessionId}`
}

/** Options common to every attention-plugins notification (tag set by caller). */
export function buildNotificationOptions(kind: NotificationType): AttentionNotificationOptions {
  return {
    renotify: true,
    requireInteraction: kind === 'question' || kind === 'permission',
    icon: '/favicon.ico', // Use DSH's favicon
  }
}

/** Request notification permission if not already granted. */
export async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('[attention-plugins] Notification API not available')
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission === 'denied') {
    return false
  }

  try {
    const result = await Notification.requestPermission()
    return result === 'granted'
  } catch (err) {
    console.warn('[attention-plugins] Failed to request notification permission:', err)
    return false
  }
}

/** Check if browser notifications are available and permitted. */
export function canNotify(): boolean {
  return (
    'Notification' in window &&
    Notification.permission === 'granted'
  )
}

/**
 * Show a system notification. Returns whether it was shown.
 *
 * Clicking focuses the DSH window, calls `onClick` with the session id, and
 * dismisses the notification. `completed` / `failed` auto-close after 5s;
 * `question` / `permission` stay until the user deals with them.
 */
export function showNotification(
  kind: NotificationType,
  sessionId: string,
  title: string,
  body: string,
  onClick?: (sessionId: string) => void,
): boolean {
  if (!canNotify()) return false

  try {
    const options: NotificationOptions = {
      ...buildNotificationOptions(kind),
      tag: notificationTag(kind, sessionId),
      body,
    }
    const notification = new Notification(title, options)

    notification.onclick = () => {
      try {
        window.focus()
      } catch { /* focus is best-effort */ }
      onClick?.(sessionId)
      notification.close()
    }

    if (kind === 'completed' || kind === 'failed') {
      setTimeout(() => notification.close(), AUTO_CLOSE_MS)
    }

    return true
  } catch (err) {
    console.warn('[attention-plugins] Failed to show notification:', err)
    return false
  }
}
