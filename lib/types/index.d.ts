/**
 * Host half of attention-plugins: registers the settings namespace.
 * This half is optional for pure client-side plugins but reserves the
 * namespace for future host/client settings sync if DSH exposes it.
 */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
export declare const name = "attention-plugins";
export interface Config {
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=index.d.ts.map