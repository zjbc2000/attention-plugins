/**
 * Notification engine for attention-plugins.
 * Supports 4 event types: completed, failed, question, permission.
 *
 * Side-line alerting is a user setting (`ports.sidelineMode`):
 * - `per-session` (default): EVERY session alerts on its own completion, main
 *   line or not, and no aggregate "all tasks" alert is ever raised.
 * - `batch`: only the main line alerts immediately; side-line sessions stay
 *   quiet and one aggregate alert fires when ALL running sessions go idle.
 *
 * Two equivalent inputs feed the same state machine:
 * - observe()/seed(): full sessions-list snapshots (0.1.6 store wiring, tests)
 * - observeStatus()/observeAdded()/observeRemoved()/observeError(): the
 *   0.1.7 remote event wiring (api-session/* events, one session at a time).
 */
import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'
import type { SessionListState, SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type { NotificationType, SidelineMode } from '../settings.js'

/** One notification event. */
export interface NotificationEvent {
  kind: NotificationType
  sessionId: SessionId
  /** Human display title of the session. */
  title: string
  /** Detail text (error message, question text, etc.). */
  detail: string
}

/** Minimal session detail for classification. */
export interface SessionDetail {
  /** Last agent error text, null when none. */
  lastAgentError: string | null
  /** Final completion text. */
  finalText: string
  /** Max turn-error sequence number. */
  maxTurnErrorSeq: number
  /** Failure message from turn-error. */
  failureMessage: string | null
}

/** Pending interaction facts. */
export interface PendingFacts {
  key: string
  kind: 'question' | 'approval'
  detail: string
}

/** Engine dependencies (injected by browser wiring). */
export interface NotificationEnginePorts {
  /** Human display title of one session. */
  titleOf: (sessionId: SessionId) => string
  /** Read one session's detail snapshot. */
  detailOf: (sessionId: SessionId) => SessionDetail | undefined
  /** Whether one session is marked as main-line. */
  isMainline: (sessionId: SessionId) => boolean
  /**
   * How side-line (non-main-line) sessions are alerted. Read on every run
   * completion so switching the setting takes effect without a reload.
   */
  sidelineMode: () => SidelineMode
  /** Deliver one notification event. */
  emit: (event: NotificationEvent) => void
  /** Wait for trailing wire frames after a running edge (settle window). */
  settle: () => Promise<void>
}

/** Baseline captured when a run starts. */
interface RunState {
  /** `detailOf().maxTurnErrorSeq` observed when the run armed. */
  baselineTurnErrorSeq: number
  baselineAgentError: string | null
  /** api-session/error occurrences already seen when the run armed. */
  baselineErrorCount: number
}

/**
 * Notification engine: tracks running edges, pending interactions,
 * and dispatches 4 event types with main-line/side-line logic.
 */
export class NotificationEngine {
  private readonly prevRunning = new Map<SessionId, boolean>()
  private readonly runs = new Map<SessionId, RunState>()
  private readonly settling = new Set<SessionId>()
  private readonly pendingKeys = new Map<SessionId, string>()
  /** Last api-session/error message per session (run-scoped classification). */
  private readonly errors = new Map<SessionId, string>()
  /**
   * api-session/error occurrence count per session. Counting occurrences rather
   * than comparing messages keeps consecutive runs that fail with an identical
   * message distinguishable.
   */
  private readonly errorCounts = new Map<SessionId, number>()

  /** Track whether we've seen any running=true (for side-line "all idle" detection). */
  private hadRunning = false

  constructor(private readonly ports: NotificationEnginePorts) {}

  /**
   * Process one sessions-list snapshot (called on every list change).
   */
  observe(sessions: SessionListState): void {
    const seen = new Set<SessionId>()
    let hasRunning = false
    let mainlineJustCompleted = false

    for (const summary of Object.values(sessions.byId)) {
      const id = summary.id
      seen.add(id)

      if (summary.running) hasRunning = true

      const prevRunning = this.prevRunning.get(id) ?? false
      const nowRunning = summary.running

      // Detect true → false edge
      if (prevRunning && !nowRunning) {
        void this.settleRun(id)

        // Track if main-line just completed (for side-line suppression)
        if (this.ports.isMainline(id)) {
          mainlineJustCompleted = true
        }
      } else if (!prevRunning && nowRunning) {
        this.armRun(id)
      }

      this.prevRunning.set(id, nowRunning)
    }

    // Side-line logic: detect "had running → all idle" edge. Only the `batch`
    // mode aggregates; in `per-session` mode every session already alerted
    // itself, so an aggregate would just be a duplicate.
    if (this.aggregates() && this.hadRunning && !hasRunning && !mainlineJustCompleted) {
      this.emitSidelineComplete()
    }
    this.hadRunning = hasRunning

    // Clean up tracking for removed sessions
    for (const id of this.prevRunning.keys()) {
      if (!seen.has(id)) {
        this.prevRunning.delete(id)
        this.runs.delete(id)
        this.pendingKeys.delete(id)
        this.errors.delete(id)
        this.errorCounts.delete(id)
      }
    }
  }

  /**
   * Process one api-session/status event (0.1.7 wiring).
   * Same per-session edge semantics as observe(), one session at a time.
   */
  observeStatus(sessionId: SessionId, running: boolean): void {
    const prev = this.prevRunning.get(sessionId) ?? false
    let mainlineJustCompleted = false

    if (prev && !running) {
      void this.settleRun(sessionId)
      if (this.ports.isMainline(sessionId)) mainlineJustCompleted = true
    } else if (!prev && running) {
      this.armRun(sessionId)
    }

    this.prevRunning.set(sessionId, running)

    let hasRunning = false
    for (const v of this.prevRunning.values()) {
      if (v) { hasRunning = true; break }
    }
    if (this.aggregates() && this.hadRunning && !hasRunning && !mainlineJustCompleted) {
      this.emitSidelineComplete()
    }
    this.hadRunning = hasRunning
  }

  /**
   * Process one api-session/added event: seed a newly appeared session.
   */
  observeAdded(summary: { id: SessionId; running?: boolean }): void {
    if (summary == null || summary.id == null) return
    if (this.prevRunning.has(summary.id)) return
    const running = summary.running === true
    this.prevRunning.set(summary.id, running)
    if (running) {
      this.armRun(summary.id)
      this.hadRunning = true
    }
  }

  /**
   * Process one api-session/removed event: drop all tracking for the session.
   */
  observeRemoved(sessionId: SessionId): void {
    this.prevRunning.delete(sessionId)
    this.runs.delete(sessionId)
    this.pendingKeys.delete(sessionId)
    this.errors.delete(sessionId)
    this.errorCounts.delete(sessionId)
  }

  /**
   * Process one api-session/error event: remember the message for the
   * failure classification of the session's current/next run.
   */
  observeError(sessionId: SessionId, message: string): void {
    if (typeof message === 'string' && message.length > 0) {
      this.errors.set(sessionId, message)
      this.errorCounts.set(sessionId, (this.errorCounts.get(sessionId) ?? 0) + 1)
    }
  }

  /**
   * Process pending interactions snapshot.
   *
   * @param pending - one fact per session currently awaiting the user.
   * @param options.silent - record the baseline without emitting. Used for the
   *   first snapshot after load, so interactions that were already pending when
   *   the page opened do not raise a burst of notifications.
   */
  observePending(
    pending: ReadonlyMap<SessionId, PendingFacts>,
    options: { silent?: boolean } = {},
  ): void {
    for (const [id, facts] of pending) {
      const prevKey = this.pendingKeys.get(id)
      if (prevKey === undefined || prevKey !== facts.key) {
        // New interaction or replacement
        const kind: NotificationType = facts.kind === 'approval' ? 'permission' : 'question'
        if (options.silent !== true) {
          this.ports.emit({
            kind,
            sessionId: id,
            title: this.ports.titleOf(id),
            detail: facts.detail,
          })
        }
      }
      this.pendingKeys.set(id, facts.key)
    }

    for (const id of this.pendingKeys.keys()) {
      if (!pending.has(id)) this.pendingKeys.delete(id)
    }
  }

  /**
   * Seed baseline: record initial state without raising events.
   */
  seed(sessions: SessionListState): void {
    let hasRunning = false
    for (const summary of Object.values(sessions.byId)) {
      this.prevRunning.set(summary.id, summary.running)
      if (summary.running) {
        this.armRun(summary.id)
        hasRunning = true
      }
    }
    this.hadRunning = hasRunning
  }

  /** Whether side-line sessions are aggregated instead of alerted one by one. */
  private aggregates(): boolean {
    return this.ports.sidelineMode() === 'batch'
  }

  /** Capture pre-run baseline. */
  private armRun(id: SessionId): void {
    const detail = this.ports.detailOf(id)
    this.runs.set(id, {
      baselineTurnErrorSeq: detail?.maxTurnErrorSeq ?? 0,
      baselineAgentError: detail?.lastAgentError ?? null,
      baselineErrorCount: this.errorCounts.get(id) ?? 0,
    })
  }

  /** Classify a finished run after settle window. */
  private async settleRun(id: SessionId): Promise<void> {
    const run = this.runs.get(id)
    if (run === undefined || this.settling.has(id)) return

    this.runs.delete(id)
    this.settling.add(id)

    try {
      await this.ports.settle()

      // A newer run armed while settling: skip this stale one
      if (this.runs.has(id)) return

      const detail = this.ports.detailOf(id)
      // Run-scoped: only an error raised *after* the run armed counts.
      const errorCount = this.errorCounts.get(id) ?? 0
      const errorDuringRun = errorCount > run.baselineErrorCount
        ? (this.errors.get(id) ?? null)
        : null
      const failed = (detail !== undefined && (
        detail.maxTurnErrorSeq > run.baselineTurnErrorSeq ||
        (detail.lastAgentError !== null && detail.lastAgentError !== run.baselineAgentError)
      )) || errorDuringRun !== null

      const message = failed
        ? (detail?.failureMessage ?? errorDuringRun ?? detail?.lastAgentError ?? '')
        : (detail?.finalText ?? '')

      const kind: NotificationType = failed ? 'failed' : 'completed'

      // `per-session` (default): every finished run alerts, main-line or not.
      // `batch`: only the main line alerts; side-line runs are silent and are
      // covered by the aggregate "all idle" alert instead.
      if (this.ports.isMainline(id) || !this.aggregates()) {
        this.ports.emit({
          kind,
          sessionId: id,
          title: this.ports.titleOf(id),
          detail: message,
        })
      }
      // In `batch` mode, side-line completions are handled by the "all idle"
      // edge in observe()/observeStatus() (no individual per-session alert).

    } finally {
      this.settling.delete(id)
    }
  }

  /** Emit side-line completion: all tasks finished. */
  private emitSidelineComplete(): void {
    // Skip if no sessions were tracked (edge case: all removed)
    if (this.prevRunning.size === 0) return

    // Use first session as representative
    const sessions = Array.from(this.prevRunning.keys())
    const id = sessions[0]

    this.ports.emit({
      kind: 'completed',
      sessionId: id,
      title: 'All tasks',
      detail: 'All side-line tasks completed',
    })
  }
}
