import type { GristDocApi } from "../types"

export type GristAccessToken = {
  token: string
  baseUrl: string
}

type TokenCacheEntry = {
  token: GristAccessToken
  fetchedAt: number
}

const TOKEN_TTL_MS = 45_000
const cache = new Map<string, TokenCacheEntry>()
const inFlight = new Map<string, Promise<GristAccessToken>>()

function cacheKey(readOnly: boolean): string {
  return readOnly ? "ro" : "rw"
}

/**
 * Returns an access token suitable for calling Grist's REST API directly.
 * Tokens are short-lived; results are cached briefly and coalesced per readOnly flag.
 */
export async function getGristAccessToken(
  docApi: GristDocApi,
  options?: { readOnly?: boolean }
): Promise<GristAccessToken> {
  if (!docApi.getAccessToken) {
    throw new Error("getAccessToken is not available on docApi (need higher access level)")
  }

  const readOnly = options?.readOnly ?? false
  const key = cacheKey(readOnly)
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && now - hit.fetchedAt < TOKEN_TTL_MS) {
    return hit.token
  }

  const pending = inFlight.get(key)
  if (pending) return pending

  const next = docApi.getAccessToken({ readOnly }).then((token) => {
    cache.set(key, { token, fetchedAt: Date.now() })
    inFlight.delete(key)
    return token
  })

  inFlight.set(key, next)
  return next
}

/** Clear cached tokens (tests or after auth errors). */
export function clearGristAccessTokenCache(): void {
  cache.clear()
  inFlight.clear()
}

/**
 * `fetch()` against Grist's REST API with the doc access token attached.
 */
export async function fetchWithGristAuth(
  docApi: GristDocApi,
  path: string,
  init?: RequestInit & { readOnly?: boolean }
): Promise<Response> {
  const readOnly = init?.readOnly ?? false
  let token: GristAccessToken
  try {
    token = await getGristAccessToken(docApi, { readOnly })
  } catch (err) {
    clearGristAccessTokenCache()
    throw err
  }

  const isAbsolute = /^https?:\/\//i.test(path)
  const cleanPath = isAbsolute ? path : path.startsWith("/") ? path : `/${path}`

  const url = isAbsolute
    ? new URL(path)
    : new URL(`${token.baseUrl.replace(/\/$/, "")}${cleanPath}`)

  // The token goes into the URL, so it may only go to the Grist instance that
  // issued it. An absolute URL to any other origin (one read from a cell, say)
  // would hand the document's access token to that host.
  const gristOrigin = new URL(token.baseUrl).origin
  if (url.origin !== gristOrigin) {
    throw new Error(
      `fetchWithGristAuth: refusing to send the Grist access token to ${url.origin}; ` +
        `absolute URLs must point at this document's Grist instance (${gristOrigin}). ` +
        `Use plain fetch() for other hosts.`
    )
  }

  // Grist signs widget REST calls with a short-lived `auth` query parameter.
  // Do not send `Authorization: Bearer` from the browser: many Grist deployments
  // omit it from Access-Control-Allow-Headers, which breaks POST (e.g. attachment upload).
  if (!url.searchParams.has("auth")) url.searchParams.set("auth", token.token)

  const headers = new Headers(init?.headers ?? {})
  headers.delete("Authorization")

  const response = await fetch(url.toString(), { ...init, headers })
  if (response.status === 401) {
    clearGristAccessTokenCache()
    const retryToken = await getGristAccessToken(docApi, { readOnly })
    url.searchParams.set("auth", retryToken.token)
    return fetch(url.toString(), { ...init, headers })
  }
  return response
}
