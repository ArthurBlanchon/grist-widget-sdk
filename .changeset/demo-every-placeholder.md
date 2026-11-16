---
"create-grist-widget": patch
---

The demo page shows the widget again. A demo document can hold the widget URL more than once: in its action history, and in the section Grist loads. The page used to point only the first copy at the widget, so a document whose history came first showed an error frame where the widget should be. The page now points every whole copy at the widget, and leaves alone a copy cut short in the history, which Grist never loads. Existing widgets can copy the template's new `public/demo/index.html`, keeping their own `<title>` and its title in the page's `config`, with no Docker. `pnpm demo --save` writes the same page but also regenerates `public/demo/demo.grist`, replacing a demo document edited by hand.
