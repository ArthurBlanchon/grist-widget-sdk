import assert from "node:assert/strict"
import { test } from "node:test"

import { changesetText, pullRequestNumbers, shippedDependenciesChanged } from "./routine-changeset.mjs"

test("pull request numbers come from squash-merge subjects, once each", () => {
  assert.deepEqual(
    pullRequestNumbers(["build(deps): bump vite (#21)", "chore: a hand commit", "bump the routine group (#18)", "again (#21)"]),
    [18, 21]
  )
})

test("only shipped dependencies count for the SDK", () => {
  const base = { dependencies: { zod: "^4.6.7" }, devDependencies: { vite: "^8.3.5" } }
  const devOnly = { ...base, devDependencies: { vite: "^8.3.6" } }
  const runtime = { ...base, dependencies: { zod: "^4.7.0" } }
  assert.equal(shippedDependenciesChanged(JSON.stringify(base), JSON.stringify(devOnly)), false)
  assert.equal(shippedDependenciesChanged(JSON.stringify(base), JSON.stringify(runtime)), true)
})

test("no changeset when nothing published moved", () => {
  assert.equal(changesetText({ template: [], sdk: { changed: false } }), null)
})

test("a template update is a create-grist-widget patch naming the pull requests", () => {
  const text = changesetText({ template: [18, 21], sdk: { changed: false } })
  assert.match(text, /^---\n"create-grist-widget": patch\n---\n/)
  assert.match(text, /Dependabot #18, #21/)
  assert.match(text, /Existing widgets get the same updates/)
  assert.doesNotMatch(text, /"grist-widget-sdk"/)
})

test("an SDK runtime dependency update names grist-widget-sdk too", () => {
  const text = changesetText({ template: [18], sdk: { changed: true } })
  assert.match(text, /"grist-widget-sdk": patch\n"create-grist-widget": patch/)
})
