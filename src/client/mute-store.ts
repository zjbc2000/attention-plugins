/**
 * Shared reactive muted-session state, same shape as mainline-store: the
 * durable copy lives in settings (localStorage), this store caches the list in
 * memory so every mounted surface agrees immediately.
 */
import { loadSettings, saveSettings } from './settings.js'

const listeners = new Set<() => void>()

function readInitial(): string[] {
  try {
    return [...loadSettings().mutedSessionIds]
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
  const next = [...new Set(nextInput.filter(id => typeof id === 'string' && id.length > 0))]
  if (next.length === cached.length && next.every((id, i) => id === cached[i])) return
  cached = next
  try {
    const settings = loadSettings()
    saveSettings({ ...settings, mutedSessionIds: cached })
  } catch (err) {
    console.warn('[attention-plugins] failed to persist muted state:', err)
  }
  emit()
}

export const muteStore = {
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
  getSnapshot(): readonly string[] {
    return cached.length === 0 ? EMPTY : cached
  },
  /** Add or remove one session's mute, persist, and notify subscribers. */
  toggle(sessionId: string): void {
    commit(cached.includes(sessionId)
      ? cached.filter(id => id !== sessionId)
      : [...cached, sessionId])
  },
}
