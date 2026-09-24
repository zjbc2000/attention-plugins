/**
 * Client half of attention-plugins (DSH 0.1.7-rc.1 adaptation).
 *
 * 0.1.7 contract changes addressed here:
 * - Slot entries receive the inject face as DIRECT props (the renderer calls
 *   the register option's inject() itself); the old props.inject() thunk is gone.
 * - The `hooks` key of an inject face is reserved (bindInjectSources) —
 *   mainline state is delivered as plain face members instead.
 * - `ctx.sessions.useSessions` (the 0.1.6 store) no longer exists. Completion
 *   edges now arrive via the remote event hub: ctx.remote.$on('api-session/…'),
 *   the same wire the official api-session-controller consumes. Titles/details
 *   come from the `sessions` service snapshot (sessions.list.getSnapshot()).
 *
 * Marking surfaces: composer tool-row toggle + sidebar row "..." menu item +
 * persistent sidebar badge (B2, experimental). The conversation header button
 * was removed at the user's request.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'
import { NotificationEngine, type SessionDetail } from './engine.js'
import { playSound } from './sounds.js'
import { showNotification } from './notification.js'
import { loadSettings, saveSettings, AttentionSettingsSection } from './settings.js'
import { locales, resolveLocaleCode } from './locales.js'
import { mainlineStore } from './mainline-store.js'
import { MainlineComposerButton } from './mainline-composer-button.js'
import { MainlineMenuItem } from './mainline-menu-item.js'
import { installSidebarBadge } from './sidebar-badge.js'

export const name = 'attention-plugins'

export interface Config {}

/** The session the user is currently viewing (best effort, for notifyCurrent gating). */
const viewTracker: { current: SessionId | null } = { current: null }

function translate(key: string): string {
  const localeCode = resolveLocaleCode()
  return locales[localeCode][key as keyof typeof locales['en']] || key
}

/** The face the mainline surfaces receive as direct props (no `hooks` key!). */
function mainlineFace() {
  return {
    onToggle: (id: SessionId) => {
      mainlineStore.set(mainlineStore.getSnapshot() === id ? '' : id)
    },
    t: translate,
    setSeen: (id: SessionId) => {
      viewTracker.current = id
    },
  }
}

export const inject = ['slots', 'remote', 'sessions']

export function apply(ctx: Context, config: Config) {
  const slots = (ctx as any).slots

  // ── Settings panel (settings.section slot) ────────────────────────────────
  if (slots?.inject) {
    ctx.effect(() => {
      const dispose = slots.inject('settings.section', () =>
        slots.register({
          name: 'settings.section',
          id: 'attention-plugins',
          order: 150,
          label: () => 'Attention',
          inject: () => ({
            locale: resolveLocaleCode(),
          }),
        }, AttentionSettingsSection)
      )
      return () => dispose?.()
    })
  }

  // ── ⭐ compact toggle: composer tool row (works on a blank new session) ───
  if (slots?.inject) {
    ctx.effect(() => {
      const dispose = slots.inject('conversation.input.left', () =>
        slots.register({
          name: 'conversation.input.left',
          id: 'attention-mainline-composer',
          order: 100,
          inject: mainlineFace,
        }, MainlineComposerButton)
      )
      return () => dispose?.()
    })
  }

  // ── ⭐ main-line item: sidebar session row "..." menu (B4) ────────────────
  if (slots?.inject) {
    ctx.effect(() => {
      const dispose = slots.inject('sidebar.workspaces.session.menu.item', () =>
        slots.register({
          name: 'sidebar.workspaces.session.menu.item',
          id: 'attention-mainline-menu',
          order: 150,
          label: () => '主线',
          inject: mainlineFace,
        }, MainlineMenuItem)
      )
      return () => dispose?.()
    })
  }

  // ── Notifications: remote session events (0.1.7 wiring) ──────────────────
  ctx.effect(() => {
    const sessionsSvc = (ctx as any).sessions
    const listOf = () => sessionsSvc?.list?.getSnapshot?.()

    const engine = new NotificationEngine({
      titleOf: (sessionId: SessionId) => {
        const row = listOf()?.byId?.[sessionId]
        return row?.title || 'Untitled'
      },
      detailOf: (sessionId: SessionId): SessionDetail | undefined => {
        const row = listOf()?.byId?.[sessionId]
        if (row === undefined) return undefined
        return {
          maxTurnErrorSeq: 0,
          failureMessage: null,
          lastAgentError: (row as any).lastAgentError ?? null,
          finalText: '',
        }
      },
      isMainline: (sessionId: SessionId) => mainlineStore.getSnapshot() === sessionId,
      emit: (event) => {
        const settings = loadSettings()
        const typeSettings = settings.types[event.kind]
        if (!typeSettings.enabled) return

        // Gating: quiet the currently viewed session by default
        const isCurrent = viewTracker.current === event.sessionId
        const isHidden = document.hidden
        if (isCurrent && !isHidden && !settings.notifyCurrent) return

        // Play sound
        if (settings.soundEnabled && typeSettings.sound !== 'none') {
          playSound(typeSettings.sound, settings.volume)
        }

        // Show browser notification when away
        if (settings.browserEnabled) {
          const shouldNotify = isHidden || !isCurrent || settings.notifyCurrent
          if (shouldNotify) {
            const t = (key: keyof typeof locales['en']) => locales[resolveLocaleCode()][key]
            const title = t(`notification.${event.kind}.title` as any) || event.kind
            const body = t(`notification.${event.kind}.body` as any)
              ?.replace('{title}', event.title)
              ?.replace('{detail}', event.detail) || event.detail
            showNotification(title, body)
          }
        }
      },
      settle: () => new Promise(resolve => setTimeout(resolve, 100)),
    })

    // Seed from the current sessions snapshot so tasks that started before
    // this page load still raise completion notifications.
    const snap = listOf()
    if (snap?.byId) engine.seed(snap as any)

    const remote = (ctx as any).remote
    if (remote?.$on) {
      const offs: Array<() => void> = []
      const on = (event: string, handler: (...args: any[]) => void) => {
        try {
          const off = remote.$on(event, handler)
          if (typeof off === 'function') offs.push(off)
        } catch (err) {
          console.warn(`[attention-plugins] failed to subscribe ${event}:`, err)
        }
      }
      on('api-session/added', (summary: any) => engine.observeAdded(summary))
      on('api-session/removed', (sessionId: SessionId) => engine.observeRemoved(sessionId))
      on('api-session/status', (sessionId: SessionId, running: boolean) => engine.observeStatus(sessionId, running))
      on('api-session/error', (sessionId: SessionId, message: string) => engine.observeError(sessionId, message))
      return () => {
        for (const off of offs) { try { off() } catch {} }
      }
    }

    console.warn('[attention-plugins] ctx.remote unavailable; completion notifications disabled')
    return () => {}
  })

  // ── B2: sidebar persistent mainline star (experimental DOM injection) ─────
  ctx.effect(() => {
    const sessionsSvc = (ctx as any).sessions
    const listOf = () => sessionsSvc?.list?.getSnapshot?.()
    const resolveByTitle = (title: string): SessionId | null => {
      const snap = listOf()?.byId
      if (!snap || !title) return null
      let partial: SessionId | null = null
      for (const row of Object.values(snap) as any[]) {
        const dt: string = row?.displayTitle || row?.title || ''
        if (!dt || dt.length < 4) continue
        if (title === dt) return row.id
        if (partial === null && title.includes(dt)) partial = row.id
      }
      return partial
    }
    return installSidebarBadge(resolveByTitle)
  })
}
