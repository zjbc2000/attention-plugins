/**
 * B2: persistent mainline star in the sidebar session list (experimental).
 *
 * DSH 0.1.7 ships no per-row badge slot for the sidebar session list, so this
 * keeps a small crystal sparkle in front of the mainline row's title via a
 * self-healing MutationObserver (the same technique @linxin666/dsh-web-all
 * uses for its sidebar entry). React may displace the node on re-render; the
 * next scan re-adds it. Toggle in Settings → Attention (sidebarBadge).
 * Clicking the badge cancels the mainline marking.
 */
import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'
import { mainlineStore } from './mainline-store.js'
import { loadSettings } from './settings.js'
import { PRIMOGEM_URI } from './primogem-uri.js'

const BADGE_ATTR = 'data-att-mainline-star'
const RESCAN_EVENT = 'att-mainline-rescan'

/**
 * The official Primogem art, inlined as a data URI — the real texture, not an
 * SVG redraw (three vector attempts still read "off" next to the reference).
 * No glow: the old drop-shadow on a 13px icon was what tired the eye.
 * Kept as a plain string (not the React component) because the badge is
 * inserted imperatively through a MutationObserver.
 */
const STAR_SVG =
  `<img src="${PRIMOGEM_URI}" width="13" height="13" alt="" aria-hidden="true" draggable="false" ` +
  'style="display:block;width:13px;height:13px;object-fit:contain;">'

function starNode(): HTMLSpanElement {
  const span = document.createElement('span')
  span.setAttribute(BADGE_ATTR, '1')
  span.setAttribute('aria-hidden', 'true')
  span.title = '主线会话（点击取消）'
  span.style.cssText = 'display:inline-flex;align-items:center;margin-right:6px;flex:none;cursor:pointer;'
  span.innerHTML = STAR_SVG
  span.addEventListener('click', (e) => {
    e.stopPropagation()
    mainlineStore.set('')
  })
  return span
}

function findRows(column: Element): HTMLElement[] {
  const rows = Array.from(column.querySelectorAll<HTMLElement>('[class*="sessionRow" i]'))
  if (rows.length > 0) return rows
  return Array.from(column.querySelectorAll<HTMLElement>('[class*="rowActions" i]'))
    .map((el) => el.parentElement)
    .filter((el): el is HTMLElement => el !== null)
}

function rowIdOf(row: HTMLElement, resolveByTitle: (title: string) => SessionId | null): SessionId | null {
  // 1) explicit data attributes carrying a session-id-like value
  for (const attr of Array.from(row.attributes)) {
    if (
      attr.name.startsWith('data-') &&
      /session|(^|-)id($|-)/i.test(attr.name) &&
      /^[0-9a-f-]{10,}$/i.test(attr.value)
    ) {
      return attr.value as SessionId
    }
  }
  // 2) fallback: match the row text against known session display titles
  return resolveByTitle((row.textContent || '').trim())
}

function removeAll(): void {
  document.querySelectorAll(`[${BADGE_ATTR}]`).forEach((el) => el.remove())
}

/**
 * Install the badge machinery. Returns a dispose function.
 * @param resolveByTitle - row-text → session id fallback resolver.
 */
export function installSidebarBadge(resolveByTitle: (title: string) => SessionId | null): () => void {
  if (typeof document === 'undefined') return () => {}

  let scheduled = false
  const scan = () => {
    scheduled = false
    try {
      if (!loadSettings().sidebarBadge) {
        removeAll()
        return
      }
      const mainlineId = mainlineStore.getSnapshot()
      if (!mainlineId) {
        removeAll()
        return
      }
      const column = document.querySelector('[data-pane="sidebar" i], [class*="sidebarCol" i]')
      if (column === null) return
      for (const row of findRows(column)) {
        const existing = row.querySelector(`[${BADGE_ATTR}]`)
        const id = rowIdOf(row, resolveByTitle)
        if (id !== null && id === mainlineId) {
          if (existing === null) row.insertBefore(starNode(), row.firstChild)
        } else if (existing !== null) {
          existing.remove()
        }
      }
    } catch (err) {
      console.warn('[attention-plugins] sidebar badge scan failed:', err)
    }
  }
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(scan)
  }

  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  const offStore = mainlineStore.subscribe(schedule)
  window.addEventListener(RESCAN_EVENT, schedule)

  schedule()
  return () => {
    observer.disconnect()
    offStore()
    window.removeEventListener(RESCAN_EVENT, schedule)
    removeAll()
  }
}
