/**
 * Host half of attention-plugins: registers the settings namespace.
 * This half is optional for pure client-side plugins but reserves the
 * namespace for future host/client settings sync if DSH exposes it.
 */
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { createSettingsSchema, type AttentionSettings } from './settings.js'

export const name = 'attention-plugins'

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context, config: Config) {
  // Reserve the settings namespace for this plugin
  // (currently client-only via localStorage, but this keeps the migration path open)
  const settingsService = (ctx as any).settings
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
    })
  }
}
