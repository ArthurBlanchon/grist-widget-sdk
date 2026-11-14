#!/usr/bin/env node
// The SDK's API report: one api/<entry>.api.md per public entry point, made
// by API Extractor from the built declarations (dist/, `pnpm build` first).
// The reports are committed, so a change to a public name or type shows in
// review as a change to these files.
//
//   pnpm api:report          rewrite the reports from dist/
//   pnpm api:report --check  fail if dist/ no longer matches them (CI)

import { Extractor, ExtractorConfig } from "@microsoft/api-extractor"
import { existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const check = process.argv.includes("--check")

/** Entry point (package.json export) → its declaration file and report name. */
export const ENTRIES = [
  { entry: ".", dts: "dist/index.d.ts", report: "index" },
  { entry: "./app", dts: "dist/app.d.ts", report: "app" },
  { entry: "./actions", dts: "dist/actions.d.ts", report: "actions" },
  { entry: "./emulator", dts: "dist/emulator.d.ts", report: "emulator" },
  { entry: "./emulator/testing", dts: "dist/emulator/testing.d.ts", report: "emulator-testing" },
]

const reportFolder = path.join(root, "api")
const tempFolder = path.join(root, "node_modules", ".api-report")
mkdirSync(reportFolder, { recursive: true })
mkdirSync(tempFolder, { recursive: true })

let failed = false
for (const { entry, dts, report } of ENTRIES) {
  const mainEntryPointFilePath = path.join(root, dts)
  if (!existsSync(mainEntryPointFilePath)) {
    console.error(`${dts} is missing: run \`pnpm build\` first.`)
    process.exit(1)
  }
  const config = ExtractorConfig.prepare({
    configObject: {
      projectFolder: root,
      mainEntryPointFilePath,
      // The built declarations only: tsconfig.json includes src/, whose .ts
      // files API Extractor refuses to analyse.
      compiler: {
        overrideTsconfig: {
          compilerOptions: {
            target: "ES2020",
            lib: ["ES2020", "ES2022.Error", "DOM", "DOM.Iterable"],
            module: "ESNext",
            moduleResolution: "bundler",
            jsx: "react-jsx",
            strict: true,
            skipLibCheck: true,
          },
          include: ["dist/**/*.d.ts"],
        },
      },
      apiReport: {
        enabled: true,
        reportFileName: `${report}.api.md`,
        reportFolder,
        reportTempFolder: tempFolder,
      },
      docModel: { enabled: false },
      dtsRollup: { enabled: false },
      tsdocMetadata: { enabled: false },
      messages: {
        // Report content only: missing release tags, forgotten exports and
        // TSDoc style are not this check's business.
        extractorMessageReporting: {
          default: { logLevel: "none" },
          "ae-wrong-input-file-type": { logLevel: "error" },
        },
        tsdocMessageReporting: { default: { logLevel: "none" } },
        compilerMessageReporting: { default: { logLevel: "warning" } },
      },
    },
    configObjectFullPath: path.join(root, "api", `${report}.api-extractor.json`),
    packageJsonFullPath: path.join(root, "package.json"),
  })
  const result = Extractor.invoke(config, { localBuild: !check, showVerboseMessages: false })
  if (!result.succeeded || (check && result.apiReportChanged)) {
    failed = true
    console.error(
      `::error::The API of grist-widget-sdk${entry === "." ? "" : entry.slice(1)} changed (api/${report}.api.md). ` +
        "Run `pnpm --filter grist-widget-sdk build && pnpm --filter grist-widget-sdk api:report` and commit the report: " +
        "the diff is the API change reviewers see."
    )
  } else {
    console.log(`api/${report}.api.md ${result.apiReportChanged ? "updated" : "unchanged"}`)
  }
}
process.exit(failed ? 1 : 0)
