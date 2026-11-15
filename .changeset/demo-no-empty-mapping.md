---
"create-grist-widget": patch
---

`pnpm demo` and `demo --save`: a widget that maps no column gets no saved mapping, as in Grist, rather than an empty one. Grist sends a widget with a saved mapping only its mapped columns, so a widget that declares none (a document template, say) saw no cell in its demo document.
