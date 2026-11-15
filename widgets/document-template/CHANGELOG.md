# Changelog

What changed in each version, for the people using the widget. Newest first.

## 0.1.1 (2026-11-15)

- The widget's page carries a Content Security Policy: only its own code and Grist's plugin API run in it, which keeps a document's content from running anything there.
- Its options now carry their version, so a later version can change how it keeps them without losing yours.

## 0.1.0 (2026-11-14)

First release. One document per row from an HTML template with the columns as placeholders, or one for all rows; print it or save it as PDF.
