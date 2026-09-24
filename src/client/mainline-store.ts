/**
 * Shared reactive mainline state so every mounted marker button (header +
 * composer) shows the same value instantly. The durable source of truth
 * stays in localStorage via loadSettings/saveSettings; this store caches the
 * current value in memory and notifies subscribers on change.
 */
import { loadSettings, saveSettings } from './settings.js'

const listeners = new Set<() => void>()

function readInitial(): string {
  try {
    return loadSettings().mainlineSessionId
  } catch {
    return ''
  }
}

let cached = readInitial()

export const mainlineStore = {
  /** useSyncExternalStore subscribe side. */
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
  /** useSyncExternalStore getSnapshot side (cached primitive — stable identity). */
  getSnapshot(): string {
    return cached
  },
  /** Write the mainline session id, persist it, and notify every subscriber. */
  set(id: string): void {
    if (id === cached) return
    cached = id
    try {
      const settings = loadSettings()
      saveSettings({ ...settings, mainlineSessionId: id })
    } catch (err) {
      console.warn('[attention-plugins] failed to persist mainline state:', err)
    }
    for (const fn of listeners) {
      try { fn() } catch {}
    }
  },
}
