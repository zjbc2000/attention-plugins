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
 * Overall alerting mode. One setting covers every case:
 * - `mainline` (default): a marked main-line alerts as soon as it finishes;
 *   everything else is side-line and stays quiet until all running sessions
 *   are idle, then rings once ("all tasks").
 * - `balanced`: every finished session alerts on its own.
 * - `silent` (静音): no completion alert at all, neither sound nor browser
 *   notification. Questions and permission requests still alert because the
 *   agent is blocked on you.
 */
export type MainlineMode = 'mainline' | 'balanced' | 'silent'

/**
 * When the session you are currently looking at may interrupt you.
 * - `hidden` (default): only when the page is hidden (tab switched, minimised).
 * - `unfocused`: also when the window lost focus (split screen, other app).
 * - `always`: even while you are reading that session.
 */
export type CurrentSessionMode = 'hidden' | 'unfocused' | 'always'

/**
 * Decide whether one session is treated as main-line.
 * Any marker wins; only an unmarked session depends on the mode, which is what
 * makes `balanced` a no-op once the user marks at least one main line.
 * `silent` never promotes a session: nothing alerts per session.
 */
export function isMainlineSession(
  sessionId: string,
  markedSessionIds: readonly string[],
  mode: MainlineMode,
): boolean {
  if (mode === 'silent') return false
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

/** One uploaded custom sound, stored as a data URL in localStorage. */
export interface StoredAudio {
  /** Original file name, shown in the settings panel. */
  name: string
  /** `data:audio/...` URL usable by an HTMLAudioElement. */
  dataUrl: string
  /** File size in bytes (validated before storing). */
  bytes: number
}

/** Per-event-type configuration. */
export interface EventTypeSettings {
  /** Whether this event type triggers notifications. */
  enabled: boolean
  /** Built-in sound to play for this event. */
  sound: SoundId
  /** Uploaded sound; overrides `sound` when present. */
  customAudio?: StoredAudio | null
}

/** Plugin configuration stored in localStorage. */
export interface AttentionSettings {
  /** Master switch for sound notifications. */
  soundEnabled: boolean
  /** Playback volume (0-100). */
  volume: number
  /** Master switch for browser notifications. */
  browserEnabled: boolean
  /** When the session you are viewing may interrupt you. */
  currentSessionMode: CurrentSessionMode
  /** Sessions marked as main-line (multiple allowed; empty = none). */
  mainlineSessionIds: string[]
  /** Sessions the user muted individually (no sound, no notification). */
  mutedSessionIds: string[]
  /**
   * Overall alerting mode. `mainline` keeps unmarked sessions side-line (they
   * are pooled into one "All tasks" chime); `balanced` treats every session as
   * alerting on its own; `silent` never alerts a completion.
   */
  mainlineMode: MainlineMode
  /**
   * Wait for a session's running subagents before announcing that session.
   * A run that spawned subagents is not finished while they are still working.
   */
  waitForSubagents: boolean
  sidebarBadge: boolean
  /** Per-event-type settings. */
  types: Record<NotificationType, EventTypeSettings>
}

/** Default settings. */
export const defaultSettings: AttentionSettings = {
  soundEnabled: true,
  volume: 70,
  browserEnabled: false,
  currentSessionMode: 'hidden',
  mainlineSessionIds: [],
  mutedSessionIds: [],
  mainlineMode: 'mainline',
  waitForSubagents: true,
  sidebarBadge: true,
  types: {
    completed: { enabled: true, sound: 'chime' },
    failed: { enabled: true, sound: 'subtle' },
    question: { enabled: true, sound: 'success' },
    permission: { enabled: true, sound: 'success' },
  },
}

/** A parsed config as it may exist on disk (old versions included). */
export type StoredSettings = Partial<AttentionSettings> & {
  mainlineSessionId?: string
  /** Pre-0.3 single boolean replaced by `currentSessionMode`. */
  notifyCurrent?: boolean
}

/** Clamp a number into a closed range. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/** Keep only non-empty string entries of an unknown array value. */
function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
}

