# Catalog roadmap: the first list

> **Status: agreed with the maintainer on 2026-11-14.** This is step F3's
> list in the [widget factory plan](../docs/planning/2026-11-14-widget-factory-plan.md):
> what the factory builds first, in which order, and why.
>
> Each entry below seeds that widget's `SPEC.md`. When a widget is built,
> its `SPEC.md` becomes the source of truth and the entry here shrinks to a
> link.

The list comes from the maintainer's research of 2026-11-14 on:
- the Grist community forum, with view counts noted that day;
- Grist's official widget manifest (27 widgets);
- Grist's newsletters and issues;
- the views and extensions of twelve comparable tools (Airtable, Notion,
  Baserow, NocoDB, Teable, SeaTable, Smartsheet, Coda, Glide, Softr,
  Retool, Appsmith).

The demand figures quoted are forum views: relative signals, not usage
counts.

## What it found, in short

- **The four strongest needs** are planning (Gantt or timeline: threads of
  2,549 and 3,734 views), Kanban (1,742), attachments (710), and producing
  documents (PDF, DOCX).
- **Grist has none of them natively.** It has no Kanban, Gantt, gallery,
  pivot or printing. Its official gallery covers the map and a few fixed
  documents (invoices, labels).
- **Every comparable tool has the same base:** Kanban, calendar, gallery,
  form and timeline. After it come the map, the chart, document layout,
  pivot and org chart.
- **The community already fills most gaps,** but with isolated widgets:
  uneven quality, no tests, tried on the hosted service only, published on
  personal pages, with code that can change after review. What the factory
  adds is less the ideas than **reliability**:
  - tests against a real Grist;
  - self-hosted Grist supported;
  - the lowest access level that works;
  - fixed versions.

## Rules every widget follows

- **One design system: shadcn/ui.**
  - Widgets build their UI from the shared shadcn components in
    `widgets/_shared/ui/`. That folder holds the factory's only
    `components.json`, and the only copy of each component.
  - Colours, radius, spacing and fonts are the tokens of one theme,
    `widgets/_shared/theme.css`, mapped to Grist's light and dark themes.
    Changing that file, or the shadcn style it is built from, restyles
    every widget in the next release.
  - A widget never hard-codes a colour or a size in pixels, and lint
    enforces it.
  - Third-party views (the Gantt's timeline, the map, the board's drag and
    drop) take their colours from the same tokens.
- **English and French from the first wave.**
  - A small translation helper in `widgets/_shared/` gives each widget
    an `en` and a `fr` dictionary. The language comes from Grist where the
    widget API exposes it, otherwise from the browser.
  - CI fails on a key missing from either language.
- **The lowest access level that works.** `read table` by default; `full`
  only for a widget that writes, and justified in its `SPEC.md`. Grist
  keeps only the first `ready()` call, so this is chosen at design time.
- **Modes, not near-duplicates.** One widget has modes (Gantt and
  timeline; map and choropleth; viewer and gallery) when the modes share
  their mapped columns and most of their code; otherwise they are two
  widgets.
- **API keys never go in widget options**, which every editor of the
  document can read.
  - Each person keeps their own key in their own browser.
  - The widget says plainly which data goes to which provider.
  - There is no proxy: it would need a server and a secret.
- **Libraries under an allowed licence:** MIT, BSD, Apache-2.0 or ISC, and
  CI checks it. No GPL or dual-licensed libraries, which rules out several
  well-known Gantt libraries.
- **Columns declared in the manifest.** The catalog's `grist-widgets.json`
  publishes each widget's declared columns. An AI can then install and set
  up a widget through Grist's MCP server, which gained widget settings in
  August 2026.

## Wave 1: the core, 10 reference widgets

These answer the strongest demand, and together they use every part of
the widget API at least twice: the selected row, all rows, writes, mapped
columns, options, attachments, and linking. They are also the factory's
reference code. A new widget starts from the core widget closest to it,
and the skills point agents at them.

**The pilot (F1) is the Kanban board.** It is in high demand and of medium
size. It uses writes, mapped columns, options and linking, and the
`task-board` example is its starting point.

| # | Widget | Job | Access | Modes | Starts from | Demand |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Kanban board | Move cards between status columns by dragging; card fields and order chosen in options | full | — | `examples/task-board` | Strong: 1,742 views; asked for since 2023; in every comparable tool |
| 2 | Record editor | Edit a record inside Grist: typed fields (Choice, Ref, Date), validation, conditional fields, Save and Cancel | full | multi-step wizard | `examples/form-edit` | Strong: in the forum's "top 5 requests"; Grist Forms are public-only |
| 3 | Record selector | Find a row by search and drive the other widgets on the page | read table | — | — | Medium; the piece that makes dashboards work |
| 4 | Gantt chart | Plan tasks with dependencies and milestones; move and resize bars | full | timeline, resources | gantt-widget | Strong: 2,549 and 3,734 views |
| 5 | Map | Points by coordinates or address, colour by category, clusters, linked selection | read table (full to geocode) | choropleth | world-map | Medium; standard everywhere |
| 6 | Chart builder | Charts beyond Grist's own: combined, heat map, radar, colour scales | read table | — | — | Medium: 897 views on colour scales |
| 7 | Grouped / Pivot view | Group by a value with collapsible groups; aggregate in a pivot | read table | grouped, pivot | — | Medium: 673 views; the official pivot is unmaintained since 2024 |
| 8 | Attachment viewer & gallery | Show the selected row's images and PDFs large; all of a table's attachments in a grid | read table | viewer, gallery | `examples/attachment-gallery` | Strong: 710 views; many hand-written viewers |
| 9 | File uploader | Drop files into an attachments column, with type and size limits | full | — | — | Medium: forms take no attachments |
| 10 | Document template | One document per row (quote, certificate, letter) from an editable HTML or Liquid template; print to PDF, optionally attach it | read table (full to attach) | list report | — | Strong: 1,082 views; 17,347 at Retool; Airtable's Page designer |

