# Changelog

What changed in each version, for the people using the widget. Newest first.

## 0.2.0 (2026-11-16)

- A section of many rows lists them 100 at a time, with a button for the next ones: the widget stays quick with thousands of rows. Open the next one still goes through all of them.

## 0.1.2 (2026-11-15)

- Placeholders for columns you haven't mapped (`{{Name}}`, say) are filled. Grist sends a mapped widget only its mapped columns, so they came out empty; the widget now reads the table itself, a reference as the text its column shows. The e-mails can be opened once the table is read, and a failed read is shown.

## 0.1.1 (2026-11-15)

- The widget's page carries a Content Security Policy: only its own code and Grist's plugin API run in it, which keeps a document's content from running anything there.
- Its options now carry their version, so a later version can change how it keeps them without losing yours.

## 0.1.0 (2026-11-15)

First release. A personal e-mail for each row the section shows, opened ready to send in the person's own mail app, Gmail or Outlook: no provider, no key.
