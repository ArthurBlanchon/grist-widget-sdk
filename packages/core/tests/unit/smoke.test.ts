import { describe, expect, it } from "vitest"
import * as core from "../../src/index"

describe("core package", () => {
  it("loads module exports", () => {
    expect(core).toBeDefined()
  })
})
