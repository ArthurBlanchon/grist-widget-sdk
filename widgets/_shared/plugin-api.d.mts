// Types of plugin-api.mjs (plain JavaScript, so check-widgets.mjs can import it too).
export declare const PLUGIN_API_GRIST_STATIC: string
export declare const PLUGIN_API_SHA512: string
export declare const PLUGIN_API_FILE: string
export declare const PLUGIN_API_DIR: string
export declare function checkPluginApi(bytes: Uint8Array): string[]
export declare function pinnedPluginApi(): { bytes: Buffer; name: string; version: string; license: string; notice: string }
