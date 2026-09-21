/**
 * Client half of attention-plugins: observes session events and
 * dispatches sound/browser notifications based on durable preferences.
 *
 * Supports:
 * - 4 event types: completed, failed, question, permission
 * - Main-line/side-line logic: main alerts immediately, side alerts when ALL idle
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "attention-plugins";
export interface Config {
}
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=index.d.ts.map