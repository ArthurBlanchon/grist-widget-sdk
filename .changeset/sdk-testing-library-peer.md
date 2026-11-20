---
"grist-widget-sdk": patch
"create-grist-widget": patch
---

`grist-widget-sdk` declares `@testing-library/react` (14 or newer) as an optional peer dependency: `grist-widget-sdk/emulator/testing` imports it, which worked only because a widget installs it for its own tests. A widget made from the template already has it; nothing to do. `create-grist-widget`'s package now carries its `CHANGELOG.md`.