/** Validate one stored custom sound, dropping malformed entries. */
function storedAudio(value: unknown): StoredAudio | null {
  if (value === null || typeof value !== 'object') return null
  const candidate = value as Partial<StoredAudio>
  if (typeof candidate.dataUrl !== 'string' || !candidate.dataUrl.startsWith('data:audio/')) return null
  if (typeof candidate.name !== 'string') return null
  const bytes = typeof candidate.bytes === 'number' && Number.isFinite(candidate.bytes)
    ? candidate.bytes
    : 0
  return { name: candidate.name, dataUrl: candidate.dataUrl, bytes }
}

/**
 * Merge a parsed config with defaults and migrate legacy fields.
 * - a single `mainlineSessionId` becomes a one-item `mainlineSessionIds` list
 * - the old `notifyCurrent` boolean becomes `currentSessionMode`
 *   (`true` → `always`, `false` → `hidden`)
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
    ? stringList(raw.mainlineSessionIds)
    : legacyId
      ? [legacyId]
      : []
  delete (merged as AttentionSettings & { mainlineSessionId?: string }).mainlineSessionId

  if (raw.currentSessionMode === undefined && typeof raw.notifyCurrent === 'boolean') {
    merged.currentSessionMode = raw.notifyCurrent ? 'always' : 'hidden'
  }
  if (merged.currentSessionMode !== 'hidden'
    && merged.currentSessionMode !== 'unfocused'
    && merged.currentSessionMode !== 'always') {
    merged.currentSessionMode = 'hidden'
  }
  delete (merged as AttentionSettings & { notifyCurrent?: boolean }).notifyCurrent

  if (merged.mainlineMode !== 'mainline'
    && merged.mainlineMode !== 'balanced'
    && merged.mainlineMode !== 'silent') {
    merged.mainlineMode = 'mainline'
  }
  // `sidelineMode` was removed in favour of the three-way `mainlineMode`.
  // Old "per-session" meant every task rang on its own, which is now
  // `balanced`; old "batch" is what `mainline` does today, so it needs no move.
  const legacySideline = (raw as { sidelineMode?: unknown }).sidelineMode
  if (legacySideline === 'per-session' && merged.mainlineMode === 'mainline') {
    merged.mainlineMode = 'balanced'
  }
  delete (merged as AttentionSettings & { sidelineMode?: string }).sidelineMode

  merged.volume = clamp(merged.volume, 0, 100)
  merged.mutedSessionIds = stringList(raw.mutedSessionIds)
  merged.waitForSubagents = raw.waitForSubagents !== false
  merged.sidebarBadge = raw.sidebarBadge !== false

  for (const kind of Object.keys(defaultSettings.types) as NotificationType[]) {
    const type = merged.types[kind]
    // Only surface `customAudio` when a clip is actually stored, so a plain
    // `{enabled, sound}` config normalises back to exactly that shape.
    const audio = storedAudio(type?.customAudio)
    merged.types[kind] = {
      ...defaultSettings.types[kind],
      ...type,
      enabled: type?.enabled !== false,
      ...(audio === null ? {} : { customAudio: audio }),
    }
  }

  return merged
}

/** Whether one session is muted by the user. */
export function isMutedSession(sessionId: string, mutedSessionIds: readonly string[]): boolean {
  return mutedSessionIds.includes(sessionId)
}

/** Settings schema for host-side registration (optional for future compatibility). */
export function createSettingsSchema(S: typeof Schema): ReturnType<typeof S.object> {
  return S.object({
    soundEnabled: S.boolean().default(true).description('Enable sound notifications'),
    volume: S.number().min(0).max(100).default(70).description('Playback volume (0-100)'),
    browserEnabled: S.boolean().default(false).description('Enable browser notifications'),
    currentSessionMode: S.union(['hidden', 'unfocused', 'always'] as const)
      .default('hidden')
      .description('When the current session may alert'),
    mainlineSessionIds: S.array(S.string()).default([]).description('Main-line session IDs'),
    mutedSessionIds: S.array(S.string()).default([]).description('Muted session IDs'),
    mainlineMode: S.union(['mainline', 'balanced', 'silent'] as const).default('mainline').description('How unmarked sessions are classified'),
    waitForSubagents: S.boolean().default(true).description('Wait for running subagents before alerting'),
    types: S.object({
      completed: S.object({ enabled: S.boolean(), sound: S.string() }),
      failed: S.object({ enabled: S.boolean(), sound: S.string() }),
      question: S.object({ enabled: S.boolean(), sound: S.string() }),
      permission: S.object({ enabled: S.boolean(), sound: S.string() }),
    }),
  })
}
