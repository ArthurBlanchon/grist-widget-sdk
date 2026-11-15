# Changelog

What changed in each version, for the people using the widget. Newest first.

## 0.2.0 (2026-11-15)

- Diagrams are now laid out by Dagre, Mermaid's classic layout. 0.1.0 used ELK, Mermaid 12's default, so a diagram's nodes may sit differently: the diagram itself, its text and its links don't change. A diagram can no longer ask for ELK in its front matter.
- ELK is no longer shipped with the widget: its licence (EPL-2.0 or GPL-3.0) is off the catalog's allow list.

## 0.1.0 (2026-11-15)

First release. A Mermaid diagram written in the selected row's cell, or a flowchart drawn from the rows' From and To columns.
