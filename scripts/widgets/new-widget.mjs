#!/usr/bin/env node
// pnpm new-widget <slug> [--title "Title"] [--category <category>]
//
// Starts a catalog widget in widgets/<slug>/: its package, configuration
// (one line each onto widgets/_shared/), a SPEC.md to fill in first, an App
// with its declaration, English and French messages, a smoke test and a
// first acceptance test. Then: write the spec, then the code, then
// `node scripts/widgets/check-widgets.mjs <slug>` (widgets/AGENTS.md).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { CATEGORIES, WIDGETS_DIR } from "./check-widgets.mjs"

export const SLUG = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

const titleFromSlug = (slug) => slug.split("-").map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(" ")

/** `{ relative path: content }` for a new widget. */
export function widgetFiles({ slug, title = titleFromSlug(slug), category = "visualisation" }) {
  const pilot = JSON.parse(readFileSync(join(WIDGETS_DIR, "kanban-board", "package.json"), "utf8"))
  const pkg = {
    name: `@grist-widgets/${slug}`,
    private: true,
    version: "0.1.0",
    type: "module",
    description: "TODO: what it does, in one sentence (the spec's Job).",
    license: "MIT",
    scripts: pilot.scripts,
    dependencies: pilot.dependencies,
    devDependencies: pilot.devDependencies,
  }
  const json = (v) => `${JSON.stringify(v, null, 2)}\n`
  return {
    "package.json": json(pkg),
    "vite.config.ts": readFileSync(join(WIDGETS_DIR, "kanban-board", "vite.config.ts"), "utf8"),
    "eslint.config.js": readFileSync(join(WIDGETS_DIR, "kanban-board", "eslint.config.js"), "utf8"),
    "tsconfig.json": readFileSync(join(WIDGETS_DIR, "kanban-board", "tsconfig.json"), "utf8"),
    "index.html": readFileSync(join(WIDGETS_DIR, "kanban-board", "index.html"), "utf8").replace(
      "<title>Kanban board</title>",
      `<title>${title}</title>`,
    ),
    "src/main.tsx": readFileSync(join(WIDGETS_DIR, "kanban-board", "src", "main.tsx"), "utf8"),
    "src/vite-env.d.ts": readFileSync(join(WIDGETS_DIR, "kanban-board", "src", "vite-env.d.ts"), "utf8"),
    "SPEC.md": `---
slug: ${slug}
title: ${title}
category: ${category}
status: draft
access: read table
---

# ${title}

## Job

TODO: who uses it, for what, and what Grist does without it.

## Columns

| Column | Type | Required | Use |
| --- | --- | --- | --- |
| Title | Text | yes | TODO |

## Access

\`read table\`: TODO (say why if it becomes \`full\`).

## Acceptance criteria

- **AC-1** Given a row, when the widget opens, its title is shown.

## Out of scope

- TODO

## Demo data

TODO: a few realistic rows.
`,
    "src/app/messages.ts": `import { defineMessages } from "@shared/i18n"

export const messages = defineMessages({
  en: {
    empty: "Select a row.",
  },
  fr: {
    empty: "Sélectionnez une ligne.",
  },
})
`,
    "src/app/App.tsx": `import { defineGristWidget } from "grist-widget-sdk"

import { useT } from "@shared/i18n"

import { messages } from "./messages"

export const widget = defineGristWidget({
  title: ${JSON.stringify(title)},
  description: "TODO: what it does, in one sentence.",
  requiredAccess: "read table",
  columns: [{ name: "Title", type: "Text" }],
})

export default function App() {
  const w = widget.useGrist()
  const t = useT(messages)
  return (
    <main className="flex h-svh flex-col gap-3 bg-background p-4 text-foreground">
      <h1 className="text-lg font-medium">{w.mappedRecord?.Title ?? t("empty")}</h1>
    </main>
  )
}
`,
    "src/app/App.test.tsx": `import "@testing-library/jest-dom/vitest"
import { afterEach, expect, it } from "vitest"
import { cleanup, renderWithGrist, screen } from "grist-widget-sdk/emulator/testing"

import App, { widget } from "./App"

afterEach(() => cleanup())

it("AC-1 shows the row's title", async () => {
  renderWithGrist(<App />, { widget, rows: [{ Title: "First" }] })
  expect(await screen.findByRole("heading", { name: "First" })).toBeInTheDocument()
})
`,
    "src/app/App.smoke.test.tsx": readFileSync(join(WIDGETS_DIR, "kanban-board", "src", "app", "App.smoke.test.tsx"), "utf8"),
  }
}

function main(argv) {
  const opt = (name) => {
    const i = argv.indexOf(name)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const slug = argv.find((a, i) => !a.startsWith("--") && !["--title", "--category"].includes(argv[i - 1]))
  if (!slug || !SLUG.test(slug)) {
    console.error('Usage: pnpm new-widget <slug, like gantt-chart> [--title "Gantt chart"] [--category <category>]')
    process.exit(2)
  }
  const category = opt("--category") ?? "visualisation"
  if (!CATEGORIES.includes(category)) {
    console.error(`--category must be one of ${CATEGORIES.join(", ")}`)
    process.exit(2)
  }
  const dir = join(WIDGETS_DIR, slug)
  if (existsSync(dir)) {
    console.error(`widgets/${slug} already exists`)
    process.exit(1)
  }
  for (const [rel, content] of Object.entries(widgetFiles({ slug, title: opt("--title"), category }))) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), content)
  }
  console.log(`widgets/${slug}/ created. Next:
  1. pnpm install
  2. write widgets/${slug}/SPEC.md (catalog/roadmap.md has its first paragraph)
  3. the code and one test per criterion, then:
     node scripts/widgets/check-widgets.mjs ${slug}
  Add @grist-widgets/${slug} to .changeset/config.json's ignore until widgets have their release train (F2).`)
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2))
