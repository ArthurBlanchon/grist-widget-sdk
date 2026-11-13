import { afterEach, describe, expect, it, vi } from "vitest"

import { clearGristAccessTokenCache } from "../../src/sdk/helpers/grist-fetch-with-auth"
import {
  gristAttachmentCellValue,
  gristAttachmentCellValues,
  mergeGristAttachmentCellValue,
  parseGristAttachmentUploadResponse,
  parseGristAttachmentUploadResponseIds,
  uploadGristAttachment,
} from "../../src/sdk/helpers/grist-attachment-upload"
import type { GristDocApi } from "../../src/sdk/types"

describe("parseGristAttachmentUploadResponseIds", () => {
  it("parses JSON array of ids (Grist REST default)", () => {
    expect(parseGristAttachmentUploadResponseIds("[42]")).toEqual(["42"])
    expect(parseGristAttachmentUploadResponseIds("[101, 102]")).toEqual(["101", "102"])
  })

  it("parses bare numeric id", () => {
    expect(parseGristAttachmentUploadResponseIds("7")).toEqual(["7"])
  })

  it("parses object with id", () => {
    expect(parseGristAttachmentUploadResponseIds('{"id":99}')).toEqual(["99"])
  })

  it("strict mode accepts only JSON array of numbers", () => {
    expect(parseGristAttachmentUploadResponseIds("[42, 43]", { strict: true })).toEqual([
      "42",
      "43",
    ])
    expect(() => parseGristAttachmentUploadResponseIds('{"id":99}', { strict: true })).toThrow()
    expect(() => parseGristAttachmentUploadResponseIds("not-json", { strict: true })).toThrow()
  })
})

describe("parseGristAttachmentUploadResponse", () => {
  it("returns the first id", () => {
    expect(parseGristAttachmentUploadResponse("[42]")).toBe("42")
    expect(parseGristAttachmentUploadResponse("[101, 102]")).toBe("101")
  })
})

describe("gristAttachmentCellValue", () => {
  it("encodes list wire form", () => {
    expect(gristAttachmentCellValue(42)).toEqual(["L", 42])
    expect(gristAttachmentCellValue("42")).toEqual(["L", 42])
  })
})

describe("gristAttachmentCellValues", () => {
  it("encodes multiple ids", () => {
    expect(gristAttachmentCellValues([1, 2])).toEqual(["L", 1, 2])
  })
})

describe("mergeGristAttachmentCellValue", () => {
  it("appends new ids and dedupes", () => {
    expect(mergeGristAttachmentCellValue(["L", 1], [2, 1])).toEqual(["L", 1, 2])
    expect(mergeGristAttachmentCellValue(null, [5])).toEqual(["L", 5])
  })
})

describe("uploadGristAttachment", () => {
  afterEach(() => {
    clearGristAccessTokenCache()
    vi.unstubAllGlobals()
  })

  it("POSTs to /attachments with auth query and X-Requested-With", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("[99]", { status: 200, headers: { "Content-Type": "application/json" } })
    )
    vi.stubGlobal("fetch", fetchMock)

    const docApi = {
      getAccessToken: vi.fn().mockResolvedValue({
        token: "upload-token",
        baseUrl: "https://grist.example/o/docs/api/docs/doc1",
      }),
    } satisfies Pick<GristDocApi, "getAccessToken"> as GristDocApi

    const file = new File(["data"], "doc.pdf", { type: "application/pdf" })
    const result = await uploadGristAttachment(docApi, file)

    expect(result).toEqual({ ids: ["99"], firstId: "99" })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toContain("/attachments")
    expect(calledUrl).toContain("auth=upload-token")
    const headers = new Headers(init.headers)
    expect(headers.get("X-Requested-With")).toBe("XMLHttpRequest")
    expect(headers.has("Authorization")).toBe(false)
    expect(init.method).toBe("POST")
    expect(init.body).toBeInstanceOf(FormData)
  })
})
