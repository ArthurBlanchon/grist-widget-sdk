import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { stripTemplateOnly } from "../src/template-only.mjs"

const README = readFileSync(new URL("../../../templates/grist-widget-template-vite/README.md", import.meta.url), "utf8")

describe("stripTemplateOnly", () => {
  it("drops each template-only block and keeps the rest", () => {
    const text = "# W\n\nKeep.\n\n<!-- template-only:start: why -->\nDrop.\n<!-- template-only:end -->\n\n## Next\n"
    expect(stripTemplateOnly(text)).toBe("# W\n\nKeep.\n\n## Next\n")
  })

  it("gives a scaffold the template's README without the template's maintainer notes", () => {
    const out = stripTemplateOnly(README)
    expect(README).toContain("How this template is distributed")
    for (const note of ["How this template is distributed", "Monorepo dev", "### Live preview", "This is the **source** template", "template-only"])
      expect(out).not.toContain(note)
    expect(out).toContain("## Deployment")
    expect(out).toContain("<!-- install-url:start -->")
  })
})
