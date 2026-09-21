/**
 * Settings panel UI for attention-plugins.
 * Registers an "Attention" section in DSH Settings using the settings.section slot.
 */
import React from 'react';
import type { AttentionSettings } from '../settings.js';
/** Load settings from localStorage. */
export declare function loadSettings(): AttentionSettings;
/** Save settings to localStorage. */
export declare function saveSettings(settings: AttentionSettings): void;
/** Settings section component props (injected by DSH settings slot system). */
interface SettingsSectionProps {
    locale?: string;
}
/** Attention settings section component. */
export declare function AttentionSettingsSection({ locale }: SettingsSectionProps): React.JSX.Element;
export {};
//# sourceMappingURL=settings.d.ts.map