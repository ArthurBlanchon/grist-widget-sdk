---
"grist-widget-sdk": minor
"create-grist-widget": patch
---

The public API loses three internals no widget needs: `entryProps` (`grist-widget-sdk/app`), and `resolveMappings` and `enrichEmulatorColumnMetadata` (`grist-widget-sdk/emulator`). Pass the entry module to `mountGristWidget(entry)` or `smokeTestWidget(entry)`, and read mappings with `w.mappings`. `useWidgetMetadata` is deprecated: `mountGristWidget()` already sets the page's title and meta tags from the declaration's `title` and `description`, so remove the call. It still works, and warns once in development. `create-grist-widget upgrade` lists each use of these four names by file and line, with what to do.
