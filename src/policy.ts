/**
 * Alert policy for attention-plugins.
 *
 * Pure functions only: the browser wiring and the plain tests share them, so a
 * rule change is verifiable without a DOM. Three questions are answered here:
 *
 * 1. should this finished run alert on its own, wait for the aggregate edge, or
 *    stay silent (`decideAlert`)?
 * 2. may an alert interrupt the session the user is reading right now
 *    (`shouldAlertCurrentSession`)?
 * 3. is this alert deferred because the session still has running subagents
 *    (`shouldWaitForSubagents`)?
 */
import type { CurrentSessionMode, MainlineMode, NotificationType } from './settings.js'

/** What to do with one finished run. */
export type AlertAction = 'now' | 'aggregate' | 'never'

/** Inputs for one alert decision; everything is read at decision time. */
export interface AlertPolicyInput {
  kind: NotificationType
  /** Whether the user marked this session as main-line. */
  markedMainline: boolean
  mainlineMode: MainlineMode
  /** User muted this session individually. */
  muted: boolean
}

/**
 * Decide how one event is delivered.
 *
 * Rules (in order):
 * - a muted session never alerts;
 * - `question` / `permission` always alert: the run is blocked on the user;
 * - `silent` mode never alerts a completion — no sound, no browser
 *   notification, not even the aggregate chime;
 * - a marked main-line alerts on its own completion;
 * - `balanced` alerts every completion on its own;
 * - otherwise (`mainline` mode, unmarked session) it joins the aggregate edge:
 *   one chime once every running session is idle.
 */
export function decideAlert(input: AlertPolicyInput): AlertAction {
  if (input.muted) return 'never'
  if (input.kind === 'question' || input.kind === 'permission') return 'now'
  if (input.mainlineMode === 'silent') return 'never'
  if (input.markedMainline) return 'now'
  if (input.mainlineMode === 'balanced') return 'now'
  return 'aggregate'
}

/** What the page can observe about focus. */
export interface FocusState {
  /** `document.hidden`: tab switched away or window minimised. */
  hidden: boolean
  /** `document.hasFocus()`: the window owns keyboard focus. */
  focused: boolean
}

/**
 * Whether an alert may interrupt the session currently on screen.
 * Split screens and second monitors are why `hidden` alone is not enough:
 * the page stays visible while another application has focus.
 */
export function shouldAlertCurrentSession(
  mode: CurrentSessionMode,
  focus: FocusState,
): boolean {
  if (mode === 'always') return true
  if (mode === 'unfocused') return focus.hidden || !focus.focused
  return focus.hidden
}

/**
 * Whether a finished run must wait for its running subagents.
 * A run that spawned subagents is not finished while they still work, and
 * announcing it early is the most reported false positive of this class of
 * plugins.
 */
export function shouldWaitForSubagents(
  enabled: boolean,
  runningChildren: number,
): boolean {
  return enabled && runningChildren > 0
}

/** Count sessions whose direct parent is `sessionId`. */
export function countRunningChildren(
  sessionId: string,
  rows: Iterable<{ parentSessionId?: string; running?: boolean; origin?: string }>,
): number {
  let count = 0
  for (const row of rows) {
    if (row.parentSessionId === sessionId && row.running === true) count += 1
  }
  return count
}
