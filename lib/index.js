import Schema from '@deepseek-ai/schemastery';
import { createSettingsSchema } from './settings.js';
export const name = 'attention-plugins';
export const Config = Schema.object({});
export function apply(ctx, config) {
    // Reserve the settings namespace for this plugin
    // (currently client-only via localStorage, but this keeps the migration path open)
    const settingsService = ctx.settings;
    if (settingsService?.register) {
        settingsService.register('attention-plugins', createSettingsSchema(Schema), {
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
        });
    }
}
//# sourceMappingURL=index.js.map