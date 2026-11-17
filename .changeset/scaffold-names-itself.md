---
"create-grist-widget": patch
---

A fresh scaffold names itself and starts without a warning. Its README no longer carries the template's maintainer notes ("How this template is distributed", "Monorepo dev", "Live preview"), and its `CHANGELOG.md` is headed with the widget's name. `vite.config.ts` uses `import.meta.dirname`, so `pnpm dev` and `pnpm test` no longer warn about `__dirname`. Existing widgets get the new `vite.config.ts` from `pnpm exec create-grist-widget upgrade`. They can delete those three README sections and rename their `CHANGELOG.md` heading by hand: both files are the widget's own.
