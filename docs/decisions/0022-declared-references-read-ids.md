# 0022. A declared reference column reads as row ids

- **Status:** proposed
- **Date:** 2026-11-17

## Context

Grist sends a widget each reference as the value its column shows
(`expandRefs`, the plugin API's default): a person's name, or a number
from a Numeric column. Typed reads (`mappedRecord`) promise the row id for a
column declared `Ref:<table>`, so a reference showing a name read as `null`
with a "not a reference" issue, and one showing a number was taken for the
row id, silently. Grist offers no per-column choice: `expandRefs` applies to
the whole read (`fetchSelectedTable` reads each column or its display column,
checked in grist-static 0.1.6, built from grist-core).

## Decision

- **A widget that declares a column accepting a reference and not text**
  (`Ref:People`, `RefList:Tags`; not `"Text,Ref"`) reads its records with
  `expandRefs: false`: every reference in `w.record`, `w.records` and the
  mapped records is a row id.
- **Every other widget reads as before**, the references as their columns
  show them: one that declares no reference, or declares `"Text,Ref"` to read
  the name.
- **The page's first provider decides**, since Grist's record streams bind
  once per page.

## Consequences

- A declared `Ref` column always reads as its row id, whatever its column
  shows, in Grist and in the emulator (which now applies a subscriber's own
  read options to the records it pushes).
- A widget that declares a reference and also shows another reference's
  name, from the raw records, gets that one's id too: it reads the name from
  the referenced table (`fetchRows(tableId)`, full access), or declares the
  column `"Text,Ref"`.
- A `"Text,Ref"` column declared next to a pure `Ref` one reads the id too:
  `expandRefs` is all or nothing. The SDK warns in the console when a
  declaration mixes them.
- `w.fetchRows()` reads the section with the same options as the records,
  so the two agree.
- Like Grist, the emulator answers every `docApi` call but `getDocName` only
  with full access (`fetchTable`, `listTables`, `applyUserActions`,
  `getAccessToken`), so a test can't do what the widget couldn't.
