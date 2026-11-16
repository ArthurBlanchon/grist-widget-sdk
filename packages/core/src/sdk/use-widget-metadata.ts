import { useEffect } from "react"

/** The page's title and description. */
export type UseWidgetMetadataInput = {
  title: string
  description: string
}

/**
 * Sets the page's title and its description meta tags (Open Graph and
 * Twitter included) while the component is mounted. `mountGristWidget()`
 * does this from the declaration's title and description.
 */
export function useWidgetMetadata(input?: UseWidgetMetadataInput | null) {
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
