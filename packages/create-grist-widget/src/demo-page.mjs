// A widget's demo page: Grist itself, running in the browser from static
// files (grist-static), with the widget's demo.grist document open.
//
// demo.grist is generated once (`create-grist-widget demo --save`) and holds
// a placeholder widget URL and a placeholder section title, each of fixed
// length. The page swaps them for the widget next to it and the widget's
// title before Grist opens the document, so one document serves every
// channel (v<version>/demo/ shows that version, dev/demo/ the dev build) and
// every host, and a scaffold's copy names its section after the new widget,
// with nothing regenerated. Same length matters: the document is an SQLite
// file, and a string of the same byte length leaves every record and page
// of it valid.

/** The widget URL a demo document is generated with. */
export const DEMO_URL_PLACEHOLDER_PREFIX = "https://grist-widget-demo.invalid/?"
export const DEMO_URL_LENGTH = 400
export const DEMO_URL_PLACEHOLDER = DEMO_URL_PLACEHOLDER_PREFIX + "x".repeat(DEMO_URL_LENGTH - DEMO_URL_PLACEHOLDER_PREFIX.length)

/** The widget section's title a demo document is generated with: the page writes the widget's title over it, space-padded. */
export const DEMO_TITLE_PLACEHOLDER_PREFIX = "grist-widget-demo-title:"
export const DEMO_TITLE_LENGTH = 120
export const DEMO_TITLE_PLACEHOLDER = DEMO_TITLE_PLACEHOLDER_PREFIX + " ".repeat(DEMO_TITLE_LENGTH - DEMO_TITLE_PLACEHOLDER_PREFIX.length)

/**
 * grist-static, pinned. gristwidgets.com hosts this exact version (the site
 * build copies it from the npm package), so a demo page never loads a
 * Grist build nobody chose. Public CDNs don't serve it: the package is
 * 188 MB, over jsDelivr's size limit.
 */
export const GRIST_STATIC_VERSION = "0.1.6"
export const GRIST_STATIC_BASE = `https://gristwidgets.com/grist-static/${GRIST_STATIC_VERSION}/`

/**
 * Point the demo document at `widgetUrl`: replaces every whole copy of the
 * placeholder in the document's bytes (a .grist file holds it in its action
 * history and in the section Grist loads), in place, keeping its length (the
 * rest is padded with an unused query string). A copy cut short (a history
 * entry SQLite split across pages) is left alone: Grist never loads it.
 * Embedded verbatim in the demo page, so it must stay self-contained (400 is
 * DEMO_URL_LENGTH). Returns false when the document holds no whole copy.
 */
export function patchDemoDocument(bytes, widgetUrl) {
  var length = 400
  var prefix = new TextEncoder().encode("https://grist-widget-demo.invalid/?")
  var url = new TextEncoder().encode(widgetUrl + (widgetUrl.indexOf("?") < 0 ? "?" : "&") + "demo=")
  if (url.length > length) throw new Error("demo: widget URL too long for the demo document")
  var next = new Uint8Array(length).fill(0x78) // the "x" padding
  next.set(url)
  var found = false
  search: for (var i = 0; i <= bytes.length - length; i++) {
    for (var j = 0; j < prefix.length; j++) if (bytes[i + j] !== prefix[j]) continue search
    for (j = prefix.length; j < length; j++) if (bytes[i + j] !== 0x78) continue search
    bytes.set(next, i)
    found = true
    i += length - 1
  }
  return found
}

/**
 * Name the demo document's widget section `title`: replaces every whole copy
 * of the title placeholder in the document's bytes, in place, keeping its
 * length (the rest is spaces; a title longer than the placeholder is cut at
 * a character). Embedded verbatim in the demo page, so it must stay
 * self-contained (120 is DEMO_TITLE_LENGTH). Returns false when the
 * document holds no placeholder: a document generated before it keeps the
 * title it was generated with.
 */
export function patchDemoTitle(bytes, title) {
  var length = 120
  var prefix = new TextEncoder().encode("grist-widget-demo-title:")
  var text = new TextEncoder().encode(title)
  if (text.length > length) {
    var cut = length
    while (cut > 0 && (text[cut] & 0xc0) === 0x80) cut--
    text = text.slice(0, cut)
  }
  var next = new Uint8Array(length).fill(0x20)
  next.set(text)
  var found = false
  search: for (var i = 0; i <= bytes.length - length; i++) {
    for (var j = 0; j < prefix.length; j++) if (bytes[i + j] !== prefix[j]) continue search
    for (j = prefix.length; j < length; j++) if (bytes[i + j] !== 0x20) continue search
    bytes.set(next, i)
    found = true
    i += length - 1
  }
  return found
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/**
 * The demo page. `widget` is the widget's URL relative to the page ("../"
 * for a widget's own <channel>/demo/), `gristStatic` where grist-static is
 * served from.
 */
export function demoPageHtml({ title, widget = "../", gristStatic = GRIST_STATIC_BASE }) {
  const config = JSON.stringify({ title: `${title} — demo`, section: title, widget }).replace(/</g, "\\u003c")
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — demo</title>
<!-- Generated by create-grist-widget: the widget in a real Grist, from static files. Changes are not saved. -->
<script src="${escapeHtml(gristStatic)}latest.js"></script>
</head>
<body>
<script>
${patchDemoDocument.toString()}
${patchDemoTitle.toString()}
(async function () {
  var config = ${config}
  var bytes = new Uint8Array(await (await fetch("demo.grist")).arrayBuffer())
  patchDemoDocument(bytes, new URL(config.widget, location.href).href)
  patchDemoTitle(bytes, config.section)
  bootstrapGrist({ initialFile: URL.createObjectURL(new Blob([bytes])), name: config.title, singlePage: true })
})()
</script>
</body>
</html>
`
}
