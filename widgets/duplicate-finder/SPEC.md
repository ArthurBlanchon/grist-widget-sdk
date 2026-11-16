---
slug: duplicate-finder
title: Duplicate finder
category: data-entry
status: beta
access: full
---

# Duplicate finder

## Job

People who keep contacts, customers or products in Grist end up with the
same thing entered twice: "ACME Corp." and "Acme corp", a name with and
without its accent, a typo in an e-mail. The widget groups the rows the
section shows that are the same on the mapped key columns, exactly (case,
accents, spaces and punctuation aside) or approximately, and merges a
group into the row to keep: the others are deleted, the kept row's blank
cells are filled from them, and the references to them, in every table,
move to the kept row. A merge is shown before it is made, and is one
action in Grist's undo.

A second tab reports on each column of the table: its blank cells, the
cells whose value doesn't fit the column's type, formula errors, and
references to rows that no longer exist.

Grist has no duplicate search beyond a formula column written for the
purpose, and nothing that merges rows.

## Columns

| Column | Type | Required | Use |
| --- | --- | --- | --- |
| Keys | Any, several columns | yes, one or more | the columns that say two rows are the same (a name, an e-mail…) |

The rows compared are the ones the section shows: its filters choose them.

## Access

`full`: a merge deletes rows and writes cells in every table that refers
to them, and the report reads the column types from Grist's metadata.

## Acceptance criteria

- **AC-1** Given rows equal on the keys once case, accents, spaces and
  punctuation are set aside, they are grouped as duplicates; rows whose
  keys are all blank never are.
- **AC-2** Given approximate matching, rows whose keys differ by a typo or
  two are grouped too.
- **AC-3** Given a group, the row kept is the one with the most filled
  cells, and another can be chosen.
- **AC-4** Given Merge, the widget first says which rows it keeps and
  deletes, how many blank cells it fills and how many references it
  moves; Cancel changes nothing.
- **AC-5** Given the confirmation, the other rows are deleted and the
  kept row's blank cells are filled from them, formula columns aside, in
  one action (one undo in Grist).
- **AC-6** Given references to a deleted row (Ref or RefList, in any
  table, this one included), they point to the kept row afterwards.
- **AC-7** Given the report, each column shows its number of blank cells,
  of cells that don't fit its type, and of formula errors.
- **AC-8** Given a reference column, the report counts the references to
  rows that don't exist.
- **AC-9** Given a write that Grist refuses, the widget shows the error.
- **AC-10** Given no duplicates, the widget says so.
- **AC-11** Given a browser that prefers French, the widget's text is in
  French.
- **AC-12** Given many duplicates, the widget lists 20 groups at a time, with a
  button that shows the next ones, and 10 rows in a group (the kept one
  always among them), with a button that shows all of one group's rows; a
  merge that deletes rows not shown says how many.

## Standard criteria

The same in every catalog widget ([ADR 0018](../../docs/decisions/0018-standard-criteria.md)).

- **AC-volume** Given 5,000 rows, the widget renders them with at most 3,000 DOM nodes.
- **AC-keyboard** Tab reaches the widget's controls without getting stuck, and the page passes axe after it.
- **AC-narrow** The widget fits a 320 px side panel and a 1,280 px page, without scrolling sideways.
- **AC-readonly** On a document open read-only, the widget shows its data, and if it writes, it says why it can't.

## Out of scope

- Remembering that a group is not a duplicate: change a key, or filter
  the rows out.
- Merging cell by cell (choosing which row's value wins for each column):
  the kept row's filled cells stay, its blank ones are filled.
- Searching more than a few thousand rows at once in approximate mode:
  rows are compared with their neighbours in key order, not each with
  every other.

## Demo data

Contacts: about twenty-five people with a name, an e-mail, a company and
a city, with a few written twice (an accent, a capital, a typo), and an
Orders table that refers to them.
