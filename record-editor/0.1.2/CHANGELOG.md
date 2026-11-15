# Changelog

What changed in each version, for the people using the widget. Newest first.

## 0.1.2 (2026-11-15)

- A reference field shows the row it points to. Grist sends a reference as the text its column shows (a name), so the field was empty for any reference showing a column; the widget now reads the row ids from the table.

## 0.1.1 (2026-11-15)

- The widget's page carries a Content Security Policy: only its own code and Grist's plugin API run in it, which keeps a document's content from running anything there.

## 0.1.0 (2026-11-14)

First release. Edit the selected row in a form, each field typed by its Grist column, with Save and Cancel; or add a row.
