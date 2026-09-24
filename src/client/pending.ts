/**
 * Pending-interaction projection.
 *
 * Questions and approval requests are NOT carried by any `api-session/*`
 * remote event — the session controller only emits added / removed / status /
 * error / activity. They surface exclusively on the UI status source
 * (`ctx.uiSession.sessionStatus`), whose rows carry `pendingInteraction`.
 *
 * That source is the union of two domain contributions:
 * - `dsh-client-ui-user-questions` → `kind: 'question' | 'plan-review'`
 * - `dsh-client-ui-approval`       → `kind: 'approval'`
 *
 * Neither package is a dependency of this plugin, so the fields are read
 * structurally instead of by importing their classes.
 */
import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'
import type { PendingFacts } from './engine.js'

/** Structural view of one pending interaction published on the status source. */
export interface PendingInteractionLike {
  /** Opaque request identity; a replacement request uses a new key. */
  readonly key?: unknown
  /** Domain discriminator: `'approval'`, `'question'` or `'plan-review'`. */
  readonly kind?: unknown
  /** Approval only: tool asking for the decision. */
  readonly toolName?: unknown
  /** Approval only: human-readable reason supplied by the requester. */
  readonly reason?: unknown
  /** Question only: the request's question list. */
  readonly questions?: unknown
}

/** Structural view of one Session's UI status row. */
export interface SessionStatusLike {
  readonly pendingInteraction?: PendingInteractionLike | null | undefined
}

/** Read the first question's text out of a question interaction. */
function questionText(questions: unknown): string {
  if (!Array.isArray(questions)) return ''
  const first = questions[0] as { question?: unknown } | undefined
  return typeof first?.question === 'string' ? first.question : ''
}

/** Human-readable detail line for one pending interaction. */
export function pendingDetail(interaction: PendingInteractionLike): string {
  if (interaction.kind === 'approval') {
    const tool = typeof interaction.toolName === 'string' ? interaction.toolName : ''
    const reason = typeof interaction.reason === 'string' ? interaction.reason : ''
    if (tool !== '' && reason !== '') return `${tool} — ${reason}`
    return reason !== '' ? reason : tool
  }
  return questionText(interaction.questions)
}

/**
 * Project a UI status snapshot onto the engine's pending-interaction facts.
 *
 * Rows without a live interaction, and interactions without a usable key, are
 * skipped: the key is the engine's only de-duplication axis, so an unkeyed
 * request would re-notify on every snapshot.
 *
 * @param statuses - the `SessionStatusSnapshot` (a map of session to status).
 * @returns one fact per session currently awaiting the user.
 */
export function collectPending(
  statuses: Iterable<readonly [SessionId, SessionStatusLike | undefined]>,
): Map<SessionId, PendingFacts> {
  const facts = new Map<SessionId, PendingFacts>()

  for (const [id, status] of statuses) {
    const interaction = status?.pendingInteraction
    if (interaction === undefined || interaction === null) continue

    const key = typeof interaction.key === 'string' ? interaction.key : ''
    if (key === '') continue

    facts.set(id, {
      key,
      // 'plan-review' is a question presentation, so only 'approval' differs.
      kind: interaction.kind === 'approval' ? 'approval' : 'question',
      detail: pendingDetail(interaction),
    })
  }

  return facts
}
