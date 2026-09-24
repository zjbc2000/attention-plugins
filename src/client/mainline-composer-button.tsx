/**
 * Compact main-line toggle for the composer tool row (conversation.input.left slot).
 * Renders from the blank new-session state too, so a session can be marked as
 * main-line BEFORE the conversation starts ("main-line before first message").
 *
 * DSH 0.1.7 contract: the slot renderer calls the register option's inject()
 * itself and spreads the face as DIRECT props; `sessionId` comes from the
 * slot's standard session props.
 *
 * Mainline state is read from the shared mainlineStore via
 * useSyncExternalStore. Glyph: S4 four-point sparkle, crystal palette.
 */
import React, { useCallback, useSyncExternalStore } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'
import { mainlineStore } from './mainline-store.js'
import { SparkStar } from './spark-star.js'

/** The inject face delivered as direct props by the 0.1.7 slot renderer. */
export interface MainlineInjected {
  onToggle: (id: SessionId) => void
  t: (key: string) => string
  /** Best-effort view tracking for notifyCurrent gating. */
  setSeen?: (id: SessionId) => void
}

/** Props for the compact main-line tool-row button. */
export interface MainlineComposerButtonProps extends MainlineInjected {
  sessionId?: SessionId
}

/** Compact icon-only main-line toggle rendered in the composer tool row. */
export function MainlineComposerButton(props: MainlineComposerButtonProps) {
  const { sessionId, onToggle, t, setSeen } = props
  const mainlineId = useSyncExternalStore(mainlineStore.subscribe, mainlineStore.getSnapshot)

  // Best-effort view tracking for notifyCurrent gating (idempotent per render).
  if (sessionId != null && setSeen) setSeen(sessionId)

  // All hooks run unconditionally; the tool row may mount before a session binds.
  const active = sessionId != null && mainlineId === sessionId

  const handleClick = useCallback(() => {
    if (sessionId == null) return
    onToggle(sessionId)
  }, [sessionId, onToggle])

  if (sessionId == null) return null

  const activeBg = 'rgba(140,180,255,.14)'
  const activeHoverBg = 'rgba(140,180,255,.24)'

  return (
    <button
      type="button"
      onClick={handleClick}
      title={t(active ? 'mainline.unset' : 'mainline.set')}
      aria-pressed={active}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '26px',
        height: '26px',
        padding: 0,
        border: 'none',
        borderRadius: '6px',
        background: active ? activeBg : 'transparent',
        color: active ? '#a8ccff' : 'var(--dsw-alias-label-tertiary)',
        fontSize: '15px',
        lineHeight: 1,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = active ? activeHoverBg : 'var(--dsw-alias-interactive-bg-hover)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = active ? activeBg : 'transparent'
      }}
    >
      <SparkStar active={active} size={15} />
    </button>
  )
}
