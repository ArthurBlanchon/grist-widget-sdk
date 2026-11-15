import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The catalog widgets (widgets/<slug>/ in this repository), as
 * scripts/widgets/catalog.mjs reads them from each widget's SPEC.md,
 * package.json and CHANGELOG.md. The prebuild and predev scripts write
 * .generated/catalog.json; the pages read it at build time.
 *
 * Server-only: imported by server components at build time.
 */
export type CatalogColumn = {
  name: string;
  types: string[];
  required: boolean;
  use: string;
};

export type CatalogChange = { version: string; date: string | null; text: string };

export type CatalogWidget = {
  slug: string;
  title: string;
  category: string;
  categoryLabel: string;
  status: 'beta' | 'stable';
  access: 'none' | 'read table' | 'full';
  description: string;
  license: string | null;
  job: string;
  columns: CatalogColumn[];
  columnsNote: string | null;
  accessNote: string;
  network: string | null;
  version: string;
  channel: string;
  path: string;
  installUrl: string;
  alternateUrl: string;
  source: string;
  changes: CatalogChange[];
};

const CATALOG_FILE = join(process.cwd(), '.generated', 'catalog.json');

let cached: CatalogWidget[] | null = null;

export function getCatalog(): CatalogWidget[] {
  if (cached) return cached;
  let text: string;
  try {
    text = readFileSync(CATALOG_FILE, 'utf8');
  } catch {
    throw new Error(
      `${CATALOG_FILE} is missing: run \`node ../../scripts/widgets/catalog.mjs --www .generated/catalog.json\` (apps/www's prebuild does)`,
    );
  }
  cached = JSON.parse(text) as CatalogWidget[];
  return cached;
}

export function getCatalogWidget(slug: string): CatalogWidget | undefined {
  return getCatalog().find((w) => w.slug === slug);
}

export const ACCESS_LABEL: Record<CatalogWidget['access'], string> = {
  none: 'No document access',
  'read table': 'Reads its table',
  full: 'Full document access',
};

