---
"grist-widget-sdk": minor
---

The SDK's own chrome speaks the widget's language. `defineGristWidget({ languages: ["en", "fr"] })` says which languages a widget is written in. The screens before the widget renders, the alerts above it, "Report a problem" and "The widget stopped working" then take the first of the person's browser languages that the widget declares and the SDK speaks (English and French). The French quotes Grist's own French labels. A widget that declares no `languages` keeps English chrome, as before. Existing widgets that ship French can add `languages: ["en", "fr"]` to their declaration.
