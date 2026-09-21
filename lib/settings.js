/** Default settings. */
export const defaultSettings = {
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
};
/** Settings schema for host-side registration (optional for future compatibility). */
export function createSettingsSchema(S) {
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
    });
}
//# sourceMappingURL=settings.js.map