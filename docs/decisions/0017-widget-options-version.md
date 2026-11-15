# 0017. Widget options carry the version that wrote them

- **Status:** accepted
- **Date:** 2026-11-15

## Context

A widget's options live in the document, with its section, for years; the
widget that reads them changes. The plan to 0.8.0 (M4) asked for options
that evolve: `optionsVersion` and `migrate` in the declaration. Two facts
from grist-core shaped the design:
- a widget's `setOptions` is a draft of the section (`activeCustomOptions`):
  its menu shows Save and Revert until someone saves;
- a section keeps its options when its widget's URL changes, so the
  options of one widget, or of another version of it (`/dev/`, another
  major), can reach another.

## Decision

- **A reserved key, `__version`,** holds the version the options were
  written under. The SDK hides it from the widget. It is a format stored in
  documents, shared by every widget that declares `optionsVersion`:
  renaming it means migrating every document.
- **Migrated on read, never written on load.** Options under an older
  version reach `widgetOptions` through `migrate`, in memory, on every read.
  The widget's own writes carry the current version; a patch merges into
  the migrated options.
- **Unversioned options count as version 1.** From version 2, `migrate` is
  required, and checks the options' shape rather than trust the version.
- **Never written over when unreadable:** options from a newer version,
  options `migrate` couldn't migrate (it threw, or returned no plain
  object), or a version that isn't an integer from 1. `optionsIssue` says
  why, and the writes reject; `setWidgetOptions({})` resets them.
- **A widget that declares no version** reads and writes its options
  untouched, the key included.

## Consequences

- A widget's options panel shows `optionsIssue` and leaves its settings
  read-only while it is set.
- Moving a section to an older version of its widget leaves its options
  read-only there until reset: nothing older overwrites newer.
- The options of another widget that reach a section are migrated as this
  widget's own: they carry no widget identity. A later version may add one.
- A catalog widget that adopts a `migrate` changing how its options are
  read is no longer "options read as before" (ADR 0012): its pull request
  needs the maintainer's go.
