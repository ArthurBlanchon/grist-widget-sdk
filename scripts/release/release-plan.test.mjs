import assert from "node:assert/strict"
import { test } from "node:test"

import { pendingChangesets, releasePlan } from "./release-plan.mjs"

const pkg = (name, version, onNpm) => ({ name, version, onNpm })

test("the README and config are not changesets", () => {
  assert.deepEqual(pendingChangesets(["README.md", "config.json", "alert-contrast.md", "readme.md"]), ["alert-contrast.md"])
})

test("pending changesets: the Version Packages pull request, no publish", () => {
  const plan = releasePlan({ changesets: ["a.md"], packages: [pkg("grist-widget-sdk", "0.7.0", true), pkg("create-grist-widget", "0.7.0", true)] })
  assert.deepEqual(plan, { versionPr: true, publish: false, unpublished: [] })
})

test("the Version Packages pull request merged: publish what npm doesn't have", () => {
  const plan = releasePlan({ changesets: [], packages: [pkg("grist-widget-sdk", "0.8.0", false), pkg("create-grist-widget", "0.8.0", false)] })
  assert.deepEqual(plan, { versionPr: false, publish: true, unpublished: ["grist-widget-sdk@0.8.0", "create-grist-widget@0.8.0"] })
})

test("an ordinary push: nothing to do, so no run waits for an approval", () => {
  const plan = releasePlan({ changesets: [], packages: [pkg("grist-widget-sdk", "0.7.0", true), pkg("create-grist-widget", "0.7.0", true)] })
  assert.deepEqual(plan, { versionPr: false, publish: false, unpublished: [] })
})
