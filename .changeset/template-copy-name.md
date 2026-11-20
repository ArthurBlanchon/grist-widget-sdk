---
"create-grist-widget": patch
---

The first release of a widget made with GitHub's "Use this template" from the grist-widget-template repository now commits its renaming after its own repository to `main`, as it did for a copy of the template source: package.json's name, the README and CHANGELOG headings, the page titles and the demo page's title read the repository's name instead of `grist-widget-template`. The README's link to the template repository stays. That release is built before the rename and keeps the template's name; the next one carries the widget's. Existing widgets: a copy already released keeps the name it has; rename it in those files by hand if it still reads `grist-widget-template`.
