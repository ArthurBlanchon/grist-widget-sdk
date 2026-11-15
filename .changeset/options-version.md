---
"grist-widget-sdk": minor
---

`defineGristWidget({ optionsVersion, migrate })`: widget options that change shape between versions. The SDK keeps the version with the options; options saved under an older version reach `widgetOptions` already migrated by `migrate(options, fromVersion)`, and are saved back. Options saved before a widget declared a version count as version 1; `setWidgetOptions` and `patchWidgetOptions` write under the current version. The `MigrateWidgetOptions` type is exported for `migrate`.
