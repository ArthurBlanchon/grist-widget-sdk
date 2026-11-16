# Changelog

What changed in each version, for the people using the widget. Newest first.

## 0.2.2 (2026-11-16)

- A diagram larger than the panel can be scrolled from the keyboard: Tab reaches it.

## 0.2.1 (2026-11-15)

- The widget's page carries a Content Security Policy: only its own code and Grist's plugin API run in it, which keeps a document's content from running anything there.

## 0.2.0 (2026-11-15)

- Diagrams are now laid out by Dagre, Mermaid's classic layout. 0.1.0 used ELK, Mermaid 12's default, so a diagram's nodes may sit differently: the diagram itself, its text and its links don't change. A diagram can no longer ask for ELK in its front matter.
- ELK is no longer shipped with the widget: its licence (EPL-2.0 or GPL-3.0) is off the catalog's allow list.

## 0.1.0 (2026-11-15)

First release. A Mermaid diagram written in the selected row's cell, or a flowchart drawn from the rows' From and To columns.
