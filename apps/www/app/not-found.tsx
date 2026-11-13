import Link from 'next/link';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { Button } from '@/components/ui/button';
import {
  PageActions,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from '@/components/site/page-header';

// Same HomeLayout + baseOptions() every other top-level page uses (see
// app/(home)/page.tsx, app/widgets/page.tsx) -- a 404 with no nav/footer
// dead-ends a visitor instead of letting them recover.
export default function NotFound() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="flex flex-1 flex-col">
        <div className="container mx-auto max-w-6xl px-4">
          <PageHeader>
            <PageHeaderHeading>Page not found</PageHeaderHeading>
            <PageHeaderDescription>
              There&apos;s nothing here. It may have moved, or the link is wrong.
            </PageHeaderDescription>
            <PageActions>
              <Button asChild size="lg">
                <Link href="/">Go home</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/docs">Browse docs</Link>
              </Button>
            </PageActions>
          </PageHeader>
        </div>
      </main>
    </HomeLayout>
  );
}
