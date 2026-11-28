# Changelog

What changed in each version, for the people using the widget. Newest first.

## 0.3.4 (2026-11-28)

- Built with the latest version of grist-widget-sdk: nothing changes on screen.

## 0.3.3 (2026-11-21)

- No more linking alert ("Widget linking") in a section that follows no other, or that no section follows: the widget works either way.

## 0.3.2 (2026-11-21)

- The widget loads again: Grist started serving its plugin script as a development build that this widget's security policy refuses, which left every copy on "The Grist plugin did not load". The widget now ships its own copy of Grist's plugin script, a fixed version without that problem, and runs no script from anywhere else.

## 0.3.1 (2026-11-16)

- A flowchart built from more rows than a diagram can hold (500 arrows) draws the first ones and says how many of how many are drawn, instead of an error about a setting nobody using the widget can change.

## 0.3.0 (2026-11-16)

- "Report a problem": when a change fails to save, or if the widget ever stops working, a link opens this widget's bug form, filled in with its name and version. Nothing is sent from your document: you write what you choose.
- If the widget stops working, it says so, with a button to reload it, instead of showing an empty panel.

## 0.2.2 (2026-11-16)

- A diagram larger than the panel can be scrolled from the keyboard: Tab reaches it.

## 0.2.1 (2026-11-15)

- The widget's page carries a Content Security Policy: only its own code and Grist's plugin API run in it, which keeps a document's content from running anything there.

## 0.2.0 (2026-11-15)

- Diagrams are now laid out by Dagre, Mermaid's classic layout. 0.1.0 used ELK, Mermaid 12's default, so a diagram's nodes may sit differently: the diagram itself, its text and its links don't change. A diagram can no longer ask for ELK in its front matter.
- ELK is no longer shipped with the widget: its licence (EPL-2.0 or GPL-3.0) is off the catalog's allow list.

## 0.1.0 (2026-11-15)

First release. A Mermaid diagram written in the selected row's cell, or a flowchart drawn from the rows' From and To columns.
