---
slug: document-template
title: Document template
category: documents
status: beta
access: full
csp: img-src https:; style-src https:; font-src https:
---

# Document template

## Job

People who produce documents from their data (a quote, a certificate, a
letter, a delivery note) write an HTML template once, with the table's
columns as placeholders, and get the selected row's document, ready to
print or save as PDF. In list mode, a repeated section makes one document
of all the section's rows: a report, a price list.

Grist has no printing beyond its own views; its official gallery has
fixed invoice and label widgets. This one takes any layout.

## Columns

None to map: the template names the table's columns, `{{ColumnId}}`.
Grist sends the widget every column of the selected row.

## Template

- `{{Name}}` is the cell of column `Name`, written as text: a number or a
  date the way the person's language writes it, a list as its items
  separated by commas.
- `{{#rows}} … {{/rows}}` repeats its content for each of the section's
  rows, in their order. Inside it, `{{Name}}` is that row's cell.
- Anything else is HTML and CSS, kept as written. Scripts never run.

## Access

`full`: the template is saved in the widget's options, which only a
widget with full access can write. It writes nothing to the document.

## Acceptance criteria

- **AC-1** Given a template and a selected row, each `{{Column}}` shows
  that row's cell, numbers, dates and lists written as text.
- **AC-2** Given a cell holding HTML, the document shows it as text.
- **AC-3** Given a template with a script, the document is shown where
  scripts don't run.
- **AC-4** Given a placeholder that names no column, it stays visible, and
  the editor lists the columns there are.
- **AC-5** Given the editor, a changed template is previewed, and saved in
  the widget's options with Save.
- **AC-6** Given Print, the document alone is printed (or saved as PDF by
  the browser).
- **AC-7** Given a `{{#rows}}` section, it repeats for each of the
  section's rows, in order.
- **AC-8** Given no template yet, a default one shows every column of the
  row as a table.
- **AC-9** Given no selected row and a template without a `{{#rows}}`
  section, the widget says so.
- **AC-10** Given a browser that prefers French, the widget's text is in
  French.

## Out of scope

- Logic in templates (conditions, loops other than the rows): a formula
  column computes it.
- Saving the PDF as an attachment: printing to PDF covers it for now.
- DOCX templates: a later widget.

## Demo data

Quotes: about ten quotes with a client, a date, an amount and a status,
and a template that lays one out as a letter.
