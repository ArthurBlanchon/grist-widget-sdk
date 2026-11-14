---
slug: file-uploader
title: File uploader
category: data-entry
status: beta
access: full
---

# File uploader

## Job

People who attach documents to rows (a quote to a deal, photos to an
intervention, a CV to an application) drop files onto the widget, or pick
them, and they are added to the selected row's attachments column. The
widget checks the file types and sizes the document's owner allows, and
lists the row's files by name, each removable.

Grist's own attachment cell takes files one cell at a time, with no
limits, and Grist Forms take no attachments. This is a drop zone with
rules, inside the document.

## Columns

| Column | Type | Required | Use |
| --- | --- | --- | --- |
| Files | Attachments | yes | the cell the files are added to |

## Access

`full`: it uploads files to the document, writes the row's attachments
cell, saves its limits in the widget's options, and reads the files'
names from Grist's attachments table.

## Acceptance criteria

- **AC-1** Given a selected row, its attachments are listed by file name.
- **AC-2** Given files dropped on the widget or picked with its button,
  they are uploaded and added to the row's cell after the files it
  already has, in one write.
- **AC-3** Given a file larger than the size limit, it is refused with a
  message naming it; the other files are still uploaded.
- **AC-4** Given a file whose type the limits don't accept, it is refused
  with a message naming it.
- **AC-5** Given the widget's settings, the accepted types and the size
  limit are saved in its options, and apply at once.
- **AC-6** Given a file in the row's list, Remove takes it out of the
  row's cell.
- **AC-7** Given an upload that fails, the widget shows the error and the
  row's cell is unchanged.
- **AC-8** Given no selected row, the widget says so and takes no files.
- **AC-9** Given a browser that prefers French, the widget's text is in
  French.
- **AC-10** Given a file name that is HTML, it is shown as text.
- **AC-11** Given files being uploaded, the widget says how many, and takes
  no other files until they are done.

## Out of scope

- Previewing files: the Attachment viewer shows them.
- Deleting a file from the document: Remove only takes it out of the row;
  Grist removes files that no row uses any more.
- Resizing or compressing images before they are uploaded.

## Demo data

Applications: a table of about ten candidates with a name and a CV
attachments column, a few of them with files.
