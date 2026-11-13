'use client';

import * as React from 'react';
import Link from 'next/link';
import { ExternalLinkIcon, GitForkIcon, SearchIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  manifestUrl,
  parseManifest,
  parseRegistryWidgets,
  REGISTRY_REPO_URL,
  WIDGETS_JSON_URL,
  repoOwner,
  type RegistryWidget,
  type WidgetManifest,
} from '@/lib/registry';

type FetchState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; widgets: RegistryWidget[] };

const FETCH_TIMEOUT_MS = 8000;

// One attempt, aborted after FETCH_TIMEOUT_MS so a hung/rate-limited request
// doesn't leave the page in `loading` forever (the raw.githubusercontent.com
// fetch had no timeout at all before this).
async function fetchWidgets(signal: AbortSignal): Promise<RegistryWidget[]> {
  const res = await fetch(WIDGETS_JSON_URL, { signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return parseRegistryWidgets(await res.json());
}

const ACCESS_LABEL: Record<WidgetManifest['accessLevel'], string> = {
  none: 'No document access',
  'read table': 'Reads its table',
  full: 'Full document access',
};

/**
 * The widget's manifest, live from its install URL (GitHub Pages serves it
 * with CORS), so the page shows its latest release; the copy in
 * widgets.json until then, or if that fetch fails.
 */
function useLiveManifest(widget: RegistryWidget): WidgetManifest | undefined {
  const [live, setLive] = React.useState<WidgetManifest | null>(null);
  React.useEffect(() => {
    const url = manifestUrl(widget.widgetUrl);
    if (!url) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    fetch(url, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const manifest = parseManifest(data);
        if (manifest) setLive(manifest);
      })
      .catch(() => {
        // keep the registry's copy
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [widget.widgetUrl]);
  return live ?? widget.manifest;
}

function formatDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
}

function WidgetCard({ widget }: { widget: RegistryWidget }) {
  const manifest = useLiveManifest(widget);
  const owner = repoOwner(widget.repoUrl);
  const updated = formatDate(manifest?.lastUpdatedAt);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {widget.name}
          {widget.reference && (
            <Badge variant="secondary" title="Checked by grist-widget-sdk's CI against every SDK change">
              Reference
            </Badge>
          )}
        </CardTitle>
        {owner && <CardDescription className="text-xs">by {owner}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{widget.description}</p>
        {manifest && (
          <>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">{ACCESS_LABEL[manifest.accessLevel]}</Badge>
              {manifest.version && <Badge variant="outline">v{manifest.version}</Badge>}
              {manifest.license && <Badge variant="outline">{manifest.license}</Badge>}
            </div>
            {manifest.columns.length > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">Columns: </span>
                {manifest.columns.map((c, i) => (
                  <React.Fragment key={c.name}>
                    {i > 0 && ', '}
                    <span title={c.description}>
                      <code className="text-xs">{c.name}</code>
                      {c.type && <span className="text-muted-foreground"> ({c.type})</span>}
                      {c.optional && <span className="text-muted-foreground">, optional</span>}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            )}
            {(manifest.sdkVersion || updated) && (
              <p className="text-xs text-muted-foreground">
                {manifest.sdkVersion && <>grist-widget-sdk {manifest.sdkVersion}</>}
                {manifest.sdkVersion && updated && ' · '}
                {updated && <>updated {updated}</>}
              </p>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <Button asChild size="sm">
          {/* Its demo page when it has one: the widget in a real Grist, in the browser. */}
          <Link href={manifest?.demoUrl ?? widget.widgetUrl} target="_blank" rel="noreferrer">
            Try it
            <ExternalLinkIcon />
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={widget.repoUrl} target="_blank" rel="noreferrer" aria-label="Source on GitHub">
            <GitForkIcon />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export function WidgetsClient() {
  const [state, setState] = React.useState<FetchState>({ status: 'loading' });
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;

    // One retry: a transient GitHub raw-content hiccup shouldn't need a page
    // reload to recover from, but a second consecutive failure is treated as
    // real (offline, sustained rate-limit) rather than retried forever.
    async function load() {
      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
          const widgets = await fetchWidgets(controller.signal);
          if (!cancelled) setState({ status: 'ready', widgets });
          return;
        } catch {
          // fall through to retry / final error state below
        } finally {
          clearTimeout(timer);
        }
      }
      if (!cancelled) setState({ status: 'error' });
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered =
    state.status === 'ready'
      ? state.widgets.filter((widget) => {
          const q = query.trim().toLowerCase();
          if (!q) return true;
          return (
            widget.name.toLowerCase().includes(q) ||
            widget.description.toLowerCase().includes(q) ||
            (widget.manifest?.columns ?? []).some((c) => c.name.toLowerCase().includes(q))
          );
        })
      : [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Widget registry</h1>
        <p className="max-w-xl text-muted-foreground">
          Grist custom widgets built with grist-widget-sdk, from{' '}
          <Link
            href={REGISTRY_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-4"
          >
            awesome-grist-widgets
          </Link>
          .
        </p>
      </div>

      <div className="relative">
        <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search widgets by name, description or column…"
          className="pl-9"
          aria-label="Search widgets"
        />
      </div>

      {state.status === 'loading' && (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Couldn&apos;t load the registry</CardTitle>
            <CardDescription>
              The fetch to GitHub failed — could be offline, or the request was blocked. You can
              browse the source directly instead:{' '}
              <Link
                href={WIDGETS_JSON_URL}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline underline-offset-4"
              >
                widgets.json
              </Link>
              .
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {state.status === 'ready' && filtered.length === 0 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">
              {state.widgets.length === 0 || !query.trim()
                ? 'No widgets listed yet'
                : <>No widgets match &quot;{query}&quot;</>}
            </CardTitle>
            <CardDescription>
              Don&apos;t see your widget?{' '}
              <Link
                href="/docs/registry"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Learn how to add it →
              </Link>
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {state.status === 'ready' && filtered.length > 0 && (
        <div className="flex flex-col gap-4">
          {filtered.map((widget) => (
            <WidgetCard key={widget.repoUrl} widget={widget} />
          ))}
        </div>
      )}
    </div>
  );
}
