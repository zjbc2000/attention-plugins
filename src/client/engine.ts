/**
 * Notification engine for attention-plugins.
 * Supports 4 event types: completed, failed, question, permission.
 * Implements main-line/side-line logic:
 * - Main-line: marked session alerts immediately on completion
 * - Side-line: all running sessions alert once when ALL become idle
 */
import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'
import type { SessionListState, SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type { NotificationType } from '../settings.js'

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
  /** Deliver one notification event. */
  emit: (event: NotificationEvent) => void
  /** Wait for trailing wire frames after a running edge (settle window). */
  settle: () => Promise<void>
}

/** Baseline captured when a run starts. */
interface RunState {
  baselineErrorSeq: number
  baselineAgentError: string | null
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
    
    // Side-line logic: detect "had running → all idle" edge
    // BUT suppress if main-line just completed (avoid duplicate notification)
    if (this.hadRunning && !hasRunning && !mainlineJustCompleted) {
      this.emitSidelineComplete()
    }
    this.hadRunning = hasRunning
    
    // Clean up tracking for removed sessions
    for (const id of this.prevRunning.keys()) {
      if (!seen.has(id)) {
        this.prevRunning.delete(id)
        this.runs.delete(id)
        this.pendingKeys.delete(id)
      }
    }
  }

  /**
   * Process pending interactions snapshot.
   */
  observePending(pending: ReadonlyMap<SessionId, PendingFacts>): void {
    for (const [id, facts] of pending) {
      const prevKey = this.pendingKeys.get(id)
      if (prevKey === undefined || prevKey !== facts.key) {
        // New interaction or replacement
        const kind: NotificationType = facts.kind === 'approval' ? 'permission' : 'question'
        this.ports.emit({
          kind,
          sessionId: id,
          title: this.ports.titleOf(id),
          detail: facts.detail,
        })
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

  /** Capture pre-run baseline. */
  private armRun(id: SessionId): void {
    const detail = this.ports.detailOf(id)
    this.runs.set(id, {
      baselineErrorSeq: detail?.maxTurnErrorSeq ?? 0,
      baselineAgentError: detail?.lastAgentError ?? null,
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
      const failed = detail !== undefined && (
        detail.maxTurnErrorSeq > run.baselineErrorSeq ||
        (detail.lastAgentError !== null && detail.lastAgentError !== run.baselineAgentError)
      )
      
      const message = failed
        ? (detail?.failureMessage ?? detail?.lastAgentError ?? '')
        : (detail?.finalText ?? '')
      
      const kind: NotificationType = failed ? 'failed' : 'completed'
      
      // Main-line: alert immediately
      if (this.ports.isMainline(id)) {
        this.ports.emit({
          kind,
          sessionId: id,
          title: this.ports.titleOf(id),
          detail: message,
        })
      }
      // Side-line completions are handled by "all idle" edge in observe()
      // (no individual per-session notification for side-line)
      
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
