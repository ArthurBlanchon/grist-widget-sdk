// Where a person reports a problem with a catalog widget (ADR 0019): the
// widget bug form of this repository, prefilled with the widget and its
// version. Plain JavaScript, so check-widgets.mjs can import it too.

export const REPORT_REPOSITORY = "https://github.com/ArthurBlanchon/grist-widget-sdk"

/** The prefilled "Widget bug" issue form for `slug` at `version`. Nothing else goes in it. */
export function reportUrlFor(slug, version) {
  const query = new URLSearchParams({ template: "widget-bug.yml", title: `[${slug}] `, widget: slug, version })
  return `${REPORT_REPOSITORY}/issues/new?${query}`
}
