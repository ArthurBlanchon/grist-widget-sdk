---
"grist-widget-sdk": minor
---

`defineGristWidget({ optionsVersion, migrate })`: widget options that change shape between versions. The SDK keeps the version with the options (`__version`, a reserved key). Options written under an older version reach `widgetOptions` migrated by `migrate(options, fromVersion)`, each time they are read, without writing on load; the widget's writes carry the current version, a patch merging into the migrated options. Options without a version count as version 1; from version 2, `migrate` is required. Options from a newer version, or that `migrate` can't migrate, are never written over: the new `optionsIssue` says why, and `setWidgetOptions({})` resets them. A widget that declares no version reads and writes its options untouched. The `MigrateWidgetOptions` type is exported for `migrate`.
