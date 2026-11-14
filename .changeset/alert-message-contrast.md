---
"grist-widget-sdk": patch
---

The message of an alert above a widget (`mountGristWidget()`'s default alerts) now takes the alert's own colour instead of the muted one. On a warning's amber tint the muted text had a contrast of 4.38:1, under WCAG AA's 4.5:1, which an accessibility check in a real Grist caught on the first catalog widget.