Notes for their specs:
- **Kanban:** a card's text is data the widget does not control, so it is
  rendered as text, never as HTML.
- **Gantt:** it needs a drag-and-drop timeline under an allowed licence.
  Choosing that library is the first task of its spec.
- **Map:** the tiles are its only network calls. Their host is fixed in
  its CSP, and so is the geocoder's when geocoding is turned on.
- **Chart builder:** shadcn's charts (Recharts) by default, so charts take
  the theme like everything else. A declarative spec such as Vega-Lite is
  considered only if shadcn's charts fall short.
- **Attachment viewer:** attachments are read with Grist's temporary
  access token. The self-hosted case, where the download URL can be wrong,
  is in its e2e test.
- **Document template:** the user's template is rendered in a sandbox
  with no scripts.

## Wave 2: widely asked for, low cost

| # | Widget | Job | Access | Starts from | Demand |
| --- | --- | --- | --- | --- | --- |
| 11 | Signature pad | Sign on a tablet; the image is stored as an attachment | full | — | Medium: a forum thread; in Glide and Retool |
| 12 | Duplicate finder | Find duplicates, approximate ones included, and merge them; a data-quality report per column (blanks, mixed types, broken references) | full | — | Strong: 3,361 views |
| 13 | Schema viewer | An entity-relationship diagram of the document's tables and references | full (metadata tables) | `examples/schema-preview` | Medium: 908 views; useful to people and to AI |
| 14 | Mermaid diagram | Render a Mermaid diagram written in a cell or generated from rows | read table | — | Medium: 1,224 views; easy for an AI to write |
| 15 | Bulk editor | Apply a value or a status to the filtered rows, with a confirmation and undo | full | `examples/mark-done`, `examples/bulk-mark-done` | Low; the two examples' job |
| 16 | Mail merge | Personal e-mails for the filtered rows, as drafts or `mailto:` links: no provider, no key | read table (full to log) | create-email-draft | Medium: shown at a community webinar |

Notes:
- **Duplicate finder:** a merge deletes rows, so it shows a preview first
  and stays one action in Grist's undo.
- **Mermaid:** the SVG is rendered in Mermaid's strict security mode.

## Wave 3: the widgets that depend on a key or an outside service

| # | Widget | Job | Access | Starts from | Notes |
| --- | --- | --- | --- | --- | --- |
| 17 | REST enrichment | Call an API for the row and write the answer into mapped columns (SIRENE, BAN, exchange rates) | full | `examples/rest-fetch` | The allowed domains are listed in its options and in its CSP; the key follows the rule above |
| 18 | Ask AI | Ask questions in plain language about a filtered view | read table | ask-ai-widget | It must do what Grist's own assistant and MCP server don't; the key leaves the widget's options |
| 19 | Scan with AI | Extract fields from a PDF or an image into mapped columns | full | scan-with-ai | Nothing like it in Grist; the files go to a provider, and the widget says so |

## Later, when the factory keeps pace

Possible additions, in no fixed order:
- DOCX template;
- Tree view and Org chart, as one widget with two modes;
- KPI cards;
- Barcode generator;
- Address geocoder;
- iCal export;
- AI column fill;
- Barcode scanner.

The Barcode scanner is not a priority. It also depends on the camera being
allowed in a widget's iframe, which is unknown (grist-core #2550).

## Not in the catalog

- **Already in Grist or its official gallery,** so not rebuilt: Calendar,
  Action button, Markdown, Notepad, Invoices, Print labels, QR code, video
  player, Dropbox, JupyterLite, Flashcards and the inspector widgets.
  Invoices and Print labels are covered by the Document template.
- **news-feed-widget** leaves the list: its demand is low and it depends
  on a third-party service. Its current install URL keeps working.

The examples that only show the API become **test fixtures** (against a
real Grist) and **checked docs snippets**, not catalog widgets. The API
coverage check (plan, F3) makes sure every public name still has an
example:

| Example | Becomes |
| --- | --- |
| hello-world | the scaffold's starting point |
| declared-columns, reads-demo, writes-demo, typed-reads, widget-options, theme-demo | test fixtures and docs snippets |
| schema-migration | a test fixture: it changes the document's structure with full access, too risky for the catalog |
| spreadsheet-grid | dropped: it duplicates Grist's own table |

## Still to find out

- Whether the widget API exposes Grist's interface language, or only the
  browser's language is available.
- How widgets behave in Grist Desktop: a 2026 forum thread reports them
  not working in 0.3.13.
- The licence of each library a widget bundles, checked when its spec is
  written.
- Install counts for any widget, here or at competitors: none were found.
