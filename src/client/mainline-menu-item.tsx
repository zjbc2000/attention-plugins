/**
 * B4: "设为主线 / 取消主线" item for the sidebar session row "..." menu
 * (slot sidebar.workspaces.session.menu.item, order 150 — between pin and
 * rename). Dismisses the menu via the injected useMenuOpenState hook (the
 * same pattern as the shipped PinSessionMenuItem: setMenuOpen(false) first,
 * then act), then toggles the mainline marking through the shared face.
 */
import React, { useSyncExternalStore } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'
import type { MainlineInjected } from './mainline-composer-button.js'
import { mainlineStore } from './mainline-store.js'
import { SparkStar } from './spark-star.js'

export interface MainlineMenuItemProps extends MainlineInjected {
  sessionId?: SessionId
  displayTitle?: string
  /** Injected by the slot: the owner row's [open, setOpen] useState pair. */
  useMenuOpenState?: () => readonly [boolean, (open: boolean) => void]
}

export function MainlineMenuItem(props: MainlineMenuItemProps) {
  const { sessionId, onToggle, t, useMenuOpenState } = props
  const mainlineId = useSyncExternalStore(mainlineStore.subscribe, mainlineStore.getSnapshot)

  // The hook is bound while the row-menu slot exists; presence is stable per
  // mount, so calling it conditionally here keeps hook order consistent.
  let setMenuOpen: ((open: boolean) => void) | undefined
  if (typeof useMenuOpenState === 'function') {
    try {
      const pair = useMenuOpenState()
      setMenuOpen = pair?.[1]
    } catch {
      setMenuOpen = undefined
    }
  }

  const active = sessionId != null && mainlineId === sessionId

  if (sessionId == null) return null

  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation()
        try { setMenuOpen?.(false) } catch {}
        onToggle(sessionId)
      }}
      title={t(active ? 'mainline.unset' : 'mainline.set')}
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
      <SparkStar active={active} size={13} />
      <span>{active ? t('mainline.unset') : t('mainline.set')}</span>
    </button>
  )
}
