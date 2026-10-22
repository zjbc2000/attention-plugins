/**
 * Shared reactive mainline state so every mounted marker button (composer +
 * sidebar menu) shows the same value instantly. Multiple sessions can be
 * marked at once; the durable source of truth stays in localStorage via
 * loadSettings/saveSettings, this store caches the current list in memory and
 * notifies subscribers on change.
 */
import { loadSettings, saveSettings } from './settings.js'
import { toggleMainlineSession } from '../settings.js'

const listeners = new Set<() => void>()

function readInitial(): string[] {
  try {
    return [...loadSettings().mainlineSessionIds]
  } catch {
    return []
  }
}

let cached: string[] = readInitial()
const EMPTY: readonly string[] = []

function emit(): void {
  for (const fn of listeners) {
    try { fn() } catch {}
  }
}

function commit(nextInput: readonly string[]): void {
  const next = [...nextInput]
  if (next.length === cached.length && next.every((id, i) => id === cached[i])) return
  cached = next
  try {
    const settings = loadSettings()
    saveSettings({ ...settings, mainlineSessionIds: cached })
  } catch (err) {
    console.warn('[attention-plugins] failed to persist mainline state:', err)
  }
  emit()
}

export const mainlineStore = {
  /** useSyncExternalStore subscribe side. */
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
  /** useSyncExternalStore getSnapshot side (cached array — stable identity). */
  getSnapshot(): readonly string[] {
    return cached.length === 0 ? EMPTY : cached
  },
  /** Add or remove one session's marker, persist, and notify subscribers. */
  toggle(sessionId: string): void {
    commit(toggleMainlineSession(cached, sessionId))
  },
}
