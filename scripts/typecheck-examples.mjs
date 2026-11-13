#!/usr/bin/env node
// Type-checks every examples/<id>/ by composing it onto the template and
// running `tsc -b` (the template's own noEmit-configured typecheck) —
// the CI gate `apps/www/content/docs/sdk/index.mdx`
// documents ("hello-world is type-checked on every `pnpm typecheck:examples`
// run"). Replaces the pre-batch-G `pnpm --filter playground build:widgets`
// step (which type-checked apps/playground/src/widgets/** via a second Vite
// config, both gone now examples/** moved out — see batch G,
// docs/history/2026-08-08-execution-plan.md).
//
// Shares one `pnpm install` across all of them (scripts/compose-example.mjs),
// workspace-source SDK resolution — same as www's own build,
// and scripts/build-site.mjs's examples target. Proving a build against the
// *published* SDK is scripts/smoke/create-widget.sh's job (§4 of the plan).

import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { allExtraDependencies, composeExample, overlayExampleSrc } from "./compose-example.mjs"
import { listExampleIds } from "./example-ids.mjs"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function main() {
  const exampleIds = listExampleIds(join(repoRoot, "examples"))

  const scratchDir = mkdtempSync(join(tmpdir(), "grist-widget-typecheck-"))
  try {
    composeExample({
      exampleId: exampleIds[0],
      destDir: scratchDir,
      sdkDependency: `file:${join(repoRoot, "packages/core")}`,
    })
    const pkgPath = join(scratchDir, "package.json")
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
    Object.assign(pkg.dependencies, allExtraDependencies())
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
    execFileSync("pnpm", ["install"], { cwd: scratchDir, stdio: "inherit" })

    for (const id of exampleIds) {
      overlayExampleSrc({ exampleId: id, destDir: scratchDir })
      console.log(`\n-- typechecking ${id}`)
      execFileSync("pnpm", ["exec", "tsc", "-b", "--force"], { cwd: scratchDir, stdio: "inherit" })
    }
    console.log(`\ntypecheck-examples: ${exampleIds.length} examples OK`)
  } finally {
    rmSync(scratchDir, { recursive: true, force: true })
  }
}

main()
