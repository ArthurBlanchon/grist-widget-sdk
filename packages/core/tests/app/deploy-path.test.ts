/**
 * `parseDeployPath()` / `deployChannelLabel()` — see /docs/sdk/api/app
 */
import { describe, expect, it } from "vitest"

import { deployChannelLabel, parseDeployPath } from "../../src/app"

describe("parseDeployPath()", () => {
  it.each([
    ["/my-widget/latest/", { kind: "latest" }, "/my-widget/"],
    ["/my-widget/latest", { kind: "latest" }, "/my-widget/"],
    ["/my-widget/dev/", { kind: "dev" }, "/my-widget/"],
    ["/my-widget/v1.2.0/", { kind: "version", version: "1.2.0" }, "/my-widget/"],
    ["/my-widget/v0.0.1-rc.1/", { kind: "version", version: "0.0.1-rc.1" }, "/my-widget/"],
    ["/latest/", { kind: "latest" }, "/"],
    ["/v2.0.0/", { kind: "version", version: "2.0.0" }, "/"],
  ])("reads the channel of %s", (pathname, channel, basePath) => {
    expect(parseDeployPath(pathname)).toEqual({ channel, basePath })
  })

  it("treats a path without a channel segment as latest, at that path", () => {
    expect(parseDeployPath("/my-widget/")).toEqual({ channel: { kind: "latest" }, basePath: "/my-widget/" })
    expect(parseDeployPath("/my-widget")).toEqual({ channel: { kind: "latest" }, basePath: "/my-widget/" })
    expect(parseDeployPath("/")).toEqual({ channel: { kind: "latest" }, basePath: "/" })
  })

  it("doesn't take a segment that only looks like a version for one", () => {
    expect(parseDeployPath("/my-widget/v1/").channel).toEqual({ kind: "latest" })
    expect(parseDeployPath("/my-widget/version/").channel).toEqual({ kind: "latest" })
  })
})

describe("deployChannelLabel()", () => {
  it("labels each channel", () => {
    expect(deployChannelLabel({ kind: "latest" })).toBe("latest")
    expect(deployChannelLabel({ kind: "dev" })).toBe("dev")
    expect(deployChannelLabel({ kind: "version", version: "1.2.0" })).toBe("v1.2.0")
  })
})
