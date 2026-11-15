---
"grist-widget-sdk": minor
---

`defineGristWidget({ optionsVersion, migrate })`: widget options that change shape between versions. The SDK keeps the version with the options. Options written under an older version reach `widgetOptions` migrated by `migrate(options, fromVersion)`, each time they are read, without writing on load; the widget's own writes (`setWidgetOptions`, `patchWidgetOptions`) carry the current version, a patch merging into the migrated options. Options without a version count as version 1. The SDK refuses to write over options from a newer version of the widget, or options `migrate` couldn't migrate. The `MigrateWidgetOptions` type is exported for `migrate`.
