# Changelog

What changed in each version, for the people using the widget. Newest first.

## 0.4.3 (2026-11-22)

- The message to click Save is now a warning inside the configuration, easier to see, and it goes away when you close the configuration.

## 0.4.2 (2026-11-22)

- The configuration has no Apply button any more: choosing a default scale applies it at once. A notice at the top of the chart then says to click Save at the top of the section, Grist's own button, to keep it for everyone. It goes away with Grist's Revert, or when you hide it.

## 0.4.1 (2026-11-22)

- The configuration's button says Apply, not Save, and the view says what Grist does next: it keeps the new default scale as a draft of the widget, as it does for its sort and filters, until you click Save in the widget's header. Two buttons named Save, one after the other, were confusing.

## 0.4.0 (2026-11-22)

- A day scale: the timeline shows days, weeks or months.
- A default scale, the one the chart opens on, set in the widget's configuration: Grist's "Open configuration" and the chart's settings icon both open it. Without one, the chart opens on weeks, as before. The scale buttons change the view for the moment, without saving it.

## 0.3.2 (2026-11-21)

- No more linking alert ("Widget linking") in a section that follows no other, or that no section follows: the widget works either way.

## 0.3.1 (2026-11-21)

- The widget loads again: Grist started serving its plugin script as a development build that this widget's security policy refuses, which left every copy on "The Grist plugin did not load". The widget now ships its own copy of Grist's plugin script, a fixed version without that problem, and runs no script from anywhere else.

## 0.3.0 (2026-11-16)

- "Report a problem": when a change fails to save, or if the widget ever stops working, a link opens this widget's bug form, filled in with its name and version. Nothing is sent from your document: you write what you choose.
- If the widget stops working, it says so, with a button to reload it, instead of showing an empty panel.

## 0.2.0 (2026-11-16)

- A section of many tasks shows the first 50, in its order, with a button for the next ones: the chart stays quick with thousands of rows. Filter or sort the section to choose which come first.

## 0.1.2 (2026-11-15)

- The chart opens on today, rather than in the middle of the year, months away from the work.

## 0.1.1 (2026-11-15)

- The widget's page carries a Content Security Policy: only its own code and Grist's plugin API run in it, which keeps a document's content from running anything there.

## 0.1.0 (2026-11-15)

First release. Tasks on a timeline, grouped and in rows, coloured by status; drag a bar to move it, or its ends to change its dates.
