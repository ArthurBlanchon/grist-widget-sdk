import { useEffect } from "react"

/** The page's title and description. */
export type UseWidgetMetadataInput = {
  title: string
  description: string
}

/**
 * Sets the page's title and its description meta tags (Open Graph and
 * Twitter included) when the component mounts and whenever `input` changes;
 * nothing is restored on unmount. `mountGristWidget()` does this from the
 * declaration's title and description.
 */
export function usePageMetadata(input?: UseWidgetMetadataInput | null) {
  useEffect(() => {
    if (!input) return

    const { title, description } = input
    const canonicalUrl = window.location.href

    document.title = title
    setMetaTag("name", "title", title)
    setMetaTag("name", "description", description)
    setMetaTag("property", "og:title", title)
    setMetaTag("property", "og:description", description)
    setMetaTag("property", "og:type", "website")
    setMetaTag("property", "og:url", canonicalUrl)
    setMetaTag("name", "twitter:card", "summary")
    setMetaTag("name", "twitter:title", title)
    setMetaTag("name", "twitter:description", description)

  }, [input])
}

function setMetaTag(key: "name" | "property", value: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(
    `meta[${key}="${value}"]`
  )
  if (!meta) {
    meta = document.createElement("meta")
    meta.setAttribute(key, value)
    document.head.appendChild(meta)
  }
  meta.setAttribute("content", content)
}

const warned = { useWidgetMetadata: false }

function warnDeprecated(): void {
  if (warned.useWidgetMetadata || !isDevelopment()) return
  warned.useWidgetMetadata = true
  console.warn(
    "grist-widget-sdk: useWidgetMetadata() is deprecated: mountGristWidget() sets the page's title and meta tags from the declaration's title and description. Remove the call."
  )
}

/**
 * Deprecated: `mountGristWidget()` sets the page's title and meta tags from
 * the declaration. Sets the page's title and its description meta tags.
 *
 * @deprecated `mountGristWidget()` sets them from the declaration's `title`
 * and `description`: remove the call. Removed in a later release.
 */
export function useWidgetMetadata(input?: UseWidgetMetadataInput | null) {
  useEffect(warnDeprecated, [])
  usePageMetadata(input)
}

// Typed here: the SDK doesn't depend on Node's types.
declare const process: { env: Record<string, string | undefined> }

/**
 * Development, as the bundler sees it. Bundlers replace the literal
 * `process.env.NODE_ENV`; where nothing does, `process` is undefined and
 * nothing is logged.
 */
function isDevelopment(): boolean {
  try {
    return process.env.NODE_ENV !== "production"
  } catch {
    return false
  }
}
