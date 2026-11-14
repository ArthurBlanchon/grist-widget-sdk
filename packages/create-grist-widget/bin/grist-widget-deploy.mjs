#!/usr/bin/env node
// grist-widget-deploy — the GitHub Pages deploy steps a widget's
// .github/workflows/deploy.yml runs (plan, place, remove, finalize,
// reset-branches, check-protection). See src/deploy.mjs and
// src/protection-check.mjs for what each one does.
//
// The publish job runs this next to a `contents: write` token, after an
// install with --ignore-scripts, so this file and src/deploy.mjs must import
// node builtins only: no other dependency code may run there
// (tests/deploy-imports.test.mjs).

import {
  finalize,
  placeTarget,
  plan,
  removeDevDir,
  resetBranchesIfFirstRelease,
} from "../src/deploy.mjs"
import { checkProtection } from "../src/protection-check.mjs"
import { appendFileSync } from "node:fs"

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--")) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("--")) out[key] = true
      else {
        out[key] = next
        i++
      }
    } else out._.push(a)
  }
  return out
}

const [cmd, ...rest] = process.argv.slice(2)
const args = parseArgs(rest)

switch (cmd) {
  case "plan": {
    const result = plan(args.site, args.repo, args.event, args.ref, {
      force: !!args.force,
    })
    process.stdout.write(JSON.stringify(result))
    break
  }
  case "place": {
    const res = placeTarget({
      siteDir: args.site,
      channel: args.channel,
      version: args.version,
      distDir: args.dist,
      sha: args.sha,
      ref: args.ref,
      repo: args.repo,
    })
    console.log("placed:", JSON.stringify(res))
    break
  }
  case "remove": {
    const res = removeDevDir(args.site)
    console.log("remove:", JSON.stringify(res))
    break
  }
  case "finalize": {
    const res = finalize({
      siteDir: args.site,
      updateVersions: !!args["update-versions"],
      push: !!args.push,
      commitMessage: args["commit-message"],
      repo: args.repo,
    })
    console.log("finalize:", JSON.stringify(res))
    break
  }
  case "reset-branches": {
    const res = resetBranchesIfFirstRelease(
      args["repo-dir"] || ".",
      args.repo,
      undefined,
      args["owner-repo"] || process.env.GITHUB_REPOSITORY
    )
    console.log("reset-branches:", JSON.stringify(res))
    break
  }
  case "check-protection": {
    const res = await checkProtection({
      ownerRepo: args["owner-repo"] || process.env.GITHUB_REPOSITORY,
      token: process.env.GITHUB_TOKEN,
      firstRelease: !!args["first-release"],
    })
    if (res.note) {
      console.log(res.note)
    } else if (res.missing.length > 0) {
      const text =
        `This repository has no ${res.missing.join(", ")} ruleset: run \`pnpm exec create-grist-widget protect\` ` +
        "(GitHub CLI, admin) to apply the template's .github/rulesets/."
      console.log(`::warning title=Repository not protected::${text}`)
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Repository not protected\n\n${text}\n`)
      if (res.issue) console.log(`check-protection: opened ${res.issue}`)
    } else {
      console.log("check-protection: main, dev and tags rulesets are in place")
    }
    break
  }
  default:
    console.error(
      `grist-widget-deploy: unknown subcommand "${cmd || "(none)"}". ` +
        "Expected plan, place, remove, finalize, reset-branches or check-protection."
    )
    process.exit(2)
}
