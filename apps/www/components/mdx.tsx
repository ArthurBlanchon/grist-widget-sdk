import defaultMdxComponents from 'fumadocs-ui/mdx';
import { AutoTypeTable } from 'fumadocs-typescript/ui';
import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import { Steps, Step } from 'fumadocs-ui/components/steps';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
import type { MDXComponents } from 'mdx/types';

import { ExamplesCatalog } from '@/components/examples-catalog';
import { typeTableGenerator } from '@/lib/typescript-generator';

// Registered once here rather than per-page -- `defaultMdxComponents`
// already carries `Callout`, but not these. Every .mdx page gets them for
// free; none needs its own `import { Tabs, Tab } from '...'` line.
export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    AutoTypeTable: (props: React.ComponentProps<typeof AutoTypeTable>) => (
      <AutoTypeTable {...props} generator={typeTableGenerator} />
    ),
    ExamplesCatalog,
    Tabs,
    Tab,
    Steps,
    Step,
    Accordion,
    Accordions,
    File,
    Files,
    Folder,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
