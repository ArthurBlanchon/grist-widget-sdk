import Link from 'next/link';
import { ArrowRightIcon, SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PageActions,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from '@/components/site/page-header';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="container mx-auto max-w-6xl px-4">
        <PageHeader>
          <PageHeaderHeading>Extend Grist with custom widgets</PageHeaderHeading>
          <PageHeaderDescription>
            <code className="font-mono text-sm">grist-widget-sdk</code> turns Grist&apos;s plugin
            API into idiomatic React — start from a template with CI and Pages already wired, and
            docs an AI coding agent can read directly (<code className="font-mono text-sm">AGENTS.md</code>,{' '}
            <code className="font-mono text-sm">llms.txt</code>).
          </PageHeaderDescription>
          <PageActions>
            <Button asChild size="lg">
              <a href="https://github.com/ArthurBlanchon/grist-widget-template/generate">
                Use this template
                <ArrowRightIcon />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/docs/quickstart">Build your own</Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/widgets">
                Browse widgets
                <SearchIcon />
              </Link>
            </Button>
          </PageActions>
        </PageHeader>
      </div>
    </main>
  );
}
