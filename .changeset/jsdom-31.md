---
"create-grist-widget": patch
---

The template's tests run on jsdom 31 (was 30), which needs Node.js 22.22.2 or later on the 22 line, or 24.15 or later; `create-grist-widget` now asks for the same.

Existing widgets can stay on jsdom 30. To move to 31, run `pnpm add -D jsdom@^31` once it is a day old; if tests then fail at startup with `flushCharacters is not a function`, run `pnpm dedupe` so that parse5 resolves to one 8.1 copy.
