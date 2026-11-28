# Changelog

What changed in each version, for the people using the widget. Newest first.

## 0.2.4 (2026-11-28)

- Built with the latest version of grist-widget-sdk: nothing changes on screen.

## 0.2.3 (2026-11-26)

- A ChoiceList whose first choice is "L" (a size, say) keeps it: the field read it without that choice, so Undo would put back the list without it.

## 0.2.2 (2026-11-21)

- No more linking alert ("Widget linking") in a section that follows no other, or that no section follows: the widget works either way.

## 0.2.1 (2026-11-21)

- The widget loads again: Grist started serving its plugin script as a development build that this widget's security policy refuses, which left every copy on "The Grist plugin did not load". The widget now ships its own copy of Grist's plugin script, a fixed version without that problem, and runs no script from anywhere else.

## 0.2.0 (2026-11-16)

- "Report a problem": when a change fails to save, or if the widget ever stops working, a link opens this widget's bug form, filled in with its name and version. Nothing is sent from your document: you write what you choose.
- If the widget stops working, it says so, with a button to reload it, instead of showing an empty panel.

## 0.1.1 (2026-11-15)

- The widget's page carries a Content Security Policy: only its own code and Grist's plugin API run in it, which keeps a document's content from running anything there.

## 0.1.0 (2026-11-15)

First release. Set one column to one value on every row the section shows, after a confirmation, in one action that can be undone.
