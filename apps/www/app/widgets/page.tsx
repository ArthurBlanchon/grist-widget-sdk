import type { Metadata } from 'next';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { WidgetsClient } from './widgets-client';
import { canonicalUrl } from '@/lib/shared';

export const metadata: Metadata = {
  title: 'Widgets',
  description: 'Browse Grist custom widgets built with grist-widget-sdk, each described by its own manifest, from the awesome-grist-widgets registry.',
  alternates: { canonical: canonicalUrl('/widgets') },
};

export default function WidgetsPage() {
  return (
    <HomeLayout {...baseOptions()}>
      <WidgetsClient />
    </HomeLayout>
  );
}
