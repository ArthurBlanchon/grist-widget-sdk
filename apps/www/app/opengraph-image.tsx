import { generateOGImage } from 'fumadocs-ui/og';
import { appName } from '@/lib/shared';

// The site root and /widgets have no OG image at all today (W-13/F-09) --
// only /docs/** pages do, via the equivalent app/og/docs/[...slug]/route.tsx.
// Same fumadocs-ui/og helper, so both card styles stay visually consistent.
export const revalidate = false;

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return generateOGImage({
    title: 'Grist Widgets',
    description: 'A typed SDK, CLI, and starter template for building Grist custom widgets.',
    site: appName,
    ...size,
  });
}
