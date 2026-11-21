---
"grist-widget-sdk": minor
"create-grist-widget": minor
---

The linking alerts show only for a widget that says it needs the link. `defineGristWidget({ requiredLinking: "target" })` is a widget that shows the row selected in another section: `section-not-linked` shows while its section follows none. `requiredLinking: "source"`, with `allowSelectBy: true`, is a widget that is there to drive other sections: `source-not-wired` shows while none follows it. Without `requiredLinking`, neither shows. Until now they showed for every widget in a Grist that reports linking, so a widget that works on the whole table (a chart, a board) warned in any section added without "Select by", and every `allowSelectBy` widget warned until a section followed it. Both messages now say where to set the link in Grist: SELECT BY, in the panel's Data tab.

The template's widget, which shows the selected row, declares `requiredLinking: "target"`.

Existing widgets that show the selected row, and relied on the alert, can add `requiredLinking: "target"` to their declaration; those that drive other sections and want the alert, `requiredLinking: "source"`. Others need nothing: the alert just stops. A `suppressAlerts: ["section-not-linked"]` or `["source-not-wired"]` is no longer needed, and can go.
