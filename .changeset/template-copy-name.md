---
"create-grist-widget": patch
---

The first release of a widget made with GitHub's "Use this template" from the grist-widget-template repository now names it after its own repository: package.json's name, the README and CHANGELOG headings, the page titles and the demo page's title read the repository's name instead of `grist-widget-template`. The README's link to the template repository stays. Existing widgets: a copy already released keeps the name it has; rename it in those files by hand if it still reads `grist-widget-template`.
