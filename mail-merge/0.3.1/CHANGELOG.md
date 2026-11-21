# Changelog

What changed in each version, for the people using the widget. Newest first.

## 0.3.1 (2026-11-21)

- The widget loads again: Grist started serving its plugin script as a development build that this widget's security policy refuses, which left every copy on "The Grist plugin did not load". The widget now ships its own copy of Grist's plugin script, a fixed version without that problem, and runs no script from anywhere else.

## 0.3.0 (2026-11-16)

- "Report a problem": when a change fails to save, or if the widget ever stops working, a link opens this widget's bug form, filled in with its name and version. Nothing is sent from your document: you write what you choose.
- If the widget stops working, it says so, with a button to reload it, instead of showing an empty panel.

## 0.2.0 (2026-11-16)

- A section of many rows lists them 100 at a time, with a button for the next ones: the widget stays quick with thousands of rows. Open the next one still goes through all of them.

## 0.1.2 (2026-11-15)

- Placeholders for columns you haven't mapped (`{{Name}}`, say) are filled. Grist sends a mapped widget only its mapped columns, so they came out empty; the widget now reads the table itself, a reference as the text its column shows. The e-mails can be opened once the table is read, and a failed read is shown.

## 0.1.1 (2026-11-15)

- The widget's page carries a Content Security Policy: only its own code and Grist's plugin API run in it, which keeps a document's content from running anything there.
- Its options now carry their version, so a later version can change how it keeps them without losing yours.

## 0.1.0 (2026-11-15)

First release. A personal e-mail for each row the section shows, opened ready to send in the person's own mail app, Gmail or Outlook: no provider, no key.
