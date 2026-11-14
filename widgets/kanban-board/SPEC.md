---
slug: kanban-board
title: Kanban board
category: visualisation
status: beta
access: full
---

# Kanban board

## Job

People who track work in a Grist table (a team's tasks, a hiring pipeline,
support tickets) see each row as a card in its status's column, and move it
on by dragging it or with the arrow keys. Grist has no board view of its
own: Card Lists filtered by status are the usual workaround, without moving
cards.

## Columns

| Column | Type | Required | Use |
| --- | --- | --- | --- |
| Title | Text | yes | the card's title |
| Status | Choice, Text | yes | the card's column; moving a card writes it |
| Notes | Text | no | a few lines under the title |

## Access

`full`: moving a card writes its Status, and the column order is saved in
the widget's options.

## Acceptance criteria

- **AC-1** Given rows with statuses, when the widget opens, each row is a
  card in the column of its status, the columns in the saved order first,
  then in the order rows use them.
- **AC-2** Given a card, when it is moved to the next column (right arrow
  key, or drag and drop), its row's Status becomes that column's.
- **AC-3** Given a card, when it is clicked, its row becomes the selected
  row, so linked widgets follow.
- **AC-4** Given a new column name, when it is added, an empty column with
  that name appears, and the order is saved in the widget's options.
- **AC-5** Given two columns, when one is moved right, the saved order
  changes and the board follows it.
- **AC-6** Given a browser that prefers French, the widget's text is in
  French.
- **AC-7** Given a card whose title is HTML, it is shown as text, never
  rendered.
- **AC-8** Given an empty table and no saved columns, a message says rows
  will appear here.

## Out of scope

- Swimlanes (a second grouping), WIP limits, card colours.
- Creating or deleting rows from the board: Grist's own table does it.
- Card fields beyond Title and Notes.

## Demo data

A team's tasks: about ten rows across "To do", "Doing", "Review" and
"Done", some with notes.
