# Changelog

What changed in each version, for the people using the widget. Newest first.

## 0.2.4 (2026-11-28)

- A ChoiceList whose first choice is "E" (a grade, say) shows its choices: the form took the cell for a formula error and showed none selected.

## 0.2.3 (2026-11-26)

- A ChoiceList whose first choice is "L" (a size, say) keeps it: the form showed it without that choice, and Save then wrote the list without it.

## 0.2.2 (2026-11-21)

- The alert shown while its section follows no other now says where to link it: SELECT BY, in the widget's panel, Data.

## 0.2.1 (2026-11-21)

- The widget loads again: Grist started serving its plugin script as a development build that this widget's security policy refuses, which left every copy on "The Grist plugin did not load". The widget now ships its own copy of Grist's plugin script, a fixed version without that problem, and runs no script from anywhere else.

## 0.2.0 (2026-11-16)

- "Report a problem": when a change fails to save, or if the widget ever stops working, a link opens this widget's bug form, filled in with its name and version. Nothing is sent from your document: you write what you choose.
- If the widget stops working, it says so, with a button to reload it, instead of showing an empty panel.

## 0.1.2 (2026-11-15)

- A reference field shows the row it points to. Grist sends a reference as the text its column shows (a name), so the field was empty for any reference showing a column; the widget now reads the row ids from the table.

## 0.1.1 (2026-11-15)

- The widget's page carries a Content Security Policy: only its own code and Grist's plugin API run in it, which keeps a document's content from running anything there.

## 0.1.0 (2026-11-14)

First release. Edit the selected row in a form, each field typed by its Grist column, with Save and Cancel; or add a row.
