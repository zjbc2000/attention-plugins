/**
 * Settings panel UI for attention-plugins.
 * Registers an "Attention" section in DSH Settings using the settings.section slot.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react'
import type {
  AttentionSettings,
  SoundId,
  NotificationType,
  MainlineMode,
  CurrentSessionMode,
  StoredAudio,
} from '../settings.js'
import { defaultSettings, normalizeSettings } from '../settings.js'
import { readAudioFile, formatBytes, MAX_AUDIO_BYTES, type AudioRejectReason } from './custom-audio.js'
import { playSound } from './sounds.js'
import { requestPermission, canNotify, showNotification } from './notification.js'
import { locales, resolveLocaleCode } from './locales.js'
import { attentionCss } from './effects.js'
import { AttentionFigure } from './attention-figure.js'
import { SparkStar } from './spark-star.js'
import { requestSidebarBadgeRescan } from './events.js'
import { PluginMetaBar } from './meta-bar.js'

const STORAGE_KEY = 'attention-plugins:config'

/** Load settings from localStorage. */
export function loadSettings(): AttentionSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return defaultSettings
    
    return normalizeSettings(JSON.parse(stored))
  } catch (err) {
    console.warn('[attention-plugins] Failed to load settings:', err)
    return defaultSettings
  }
}

/** Save settings to localStorage. */
export function saveSettings(settings: AttentionSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (err) {
    console.warn('[attention-plugins] Failed to save settings:', err)
  }
}

/** Settings section component props (injected by DSH settings slot system). */
interface SettingsSectionProps {
  locale?: string
}

const eventTypes: NotificationType[] = ['completed', 'failed', 'question', 'permission']

/** Task modes, in the order they are offered (the default first). */
const MAINLINE_MODE_OPTIONS: ReadonlyArray<{
  mode: MainlineMode
  labelKey: keyof typeof locales['en']
  descriptionKey?: keyof typeof locales['en']
}> = [
  { mode: 'mainline', labelKey: 'settings.mode.mainline' },
  { mode: 'balanced', labelKey: 'settings.mode.balanced' },
  {
    mode: 'silent',
    labelKey: 'settings.mainlineMode.silent.label',
    descriptionKey: 'settings.mainlineMode.silent.description',
  },
]

/** When alerts may interrupt the session the user is looking at (default first). */
const CURRENT_SESSION_OPTIONS: ReadonlyArray<{
  mode: CurrentSessionMode
  labelKey: keyof typeof locales['en']
  descriptionKey: keyof typeof locales['en']
}> = [
  {
    mode: 'hidden',
    labelKey: 'settings.currentSession.hidden.label',
    descriptionKey: 'settings.currentSession.hidden.description',
  },
  {
    mode: 'unfocused',
    labelKey: 'settings.currentSession.unfocused.label',
    descriptionKey: 'settings.currentSession.unfocused.description',
  },
  {
    mode: 'always',
    labelKey: 'settings.currentSession.always.label',
    descriptionKey: 'settings.currentSession.always.description',
  },
]

/** Accepted audio MIME types for the custom-sound picker. */
const AUDIO_ACCEPT = 'audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/x-wav,audio/wave'

/** Shared look for the small secondary buttons in the event cards. */
const SMALL_BUTTON_STYLE: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: '4px',
  border: '1px solid var(--dsw-alias-border-l3)',
  background: 'var(--dsw-alias-interactive-bg-hover)',
  color: 'var(--dsw-alias-label-primary)',
  cursor: 'pointer',
  fontSize: '12px',
}

