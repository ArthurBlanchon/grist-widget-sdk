/**
 * getAttachmentDownloadUrl puts the document's access token in the URL it
 * builds from an attachment id, usually read from a cell: only a row id may
 * get there, so a crafted cell can't aim the token at another API route.
 */
import { describe, expect, it, vi } from "vitest"

import { getAttachmentDownloadUrl } from "../../src/sdk/helpers/grist-attachment-download"
import type { GristDocApi } from "../../src/sdk/types"

const docApi = (token = "tok") =>
  ({ getAccessToken: vi.fn(async () => ({ token, baseUrl: "https://grist.example/api/docs/doc1", ttlMsecs: 60_000 })) }) as unknown as GristDocApi

describe("getAttachmentDownloadUrl", () => {
  it("builds the download URL for a row id, numeric or string", async () => {
    await expect(getAttachmentDownloadUrl(docApi(), "12")).resolves.toBe(
      "https://grist.example/api/docs/doc1/attachments/12/download?auth=tok"
    )
    await expect(getAttachmentDownloadUrl(docApi(), 7 as unknown as string)).resolves.toBe(
      "https://grist.example/api/docs/doc1/attachments/7/download?auth=tok"
    )
  })

  it("encodes the token", async () => {
    await expect(getAttachmentDownloadUrl(docApi("a+b/c"), "3")).resolves.toBe(
      "https://grist.example/api/docs/doc1/attachments/3/download?auth=a%2Bb%2Fc"
    )
  })

  it("refuses anything but a positive integer, before asking for a token", async () => {
    for (const bad of ["1/../tables", "../records", "1?x=1", "0", "-1", "1.5", "", "abc", "1 2"]) {
      const api = docApi()
      await expect(getAttachmentDownloadUrl(api, bad), bad).rejects.toThrow("is not an attachment id")
      expect(api.getAccessToken).not.toHaveBeenCalled()
    }
  })
})
