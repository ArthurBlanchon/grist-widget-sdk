import Link from 'next/link';
import { ACCESS_LABEL, getCatalog, type CatalogWidget } from '@/lib/catalog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** The catalog widgets, by category, each linking to its page. Built at build time. */
export function CatalogSection() {
  const groups = new Map<string, CatalogWidget[]>();
  for (const widget of getCatalog()) {
    groups.set(widget.categoryLabel, [...(groups.get(widget.categoryLabel) ?? []), widget]);
  }
  const categories = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  return (
    <section className="flex flex-col gap-6" aria-labelledby="catalog">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 id="catalog" className="text-3xl font-bold tracking-tight sm:text-4xl">
          Widgets
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Custom widgets for Grist, built and maintained in grist-widget-sdk&apos;s repository. Each
          one installs from a URL that takes its fixes and new features, never a breaking
          change.
        </p>
      </div>
      {categories.map((category) => (
        <div key={category} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">{category}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.get(category)!.map((widget) => (
              <Link key={widget.slug} href={widget.path} className="group">
                <Card className="h-full transition-colors group-hover:bg-muted/40">
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      {widget.title}
                      {widget.status === 'beta' && <Badge variant="outline">Beta</Badge>}
                    </CardTitle>
                    <CardDescription>{widget.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="outline">{ACCESS_LABEL[widget.access]}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
