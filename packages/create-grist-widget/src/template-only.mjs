// The template's README holds notes for the template's own maintainers (how
// it is distributed, its monorepo development, its live preview), between
// <!-- template-only:start --> and <!-- template-only:end -->. A scaffold is a
// widget, not the template: it gets the README without them.

/** The README without its template-only blocks. */
export function stripTemplateOnly(text) {
  return text.replace(/<!-- template-only:start[^>]*-->[\s\S]*?<!-- template-only:end -->\n*/g, "")
}
