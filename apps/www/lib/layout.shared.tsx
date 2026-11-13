import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      // JSX supported
      title: 'Grist Widgets',
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    // Just two top-level entries, deliberately. The docs sidebar itself
    // (app/docs/layout.tsx) already exposes a complete six-space switcher
    // -- Quickstart, CLI, SDK, Emulator, Registry, Contributing -- right
    // where a reader lands after clicking "Docs". A previous version of
    // this nav special-cased shortcuts for two of those six spaces
    // (Templates/SDK/CLI); that was inconsistent (why those two and not
    // the other four?) and redundant with the sidebar's own switcher, so
    // it's gone -- one entry point, not two competing ones.
    links: [
      { text: 'Widgets', url: '/widgets' },
      { text: 'Docs', url: '/docs' },
    ],
  };
}
