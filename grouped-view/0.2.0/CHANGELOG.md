# Changelog

What changed in each version, for the people using the widget. Newest first.

## 0.2.0 (2026-11-16)

- With many groups (a customer, a project), the view shows 50 at a time, an open group its first 10 rows, and a pivot table its first 20 columns, each with a button for the next and how many are not shown yet. Totals still count every row: the view stays quick with thousands of rows.

## 0.1.1 (2026-11-15)

- The widget's page carries a Content Security Policy: only its own code and Grist's plugin API run in it, which keeps a document's content from running anything there.

## 0.1.0 (2026-11-14)

First release. Rows grouped by a column, with counts and totals; with a second column, a pivot table. Clicking a group filters the linked widgets.
