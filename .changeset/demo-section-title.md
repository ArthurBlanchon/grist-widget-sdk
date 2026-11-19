---
"create-grist-widget": patch
---

A new widget's demo page names the widget's section after the widget, not "Grist Widget Template". `demo --save` now gives the section a placeholder title that the demo page replaces with the widget's title, as it already did for the widget's URL; the template's demo document is regenerated that way, and a scaffold sets the title in `public/demo/index.html`. A document made before keeps its title. Existing widgets can rerun `pnpm demo --save` to get it, which also refreshes their demo page.
