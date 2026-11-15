---
slug: bulk-editor
title: Bulk editor
category: data-entry
status: beta
access: full
---

# Bulk editor

## Job

People who update many rows at once (close every task of a finished
project, set a status on a filtered list, assign a batch of tickets) pick
a column and a value, and the widget sets it on every row the section
shows, after a confirmation that says how many rows change. It is one
action in Grist, and the widget can undo it.

Grist copies a value down a selection, but not onto the rows a filter
shows across a long table, and not with a count and a confirmation.

## Columns

| Column | Type | Required | Use |
| --- | --- | --- | --- |
| Target | Any | yes | the column to set; its field is typed by the column (choices, a switch, a date…) |

The rows are the ones the section shows: its filters choose them.

## Access

`full`: it writes the rows, and the column's type and choices are read
from Grist's metadata.

## Acceptance criteria

- **AC-1** Given a mapped column, its new value is entered in a field typed
  by the column: its choices, a switch, a date, a number.
- **AC-2** Given a value, the widget says how many of the section's rows
  it would change; rows that already have it are left out.
- **AC-3** Given Apply, the widget asks to confirm, naming the column, the
  value and the number of rows; Cancel changes nothing.
- **AC-4** Given the confirmation, the rows are written in one action (one
  undo in Grist), each cell encoded for its column.
- **AC-5** Given a change made, Undo puts every row's previous value back,
  in one action.
- **AC-6** Given a number column and something that is not a number, the
  widget says so and can't apply it.
- **AC-7** Given a formula column, the widget says it can't be set.
- **AC-8** Given a write that Grist refuses, the widget shows the error.
- **AC-9** Given a browser that prefers French, the widget's text is in
  French.
- **AC-10** Given every row already holding the value, the widget says so
  and writes nothing.

## Out of scope

- Setting several columns at once, or values computed per row: a formula
  column does it.
- Deleting rows.

## Demo data

Tasks: about thirty tasks with a Status choice (To do, Doing, Done), an
owner and a due date.
