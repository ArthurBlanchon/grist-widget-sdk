---
slug: signature-pad
title: Signature pad
category: data-entry
status: beta
access: full
csp: connect-src grist
---

# Signature pad

## Job

People who collect signatures in Grist (a delivery receipt, an
intervention report, a consent form, a rental check-out) have the
selected row signed on a tablet, a phone or with a mouse. The signature
is saved as an image in the row's attachments column, with the signer's
name and the time, and the row shows it afterwards.

Grist has no signature field; the forum's threads and comparable tools
(Glide, Retool) have one.

## Columns

| Column | Type | Required | Use |
| --- | --- | --- | --- |
| Signature | Attachments | yes | where the signature's image is saved |
| SignedBy | Text | no | the name the signer types |
| SignedAt | DateTime or Date | no | when the row was signed |

## Access

`full`: it uploads the image to the document and writes the row.

## Acceptance criteria

- **AC-1** Given the pad, drawing on it with a mouse, a pen or a finger
  makes a signature; Save is enabled only once something is drawn.
- **AC-2** Given Save, the signature is uploaded as a PNG image, dark ink
  on a white page whatever the theme, and put in the row's Signature cell
  in place of a previous one.
- **AC-3** Given SignedBy and SignedAt columns, Save writes the typed name
  and the time of signing in the same write.
- **AC-4** Given Clear, the pad is empty again.
- **AC-5** Given the keyboard, a signature can be typed instead of drawn:
  the typed name becomes the signature.
- **AC-6** Given a signed row, the widget shows its signature with who
  signed it and when; Sign again starts a new one.
- **AC-7** Given an upload that fails, the widget shows the error and the
  row is unchanged.
- **AC-8** Given no selected row, the widget says so.
- **AC-9** Given a browser that prefers French, the widget's text is in
  French.
- **AC-10** Given a signer's name that is HTML, it is shown as text.

## Standard criteria

The same in every catalog widget ([ADR 0018](../../docs/decisions/0018-standard-criteria.md)).

- **AC-volume** Given 5,000 rows, the widget renders them with at most 3,000 DOM nodes.
- **AC-keyboard** Tab reaches the widget's controls without getting stuck, and the page passes axe after it.
- **AC-narrow** The widget fits a 320 px side panel and a 1,280 px page, without scrolling sideways.
- **AC-readonly** On a document open read-only, the widget shows its data, and if it writes, it says why it can't.

## Out of scope

- Proving who signed (an electronic signature with a certificate): this
  is an image of a signature, as on paper.
- Several signatures in one row (the cell keeps the latest).

## Demo data

Deliveries: about ten deliveries with a customer and an address, two of
them already signed.
