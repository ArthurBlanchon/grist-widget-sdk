---
slug: mail-merge
title: Mail merge
category: documents
status: beta
access: full
---

# Mail merge

## Job

People who write to a list kept in Grist (members, customers,
applicants) write the e-mail once, with the table's columns as
placeholders, and get a personal e-mail for each row the section shows,
opened ready to send in their own mail app, Gmail or Outlook on the web.
Nothing goes through a provider and no key is needed: the person sends
each e-mail themselves. A Sent column, when mapped, logs which e-mails
were opened.

Grist sends no e-mail; its webhooks need a service and a key.

## Columns

| Column | Type | Required | Use |
| --- | --- | --- | --- |
| Email | Any | yes | the row's address; several, separated by commas or semicolons, all receive it |
| Sent | DateTime, Date or Bool | no | set when the row's e-mail is opened: the time, the day, or true |

The rows are the ones the section shows: its filters choose them. The
placeholders can name any column of the table the person can read (the
document's access rules apply), hidden from the section or not: Grist sends
a mapped widget only its mapped columns, so the widget reads the others from
the table. A reference shows the text of its column, as in the table.

## Template

`{{Name}}` is the cell of column `Name`, as text: a number or a date the
way the person's language writes it, a list as its items separated by
commas. Everything else is sent as written, as plain text.

## Access

`full`: the template is saved in the widget's options, and the Sent
column is written, which both need full access.

## Acceptance criteria

- **AC-1** Given a subject and a message with `{{Column}}` placeholders,
  each row's e-mail has that row's cells in them, as text.
- **AC-2** Given a placeholder that names no column, the widget says so,
  and it is sent as written.
- **AC-3** Given a row, Open opens its e-mail in the chosen client: a
  `mailto:` link, Gmail's or Outlook's compose page, with the address,
  subject and message encoded in the link.
- **AC-4** Given an address cell with several addresses, all receive the
  e-mail; a cell without a valid address has no Open, and is counted out.
- **AC-5** Given a value that tries to add a recipient or a header to the
  link (`?`, `&`, a line break), it stays inside the address or the text.
- **AC-6** Given Save, the subject, message and client are saved in the
  widget's options and used from then on.
- **AC-7** Given a mapped Sent column, opening a row's e-mail sets it:
  the time for a DateTime, the day for a Date, true for a Bool.
- **AC-8** Given Open the next one, the next row with an address and not
  yet opened or sent is opened.
- **AC-9** Given an e-mail whose link is longer than some mail apps take,
  the widget warns.
- **AC-10** Given a browser that prefers French, the widget's text is in
  French.
- **AC-11** Given more than 100 rows, the list shows 100 at a time, with a
  button that shows the next ones; Open the next one goes through all of them.

## Standard criteria

The same in every catalog widget ([ADR 0018](../../docs/decisions/0018-standard-criteria.md)).

- **AC-volume** Given 5,000 rows, the widget renders them with at most 3,000 DOM nodes.
- **AC-keyboard** Tab reaches the widget's controls without getting stuck, and the page passes axe after it.
- **AC-narrow** The widget fits a 320 px side panel and a 1,280 px page, without scrolling sideways.
- **AC-readonly** On a document open read-only, the widget shows its data, and if it writes, it says why it can't.

## Out of scope

- Sending from the widget (a provider, a key): see wave 3.
- HTML e-mails and attachments: `mailto:` links carry plain text only.

## Demo data

Members: about fifteen people with a name, an e-mail, a membership
end date and a Sent column.
