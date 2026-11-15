---
slug: schema-viewer
title: Schema viewer
category: visualisation
status: beta
access: full
bundle-kb: 150
---

# Schema viewer

## Job

People who build or inherit a Grist document, and the AI that helps them
write its formulas and widgets, need to see how it is put together: its
tables, their columns and types, which are formulas, and which columns
refer to which tables. The widget draws the document as an
entity-relationship diagram, can narrow it to a table and its neighbours,
and gives the same schema as text: Markdown for an AI, or Mermaid for the
Mermaid diagram widget.

Grist's Raw data page lists the tables, but not their columns side by
side or the references between them.

## Columns

None: the widget reads the whole document, whatever its section shows.

## Access

`full`: the columns, their types and formulas are in Grist's metadata
tables, which a widget reads with full access. It writes nothing.

## Size

About 124 KB of JavaScript (gzip), the layout (dagre, MIT) about 15 KB of
it; budget 150 KB.

## Acceptance criteria

- **AC-1** Given a document, each table is drawn as a box listing its
  columns and their types, Grist's helper columns aside.
- **AC-2** Given a Ref or RefList column, an arrow labelled with the
  column goes from its table to the table it refers to; a RefList's is
  dashed and marked as a list.
- **AC-3** Given a formula column, it is marked as one, with its formula
  on hover.
- **AC-4** Given a table chosen in Show, only it and the tables it refers
  to or that refer to it are drawn.
- **AC-5** Given As text, the schema is given in Markdown: each table's
  columns, types, references and formulas, ready to copy.
- **AC-6** Given the Mermaid format, the schema is a Mermaid
  entity-relationship diagram, with each reference a relationship.
- **AC-7** Given Read again, the document's tables are read again (a
  column added since shows).
- **AC-8** Given Copy where the browser refuses it, the widget says to
  select the text and copy it.
- **AC-9** Given a browser that prefers French, the widget's text is in
  French.

## Out of scope

- Editing the schema from the diagram: Grist's creator panel does it.
- Moving boxes by hand, or saving a layout.
- Summary tables and the pages and sections of the document.

## Demo data

A small CRM: Companies, Contacts referring to a company, Deals referring
to a contact, and Tags referred to by a RefList.
