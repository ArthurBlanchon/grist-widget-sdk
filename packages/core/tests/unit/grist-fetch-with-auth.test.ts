import { afterEach, describe, expect, it, vi } from "vitest"

import {
  clearGristAccessTokenCache,
  fetchWithGristAuth,
} from "../../src/sdk/helpers/grist-fetch-with-auth"
import type { GristDocApi } from "../../src/sdk/types"

describe("fetchWithGristAuth", () => {
  afterEach(() => {
    clearGristAccessTokenCache()
    vi.unstubAllGlobals()
  })

  it("uses auth query param for POST (not Authorization header)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("42", { status: 200, headers: { "Content-Type": "application/json" } })
    )
    vi.stubGlobal("fetch", fetchMock)

    const docApi = {
      getAccessToken: vi.fn().mockResolvedValue({
        token: "test-token",
        baseUrl: "https://grist.example/o/docs/api/docs/doc1",
      }),
    } satisfies Pick<GristDocApi, "getAccessToken"> as GristDocApi

    const form = new FormData()
    form.append("upload", new Blob(["hi"]), "a.txt")

    await fetchWithGristAuth(docApi, "/attachments", {
      method: "POST",
      body: form,
      headers: { "X-Requested-With": "XMLHttpRequest" },
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toContain("auth=test-token")
    expect(calledUrl).toContain("/attachments")
    const headers = new Headers(init.headers)
    expect(headers.has("Authorization")).toBe(false)
    expect(headers.get("X-Requested-With")).toBe("XMLHttpRequest")
  })

  it("uses auth query param for GET", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const docApi = {
      getAccessToken: vi.fn().mockResolvedValue({
        token: "ro-token",
        baseUrl: "https://grist.example/o/docs/api/docs/doc1",
      }),
    } satisfies Pick<GristDocApi, "getAccessToken"> as GristDocApi

    await fetchWithGristAuth(docApi, "/tables/Foo/records", { readOnly: true })

    const [calledUrl] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toContain("auth=ro-token")
  })

  it("never sends the token to another origin", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const docApi = {
      getAccessToken: vi.fn().mockResolvedValue({
        token: "secret-token",
        baseUrl: "https://grist.example/o/docs/api/docs/doc1",
      }),
    } satisfies Pick<GristDocApi, "getAccessToken"> as GristDocApi

    await expect(fetchWithGristAuth(docApi, "https://attacker.example/collect")).rejects.toThrow(
      /refusing to send the Grist access token to https:\/\/attacker\.example/
    )
    expect(fetchMock).not.toHaveBeenCalled()

    await fetchWithGristAuth(docApi, "https://grist.example/o/docs/api/docs/doc1/tables")
    const [calledUrl] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toContain("auth=secret-token")
  })
})
