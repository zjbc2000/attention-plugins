/**
 * Settings panel UI for attention-plugins.
 * Registers an "Attention" section in DSH Settings using the settings.section slot.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { defaultSettings } from '../settings.js';
import { playSound } from './sounds.js';
import { requestPermission, canNotify, showNotification } from './notification.js';
import { locales } from './locales.js';
const STORAGE_KEY = 'attention-plugins:config';
/** Load settings from localStorage. */
export function loadSettings() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored)
            return defaultSettings;
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new fields
        return {
            ...defaultSettings,
            ...parsed,
            types: {
                ...defaultSettings.types,
                ...(parsed.types || {}),
            },
        };
    }
    catch (err) {
        console.warn('[attention-plugins] Failed to load settings:', err);
        return defaultSettings;
    }
}
/** Save settings to localStorage. */
export function saveSettings(settings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
    catch (err) {
        console.warn('[attention-plugins] Failed to save settings:', err);
    }
}
const eventTypes = ['completed', 'failed', 'question', 'permission'];
/** Attention settings section component. */
export function AttentionSettingsSection({ locale = 'en' }) {
    const [settings, setSettings] = useState(loadSettings);
    const [permissionState, setPermissionState] = useState('default');
    const localeCode = locale.startsWith('zh') ? 'zh-CN' : 'en';
    const t = useCallback((key) => locales[localeCode][key], [localeCode]);
    // Check notification permission on mount
    useEffect(() => {
        if ('Notification' in window) {
            setPermissionState(Notification.permission);
        }
    }, []);
    // Update handler with persistence
    const updateSetting = useCallback((key, value) => {
        setSettings(prev => {
            const updated = { ...prev, [key]: value };
            saveSettings(updated);
            return updated;
        });
    }, []);
    // Update event type setting
    const updateEventType = useCallback((eventType, key, value) => {
        setSettings(prev => {
            const updated = {
                ...prev,
                types: {
                    ...prev.types,
                    [eventType]: {
                        ...prev.types[eventType],
                        [key]: value,
                    },
                },
            };
            saveSettings(updated);
            return updated;
        });
    }, []);
    // Handle browser notification enable
    const handleEnableBrowserNotifications = useCallback(async () => {
        const granted = await requestPermission();
        if (granted) {
            updateSetting('browserEnabled', true);
            setPermissionState('granted');
        }
        else {
            setPermissionState(Notification.permission);
        }
    }, [updateSetting]);
    // Test notification
    const handleTestNotification = useCallback(() => {
        if (canNotify()) {
            showNotification(t('notification.test.title'), t('notification.test.body'));
        }
    }, [t]);
    // Test sound for an event type
    const handleTestSound = useCallback((sound) => {
        if (settings.soundEnabled && sound !== 'none') {
            playSound(sound, settings.volume);
        }
    }, [settings.soundEnabled, settings.volume]);
    return (React.createElement("div", { className: "attention-settings-section", style: { padding: '16px 0' } },
        React.createElement("h2", { style: { fontSize: '18px', fontWeight: 600, marginBottom: '16px' } }, t('settings.title')),
        React.createElement("div", { style: { marginBottom: '24px' } },
            React.createElement("label", { style: { display: 'flex', alignItems: 'center', marginBottom: '8px' } },
                React.createElement("input", { type: "checkbox", checked: settings.soundEnabled, onChange: e => updateSetting('soundEnabled', e.target.checked), style: { marginRight: '8px' } }),
                React.createElement("span", { style: { fontWeight: 500 } }, t('settings.sound.label'))),
            React.createElement("p", { style: { fontSize: '13px', color: '#666', marginLeft: '24px', marginBottom: '12px' } }, t('settings.sound.description')),
            settings.soundEnabled && (React.createElement("div", { style: { marginLeft: '24px' } },
                React.createElement("div", { style: { marginBottom: '16px' } },
                    React.createElement("label", { style: { display: 'block', fontSize: '13px', marginBottom: '4px' } },
                        t('settings.sound.volume'),
                        ": ",
                        settings.volume,
                        "%"),
                    React.createElement("input", { type: "range", min: "0", max: "100", value: settings.volume, onChange: e => updateSetting('volume', parseInt(e.target.value)), style: { width: '200px' } }))))),
        React.createElement("div", { style: { marginBottom: '24px' } },
            React.createElement("h3", { style: { fontSize: '15px', fontWeight: 500, marginBottom: '8px' } }, t('settings.eventTypes.label')),
            React.createElement("p", { style: { fontSize: '13px', color: '#666', marginBottom: '12px' } }, t('settings.eventTypes.description')),
            React.createElement("div", { style: { marginLeft: '0', display: 'flex', flexDirection: 'column', gap: '12px' } }, eventTypes.map(eventType => {
                const typeSettings = settings.types[eventType];
                return (React.createElement("div", { key: eventType, style: {
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px',
                        background: '#fafafa',
                    } },
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' } },
                        React.createElement("label", { style: { display: 'flex', alignItems: 'center' } },
                            React.createElement("input", { type: "checkbox", checked: typeSettings.enabled, onChange: e => updateEventType(eventType, 'enabled', e.target.checked), style: { marginRight: '8px' } }),
                            React.createElement("span", { style: { fontWeight: 500 } }, t(`event.${eventType}`)))),
                    typeSettings.enabled && (React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '24px' } },
                        React.createElement("select", { value: typeSettings.sound, onChange: e => updateEventType(eventType, 'sound', e.target.value), style: { padding: '4px 8px', borderRadius: '4px', border: '1px solid #ddd' } },
                            React.createElement("option", { value: "chime" }, t('sound.chime')),
                            React.createElement("option", { value: "success" }, t('sound.success')),
                            React.createElement("option", { value: "subtle" }, t('sound.subtle')),
                            React.createElement("option", { value: "none" }, t('sound.none'))),
                        React.createElement("button", { onClick: () => handleTestSound(typeSettings.sound), disabled: !settings.soundEnabled || typeSettings.sound === 'none', style: {
                                padding: '4px 12px',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                background: '#f5f5f5',
                                cursor: settings.soundEnabled && typeSettings.sound !== 'none' ? 'pointer' : 'not-allowed',
                            } }, "\u25B6")))));
            }))),
        React.createElement("div", { style: { marginBottom: '24px', padding: '12px', background: '#f9f9f9', borderRadius: '6px' } },
            React.createElement("h3", { style: { fontSize: '14px', fontWeight: 500, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' } },
                React.createElement("span", { style: { fontSize: '16px' } }, "\u2B50"),
                t('settings.mainline.label')),
            React.createElement("p", { style: { fontSize: '13px', color: '#666', lineHeight: '1.5' } }, t('settings.mainline.description')),
            React.createElement("p", { style: { fontSize: '13px', color: '#999', marginTop: '8px', fontStyle: 'italic' } }, t('settings.mainline.hint'))),
        React.createElement("div", { style: { marginBottom: '24px' } },
            React.createElement("label", { style: { display: 'flex', alignItems: 'center', marginBottom: '8px' } },
                React.createElement("input", { type: "checkbox", checked: settings.browserEnabled, onChange: e => {
                        if (e.target.checked && permissionState !== 'granted') {
                            handleEnableBrowserNotifications();
                        }
                        else {
                            updateSetting('browserEnabled', e.target.checked);
                        }
                    }, disabled: permissionState === 'denied', style: { marginRight: '8px' } }),
                React.createElement("span", { style: { fontWeight: 500 } }, t('settings.browser.label'))),
            React.createElement("p", { style: { fontSize: '13px', color: '#666', marginLeft: '24px', marginBottom: '8px' } }, t('settings.browser.description')),
            React.createElement("div", { style: { marginLeft: '24px', fontSize: '13px', color: '#666' } },
                React.createElement("span", null,
                    permissionState === 'granted' && t('settings.browser.permission.granted'),
                    permissionState === 'denied' && t('settings.browser.permission.denied'),
                    permissionState === 'default' && t('settings.browser.permission.default')),
                permissionState !== 'granted' && permissionState !== 'denied' && (React.createElement("button", { onClick: handleEnableBrowserNotifications, style: {
                        marginLeft: '12px',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        border: '1px solid #0066cc',
                        background: '#0066cc',
                        color: 'white',
                        cursor: 'pointer',
                    } }, t('settings.browser.enable'))),
                settings.browserEnabled && permissionState === 'granted' && (React.createElement("button", { onClick: handleTestNotification, style: {
                        marginLeft: '12px',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        border: '1px solid #ddd',
                        background: '#f5f5f5',
                        cursor: 'pointer',
                    } }, t('settings.browser.test'))))),
        React.createElement("div", null,
            React.createElement("label", { style: { display: 'flex', alignItems: 'center', marginBottom: '8px' } },
                React.createElement("input", { type: "checkbox", checked: settings.notifyCurrent, onChange: e => updateSetting('notifyCurrent', e.target.checked), style: { marginRight: '8px' } }),
                React.createElement("span", { style: { fontWeight: 500 } }, t('settings.notifyCurrent.label'))),
            React.createElement("p", { style: { fontSize: '13px', color: '#666', marginLeft: '24px' } }, t('settings.notifyCurrent.description')))));
}
//# sourceMappingURL=settings.js.map