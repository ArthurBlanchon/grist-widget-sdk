# Changelog

What changed in each version, for the people using the widget. Newest first.

## 0.1.2 (2026-11-15)

- The row kept by default is the one with the most filled cells. Grist sends a mapped widget only its key columns, so the first row of a group always won; the widget now counts the whole row, read from the table.

## 0.1.1 (2026-11-15)

- The widget's page carries a Content Security Policy: only its own code and Grist's plugin API run in it, which keeps a document's content from running anything there.

## 0.1.0 (2026-11-15)

First release. Find the rows that are the same on key columns, exactly or approximately, and merge them; with a data-quality report per column.
