import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      // JSX supported
      title: 'Grist Widgets',
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    // Just two top-level entries, deliberately: the docs sidebar holds the
    // rest, in its four sections (content/docs/meta.json).
    links: [
      { text: 'Widgets', url: '/widgets' },
      { text: 'Docs', url: '/docs' },
    ],
  };
}
