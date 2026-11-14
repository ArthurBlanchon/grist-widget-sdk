---
slug: attachment-viewer
title: Attachment viewer
category: documents
status: beta
access: full
---

# Attachment viewer

## Job

People who keep files in Grist (photos of a site, scanned invoices,
contracts) see them large, not as the attachment cell's small thumbnails.
In viewer mode, it shows the selected row's files one at a time: images
and PDFs in the widget, other files as a download. In gallery mode, it
shows the files of every row in a grid; a file opens in the viewer and
selects its row.

## Columns

| Column | Type | Required | Use |
| --- | --- | --- | --- |
| Files | Attachments | yes | the files shown |
| Caption | Any | no | a row's caption in the gallery |

## Access

`full`: a file's bytes are read from Grist's REST API with a short-lived
access token, which Grist gives only to a widget with full access. It
also saves the mode (viewer or gallery) in the widget's options. It
writes nothing to the document.

## Acceptance criteria

- **AC-1** Given a selected row with files, its first file is shown large;
  an image with its file name as its text alternative.
- **AC-2** Given a PDF, it is shown in a frame; given another type of file,
  the widget offers to download it.
- **AC-3** Given several files, the previous and next buttons and the arrow
  keys move through them, and the widget says which one of how many is
  shown.
- **AC-4** Given another selected row, its files are shown, from the first.
- **AC-5** Given gallery mode, every row's files are shown in a grid, the
  first 60, and the widget says how many there are in all.
- **AC-6** Given a file in the gallery, clicking it selects its row and
  shows that file in viewer mode.
- **AC-7** Given a change of mode, it is saved in the widget's options.
- **AC-8** Given a file that cannot be fetched, the widget says so in its
  place; the other files are still shown.
- **AC-9** Given a row without files, or no selected row, the widget says
  so.
- **AC-10** Given a browser that prefers French, the widget's text is in
  French.
- **AC-11** Given a file name or a caption that is HTML, it is shown as
  text.

## Out of scope

- Adding or removing files: the File uploader does it.
- Editing images, annotating PDFs.
- Thumbnails made by the server: Grist's API has none, so the gallery
  fetches each file, and stops at 60.

## Demo data

Site visits: about fifteen rows with a place as caption and one to three
photos each, one PDF report among them.