/** Attention settings section component. */
export function AttentionSettingsSection({ locale = 'en' }: SettingsSectionProps) {
  const [settings, setSettings] = useState<AttentionSettings>(loadSettings)
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default')
  const [audioError, setAudioError] = useState<{ kind: NotificationType; reason: AudioRejectReason } | null>(null)
  const audioInputRefs = useRef<Partial<Record<NotificationType, HTMLInputElement | null>>>({})
  
  const localeCode = resolveLocaleCode(locale)
  const t = useCallback((key: keyof typeof locales['en']) => locales[localeCode][key], [localeCode])
  
  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setPermissionState(Notification.permission)
    }
  }, [])
  
  // Update handler with persistence
  const updateSetting = useCallback(<K extends keyof AttentionSettings>(
    key: K,
    value: AttentionSettings[K]
  ) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value }
      saveSettings(updated)
      return updated
    })
  }, [])
  
  // Update event type setting
  const updateEventType = useCallback((
    eventType: NotificationType,
    key: 'enabled' | 'sound' | 'customAudio',
    value: boolean | SoundId | StoredAudio | null
  ) => {
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
      }
      saveSettings(updated)
      return updated
    })
  }, [])

  // Validate and store a picked audio file as this event type's custom sound
  const handleAudioPicked = useCallback(async (eventType: NotificationType, file: File) => {
    setAudioError(null)
    const result = await readAudioFile(file)
    if (result.ok) {
      updateEventType(eventType, 'customAudio', result.audio)
    } else {
      setAudioError({ kind: eventType, reason: result.reason })
    }
  }, [updateEventType])

  // Drop the custom sound and its error message for one event type
  const handleClearAudio = useCallback((eventType: NotificationType) => {
    setAudioError(null)
    updateEventType(eventType, 'customAudio', null)
  }, [updateEventType])
  
  // Handle browser notification enable
  const handleEnableBrowserNotifications = useCallback(async () => {
    const granted = await requestPermission()
    if (granted) {
      updateSetting('browserEnabled', true)
      setPermissionState('granted')
    } else {
      setPermissionState(Notification.permission)
    }
  }, [updateSetting])
  
  // Test notification
  const handleTestNotification = useCallback(() => {
    if (canNotify()) {
      showNotification(
        'completed',
        'attention-plugins-test',
        t('notification.test.title'),
        t('notification.test.body')
      )
    }
  }, [t])
  
  // Test sound for an event type
  const handleTestSound = useCallback((sound: SoundId) => {
    if (settings.soundEnabled && sound !== 'none') {
      playSound(sound, settings.volume)
    }
  }, [settings.soundEnabled, settings.volume])
  
  return (
    <div className="attention-settings-section" style={{ padding: '16px 0' }}>
      <style>{attentionCss}</style>

      {/* Hero — serif title over a printed-plate self-attention figure */}
      <div className="attention-hero">
        <h2 className="attention-title">
          <span className="attention-kw">{t('settings.titleKw')}</span>
          {t('settings.titleRest')}
        </h2>
        <span className="attention-citation">Vaswani et al. · 2017</span>
        <AttentionFigure />
        <span className="attention-rule" aria-hidden="true" />
      </div>

      {/* Repo / version / issues / update check */}
      <PluginMetaBar t={t} />

      {/* Sound Notifications */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <input
            type="checkbox"
            checked={settings.soundEnabled}
            onChange={e => updateSetting('soundEnabled', e.target.checked)}
            style={{ marginRight: '8px', accentColor: 'var(--dsw-alias-state-business-primary)' }}
          />
          <span style={{ fontWeight: 500 }}>{t('settings.sound.label')}</span>
        </label>
        <p style={{ fontSize: '13px', color: 'var(--dsw-alias-label-secondary)', marginLeft: '24px', marginBottom: '12px' }}>
          {t('settings.sound.description')}
        </p>
        
        {settings.soundEnabled && (
          <div style={{ marginLeft: '24px' }}>
            {/* Volume Slider */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>
                {t('settings.sound.volume')}: {settings.volume}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.volume}
                onChange={e => updateSetting('volume', parseInt(e.target.value))}
                style={{ width: '200px', accentColor: 'var(--dsw-alias-state-business-primary)' }}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Event Types Configuration */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '8px' }}>
          {t('settings.eventTypes.label')}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--dsw-alias-label-secondary)', marginBottom: '12px' }}>
          {t('settings.eventTypes.description')}
        </p>
        
        <div style={{ marginLeft: '0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {eventTypes.map((eventType, index) => {
            const typeSettings = settings.types[eventType]
            return (
              <div key={eventType} className="attention-card" style={{ 
                padding: '12px', 
                border: '1px solid var(--dsw-alias-border-l3)', 
                borderRadius: '6px',
                background: 'var(--dsw-alias-bg-layer-2)',
                animationDelay: `${index * 70}ms`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={typeSettings.enabled}
                      onChange={e => updateEventType(eventType, 'enabled', e.target.checked)}
                      style={{ marginRight: '8px', accentColor: 'var(--dsw-alias-state-business-primary)' }}
                    />
                    <span style={{ fontWeight: 500 }}>{t(`event.${eventType}` as any)}</span>
                  </label>
                </div>
                
                {typeSettings.enabled && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '24px' }}>
                      <select
                        value={typeSettings.sound}
                        onChange={e => updateEventType(eventType, 'sound', e.target.value as SoundId)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--dsw-alias-border-l3)',
                          background: 'var(--dsw-alias-bg-layer-1)',
                          color: 'var(--dsw-alias-label-primary)',
                        }}
                      >
                        <option value="chime">{t('sound.chime')}</option>
                        <option value="success">{t('sound.success')}</option>
                        <option value="subtle">{t('sound.subtle')}</option>
                        <option value="none">{t('sound.none')}</option>
                      </select>
                      <button
                        className="attention-test-btn"
                        onClick={() => handleTestSound(typeSettings.sound)}
                        disabled={!settings.soundEnabled || typeSettings.sound === 'none'}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '4px',
                          border: '1px solid var(--dsw-alias-border-l3)',
                          background: 'var(--dsw-alias-interactive-bg-hover)',
                          color: 'var(--dsw-alias-label-primary)',
                          cursor: settings.soundEnabled && typeSettings.sound !== 'none' ? 'pointer' : 'not-allowed',
                        }}
                      >
                        ▶
                      </button>
                    </div>

                    {/* Custom audio for this event type */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px',
                      marginLeft: '24px',
                      marginTop: '8px',
                      fontSize: '13px',
                    }}>
                      <input
                        ref={el => { audioInputRefs.current[eventType] = el }}
                        type="file"
                        accept={AUDIO_ACCEPT}
                        hidden
                        onChange={e => {
                          const file = e.target.files?.[0]
                          // Reset so picking the same file again still fires onChange.
                          e.target.value = ''
                          if (file) void handleAudioPicked(eventType, file)
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => audioInputRefs.current[eventType]?.click()}
                        style={SMALL_BUTTON_STYLE}
                      >
                        {t('settings.customAudio.upload')}
                      </button>
                      <span style={{ color: 'var(--dsw-alias-label-secondary)' }}>
                        {typeSettings.customAudio ? typeSettings.customAudio.name : t('settings.customAudio.none')}
                      </span>
                      {typeSettings.customAudio && (
                        <button
                          type="button"
                          onClick={() => handleClearAudio(eventType)}
                          style={SMALL_BUTTON_STYLE}
                        >
                          {t('settings.customAudio.clear')}
                        </button>
                      )}
                    </div>
                    {audioError?.kind === eventType && (
                      <p style={{
                        marginLeft: '24px',
                        marginTop: '6px',
                        fontSize: '12px',
                        color: 'var(--dsw-alias-state-error-primary, #d33)',
                      }}>
                        {t(`settings.customAudio.error.${audioError.reason}` as keyof typeof locales['en'])
                          .replace('{size}', formatBytes(MAX_AUDIO_BYTES))}
                      </p>
                    )}
                    <p style={{
                      marginLeft: '24px',
                      marginTop: '6px',
                      fontSize: '12px',
                      color: 'var(--dsw-alias-label-tertiary)',
                    }}>
                      {t('settings.customAudio.hint').replace('{size}', formatBytes(MAX_AUDIO_BYTES))}
                    </p>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
      
      {/* Task Mode */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
          {t('settings.mode.label')}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--dsw-alias-label-secondary)', lineHeight: '1.5', marginBottom: '10px' }}>
          {t('settings.mode.description')}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {MAINLINE_MODE_OPTIONS.map(({ mode, labelKey, descriptionKey }) => (
            <label
              key={mode}
              style={{
                display: 'flex',
                alignItems: descriptionKey ? 'flex-start' : 'center',
                gap: '8px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="attention-mainline-mode"
                checked={settings.mainlineMode === mode}
                onChange={() => updateSetting('mainlineMode', mode)}
                style={{
                  accentColor: 'var(--dsw-alias-state-business-primary)',
                  marginTop: descriptionKey ? '3px' : undefined,
                }}
              />
              <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span>{t(labelKey)}</span>
                {descriptionKey && (
                  <span style={{ color: 'var(--dsw-alias-label-secondary)', lineHeight: '1.4' }}>
                    {t(descriptionKey)}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Main-line Session Marker */}
      <div style={{ marginBottom: '24px', padding: '12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: '6px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <SparkStar active size={15} />
          {t('settings.mainline.label')}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--dsw-alias-label-secondary)', lineHeight: '1.5' }}>
          {t('settings.mainline.description')}
        </p>
      </div>
      
      {/* Browser Notifications */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <input
            type="checkbox"
            checked={settings.browserEnabled}
            onChange={e => {
              if (e.target.checked && permissionState !== 'granted') {
                handleEnableBrowserNotifications()
              } else {
                updateSetting('browserEnabled', e.target.checked)
              }
            }}
            disabled={permissionState === 'denied'}
            style={{ marginRight: '8px', accentColor: 'var(--dsw-alias-state-business-primary)' }}
          />
          <span style={{ fontWeight: 500 }}>{t('settings.browser.label')}</span>
        </label>
        <p style={{ fontSize: '13px', color: 'var(--dsw-alias-label-secondary)', marginLeft: '24px', marginBottom: '8px' }}>
          {t('settings.browser.description')}
        </p>
        
        <div style={{ marginLeft: '24px', fontSize: '13px', color: 'var(--dsw-alias-label-secondary)' }}>
          <span>
            {permissionState === 'granted' && t('settings.browser.permission.granted')}
            {permissionState === 'denied' && t('settings.browser.permission.denied')}
            {permissionState === 'default' && t('settings.browser.permission.default')}
          </span>
          
          {permissionState !== 'granted' && permissionState !== 'denied' && (
            <button
              onClick={handleEnableBrowserNotifications}
              style={{
                marginLeft: '12px',
                padding: '4px 12px',
                borderRadius: '4px',
                border: '1px solid var(--dsw-alias-state-business-primary)',
                background: 'var(--dsw-alias-state-business-primary)',
                color: 'var(--dsw-alias-label-primary-foreground, #fff)',
                cursor: 'pointer',
              }}
            >
              {t('settings.browser.enable')}
            </button>
          )}
          
          {settings.browserEnabled && permissionState === 'granted' && (
            <button
              onClick={handleTestNotification}
              style={{
                marginLeft: '12px',
                padding: '4px 12px',
                borderRadius: '4px',
                border: '1px solid var(--dsw-alias-border-l3)',
                background: 'var(--dsw-alias-interactive-bg-hover)',
                cursor: 'pointer',
              }}
            >
              {t('settings.browser.test')}
            </button>
          )}
        </div>
      </div>
      
      {/* Current Session Alerts */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
          {t('settings.currentSession.label')}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {CURRENT_SESSION_OPTIONS.map(({ mode, labelKey, descriptionKey }) => (
            <label
              key={mode}
              style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', cursor: 'pointer' }}
            >
              <input
                type="radio"
                name="attention-current-session-mode"
                checked={settings.currentSessionMode === mode}
                onChange={() => updateSetting('currentSessionMode', mode)}
                style={{ accentColor: 'var(--dsw-alias-state-business-primary)', marginTop: '3px' }}
              />
              <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span>{t(labelKey)}</span>
                <span style={{ color: 'var(--dsw-alias-label-secondary)', lineHeight: '1.4' }}>
                  {t(descriptionKey)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Wait for Subagents */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <input
            type="checkbox"
            checked={settings.waitForSubagents}
            onChange={e => updateSetting('waitForSubagents', e.target.checked)}
            style={{ marginRight: '8px', accentColor: 'var(--dsw-alias-state-business-primary)' }}
          />
          <span style={{ fontWeight: 500 }}>{t('settings.waitForSubagents.label')}</span>
        </label>
        <p style={{ fontSize: '13px', color: 'var(--dsw-alias-label-secondary)', marginLeft: '24px' }}>
          {t('settings.waitForSubagents.description')}
        </p>
      </div>

      {/* Sidebar Mainline Badge */}
      <div>
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <input
            type="checkbox"
            checked={settings.sidebarBadge}
            onChange={e => {
              updateSetting('sidebarBadge', e.target.checked)
              // The badge lives in the sidebar DOM, not in this React tree;
              // without a nudge, flipping the switch back on would only take
              // effect at the next unrelated sidebar mutation.
              requestSidebarBadgeRescan()
            }}
            style={{ marginRight: '8px', accentColor: 'var(--dsw-alias-state-business-primary)' }}
          />
          <span style={{ fontWeight: 500 }}>{t('settings.badge.label')}</span>
        </label>
        <p style={{ fontSize: '13px', color: 'var(--dsw-alias-label-secondary)', marginLeft: '24px' }}>
          {t('settings.badge.description')}
        </p>
      </div>
    </div>
  )
}
