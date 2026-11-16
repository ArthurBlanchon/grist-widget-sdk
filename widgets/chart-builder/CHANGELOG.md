# Changelog

What changed in each version, for the people using the widget. Newest first.

## 0.2.0 (2026-11-16)

- Grouped by a column of many values, the chart stays readable and quick with thousands of rows, and every row still counts:
  - dates, numbers, and line, area or combined charts: past 120 points, neighbours are put together, in order, under "first – last";
  - other categories (a customer, a project): past 30, the chart shows the 29 largest, losses as much as gains, and the others as one "Other".

## 0.1.1 (2026-11-15)

- The widget's page carries a Content Security Policy: only its own code and Grist's plugin API run in it, which keeps a document's content from running anything there.
- Its options now carry their version, so a later version can change how it keeps them without losing yours.

## 0.1.0 (2026-11-15)

First release. Bar, line, area, pie, radar or combined charts of a table, grouped by a column, in the theme's colours.
