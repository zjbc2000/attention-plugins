/**
 * Notification engine for attention-plugins.
 * Supports 4 event types: completed, failed, question, permission.
 * Implements main-line/side-line logic:
 * - Main-line: marked session alerts immediately on completion
 * - Side-line: all running sessions alert once when ALL become idle
 */
import type { SessionId } from '@deepseek-ai/dsh-client-connection/client';
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client';
import type { NotificationType } from '../settings.js';
/** One notification event. */
export interface NotificationEvent {
    kind: NotificationType;
    sessionId: SessionId;
    /** Human display title of the session. */
    title: string;
    /** Detail text (error message, question text, etc.). */
    detail: string;
}
/** Minimal session detail for classification. */
export interface SessionDetail {
    /** Last agent error text, null when none. */
    lastAgentError: string | null;
    /** Final completion text. */
    finalText: string;
    /** Max turn-error sequence number. */
    maxTurnErrorSeq: number;
    /** Failure message from turn-error. */
    failureMessage: string | null;
}
/** Pending interaction facts. */
export interface PendingFacts {
    key: string;
    kind: 'question' | 'approval';
    detail: string;
}
/** Engine dependencies (injected by browser wiring). */
export interface NotificationEnginePorts {
    /** Human display title of one session. */
    titleOf: (sessionId: SessionId) => string;
    /** Read one session's detail snapshot. */
    detailOf: (sessionId: SessionId) => SessionDetail | undefined;
    /** Whether one session is marked as main-line. */
    isMainline: (sessionId: SessionId) => boolean;
    /** Deliver one notification event. */
    emit: (event: NotificationEvent) => void;
    /** Wait for trailing wire frames after a running edge (settle window). */
    settle: () => Promise<void>;
}
/**
 * Notification engine: tracks running edges, pending interactions,
 * and dispatches 4 event types with main-line/side-line logic.
 */
export declare class NotificationEngine {
    private readonly ports;
    private readonly prevRunning;
    private readonly runs;
    private readonly settling;
    private readonly pendingKeys;
    /** Track whether we've seen any running=true (for side-line "all idle" detection). */
    private hadRunning;
    constructor(ports: NotificationEnginePorts);
    /**
     * Process one sessions-list snapshot (called on every list change).
     */
    observe(sessions: SessionListState): void;
    /**
     * Process pending interactions snapshot.
     */
    observePending(pending: ReadonlyMap<SessionId, PendingFacts>): void;
    /**
     * Seed baseline: record initial state without raising events.
     */
    seed(sessions: SessionListState): void;
    /** Capture pre-run baseline. */
    private armRun;
    /** Classify a finished run after settle window. */
    private settleRun;
    /** Emit side-line completion: all tasks finished. */
    private emitSidelineComplete;
}
//# sourceMappingURL=engine.d.ts.map