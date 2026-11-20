// The first release names a "Use this template" copy after its repository
// (deploy.mjs's identity edits): a copy of the template source, and a copy
// of the distribution repository, which was scaffolded as
// grist-widget-template.
import { describe, expect, it } from "vitest"

import { deriveIdentity, personalized } from "../src/deploy.mjs"

const identity = deriveIdentity("Ask-Genial-Widget")

describe("personalized", () => {
  it("names a copy of the template source after its repository", () => {
    expect(personalized("package.json", '{\n  "name": "grist-widget-template-vite",\n  "version": "0.2.23"\n}\n', identity)).toContain('"name": "ask-genial-widget"')
    expect(personalized("README.md", "# grist-widget-template-vite\n\nText.\n", identity)).toBe("# ask-genial-widget\n\nText.\n")
    expect(personalized("index.html", "<title>Grist Widget</title>", identity)).toBe("<title>Ask Genial Widget</title>")
    expect(personalized("src/app/App.tsx", '  title: "Grist Widget Template",\n', identity)).toBe('  title: "Ask Genial Widget",\n')
  })

  it("names a copy of the distribution repository too, keeping its link to the template repository", () => {
    const readme = [
      "# grist-widget-template",
      "",
      "Made from [`grist-widget-template`](https://github.com/ArthurBlanchon/grist-widget-template).",
      "",
    ].join("\n")
    expect(personalized("README.md", readme, identity)).toBe(
      [
        "# ask-genial-widget",
        "",
        "Made from [`grist-widget-template`](https://github.com/ArthurBlanchon/grist-widget-template).",
        "",
      ].join("\n")
    )
    expect(personalized("CHANGELOG.md", "# grist-widget-template\n\n## 0.0.1\n", identity)).toBe("# ask-genial-widget\n\n## 0.0.1\n")
    expect(personalized("package.json", '{\n  "name": "grist-widget-template",\n  "dependencies": {}\n}\n', identity)).toBe(
      '{\n  "name": "ask-genial-widget",\n  "dependencies": {}\n}\n'
    )
    expect(personalized("index.html", "<title>Grist Widget Template</title>", identity)).toBe("<title>Ask Genial Widget</title>")
    expect(
      personalized("public/demo/index.html", '<title>Grist Widget Template — demo</title>\nvar config = {"title":"Grist Widget Template — demo","section":"Grist Widget Template"}', identity)
    ).toBe('<title>Ask Genial Widget — demo</title>\nvar config = {"title":"Ask Genial Widget — demo","section":"Ask Genial Widget"}')
  })

  it("leaves a widget that already has its own name alone", () => {
    const pkg = '{\n  "name": "my-widget",\n  "description": "Built on grist-widget-template"\n}\n'
    expect(personalized("package.json", pkg, identity)).toBe(pkg)
    expect(personalized("README.md", "# my-widget\n", identity)).toBe("# my-widget\n")
    expect(personalized("vite.config.ts", "grist-widget-template-vite", identity)).toBe("grist-widget-template-vite")
  })
})
