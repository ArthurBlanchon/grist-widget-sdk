# Changelog

What changed in each version, for the people using the widget. Newest first.

## 0.3.3 (2026-11-21)

- No more linking alert ("Widget linking") in a section that follows no other, or that no section follows: the widget works either way.

## 0.3.2 (2026-11-21)

- The widget loads again: Grist started serving its plugin script as a development build that this widget's security policy refuses, which left every copy on "The Grist plugin did not load". The widget now ships its own copy of Grist's plugin script, a fixed version without that problem, and runs no script from anywhere else.

## 0.3.1 (2026-11-16)

- In a pivot table, a screen reader now reads each cell's total with it ("Travel, July: 70"), and the grand total too: before, only the row and column totals carried their number.

## 0.3.0 (2026-11-16)

- "Report a problem": when a change fails to save, or if the widget ever stops working, a link opens this widget's bug form, filled in with its name and version. Nothing is sent from your document: you write what you choose.
- If the widget stops working, it says so, with a button to reload it, instead of showing an empty panel.

## 0.2.0 (2026-11-16)

- With many groups (a customer, a project), the view shows 50 at a time, an open group its first 10 rows, and a pivot table its first 20 columns, each with a button for the next and how many are not shown yet. Totals still count every row: the view stays quick with thousands of rows.

## 0.1.1 (2026-11-15)

- The widget's page carries a Content Security Policy: only its own code and Grist's plugin API run in it, which keeps a document's content from running anything there.

## 0.1.0 (2026-11-14)

First release. Rows grouped by a column, with counts and totals; with a second column, a pivot table. Clicking a group filters the linked widgets.
