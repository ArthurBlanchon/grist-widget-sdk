import assert from "node:assert/strict"
import { test } from "node:test"

import { isNotFound, pendingChangesets, releasePlan } from "./release-plan.mjs"

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

test("a changeset merged before the publish ran: version, never publish from a checkout that has changesets", () => {
  const plan = releasePlan({ changesets: ["late.md"], packages: [pkg("grist-widget-sdk", "0.8.0", false), pkg("create-grist-widget", "0.8.0", false)] })
  assert.deepEqual(plan, { versionPr: true, publish: false, unpublished: ["grist-widget-sdk@0.8.0", "create-grist-widget@0.8.0"] })
})

test("a private package never asks for a publish", () => {
  const plan = releasePlan({ changesets: [], packages: [{ name: "x", version: "1.0.0", private: true, onNpm: false }, pkg("grist-widget-sdk", "0.7.0", true)] })
  assert.deepEqual(plan, { versionPr: false, publish: false, unpublished: [] })
})

test("only npm's 404 means unpublished; any other error fails the plan", () => {
  assert.equal(isNotFound("npm error code E404\nnpm error 404 No match found for version 9.9.9"), true)
  assert.equal(isNotFound("npm error 404 Not Found - GET https://registry.npmjs.org/x - Not found"), true)
  assert.equal(isNotFound("npm error code ETIMEDOUT"), false)
  assert.equal(isNotFound("npm error code E503 Service Unavailable"), false)
})
