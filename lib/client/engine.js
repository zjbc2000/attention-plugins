/**
 * Notification engine: tracks running edges, pending interactions,
 * and dispatches 4 event types with main-line/side-line logic.
 */
export class NotificationEngine {
    ports;
    prevRunning = new Map();
    runs = new Map();
    settling = new Set();
    pendingKeys = new Map();
    /** Track whether we've seen any running=true (for side-line "all idle" detection). */
    hadRunning = false;
    constructor(ports) {
        this.ports = ports;
    }
    /**
     * Process one sessions-list snapshot (called on every list change).
     */
    observe(sessions) {
        const seen = new Set();
        let hasRunning = false;
        let mainlineJustCompleted = false;
        for (const summary of Object.values(sessions.byId)) {
            const id = summary.id;
            seen.add(id);
            if (summary.running)
                hasRunning = true;
            const prevRunning = this.prevRunning.get(id) ?? false;
            const nowRunning = summary.running;
            // Detect true → false edge
            if (prevRunning && !nowRunning) {
                void this.settleRun(id);
                // Track if main-line just completed (for side-line suppression)
                if (this.ports.isMainline(id)) {
                    mainlineJustCompleted = true;
                }
            }
            else if (!prevRunning && nowRunning) {
                this.armRun(id);
            }
            this.prevRunning.set(id, nowRunning);
        }
        // Side-line logic: detect "had running → all idle" edge
        // BUT suppress if main-line just completed (avoid duplicate notification)
        if (this.hadRunning && !hasRunning && !mainlineJustCompleted) {
            this.emitSidelineComplete();
        }
        this.hadRunning = hasRunning;
        // Clean up tracking for removed sessions
        for (const id of this.prevRunning.keys()) {
            if (!seen.has(id)) {
                this.prevRunning.delete(id);
                this.runs.delete(id);
                this.pendingKeys.delete(id);
            }
        }
    }
    /**
     * Process pending interactions snapshot.
     */
    observePending(pending) {
        for (const [id, facts] of pending) {
            const prevKey = this.pendingKeys.get(id);
            if (prevKey === undefined || prevKey !== facts.key) {
                // New interaction or replacement
                const kind = facts.kind === 'approval' ? 'permission' : 'question';
                this.ports.emit({
                    kind,
                    sessionId: id,
                    title: this.ports.titleOf(id),
                    detail: facts.detail,
                });
            }
            this.pendingKeys.set(id, facts.key);
        }
        for (const id of this.pendingKeys.keys()) {
            if (!pending.has(id))
                this.pendingKeys.delete(id);
        }
    }
    /**
     * Seed baseline: record initial state without raising events.
     */
    seed(sessions) {
        let hasRunning = false;
        for (const summary of Object.values(sessions.byId)) {
            this.prevRunning.set(summary.id, summary.running);
            if (summary.running) {
                this.armRun(summary.id);
                hasRunning = true;
            }
        }
        this.hadRunning = hasRunning;
    }
    /** Capture pre-run baseline. */
    armRun(id) {
        const detail = this.ports.detailOf(id);
        this.runs.set(id, {
            baselineErrorSeq: detail?.maxTurnErrorSeq ?? 0,
            baselineAgentError: detail?.lastAgentError ?? null,
        });
    }
    /** Classify a finished run after settle window. */
    async settleRun(id) {
        const run = this.runs.get(id);
        if (run === undefined || this.settling.has(id))
            return;
        this.runs.delete(id);
        this.settling.add(id);
        try {
            await this.ports.settle();
            // A newer run armed while settling: skip this stale one
            if (this.runs.has(id))
                return;
            const detail = this.ports.detailOf(id);
            const failed = detail !== undefined && (detail.maxTurnErrorSeq > run.baselineErrorSeq ||
                (detail.lastAgentError !== null && detail.lastAgentError !== run.baselineAgentError));
            const message = failed
                ? (detail?.failureMessage ?? detail?.lastAgentError ?? '')
                : (detail?.finalText ?? '');
            const kind = failed ? 'failed' : 'completed';
            // Main-line: alert immediately
            if (this.ports.isMainline(id)) {
                this.ports.emit({
                    kind,
                    sessionId: id,
                    title: this.ports.titleOf(id),
                    detail: message,
                });
            }
            // Side-line completions are handled by "all idle" edge in observe()
            // (no individual per-session notification for side-line)
        }
        finally {
            this.settling.delete(id);
        }
    }
    /** Emit side-line completion: all tasks finished. */
    emitSidelineComplete() {
        // Skip if no sessions were tracked (edge case: all removed)
        if (this.prevRunning.size === 0)
            return;
        // Use first session as representative
        const sessions = Array.from(this.prevRunning.keys());
        const id = sessions[0];
        this.ports.emit({
            kind: 'completed',
            sessionId: id,
            title: 'All tasks',
            detail: 'All side-line tasks completed',
        });
    }
}
//# sourceMappingURL=engine.js.map