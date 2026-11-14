---
slug: record-selector
title: Record selector
category: data-entry
status: beta
access: read table
---

# Record selector

## Job

People who build a dashboard page in Grist (a client file, a project
sheet, a product record) find a row by typing part of its name, and pick
it: the other widgets on the page, linked to this one, then show that row.
Grist's own table can be searched, but it is a grid: this is the search
box a page of cards, charts and custom widgets needs.

## Columns

| Column | Type | Required | Use |
| --- | --- | --- | --- |
| Title | Any | yes | what each result shows first, and what is searched |
| Subtitle | Any | no | a second line under the title, searched too |
| Search | Any, several columns | no | more columns the search looks in, not shown |

## Access

`read table`: it only reads the rows and moves the selection.

## Acceptance criteria

- **AC-1** Given rows, when the search is empty, every row is listed with
  its title and subtitle.
- **AC-2** Given a search text, only the rows whose title, subtitle or a
  search column contains it are listed, ignoring case and accents.
- **AC-3** Given a result, when it is clicked, or chosen with Enter, its
  row becomes the selected row, so linked widgets follow.
- **AC-4** Given the selected row, its result is marked as the current one.
- **AC-5** Given results, the up and down arrow keys move through them
  from the search box.
- **AC-6** Given a browser that prefers French, the widget's text is in
  French.
- **AC-7** Given a title that is HTML, it is shown as text, never rendered.
- **AC-8** Given a search that matches nothing, a message says so.
- **AC-9** Given more than 200 matching rows, the first 200 are listed and
  the widget says how many matched.

## Out of scope

- Creating or editing rows: the Record editor does it.
- Filtering by several criteria, sorting options: Grist's own filters do.
- Fuzzy (misspelled) matching.

## Demo data

A client list: about thirty companies with their city as subtitle, and
their contact's name as a search column.
