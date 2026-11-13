/**
 * The widget's name for the pages shown outside Grist: the page title,
 * which `create-grist-widget` sets to the widget's title in `index.html`.
 */
export function widgetTitle(): string {
  const title = typeof document === "undefined" ? "" : document.title.trim()
  return title || "Grist widget"
}
