import { describe, expect, it, vi } from "vitest"

import { installPlan } from "../src/package-manager.mjs"

describe("installPlan", () => {
  it("installs with pnpm by default, whichever package manager runs the CLI", () => {
    expect(installPlan({ hasPnpm: () => true })).toEqual({ manager: "pnpm" })
  })

  it("installs nothing when pnpm isn't available, rather than falling back to npm", () => {
    expect(installPlan({ hasPnpm: () => false })).toEqual({ skip: "no-pnpm" })
  })

  it("uses an explicit --pm without probing for pnpm", () => {
    const hasPnpm = vi.fn(() => false)
    expect(installPlan({ pm: "npm", hasPnpm })).toEqual({ manager: "npm" })
    expect(hasPnpm).not.toHaveBeenCalled()
  })

  it("skips the install for --no-install, even with --pm", () => {
    const hasPnpm = vi.fn(() => true)
    expect(installPlan({ noInstall: true, pm: "pnpm", hasPnpm })).toEqual({ skip: "no-install" })
    expect(hasPnpm).not.toHaveBeenCalled()
  })
})
