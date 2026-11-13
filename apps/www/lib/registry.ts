export interface RegistryWidget {
  name: string;
  repoUrl: string;
  widgetUrl: string;
  description: string;
  /** Checked by grist-widget-sdk's CI against every SDK change. */
  reference?: boolean;
  /** The widget's grist-widget.json, as the registry last read it. */
  manifest?: WidgetManifest;
}

/** A declared column, as GRIST_OPTIONS.columns states it. */
export interface ManifestColumn {
  name: string;
  type?: string;
  optional?: boolean;
  description?: string;
}

/**
 * What the registry shows from a widget's grist-widget.json (written by
 * `create-grist-widget manifest`): a Grist custom widget entry plus the
 * SDK's own `gristWidgetSdk` key. Only the fields read here, validated.
 */
export interface WidgetManifest {
  accessLevel: 'none' | 'read table' | 'full';
  columns: ManifestColumn[];
  lastUpdatedAt?: string;
  version?: string;
  license?: string;
  sdkVersion?: string;
  /** The widget in a real Grist, from static files (`create-grist-widget demo --save`). */
  demoUrl?: string;
}

/** Where a widget serves its manifest: next to its install URL. */
export function manifestUrl(widgetUrl: string): string | null {
  try {
    return new URL('grist-widget.json', widgetUrl).href;
  } catch {
    return null;
  }
}

// Public, CORS-enabled raw file — fetched client-side at runtime rather
// than baked in at build time, so the list stays current as
// awesome-grist-widgets grows without needing an apps/www rebuild.
export const WIDGETS_JSON_URL =
  'https://raw.githubusercontent.com/ArthurBlanchon/awesome-grist-widgets/main/widgets.json';

export const REGISTRY_REPO_URL = 'https://github.com/ArthurBlanchon/awesome-grist-widgets';

export function repoOwner(repoUrl: string): string | null {
  try {
    const { pathname } = new URL(repoUrl);
    const [owner] = pathname.replace(/^\//, '').split('/');
    return owner || null;
  } catch {
    return null;
  }
}

// Third-party JSON, fetched at runtime — a bare `href={widget.widgetUrl}`
// would render whatever that field contains, `javascript:` URIs included.
// Only http/https survive; a rejected scheme reads as an invalid entry, not
// a crash.
function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidWidgetEntry(value: unknown): value is RegistryWidget {
  if (typeof value !== 'object' || value === null) return false;
  const w = value as Record<string, unknown>;
  return (
    isNonEmptyString(w.name) &&
    isNonEmptyString(w.description) &&
    isSafeHttpUrl(w.repoUrl) &&
    isSafeHttpUrl(w.widgetUrl)
  );
}

function optionalString(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value : undefined;
}

const ACCESS_LEVELS = new Set(['none', 'read table', 'full']);

/**
 * The fields of a grist-widget.json shown on the page, or null if it isn't
 * an SDK manifest. Third-party JSON: every field is checked, the rest
 * ignored, and a malformed column is dropped rather than shown.
 */
export function parseManifest(data: unknown): WidgetManifest | null {
  if (typeof data !== 'object' || data === null) return null;
  const m = data as Record<string, unknown>;
  const sdk = m.gristWidgetSdk as Record<string, unknown> | undefined;
  if (typeof sdk !== 'object' || sdk === null || sdk.schema !== 1) return null;
  const access = ACCESS_LEVELS.has(m.accessLevel as string)
    ? (m.accessLevel as WidgetManifest['accessLevel'])
    : 'none';
  const columns = (Array.isArray(m.columns) ? m.columns : [])
    .map((c): ManifestColumn | null => {
      if (isNonEmptyString(c)) return { name: c };
      if (typeof c !== 'object' || c === null) return null;
      const col = c as Record<string, unknown>;
      if (!isNonEmptyString(col.name)) return null;
      return {
        name: col.name,
        type: optionalString(col.type),
        optional: col.optional === true,
        description: optionalString(col.description),
      };
    })
    .filter((c): c is ManifestColumn => c !== null);
  return {
    accessLevel: access,
    columns,
    lastUpdatedAt: optionalString(m.lastUpdatedAt),
    version: optionalString(sdk.version),
    license: optionalString(sdk.license),
    sdkVersion: optionalString(sdk.sdk),
    demoUrl: isSafeHttpUrl(sdk.demo) ? sdk.demo : undefined,
  };
}

/**
 * Validates the shape of a fetched widgets.json payload before it ever
 * reaches render — third-party JSON, no compile-time guarantee it matches
 * `RegistryWidget[]` (the old code cast it with a bare type annotation on
 * `.then()`, which checks nothing at runtime). A malformed top level throws
 * (caller's fetch `.catch` turns that into the existing error UI); a
 * malformed *entry* is dropped rather than taking down the whole list — one
 * bad third-party submission shouldn't blank the registry for everyone.
 */
export function parseRegistryWidgets(data: unknown): RegistryWidget[] {
  if (!Array.isArray(data)) {
    throw new Error('widgets.json did not contain an array');
  }
  return data.filter(isValidWidgetEntry).map((w) => {
    const raw = w as unknown as Record<string, unknown>;
    const manifest = parseManifest(raw.manifest);
    return {
      name: w.name,
      repoUrl: w.repoUrl,
      widgetUrl: w.widgetUrl,
      description: w.description,
      ...(raw.reference === true ? { reference: true } : {}),
      ...(manifest ? { manifest } : {}),
    };
  });
}
