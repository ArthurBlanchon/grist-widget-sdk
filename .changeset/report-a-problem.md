---
"grist-widget-sdk": minor
---

A widget can say where to report a problem: `defineGristWidget({ reportUrl })`, an http or https URL such as a prefilled issue form. `mountGristWidget()` links "Report a problem" under a failed write's alert, and on a new screen, "The widget stopped working", shown when the widget throws while rendering instead of a blank panel, with a button that reloads it. Nothing is sent anywhere. Existing widgets get the new screen as they are, and can add `reportUrl` to their declaration.
