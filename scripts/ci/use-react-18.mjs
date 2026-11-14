#!/usr/bin/env node
// CI's React 18 job: switches the workspace from React 19 to React 18 before
// a non-frozen install, so the SDK's build, typecheck and tests run against
// the oldest React its peer range (`>=18`) accepts. Edits files in the CI
// checkout only; nothing is committed.
//
// Usage: node scripts/ci/use-react-18.mjs

import { readFileSync, writeFileSync } from "node:fs"

export const REACT_18 = {
  react: "^18.3.1",
  "react-dom": "^18.3.1",
  "@types/react": "^18.3.12",
  "@types/react-dom": "^18.3.1",
}

/** pnpm-workspace.yaml's overrides, with every React entry on 18. */
export function withReact18Overrides(yaml) {
  let out = yaml
  for (const [name, range] of Object.entries(REACT_18)) {
    const key = name.startsWith("@") ? `'${name}'` : name
    const line = new RegExp(`^(  ${key.replace(/[/@']/g, "\\$&")}): .*$`, "m")
    if (!line.test(out)) throw new Error(`pnpm-workspace.yaml has no override for ${name}`)
    out = out.replace(line, `$1: ${range}`)
  }
  return out
}

/** packages/core/package.json with its React type packages on 18. */
export function withReact18Types(pkg) {
  const next = structuredClone(pkg)
  for (const name of ["@types/react", "@types/react-dom"]) {
    if (!next.devDependencies?.[name]) throw new Error(`packages/core has no devDependency ${name}`)
    next.devDependencies[name] = REACT_18[name]
  }
  return next
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  writeFileSync("pnpm-workspace.yaml", withReact18Overrides(readFileSync("pnpm-workspace.yaml", "utf8")))
  const pkgPath = "packages/core/package.json"
  writeFileSync(pkgPath, JSON.stringify(withReact18Types(JSON.parse(readFileSync(pkgPath, "utf8"))), null, 2) + "\n")
  console.log("React 18: pnpm-workspace.yaml overrides and packages/core's @types switched.")
}
