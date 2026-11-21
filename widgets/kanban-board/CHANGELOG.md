# Changelog

What changed in each version, for the people using the widget. Newest first.

## 0.3.2 (2026-11-21)

- The widget loads again: Grist started serving its plugin script as a development build that this widget's security policy refuses, which left every copy on "The Grist plugin did not load". The widget now loads Grist's production plugin script from gristwidgets.com itself, and runs no script from anywhere else.

## 0.3.1 (2026-11-16)

- Moving a card with the arrow keys keeps the keyboard on it in its new column, and a screen reader says where it went: before, the focus jumped back to the top of the board.
- A screen reader reads a card's notes along with its title and column.

## 0.3.0 (2026-11-16)

- "Report a problem": when a change fails to save, or if the widget ever stops working, a link opens this widget's bug form, filled in with its name and version. Nothing is sent from your document: you write what you choose.
- If the widget stops working, it says so, with a button to reload it, instead of showing an empty panel.

## 0.2.0 (2026-11-16)

- A column of many cards shows them 50 at a time, with a button for the next ones (the card selected in Grist is always shown): the board stays quick with thousands of rows.

## 0.1.1 (2026-11-15)

- The widget's page carries a Content Security Policy: only its own code and Grist's plugin API run in it, which keeps a document's content from running anything there.
- Its options now carry their version, so a later version can change how it keeps them without losing yours.

## 0.1.0 (2026-11-14)

First release. Move cards between status columns by dragging, or with the arrow keys.
