/**
 * Cross-module DOM event names for the imperative sidebar badge.
 *
 * The badge is inserted into the sidebar DOM rather than rendered by React, so
 * a settings toggle must nudge the scanner directly. Keeping both the name and
 * the dispatch helper here (a leaf module) means the settings panel never has
 * to import the scanner — which imports the settings panel back.
 */

/** Fired on `window` to ask the sidebar badge scanner to re-run now. */
export const MAINLINE_RESCAN_EVENT = 'att-mainline-rescan'

/** Ask the badge scanner to re-run now (e.g. after the sidebar-badge toggle flips). */
export function requestSidebarBadgeRescan(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(MAINLINE_RESCAN_EVENT))
}
