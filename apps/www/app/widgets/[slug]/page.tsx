import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { ArrowLeftIcon, ExternalLinkIcon, GitForkIcon } from 'lucide-react';
import { baseOptions } from '@/lib/layout.shared';
import { canonicalUrl, withBasePath } from '@/lib/shared';
import { ACCESS_LABEL, getCatalog, getCatalogWidget } from '@/lib/catalog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyUrl } from '@/components/catalog/copy-url';
import { InlineText, Prose } from '@/components/catalog/text';

// A page per catalog widget, from its SPEC.md, package.json and CHANGELOG.md
// (scripts/widgets/catalog.mjs). It is /widgets/<slug>/: the widget's
// channels, versions and demo are the folders beside it (scripts/build-site.mjs).

export const dynamicParams = false;

export function generateStaticParams() {
  return getCatalog().map((w) => ({ slug: w.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const widget = getCatalogWidget((await params).slug);
  if (!widget) return {};
  return {
    title: widget.title,
    description: widget.description,
    alternates: { canonical: canonicalUrl(widget.path) },
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export default async function CatalogWidgetPage({ params }: Props) {
  const widget = getCatalogWidget((await params).slug);
  if (!widget) notFound();

  return (
    <HomeLayout {...baseOptions()}>
      <article className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
        <div className="flex flex-col gap-3">
          <Link
            href="/widgets"
            className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            All widgets
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{widget.title}</h1>
          <p className="text-lg text-muted-foreground">{widget.description}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{widget.categoryLabel}</Badge>
            <Badge variant="outline">{ACCESS_LABEL[widget.access]}</Badge>
            <Badge variant="outline">v{widget.version}</Badge>
            {widget.status === 'beta' && <Badge variant="outline">Beta</Badge>}
            {widget.license && <Badge variant="outline">{widget.license}</Badge>}
          </div>
        </div>

        <Section title="Add it to a document">
          <p className="text-sm text-muted-foreground">
            In Grist, add a widget, choose <strong>Custom</strong>, then <strong>Enter Custom URL</strong>{' '}
            and paste:
          </p>
          <CopyUrl url={widget.installUrl} label="Copy the install URL" />
          <p className="text-sm text-muted-foreground">
            It takes every {widget.channel}.x release, fixes and new features; a breaking change
            comes as a new major version, at a URL of its own. The same widget is also served at{' '}
            <code className="text-xs">{widget.alternateUrl}</code>.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm">
              {/* A static page next to this one, outside Next's routes: a plain link. */}
              <a href={withBasePath(`${widget.path}demo/`)} target="_blank" rel="noreferrer">
                Try it in a demo document
                <ExternalLinkIcon />
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={widget.source} target="_blank" rel="noreferrer">
                <GitForkIcon />
                Source
              </a>
            </Button>
          </div>
        </Section>

        <Section title="What it does">
          <Prose text={widget.job} className="text-sm" />
        </Section>

        <Section title="Columns">
          {widget.columns.length > 0 ? (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-start">
                  <tr>
                    <th className="p-2 text-start font-medium">Column</th>
                    <th className="p-2 text-start font-medium">Type</th>
                    <th className="p-2 text-start font-medium">Use</th>
                  </tr>
                </thead>
                <tbody>
                  {widget.columns.map((c) => (
                    <tr key={c.name} className="border-t align-top">
                      <td className="p-2">
                        <code>{c.name}</code>
                        {!c.required && <span className="text-muted-foreground">, optional</span>}
                      </td>
                      <td className="p-2 text-muted-foreground">
                        {c.types.join(', ')}
                        {c.multiple && ', several columns'}
                      </td>
                      <td className="p-2">
                        <InlineText text={c.use} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {widget.columnsNote && <Prose text={widget.columnsNote} className="text-sm" />}
        </Section>

        <Section title="Access">
          <Prose text={widget.accessNote} className="text-sm" />
        </Section>

        {widget.network && (
          <Section title="Network">
            <Prose text={widget.network} className="text-sm" />
          </Section>
        )}

        <Section title="Changes">
          {widget.changes.map((change) => (
            <div key={change.version} className="text-sm">
              <h3 className="font-medium">
                {change.version}
                {change.date && <span className="font-normal text-muted-foreground"> · {change.date}</span>}
              </h3>
              <Prose text={change.text} />
            </div>
          ))}
          <a
            href={`${widget.source}/CHANGELOG.md`}
            target="_blank"
            rel="noreferrer"
            className="w-fit text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Every version
          </a>
        </Section>
      </article>
    </HomeLayout>
  );
}
