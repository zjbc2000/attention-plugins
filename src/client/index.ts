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
 * Alert policy (who may interrupt whom) lives in ../policy.ts; this file only
 * wires it to the browser: services, settings, sound, notifications, and the
 * mainline/mute marking surfaces.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'
import { NotificationEngine, type SessionDetail } from './engine.js'
import { playSound } from './sounds.js'
import { showNotification } from './notification.js'
import { loadSettings, AttentionSettingsSection } from './settings.js'
import { isMainlineSession, isMutedSession } from '../settings.js'
import { decideAlert, shouldAlertCurrentSession, countRunningChildren } from '../policy.js'
import { locales, resolveLocaleCode } from './locales.js'
import { mainlineStore } from './mainline-store.js'
import { MainlineComposerButton } from './mainline-composer-button.js'
import { MainlineMenuItem } from './mainline-menu-item.js'
import { MuteMenuItem } from './mute-menu-item.js'
import { installSidebarBadge } from './sidebar-badge.js'
import { resolveSessionByTitle, type SessionTitleRow } from './session-lookup.js'

export const name = 'attention-plugins'

export interface Config {}

/** The session the user is currently viewing (best effort, for current-session gating). */
const viewTracker: { current: SessionId | null } = { current: null }

function translate(key: string): string {
  const localeCode = resolveLocaleCode()
  return locales[localeCode][key as keyof typeof locales['en']] || key
}

/** The face the mainline surfaces receive as direct props (no `hooks` key!). */
function mainlineFace() {
  return {
    onToggle: (id: SessionId) => {
      mainlineStore.toggle(id)
    },
    t: translate,
    setSeen: (id: SessionId) => {
      viewTracker.current = id
    },
  }
}

/** The face the session menu's mute item receives. */
function muteFace() {
  return { t: translate }
}

export const inject = ['slots', 'remote', 'sessions']

export function apply(ctx: Context, config: Config) {
  const slots = (ctx as any).slots

  /**
   * Open one session in the workspace view. `uiWorkspace` is not in `inject`
   * (older hosts do not ship it), so this resolves lazily at click time and
   * degrades to a plain focus when the service is absent.
   */
  const openSession = (sessionId: string): void => {
    try {
      const workspace = typeof (ctx as any).get === 'function'
        ? (ctx as any).get('uiWorkspace')
        : (ctx as any).uiWorkspace
      if (workspace?.openSession) workspace.openSession(sessionId as SessionId)
    } catch (err) {
      console.warn('[attention-plugins] cannot open session:', err)
    }
  }

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

  // ── 🔇 mute item: same menu, right below the mainline item ────────────────
  if (slots?.inject) {
    ctx.effect(() => {
      const dispose = slots.inject('sidebar.workspaces.session.menu.item', () =>
        slots.register({
          name: 'sidebar.workspaces.session.menu.item',
          id: 'attention-mute-menu',
          order: 160,
          label: () => '静音',
          inject: muteFace,
        }, MuteMenuItem)
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
      // Who may interrupt: read per event so flipping a setting applies at once.
      alertAction: (kind, sessionId) => {
        const settings = loadSettings()
        return decideAlert({
          kind,
          markedMainline: isMainlineSession(sessionId, mainlineStore.getSnapshot(), settings.mainlineMode),
          mainlineMode: settings.mainlineMode,
          muted: isMutedSession(sessionId, settings.mutedSessionIds),
        })
      },
      // A run with running subagents is not finished: defer, then flush.
      runningChildren: (sessionId) => {
        const snap = listOf()
        const rows = snap?.byId ? Object.values(snap.byId) : []
        return countRunningChildren(sessionId, rows as Array<{ parentSessionId?: string; running?: boolean }>)
      },
      waitForSubagents: () => loadSettings().waitForSubagents,
      isMainline: (sessionId) => {
        const settings = loadSettings()
        return isMainlineSession(sessionId, mainlineStore.getSnapshot(), settings.mainlineMode)
      },
      // One "All tasks" chime is expected in mainline mode only: balanced
      // alerts every session on its own, silent alerts nothing.
      aggregateEnabled: () => loadSettings().mainlineMode === 'mainline',
      emit: (event) => {
        const settings = loadSettings()
        const typeSettings = settings.types[event.kind]
        if (!typeSettings.enabled) return

        // Current-session gate: three modes; default stays quiet while you read.
        if (viewTracker.current === event.sessionId
          && !shouldAlertCurrentSession(settings.currentSessionMode, {
            hidden: document.hidden,
            focused: document.hasFocus(),
          })) return

        const customUrl = typeSettings.customAudio?.dataUrl ?? null
        if (settings.soundEnabled && (customUrl !== null || typeSettings.sound !== 'none')) {
          playSound(typeSettings.sound, settings.volume, customUrl)
        }

        if (settings.browserEnabled) {
          const t = (key: string) => locales[resolveLocaleCode()][key as keyof typeof locales['en']]
          const title = t(`notification.${event.kind}.title`) || event.kind
          const body = (t(`notification.${event.kind}.body`) || '')
            .replace('{title}', event.title)
            .replace('{detail}', event.detail)
          showNotification(event.kind, event.sessionId, title, body || event.detail, openSession)
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
    const resolveByTitle = (text: string): SessionId | null => {
      const snap = listOf()?.byId
      if (!snap) return null
      return resolveSessionByTitle(text, Object.values(snap) as SessionTitleRow[])
    }
    return installSidebarBadge(resolveByTitle)
  })
}
