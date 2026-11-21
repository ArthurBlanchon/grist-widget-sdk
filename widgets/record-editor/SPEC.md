---
slug: record-editor
title: Record editor
category: data-entry
status: beta
access: full
---

# Record editor

## Job

People who enter or correct data in Grist (a client file, an order, an
intervention report) edit the selected row in a form instead of a grid
row: one field per column, each typed by its Grist column (a list of
choices, a date picker, a picker of the referenced rows), with Save and
Cancel. They also add a row from the same form.

Grist's own card view edits cells one at a time and saves each at once;
Grist Forms only add rows, and only from a public link. This is the form
inside the document, for people who already have access to it.

It follows the row selected in another section of the page (SELECT BY in
its panel, Data): while its section follows none, it says so.

## Columns

| Column | Type | Required | Use |
| --- | --- | --- | --- |
| Fields | Any, several columns | yes | the columns the form shows, in this order |

Each field takes its type, label, choices and referenced table from its
Grist column, read with `listColumns`.

| Grist type | Field |
| --- | --- |
| Text, Any | a text box |
| Numeric, Int | a number box, checked |
| Bool | a switch |
| Date | a date picker |
| DateTime | a date and time picker, in the column's time zone |
| Choice | a list of the column's choices |
| ChoiceList | a toggle for each of the column's choices |
| Ref | a list of the referenced table's rows, by the column they show |
| RefList, Attachments, formula columns | shown, not editable |

## Access

`full`: it writes the row, and reading the columns' types, choices and
referenced tables needs Grist's metadata tables, which only full access
reads.

## Acceptance criteria

- **AC-1** Given mapped fields and a selected row, the form shows one field
  per mapped column, in the mapping's order, labelled with the column's
  label and holding the row's values.
- **AC-2** Given a Choice, ChoiceList, Bool, Date or Ref column, its field
  is a list of the column's choices, a toggle per choice, a switch, a date
  picker, or a list of the referenced rows by the column they show.
- **AC-3** Given a formula column, or a RefList or Attachments column, its
  value is shown and cannot be edited.
- **AC-4** Given edited fields, Save writes only the changed ones to the
  row, each encoded for its column's type, in one action (one undo in
  Grist).
- **AC-5** Given edited fields, Cancel puts back the row's values.
- **AC-6** Given a number field holding something that is not a number
  (or not a whole number for an Int column), the field says so and Save is
  disabled.
- **AC-7** Given unsaved edits, when another row is selected and then the
  first one again, the edits are still there, marked as not saved.
- **AC-8** Given New, the form is empty; Save adds the row and selects it.
- **AC-9** Given a save that Grist refuses, the widget shows the error and
  keeps the edits.
- **AC-10** Given a browser that prefers French, the widget's text is in
  French.
- **AC-11** Given a DateTime column, its field shows and writes the time in
  the column's time zone, not the browser's.
- **AC-12** Given no selected row, the widget says so and offers New.

## Standard criteria

The same in every catalog widget ([ADR 0018](../../docs/decisions/0018-standard-criteria.md)).

- **AC-volume** Given 5,000 rows, the widget renders them with at most 3,000 DOM nodes.
- **AC-keyboard** Tab reaches the widget's controls without getting stuck, and the page passes axe after it.
- **AC-narrow** The widget fits a 320 px side panel and a 1,280 px page, without scrolling sideways.
- **AC-readonly** On a document open read-only, the widget shows its data, and if it writes, it says why it can't.

## Out of scope

Planned for a later version:
- required fields and conditional fields (shown when another field has a
  value), set in the widget's options;
- the multi-step mode (a wizard of several pages).

Not planned:
- editing RefList and Attachments columns: Grist's own cell editors do it;
  the File uploader adds attachments;
- a public form for people outside the document: Grist Forms does it.

## Demo data

Interventions: a table of about twenty interventions (title, a Status
choice, a Priority choice, a date, a done switch, hours as a number, notes,
a reference to a Technicians table), and a Technicians table of five names.
