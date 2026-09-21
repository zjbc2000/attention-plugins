/**
 * Settings schema and types for attention-plugins.
 * Shared between host and client halves.
 */
import Schema from '@deepseek-ai/schemastery'

/** Available sound effects (built-in Web Audio synthesis). */
export type SoundId = 'chime' | 'success' | 'subtle' | 'none'

/** Notification event types. */
export type NotificationType = 'completed' | 'failed' | 'question' | 'permission'

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
  /** Main-line session ID (manually set; empty = none). */
  mainlineSessionId: string
  /** Per-event-type settings. */
  types: Record<NotificationType, EventTypeSettings>
}

/** Default settings. */
export const defaultSettings: AttentionSettings = {
  soundEnabled: true,
  volume: 70,
  browserEnabled: false,
  notifyCurrent: false,
  mainlineSessionId: '',
  types: {
    completed: { enabled: true, sound: 'chime' },
    failed: { enabled: true, sound: 'subtle' },
    question: { enabled: true, sound: 'success' },
    permission: { enabled: true, sound: 'success' },
  },
}

/** Settings schema for host-side registration (optional for future compatibility). */
export function createSettingsSchema(S: typeof Schema): ReturnType<typeof S.object> {
  return S.object({
    soundEnabled: S.boolean().default(true).description('Enable sound notifications'),
    volume: S.number().min(0).max(100).default(70).description('Playback volume (0-100)'),
    browserEnabled: S.boolean().default(false).description('Enable browser notifications'),
    notifyCurrent: S.boolean().default(false).description('Alert for the current session'),
    mainlineSessionId: S.string().default('').description('Main-line session ID'),
    types: S.object({
      completed: S.object({ enabled: S.boolean(), sound: S.string() }),
      failed: S.object({ enabled: S.boolean(), sound: S.string() }),
      question: S.object({ enabled: S.boolean(), sound: S.string() }),
      permission: S.object({ enabled: S.boolean(), sound: S.string() }),
    }),
  })
}
