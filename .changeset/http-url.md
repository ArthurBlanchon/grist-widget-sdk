---
"grist-widget-sdk": minor
---

`httpUrl(value)`: a link or a source from a document's data, as an absolute `http:` or `https:` URL, or `undefined`. It refuses `javascript:`, `data:` and other schemes, relative URLs, and credentials that disguise the host (`https://bank.example@evil.example`). Pass every URL that comes from a cell through it before it reaches an `href` or a `src`.
