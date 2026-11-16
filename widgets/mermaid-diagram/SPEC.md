---
slug: mermaid-diagram
title: Mermaid diagram
category: visualisation
status: beta
access: read table
bundle-kb: 1650
---

# Mermaid diagram

## Job

People who document processes, plans or structures in Grist draw them
with Mermaid, the text-to-diagram language an AI writes easily. In cell
mode, the selected row's cell holds the Mermaid code and the widget draws
it. In rows mode, the widget draws a flowchart from the rows themselves:
an arrow from each row's From to its To, labelled by its Label.

Diagrams use Mermaid (MIT), in its strict security mode, coloured with
the shared theme.

## Columns

| Column | Type | Required | Use |
| --- | --- | --- | --- |
| Diagram | Text | no | cell mode: the Mermaid code |
| From | Any | no | rows mode, with To: where each row's arrow starts |
| To | Any | no | where it ends |
| Label | Any | no | the arrow's label |

The mode follows the mapping: rows mode when From and To are mapped,
otherwise cell mode.

## Access

`read table`: it only reads.

## Size

About 1.6 MB of JavaScript (gzip) in all, budget 1,650 KB: Mermaid's
every diagram type. A page loads only what its diagram needs: a
flowchart, the entry chunk (about 140 KB) and its own chunks.

## Acceptance criteria

- **AC-1** Given cell mode, the selected row's Mermaid code is drawn.
- **AC-2** Given rows mode, a flowchart is drawn with a node per value of
  From and To, and an arrow per row, labelled with its Label.
- **AC-3** Given a value in From, To or Label with Mermaid syntax in it,
  it is drawn as text, never read as Mermaid.
- **AC-4** Given Mermaid code with an error, the widget says what Mermaid
  reports.
- **AC-5** Given any diagram, Mermaid runs in its strict security mode
  (labels sanitised, no click handlers), with the Dagre layout locked: a
  diagram's front matter can't switch it to ELK.
- **AC-6** Given the shared theme, the diagram's colours come from it, read
  again when Grist switches between light and dark.
- **AC-7** Given a drawn diagram, Download saves it as an SVG file.
- **AC-8** Given nothing to draw (nothing mapped, no row selected, an
  empty cell), the widget says what to do.
- **AC-9** Given a browser that prefers French, the widget's text is in
  French.
- **AC-10** Given a diagram larger than the panel, it can be reached with
  Tab and scrolled from the keyboard, with a visible focus ring.

## Out of scope

- Editing the code in the widget: the Grist cell is the editor.
- Diagrams other than flowcharts generated from rows.
- The ELK layout (Mermaid 12's default, `layout: elk`, `flowchart-elk`):
  elkjs's licence (EPL-2.0 or GPL-3.0) is off the catalog's allow list
  (ADR 0015). Every diagram is laid out by Dagre, even one whose front
  matter asks for ELK.

## Demo data

Processes: a few rows of Mermaid code (a flowchart, a sequence diagram,
a Gantt), and a table of steps with From and To for rows mode.
