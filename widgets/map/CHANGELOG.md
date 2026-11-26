# Changelog

What changed in each version, for the people using the widget. Newest first.

## 0.3.3 (2026-11-26)

- A list label or category that holds the choice "L" (a size, say) keeps it: every "L" in it was left out.

## 0.3.2 (2026-11-21)

- No more linking alert ("Widget linking") in a section that follows no other, or that no section follows: the widget works either way.

## 0.3.1 (2026-11-21)

- The widget loads again: Grist started serving its plugin script as a development build that this widget's security policy refuses, which left every copy on "The Grist plugin did not load". The widget now ships its own copy of Grist's plugin script, a fixed version without that problem, and runs no script from anywhere else.
- Built with MapLibre 6.18, which fixes how icons scale with their labels and how the map keeps turning after you rotate it.

## 0.3.0 (2026-11-16)

- "Report a problem": when a change fails to save, or if the widget ever stops working, a link opens this widget's bug form, filled in with its name and version. Nothing is sent from your document: you write what you choose.
- If the widget stops working, it says so, with a button to reload it, instead of showing an empty panel.

## 0.2.0 (2026-11-16)

- With more categories than the theme has colours (five), the five with the most points keep their own colour and the others are one "Others" group, in a neutral colour, last in the legend: no two categories share a colour, and the map stays readable and quick with thousands of rows. Each point's card still names its own category.

## 0.1.2 (2026-11-15)

- The widget's page carries a Content Security Policy: only its own code and Grist's plugin API run in it, which keeps a document's content from running anything there.

## 0.1.1 (2026-11-15)

- Map tiles draw again: MapLibre 6's worker is now bundled with the widget, where it failed to load.

## 0.1.0 (2026-11-15)

First release. Rows as points by their coordinates, coloured by category and clustered; or countries coloured by a value.
