/**
 * Settings schema and types for attention-plugins.
 * Shared between host and client halves.
 */
import Schema from '@deepseek-ai/schemastery';
/** Available sound effects (built-in Web Audio synthesis). */
export type SoundId = 'chime' | 'success' | 'subtle' | 'none';
/** Notification event types. */
export type NotificationType = 'completed' | 'failed' | 'question' | 'permission';
/** Per-event-type configuration. */
export interface EventTypeSettings {
    /** Whether this event type triggers notifications. */
    enabled: boolean;
    /** Sound to play for this event. */
    sound: SoundId;
}
/** Plugin configuration stored in localStorage. */
export interface AttentionSettings {
    /** Master switch for sound notifications. */
    soundEnabled: boolean;
    /** Playback volume (0-100). */
    volume: number;
    /** Master switch for browser notifications. */
    browserEnabled: boolean;
    /** Alert for the currently selected session (opt-in). */
    notifyCurrent: boolean;
    /** Main-line session ID (manually set; empty = none). */
    mainlineSessionId: string;
    /** Per-event-type settings. */
    types: Record<NotificationType, EventTypeSettings>;
}
/** Default settings. */
export declare const defaultSettings: AttentionSettings;
/** Settings schema for host-side registration (optional for future compatibility). */
export declare function createSettingsSchema(S: typeof Schema): ReturnType<typeof S.object>;
//# sourceMappingURL=settings.d.ts.map