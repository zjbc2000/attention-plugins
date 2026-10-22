/**
 * Settings schema and types for attention-plugins.
 * Shared between host and client halves.
 */
import Schema from '@deepseek-ai/schemastery'

/** Available sound effects (built-in Web Audio synthesis). */
export type SoundId = 'chime' | 'success' | 'subtle' | 'none'

/** Notification event types. */
export type NotificationType = 'completed' | 'failed' | 'question' | 'permission'

/**
 * How non-main-line (side-line) sessions are alerted.
 * - `per-session`: every session alerts on its own completion (default).
 * - `batch`: side-line sessions stay quiet until ALL running sessions finish,
 *   then one aggregate "all tasks" alert fires.
 */
export type SidelineMode = 'per-session' | 'batch'

/**
 * How sessions without a main-line marker are classified.
 * - `mainline` (default): no marker means every session is side-line, alerted
 *   according to `sidelineMode`.
 * - `balanced`: no marker means every session counts as main-line, so each one
 *   alerts on its own completion regardless of `sidelineMode`.
 */
export type MainlineMode = 'mainline' | 'balanced'

/**
 * Decide whether one session is treated as main-line.
 * Any marker wins; only an unmarked session depends on the mode, which is what
 * makes `balanced` a no-op once the user marks at least one main line.
 */
export function isMainlineSession(
  sessionId: string,
  markedSessionIds: readonly string[],
  mode: MainlineMode,
): boolean {
  if (markedSessionIds.length > 0) return markedSessionIds.includes(sessionId)
  return mode === 'balanced'
}

/**
 * Toggle one session in the main-line marker set.
 * Returns a new array: several sessions can be marked at the same time.
 */
export function toggleMainlineSession(ids: readonly string[], sessionId: string): string[] {
  return ids.includes(sessionId)
    ? ids.filter((id) => id !== sessionId)
    : [...ids, sessionId]
}

/** Per-event-type configuration. */
export interface EventTypeSettings {
  /** Whether this event type triggers notifications. */
  enabled: boolean
  /** Sound to play for this event. */
  sound: SoundId
}

/** Plugin configuration stored in localStorage. */
export interface AttentionSettings {
  /** Master switch for sound notifications. */
  soundEnabled: boolean
  /** Playback volume (0-100). */
  volume: number
  /** Master switch for browser notifications. */
  browserEnabled: boolean
  /** Alert for the currently selected session (opt-in). */
  notifyCurrent: boolean
  /** Sessions marked as main-line (multiple allowed; empty = none). */
  mainlineSessionIds: string[]
  /**
   * How side-line sessions are alerted. `per-session` rings once per finished
   * task; `batch` waits for every running task to finish and rings once.
   */
  sidelineMode: SidelineMode
  /**
   * How sessions without a main-line marker are classified. `mainline` keeps
   * them side-line; `balanced` promotes them all to main-line while no marker
   * is set.
   */
  mainlineMode: MainlineMode
  sidebarBadge: boolean
  /** Per-event-type settings. */
  types: Record<NotificationType, EventTypeSettings>
}

/** Default settings. */
export const defaultSettings: AttentionSettings = {
  soundEnabled: true,
  volume: 70,
  browserEnabled: false,
  notifyCurrent: false,
  mainlineSessionIds: [],
  sidelineMode: 'per-session',
  mainlineMode: 'mainline',
  sidebarBadge: true,
  types: {
    completed: { enabled: true, sound: 'chime' },
    failed: { enabled: true, sound: 'subtle' },
    question: { enabled: true, sound: 'success' },
    permission: { enabled: true, sound: 'success' },
  },
}

/** A parsed config as it may exist on disk (old versions included). */
export type StoredSettings = Partial<AttentionSettings> & { mainlineSessionId?: string }

/**
 * Merge a parsed config with defaults and migrate legacy fields.
 * The pre-multi-marker config stored a single `mainlineSessionId`; it becomes a
 * one-item `mainlineSessionIds` list so an upgrade keeps the marked session.
 */
export function normalizeSettings(raw: StoredSettings): AttentionSettings {
  const merged: AttentionSettings = {
    ...defaultSettings,
    ...raw,
    types: {
      ...defaultSettings.types,
      ...(raw.types || {}),
    },
  }
  const legacyId = typeof raw.mainlineSessionId === 'string' ? raw.mainlineSessionId : ''
  merged.mainlineSessionIds = Array.isArray(raw.mainlineSessionIds)
    ? raw.mainlineSessionIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : legacyId
      ? [legacyId]
      : []
  delete (merged as AttentionSettings & { mainlineSessionId?: string }).mainlineSessionId
  return merged
}

/** Settings schema for host-side registration (optional for future compatibility). */
export function createSettingsSchema(S: typeof Schema): ReturnType<typeof S.object> {
  return S.object({
    soundEnabled: S.boolean().default(true).description('Enable sound notifications'),
    volume: S.number().min(0).max(100).default(70).description('Playback volume (0-100)'),
    browserEnabled: S.boolean().default(false).description('Enable browser notifications'),
    notifyCurrent: S.boolean().default(false).description('Alert for the current session'),
    mainlineSessionIds: S.array(S.string()).default([]).description('Main-line session IDs'),
    sidelineMode: S.union(['per-session', 'batch'] as const).default('per-session').description('Side-line alert mode'),
    mainlineMode: S.union(['mainline', 'balanced'] as const).default('mainline').description('How unmarked sessions are classified'),
    types: S.object({
      completed: S.object({ enabled: S.boolean(), sound: S.string() }),
      failed: S.object({ enabled: S.boolean(), sound: S.string() }),
      question: S.object({ enabled: S.boolean(), sound: S.string() }),
      permission: S.object({ enabled: S.boolean(), sound: S.string() }),
    }),
  })
}
