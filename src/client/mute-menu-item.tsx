/**
 * "静音此会话 / 取消静音" item for the sidebar session row "..." menu
 * (slot sidebar.workspaces.session.menu.item, order 160 — just below the
 * mainline item). Muting one session silences every event it raises, including
 * questions and permission requests; the marking itself lives in settings and
 * survives reloads.
 */
import React, { useSyncExternalStore } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'
import { muteStore } from './mute-store.js'

export interface MuteMenuItemProps {
  sessionId?: SessionId
  displayTitle?: string
  t: (key: string) => string
  /** Injected by the slot: the owner row's [open, setOpen] useState pair. */
  useMenuOpenState?: () => readonly [boolean, (open: boolean) => void]
}

function BellSlash({ muted }: { muted: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-9.33-5" />
      <path d="M6 8a6 6 0 0 0 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      {muted ? <path d="M2 2l20 20" /> : null}
    </svg>
  )
}

export function MuteMenuItem(props: MuteMenuItemProps) {
  const { sessionId, t, useMenuOpenState } = props
  const mutedIds = useSyncExternalStore(muteStore.subscribe, muteStore.getSnapshot)

  let setMenuOpen: ((open: boolean) => void) | undefined
  if (typeof useMenuOpenState === 'function') {
    try {
      const pair = useMenuOpenState()
      setMenuOpen = pair?.[1]
    } catch {
      setMenuOpen = undefined
    }
  }

  if (sessionId == null) return null
  const active = mutedIds.includes(sessionId)

  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation()
        try { setMenuOpen?.(false) } catch {}
        muteStore.toggle(sessionId)
      }}
      title={t(active ? 'mute.unset' : 'mute.set')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '7px 10px',
        border: 'none',
        borderRadius: '6px',
        background: 'transparent',
        color: active ? '#a8ccff' : 'var(--dsw-alias-label-secondary, #a6a6a6)',
        fontSize: '12.5px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--dsw-alias-interactive-bg-hover, #272727)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <BellSlash muted={active} />
      <span>{active ? t('mute.unset') : t('mute.set')}</span>
    </button>
  )
}
