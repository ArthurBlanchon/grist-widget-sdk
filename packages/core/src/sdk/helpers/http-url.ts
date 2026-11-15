/**
 * `value` as a URL a widget may link to or load from: an absolute `http:` or
 * `https:` URL, normalised, or `undefined`. Use it on every link or source
 * that comes from a document's data, before it reaches an `href` or a `src`.
 *
 * It refuses what a cell can carry to attack the person reading it:
 * `javascript:` and `data:` URLs, other schemes, relative URLs (they would
 * resolve against the widget's own origin), and credentials, which make a
 * link read as one host and go to another (`https://bank.com@evil.example`).
 *
 * ```ts
 * httpUrl(" https://example.com/a b ") // "https://example.com/a%20b"
 * httpUrl("javascript:alert(1)")       // undefined
 * ```
 */
export function httpUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const text = value.trim()
  if (!text) return undefined
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return undefined
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
  if (url.username || url.password) return undefined
  return url.href
}
