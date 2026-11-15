---
slug: chart-builder
title: Chart builder
category: visualisation
status: beta
access: full
bundle-kb: 240
---

# Chart builder

## Job

People who follow figures in Grist (sales by month, hours by project,
budget by category) chart them beyond Grist's own charts: stacked bars,
bars and lines together, areas, pie, radar. They pick the kind of chart
and how rows are totalled in the widget, and the choice is kept.

## Implementation

Charts use shadcn's chart component (Recharts, MIT) in
`widgets/_shared/ui/chart.tsx`, so their colours are the theme's
`--chart-1` to `--chart-5`, light and dark, like every other widget.

## Columns

| Column | Type | Required | Use |
| --- | --- | --- | --- |
| Label | Any | yes | the categories: rows with the same label are one point of the chart |
| Values | Numeric or Int, several columns | yes | the numbers charted, a series each, named after their column |

## Access

`full`: the kind of chart and the total are saved in the widget's
options, and the series' names are the columns' labels, which only full
access reads. It writes nothing to the document.

## Size

About 220 KB of JavaScript (gzip), budget 240 KB: Recharts is half of it.

## Acceptance criteria

- **AC-1** Given rows, they are grouped by label, in order of first
  appearance, and each series is the sum of its numbers in the group.
- **AC-2** Given the total buttons, a series is the sum, the average or the
  count of its numbers instead.
- **AC-3** Given several Values columns, each is a series named after its
  column's label in Grist, in the theme's next chart colour.
- **AC-4** Given the chart buttons, the chart is drawn as bars, stacked
  bars, lines, areas, bars and lines, a pie or a radar.
- **AC-5** Given a change of chart or of total, it is saved in the widget's
  options.
- **AC-6** Given a chart, its data is also a table that screen readers
  read.
- **AC-7** Given a blank label, its rows are in a "(blank)" point.
- **AC-8** Given no rows or no Values column, the widget says what to map.
- **AC-9** Given a browser that prefers French, the widget's text and
  numbers are in French.
- **AC-10** Given a label that is HTML, it is shown as text.

## Out of scope

Later:
- the heat map and colour scales, the roadmap's other asks;
- sorting the categories, and charting dates on a time axis.

Not planned:
- charts Grist draws already (its own chart widget covers the simple
  ones).

## Demo data

Sales: about sixty rows of a month as label, with revenue and costs as
two Values columns.
