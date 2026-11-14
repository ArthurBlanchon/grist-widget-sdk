import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { withReact18Overrides, withReact18Types } from "./use-react-18.mjs"

test("every React override in the real pnpm-workspace.yaml moves to 18", () => {
  const out = withReact18Overrides(readFileSync("pnpm-workspace.yaml", "utf8"))
  assert.match(out, /^ {2}react: \^18\.3\.1$/m)
  assert.match(out, /^ {2}react-dom: \^18\.3\.1$/m)
  assert.match(out, /^ {2}'@types\/react': \^18\.3\.12$/m)
  assert.match(out, /^ {2}'@types\/react-dom': \^18\.3\.1$/m)
  assert.doesNotMatch(out, /^ {2}react(-dom)?: \^19/m)
})

test("a missing override is an error, not a silent React 19 run", () => {
  assert.throws(() => withReact18Overrides("overrides:\n  zod: ^4\n"), /no override for react/)
})

test("packages/core's React types move to 18", () => {
  const pkg = withReact18Types(JSON.parse(readFileSync("packages/core/package.json", "utf8")))
  assert.equal(pkg.devDependencies["@types/react"], "^18.3.12")
  assert.equal(pkg.devDependencies["@types/react-dom"], "^18.3.1")
})
