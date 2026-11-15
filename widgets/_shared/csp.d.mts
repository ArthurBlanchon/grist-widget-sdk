// Types of csp.mjs (plain JavaScript, so check-widgets.mjs can import it too).
export declare const PLUGIN_API_ORIGIN: string
export declare const BASE: Record<string, string[]>
export declare const EXTENDABLE: string[]
export declare function parseCspExtra(value: unknown): { extra: Record<string, string[]>; problems: string[] }
export declare function widgetCsp(extra?: Record<string, string[]>): string
