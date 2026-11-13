import Link from 'next/link';
import { gitConfig } from '@/lib/shared';

export function SiteFooter() {
  return (
    <footer className="border-t py-8">
      <div className="container flex flex-col items-center gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <p>
          <Link
            href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            grist-widget-sdk
          </Link>
          {' — '}MIT licensed.
        </p>
        <div className="flex items-center gap-4">
          <Link href="/docs" className="hover:text-foreground">
            Docs
          </Link>
          <Link
            href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            GitHub
          </Link>
          <Link
            href="https://www.npmjs.com/package/grist-widget-sdk"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            npm
          </Link>
        </div>
      </div>
    </footer>
  );
}
