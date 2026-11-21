# Changelog

What changed in each version, for the people using the widget. Newest first.

## 0.3.1 (2026-11-21)

- The widget loads again: Grist started serving its plugin script as a development build that this widget's security policy refuses, which left every copy on "The Grist plugin did not load". The widget now loads Grist's production plugin script from gristwidgets.com itself, and runs no script from anywhere else.

## 0.3.0 (2026-11-16)

- "Report a problem": when a change fails to save, or if the widget ever stops working, a link opens this widget's bug form, filled in with its name and version. Nothing is sent from your document: you write what you choose.
- If the widget stops working, it says so, with a button to reload it, instead of showing an empty panel.

## 0.2.0 (2026-11-16)

- Many duplicates are listed 20 groups at a time, with a button for the next ones, and 10 rows in a group (the kept one always among them): the widget stays quick with thousands of rows. Merging a group still merges every row in it.

## 0.1.2 (2026-11-15)

- The row kept by default is the one with the most filled cells. Grist sends a mapped widget only its key columns, so the first row of a group always won; the widget now counts the whole row, read from the table.

## 0.1.1 (2026-11-15)

- The widget's page carries a Content Security Policy: only its own code and Grist's plugin API run in it, which keeps a document's content from running anything there.

## 0.1.0 (2026-11-15)

First release. Find the rows that are the same on key columns, exactly or approximately, and merge them; with a data-quality report per column.
