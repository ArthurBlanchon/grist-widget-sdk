---
"create-grist-widget": patch
---

The demo page shows the widget again: it pointed only the first copy of the widget URL in the demo document at the widget, while Grist loads the section from a later one, so the page showed an error frame where the widget should be. Every copy is now replaced. Existing widgets can run `pnpm demo --save` after updating to regenerate `public/demo/`; the catalog's demo pages are fixed by the next site build.
