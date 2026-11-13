import { Inter, Geist } from 'next/font/google';
import type { Metadata } from 'next';
import { Provider } from '@/components/provider';
import './global.css';
import { cn } from "@/lib/utils";
import { canonicalUrl, siteUrl } from '@/lib/shared';

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  // metadataBase is the origin SERVING this build, so relative asset URLs
  // (OG/twitter images) stay on it — a github.io page's preview image must not
  // depend on gristwidgets.com being up. `canonical` is written as an explicit
  // absolute URL instead, because it points at the *other* concern: which copy
  // search engines should index. See lib/shared.ts.
  metadataBase: new URL(siteUrl),
  alternates: { canonical: canonicalUrl('/') },
  title: {
    default: 'grist-widget-sdk',
    template: '%s · grist-widget-sdk',
  },
  description:
    'A tiny, typed, batteries-included React SDK that turns the Grist plugin API into idiomatic React.',
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={cn(inter.className, "font-sans", geist.variable)} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
