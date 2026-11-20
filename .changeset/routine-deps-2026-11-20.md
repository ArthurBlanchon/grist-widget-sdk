---
"create-grist-widget": patch
---

Routine dependency updates. The template, so every new widget: `vite` 8.3.8, `@vitejs/plugin-react` 6.3.0, `typescript-eslint` 8.72.2, `prettier` 3.10.1, `lucide-react` 1.72.0. The CLI: `@clack/prompts` 1.9.0. Existing widgets can take them from their weekly Dependabot pull request, or `pnpm exec create-grist-widget upgrade` raises them to the template's ranges.
