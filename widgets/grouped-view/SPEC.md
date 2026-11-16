---
slug: grouped-view
title: Grouped view
category: visualisation
status: beta
access: read table
---

# Grouped view

## Job

People who follow a table by category (orders by status, expenses by
month, tickets by team) see its rows grouped by a column's value, with
collapsible groups, a count and a total per group. With a second column
it becomes a pivot table: the groups down, that column's values across,
and a total in each cell.

Grist groups rows only through summary tables, which are a new table per
grouping. Its official pivot widget has not been maintained since 2024.
This view groups the rows that the section shows, and follows its
filters. Clicking a group or a cell filters the widgets linked to it down
to those rows.

## Columns

| Column | Type | Required | Use |
| --- | --- | --- | --- |
| Group | Any | yes | the value rows are grouped by, down the side; a list cell counts under each of its values |
| Label | Any | no | what each row shows inside its group |
| Across | Any | no | mapped, the view is a pivot table: this column's values across the top |
| Value | Numeric or Int | no | the number totalled in each group or cell; without it, rows are counted |

Grouped by a Ref column, a group shows the referenced row's id: map a
formula column such as `$Client.Name` instead.

## Access

`read table`: it only reads the rows, and filters the linked widgets.
The total (sum, average, minimum, maximum) is chosen in the widget, for
the session: saving it would need `full` access, which a read-only view
should not ask for.

## Acceptance criteria

- **AC-1** Given rows, they are grouped by their Group value, one group per
  value, in order (numbers by value, text alphabetically), each with its
  count.
- **AC-2** Given rows with a blank Group value, they are in a "(blank)"
  group, listed last.
- **AC-3** Given a mapped Value, each group shows its sum; average, minimum
  and maximum can be chosen instead.
- **AC-4** Given a group, it collapses and expands; expanded, it lists its
  rows by their Label.
- **AC-5** Given a row in a group, clicking it selects it in Grist.
- **AC-6** Given a group, clicking its total filters the linked widgets to
  its rows; clicking it again shows them all.
- **AC-7** Given a mapped Across column, the view is a table: groups down,
  Across values across, the total of each cell, and totals for each row,
  each column and the whole.
- **AC-8** Given a pivot cell, clicking it filters the linked widgets to
  its rows.
- **AC-9** Given a list cell (ChoiceList) as Group, the row counts under
  each of its values.
- **AC-10** Given a browser that prefers French, the widget's text is in
  French and its numbers are written the French way.
- **AC-11** Given a Group value that is HTML, it is shown as text.
- **AC-12** Given no rows, the widget says so.
- **AC-13** Given many groups, the first 50 are shown, with a button for
  the next 50 (groups down, in a pivot too); an open group lists its first
  20 rows and says how many more it has; a pivot shows its first 20 Across
  values and says how many more there are. Totals count every row.

## Standard criteria

The same in every catalog widget ([ADR 0018](../../docs/decisions/0018-standard-criteria.md)).

- **AC-volume** Given 5,000 rows, the widget renders them with at most 3,000 DOM nodes.
- **AC-keyboard** Tab reaches the widget's controls without getting stuck, and the page passes axe after it.
- **AC-narrow** The widget fits a 320 px side panel and a 1,280 px page, without scrolling sideways.
- **AC-readonly** On a document open read-only, the widget shows its data, and if it writes, it says why it can't.

## Out of scope

- Grouping by several columns at once (groups within groups), and by date
  parts (month, year): a formula column does it today.
- Charts: the Chart builder draws them.
- Saving the chosen total in the widget's options (it needs `full` access).

## Demo data

Expenses: about forty rows with a category, a month, a person as label,
and an amount.
