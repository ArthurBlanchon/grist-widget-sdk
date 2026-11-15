import type { Metadata } from 'next';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { WidgetsClient } from './widgets-client';
import { CatalogSection } from '@/components/catalog/catalog-section';
import { canonicalUrl } from '@/lib/shared';

export const metadata: Metadata = {
  title: 'Widgets',
  description: 'Custom widgets for Grist: the catalog maintained in grist-widget-sdk, and the community widgets of the awesome-grist-widgets registry.',
  alternates: { canonical: canonicalUrl('/widgets') },
};

export default function WidgetsPage() {
  return (
    <HomeLayout {...baseOptions()}>
      <div className="mx-auto flex w-full max-w-3xl flex-col px-4 pt-12">
        <CatalogSection />
      </div>
      <WidgetsClient />
    </HomeLayout>
  );
}
