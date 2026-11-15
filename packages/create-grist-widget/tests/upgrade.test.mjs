// `create-grist-widget upgrade` (plan T2): what it may touch, how it merges
// package.json and prunes pnpm age exceptions, when it refuses, and a full
// run against a widget made from the real template source. Real git in real
// tmpdirs, like tests/git-gate.test.mjs. The packed CLI's end to end run is
// in scripts/smoke/create-widget.sh.

import { execFileSync } from "node:child_process"
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"

import {
  mergePackageJson,
  migratedTsconfig,
  parseJsonc,
  pruneAgeExceptions,
  mainFingerprint,
  RETIRED_FILES,
  runUpgrade,
  SDK_TSCONFIGS,
  SHIPPED_MAIN_TSX,
  TEMPLATE_FILE_SINCE,
  TEMPLATE_FILES,
  upgradeRefusal,
} from "../src/upgrade.mjs"

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const TEMPLATE_SOURCE = path.join(REPO_ROOT, "templates/grist-widget-template-vite")

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", env: GIT_ENV, stdio: ["ignore", "pipe", "pipe"] }).trim()
}

const dirs = []
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true })
})

function tmp(prefix) {
  const dir = mkdtempSync(path.join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

function listFiles(root, dir = root) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listFiles(root, full))
    else out.push(path.relative(root, full).split(path.sep).join("/"))
  }
  return out
}

/** The template as the published CLI embeds it: versions stamped the way scripts/build-template.mjs does. */
function embeddedTemplate(cliVersion = "0.9.0") {
  const dir = tmp("cgw-template-")
  cpSync(TEMPLATE_SOURCE, dir, {
    recursive: true,
    filter: (src) => !["node_modules", "dist"].includes(path.basename(src)),
  })
  const pkgPath = path.join(dir, "package.json")
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
  pkg.dependencies["grist-widget-sdk"] = `^${cliVersion}`
  pkg.devDependencies["create-grist-widget"] = `^${cliVersion}`
  pkg.packageManager = "pnpm@11.2.0"
  delete pkg.scripts.prebuild
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")
  return dir
}

/** A widget scaffolded from `templateDir`, committed on main with a dev branch checked out. */
function scaffold(templateDir, { version = "0.9.0" } = {}) {
  const dir = tmp("cgw-widget-")
  cpSync(templateDir, dir, { recursive: true })
  const pkgPath = path.join(dir, "package.json")
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
  pkg.name = "my-widget"
  pkg.createGristWidgetVersion = version
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")
  git(dir, "init", "-q", "-b", "main")
  git(dir, "add", "-A")
  git(dir, "commit", "-q", "-m", "scaffold")
  git(dir, "switch", "-q", "-c", "dev")
  return dir
}

function commitAll(dir, message) {
  git(dir, "add", "-A")
  git(dir, "commit", "-q", "-m", message)
}

const noLookup = () => null

describe("what upgrade may touch", () => {
  // Every file the template ships is either the template's (upgrade
  // rewrites it) or the widget's (never touched): a new template file has to
  // be put in one or the other.
  const WIDGET_STARTER = [
    /^\.gitignore$/,
    /^CHANGELOG\.md$/,
    /^components\.json$/, // shadcn's configuration, the widget's registries included
    /^README\.md$/,
    /^index\.html$/,
    /^package\.json$/,
    /^pnpm-workspace\.yaml$/,
    /^public\//,
    /^src\/app\//,
    /^src\/components\/ui\//,
    /^src\/index\.css$/,
    /^tsconfig\.(app|node)\.json$/, // SDK_TSCONFIGS: switched once, then the widget's
  ]

  it("classifies every template file", () => {
    const unclassified = listFiles(TEMPLATE_SOURCE).filter(
      (file) => !TEMPLATE_FILES.includes(file) && !WIDGET_STARTER.some((re) => re.test(file))
    )
    expect(unclassified).toEqual([])
    for (const file of TEMPLATE_FILES) expect(existsSync(path.join(TEMPLATE_SOURCE, file)), file).toBe(true)
    for (const file of TEMPLATE_FILES) expect(WIDGET_STARTER.some((re) => re.test(file)), file).toBe(false)
  })

  it("lists only files the template no longer ships as retired", () => {
    for (const file of RETIRED_FILES) expect(existsSync(path.join(TEMPLATE_SOURCE, file)), file).toBe(false)
  })

  it("matches the list on the Upgrading a widget page", () => {
    const page = readFileSync(path.join(REPO_ROOT, "apps/www/content/docs/cli/upgrading.mdx"), "utf8")
    const section = page.slice(page.indexOf("## The template's files"), page.indexOf("## Template changes"))
    const listed = [...section.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((p) => TEMPLATE_FILES.includes(p) || /\.\w+$/.test(p))
    for (const file of TEMPLATE_FILES) expect(listed, file).toContain(file)
  })
})

describe("mergePackageJson", () => {
  const template = {
    scripts: { build: "tsc -b && vite build", test: "vitest run" },
    dependencies: { "grist-widget-sdk": "^0.3.28", react: "^19.3.1" },
    devDependencies: { vite: "^8.3.5", typescript: "~6.0.3", "create-grist-widget": "^0.3.28" },
    packageManager: "pnpm@11.2.0",
  }

  it("applies the template's scripts and raises its dependencies, keeping the widget's own", () => {
    const widget = {
      name: "my-widget",
      version: "1.4.0",
      scripts: { build: "vite build", deploy: "custom" },
      dependencies: { "grist-widget-sdk": "^0.2.15", react: "^19.4.0", leaflet: "^1.9.4" },
      devDependencies: { vite: "^7.1.0", typescript: "~7.0.2" },
      packageManager: "pnpm@11.0.0",
      createGristWidgetVersion: "0.2.15",
    }
    const { pkg, changes } = mergePackageJson(widget, template, "0.3.28")
    expect(pkg.name).toBe("my-widget")
    expect(pkg.version).toBe("1.4.0")
    expect(pkg.scripts).toEqual({ build: "tsc -b && vite build", deploy: "custom", test: "vitest run" })
    // Raised where the widget allows older versions, kept where it is ahead.
    expect(pkg.dependencies).toEqual({ "grist-widget-sdk": "^0.3.28", react: "^19.4.0", leaflet: "^1.9.4" })
    expect(pkg.devDependencies).toEqual({ vite: "^8.3.5", typescript: "~7.0.2", "create-grist-widget": "^0.3.28" })
    expect(pkg.packageManager).toBe("pnpm@11.2.0")
    expect(pkg.createGristWidgetVersion).toBe("0.3.28")
    expect(changes).toContain('scripts.build: "vite build" -> "tsc -b && vite build"')
    expect(changes).toContain("devDependencies.create-grist-widget: added ^0.3.28")
    expect(changes).toContain("dependencies.grist-widget-sdk: ^0.2.15 -> ^0.3.28")
    expect(widget.scripts.build).toBe("vite build") // the input is left alone
  })

  it("keeps a dependency where the widget put it, and ranges that aren't plain semver", () => {
    const widget = {
      dependencies: { vite: "^7.0.0" },
      devDependencies: { "grist-widget-sdk": "file:../sdk.tgz", "create-grist-widget": "workspace:^" },
    }
    const { pkg } = mergePackageJson(widget, template, "0.3.28")
    expect(pkg.dependencies.vite).toBe("^8.3.5")
    expect(pkg.devDependencies.vite).toBeUndefined()
    expect(pkg.devDependencies["grist-widget-sdk"]).toBe("file:../sdk.tgz")
    expect(pkg.dependencies["grist-widget-sdk"]).toBeUndefined()
    expect(pkg.devDependencies["create-grist-widget"]).toBe("workspace:^")
  })

  it("changes nothing on a widget already on that template", () => {
    const widget = { ...structuredClone(template), name: "w", createGristWidgetVersion: "0.3.28" }
    expect(mergePackageJson(widget, template, "0.3.28").changes).toEqual([])
  })

  it("leaves another package manager alone, and adds pnpm where none is set", () => {
    expect(mergePackageJson({ packageManager: "yarn@4.0.0" }, template, "0.3.28").pkg.packageManager).toBe("yarn@4.0.0")
    expect(mergePackageJson({}, template, "0.3.28").pkg.packageManager).toBe("pnpm@11.2.0")
  })
})

describe("pruneAgeExceptions", () => {
  const now = new Date("2026-11-03T12:00:00Z")
  const published = {
    "grist-widget-sdk@0.3.27": "2026-11-01T17:05:03Z", // 43 h before `now`
    "create-grist-widget@0.3.27": "2026-11-01T17:04:53Z",
    "grist-widget-sdk@0.3.28": "2026-11-03T08:00:00Z", // 4 h before `now`
  }
  const publishedAt = (name, version) => {
    const at = published[`${name}@${version}`]
    return at ? new Date(at) : null
  }

  it("never looks up a name that isn't an npm package name (it would reach a shell on Windows)", () => {
    const asked = []
    const lookup = (name, version) => {
      asked.push(name)
      return publishedAt(name, version)
    }
    const yaml = [
      "minimumReleaseAgeExclude:",
      '  - "x&calc@1.0.0"',
      "  - grist-widget-sdk@0.3.27",
      "",
    ].join("\n")
    const result = pruneAgeExceptions(yaml, { publishedAt: lookup, now })
    expect(asked).toEqual(["grist-widget-sdk"])
    expect(result.removed).toEqual(["grist-widget-sdk@0.3.27"])
    expect(result.yaml).toContain("x&calc@1.0.0")
  })

  it("drops the versions older than a day, and the key once none is left", () => {
    const yaml = [
      "allowBuilds:",
      "  esbuild: true",
      "minimumReleaseAgeExclude:",
      "  - create-grist-widget@0.3.27",
      "  - grist-widget-sdk@0.3.27",
      "",
    ].join("\n")
    const result = pruneAgeExceptions(yaml, { publishedAt, now })
    expect(result.yaml).toBe("allowBuilds:\n  esbuild: true\n")
    expect(result.removed).toEqual(["create-grist-widget@0.3.27", "grist-widget-sdk@0.3.27"])
  })

  it("keeps recent versions, unknown ones, and entries naming no exact version", () => {
    const yaml = [
      "minimumReleaseAgeExclude:",
      "  - grist-widget-sdk@0.3.27 || 0.3.28",
      "  - create-grist-widget@0.3.27",
      "  - left-pad@1.3.0",
      "  - '@my-org/*'",
      "# trailing comment",
      "",
    ].join("\n")
    const result = pruneAgeExceptions(yaml, { publishedAt, now })
    expect(result.yaml).toBe(
      ["minimumReleaseAgeExclude:", "  - grist-widget-sdk@0.3.28", "  - left-pad@1.3.0", "  - '@my-org/*'", "# trailing comment", ""].join("\n")
    )
    expect(result.removed).toEqual(["grist-widget-sdk@0.3.27", "create-grist-widget@0.3.27"])
    expect(result.unknown).toEqual(["left-pad@1.3.0"])
  })

  it("reads a flow-style list, and the minimumReleaseAge the file sets", () => {
    const yaml = "minimumReleaseAge: 4320\nminimumReleaseAgeExclude: [grist-widget-sdk@0.3.27, 'create-grist-widget@0.3.27']\n"
    // Three days: 0.3.27 is still too recent.
    expect(pruneAgeExceptions(yaml, { publishedAt, now }).yaml).toBe(yaml)
    const later = new Date("2026-11-05T12:00:00Z")
    expect(pruneAgeExceptions(yaml, { publishedAt, now: later }).yaml).toBe("minimumReleaseAge: 4320\n")
  })

  it("leaves a file without exceptions as it is", () => {
    const yaml = "allowBuilds:\n  esbuild: true\n"
    expect(pruneAgeExceptions(yaml, { publishedAt, now })).toEqual({ yaml, removed: [], unknown: [] })
  })
})

describe("tsconfig migration", () => {
  // A tsconfig.app.json from before the SDK shipped its compiler settings
  // (world-map's, trimmed): no `extends`, comments, a widget-specific type.
  const OLD_APP = `{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "types": ["vite/client", "geojson"],
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
    },
  },
  "include": ["src"]
}
`
  const templateApp = readFileSync(path.join(TEMPLATE_SOURCE, "tsconfig.app.json"), "utf8")

  it("reads tsconfig's JSON with comments and trailing commas", () => {
    expect(parseJsonc(OLD_APP).compilerOptions.types).toEqual(["vite/client", "geojson"])
    expect(parseJsonc('{ "a": "// not a comment", /* c */ "b": [1,], }')).toEqual({ a: "// not a comment", b: [1] })
  })

  it("switches a config that extends nothing to the template's, keeping its types", () => {
    const migrated = migratedTsconfig(OLD_APP, templateApp)
    expect(migrated.types).toEqual(["vite/client", "geojson"])
    const parsed = parseJsonc(migrated.content)
    expect(parsed.extends).toBe("grist-widget-sdk/tsconfig/app.json")
    expect(parsed.compilerOptions.types).toEqual(["vite/client", "geojson"])
    expect(migrated.content.replace('"types": ["vite/client", "geojson"]', '"types": ["vite/client"]')).toBe(templateApp)
  })

  it("leaves one that extends a base alone, and says when one can't be read", () => {
    expect(migratedTsconfig(templateApp.replace('"vite/client"', '"vite/client", "geojson"'), templateApp)).toBeNull()
    expect(migratedTsconfig('{ "extends": "@tsconfig/strictest" }', templateApp)).toBeNull()
    expect(migratedTsconfig("{ not json", templateApp)).toEqual({ unreadable: true })
  })

  it("lists the files the template ships", () => {
    for (const file of SDK_TSCONFIGS) expect(existsSync(path.join(TEMPLATE_SOURCE, file)), file).toBe(true)
  })
})

describe("upgradeRefusal", () => {
  const cli = { cliVersion: "0.9.0" }

  it("allows a clean widget on dev", () => {
    expect(upgradeRefusal(scaffold(embeddedTemplate()), cli)).toBeNull()
  })

  it("refuses outside a git repository", () => {
    const dir = tmp("cgw-nogit-")
    cpSync(embeddedTemplate(), dir, { recursive: true })
    expect(upgradeRefusal(dir, cli)?.reason).toBe("no-repo")
  })

  it("refuses a directory that isn't a widget", () => {
    const dir = tmp("cgw-other-")
    writeFileSync(path.join(dir, "package.json"), '{ "name": "other" }\n')
    git(dir, "init", "-q", "-b", "dev")
    expect(upgradeRefusal(dir, cli)?.reason).toBe("not-a-widget")
  })

  it("refuses to run on main", () => {
    const dir = scaffold(embeddedTemplate())
    git(dir, "switch", "-q", "main")
    expect(upgradeRefusal(dir, cli)?.reason).toBe("on-main")
  })

  it("refuses a dirty working tree", () => {
    const dir = scaffold(embeddedTemplate())
    appendFileSync(path.join(dir, "src/app/App.tsx"), "// wip\n")
    expect(upgradeRefusal(dir, cli)?.reason).toBe("dirty")
  })

  it("refuses a widget still in src/App.tsx, and one with no src/app/App.tsx", () => {
    const old = scaffold(embeddedTemplate())
    git(old, "mv", "src/app/App.tsx", "src/App.tsx")
    commitAll(old, "old layout")
    const refusal = upgradeRefusal(old, cli)
    expect(refusal?.reason).toBe("old-layout")
    expect(refusal?.message).toContain("/docs/cli/upgrading#widgets-scaffolded-before-srcapp")

    const none = scaffold(embeddedTemplate())
    git(none, "rm", "-q", "src/app/App.tsx")
    commitAll(none, "no entry")
    expect(upgradeRefusal(none, cli)?.reason).toBe("no-entry")
  })

  it("refuses a widget already on a newer template", () => {
    expect(upgradeRefusal(scaffold(embeddedTemplate(), { version: "0.9.1" }), cli)?.reason).toBe("newer-widget")
  })
})

describe("upgradeRefusal: the widget's own files", () => {
  const withTemplate = (templateDir, extra = {}) => ({ cliVersion: "0.9.0", templateDir, ...extra })

  it("lists the current template's src/main.tsx among the shipped ones", () => {
    const main = readFileSync(path.join(TEMPLATE_SOURCE, "src/main.tsx"), "utf8")
    expect(SHIPPED_MAIN_TSX.has(mainFingerprint(main))).toBe(true)
  })

  it("rewrites a shipped src/main.tsx, however it is formatted", () => {
    const template = embeddedTemplate()
    const dir = scaffold(template)
    const main = path.join(dir, "src/main.tsx")
    writeFileSync(main, readFileSync(main, "utf8").replace(/"/g, "'").replace(/\)\n/g, ");\n").replace(/ {2}/g, "\t"))
    commitAll(dir, "formatted")
    expect(upgradeRefusal(dir, withTemplate(template))).toBeNull()
  })

  it("refuses a src/main.tsx changed by the widget, and --force overwrites it", () => {
    const template = embeddedTemplate()
    const dir = scaffold(template)
    const main = path.join(dir, "src/main.tsx")
    writeFileSync(main, readFileSync(main, "utf8").replace("mountGristWidget(entry", "mountGristWidget({ ...entry, Alerts: null }"))
    commitAll(dir, "custom alerts in main.tsx")
    const refusal = upgradeRefusal(dir, withTemplate(template))
    expect(refusal?.reason).toBe("custom-main")
    expect(refusal?.message).toMatch(/src\/app\/App\.tsx/)
    expect(upgradeRefusal(dir, withTemplate(template, { force: true }))).toBeNull()
  })

  it("refuses to write a file a newer template adds over the widget's own", () => {
    const template = embeddedTemplate()
    const dir = scaffold(template, { version: "0.5.0" })
    writeFileSync(path.join(dir, "src/lib/utils.ts"), "export const mine = 1\n")
    commitAll(dir, "a utils of its own")
    const since = { ...TEMPLATE_FILE_SINCE, "src/lib/utils.ts": "0.6.0" }
    const refusal = upgradeRefusal(dir, withTemplate(template, { since }))
    expect(refusal?.reason).toBe("collision")
    expect(refusal?.message).toMatch(/src\/lib\/utils\.ts/)
    expect(upgradeRefusal(dir, withTemplate(template, { since, force: true }))).toBeNull()
    // A widget made with a template that already had the file: the file is the template's.
    expect(upgradeRefusal(scaffold(template, { version: "0.6.0" }), withTemplate(template, { since, cliVersion: "0.9.0" }))).toBeNull()
  })

  it("knows when every template file was added", () => {
    expect(Object.keys(TEMPLATE_FILE_SINCE).sort()).toEqual([...TEMPLATE_FILES].sort())
  })
})

describe("runUpgrade", () => {
  it("rewrites the template's files, deletes unused retired ones, and leaves the widget's alone", () => {
    const oldTemplate = embeddedTemplate("0.8.0")
    const newTemplate = embeddedTemplate("0.9.0")
    const dir = scaffold(oldTemplate, { version: "0.8.0" })

    // What an older template wrote, and the widget's own changes.
    appendFileSync(path.join(dir, "vite.config.ts"), "// older template\n")
    rmSync(path.join(dir, ".github/workflows/ci.yml"))
    mkdirSync(path.join(dir, "scripts"))
    writeFileSync(path.join(dir, "scripts/deploy.mjs"), "// retired, unused\n")
    writeFileSync(path.join(dir, "src/lib/showcase-routing.ts"), "export const x = 1\n")
    writeFileSync(path.join(dir, "src/main.tsx"), 'import "./lib/showcase-routing"\n') // the old main.tsx: rewritten
    writeFileSync(path.join(dir, "src/components/channel-notice.tsx"), "export function ChannelNotice() { return null }\n")
    appendFileSync(path.join(dir, "src/app/App.tsx"), 'import { ChannelNotice } from "@/components/channel-notice"\n')
    writeFileSync(path.join(dir, "src/app/extra.ts"), "export const own = true\n")
    appendFileSync(path.join(dir, "src/components/ui/button.tsx"), "// customized\n")
    appendFileSync(path.join(dir, "src/index.css"), "/* theme */\n")
    const shadcn = JSON.parse(readFileSync(path.join(dir, "components.json"), "utf8"))
    shadcn.registries = { "@kibo-ui": "https://www.kibo-ui.com/r/{name}.json" }
    writeFileSync(path.join(dir, "components.json"), JSON.stringify(shadcn, null, 2) + "\n")
    appendFileSync(path.join(dir, "README.md"), "\nMy notes.\n")
    writeFileSync(path.join(dir, "pnpm-workspace.yaml"), "allowBuilds:\n  esbuild: true\nminimumReleaseAgeExclude:\n  - grist-widget-sdk@0.8.0\n")
    // From before the SDK's base: switched, keeping its types.
    writeFileSync(path.join(dir, "tsconfig.app.json"), '{ "compilerOptions": { "types": ["vite/client", "geojson"], "strict": true } }\n')
    // The widget's own, extending the base: left alone.
    appendFileSync(path.join(dir, "tsconfig.node.json"), "// mine\n")
    const nodeTsconfig = readFileSync(path.join(dir, "tsconfig.node.json"), "utf8")
    // The widget's own smoke test, with a mock the template's doesn't have.
    appendFileSync(path.join(dir, "src/app/App.smoke.test.tsx"), "// vi.mock(...)\n")
    commitAll(dir, "an older widget")
    const widgetFilesBefore = Object.fromEntries(
      [
        "src/app/App.tsx",
        "src/app/App.smoke.test.tsx",
        "src/app/extra.ts",
        "src/components/ui/button.tsx",
        "src/index.css",
        "components.json",
        "README.md",
        "index.html",
      ].map(
        (f) => [f, readFileSync(path.join(dir, f), "utf8")]
      )
    )

    const report = runUpgrade({
      cwd: dir,
      templateDir: newTemplate,
      cliVersion: "0.9.0",
      publishedAt: (name, version) => (version === "0.8.0" ? new Date("2026-01-01T00:00:00Z") : null),
    })

    expect(report.fromVersion).toBe("0.8.0")
    expect(report.written.sort()).toEqual([".github/workflows/ci.yml", "src/main.tsx", "vite.config.ts"])
    for (const file of TEMPLATE_FILES) {
      expect(readFileSync(path.join(dir, file), "utf8"), file).toBe(readFileSync(path.join(newTemplate, file), "utf8"))
    }
    expect(report.deleted.sort()).toEqual(["scripts/deploy.mjs", "src/lib/showcase-routing.ts"])
    expect(existsSync(path.join(dir, "scripts"))).toBe(false) // emptied, so gone too
    expect(report.keptRetired).toEqual([{ file: "src/components/channel-notice.tsx", by: ["src/app/App.tsx"] }])
    for (const [file, content] of Object.entries(widgetFilesBefore)) {
      expect(readFileSync(path.join(dir, file), "utf8"), file).toBe(content)
    }

    const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"))
    expect(pkg.name).toBe("my-widget")
    expect(pkg.createGristWidgetVersion).toBe("0.9.0")
    expect(pkg.dependencies["grist-widget-sdk"]).toBe("^0.9.0")
    expect(pkg.devDependencies["create-grist-widget"]).toBe("^0.9.0")
    expect(readFileSync(path.join(dir, "pnpm-workspace.yaml"), "utf8")).toBe("allowBuilds:\n  esbuild: true\n")
    expect(report.ageRemoved).toEqual(["grist-widget-sdk@0.8.0"])

    expect(report.tsconfigs).toEqual([{ file: "tsconfig.app.json", types: ["vite/client", "geojson"] }])
    const app = parseJsonc(readFileSync(path.join(dir, "tsconfig.app.json"), "utf8"))
    expect(app.extends).toBe("grist-widget-sdk/tsconfig/app.json")
    expect(app.compilerOptions.types).toEqual(["vite/client", "geojson"])
    expect(readFileSync(path.join(dir, "tsconfig.node.json"), "utf8")).toBe(nodeTsconfig)
  })

  it("rewrites the removed names in the widget's code once the template is on grist-widget-sdk 0.6", () => {
    const old = `import { useGristContext } from "grist-widget-sdk"\nexport const useW = () => useGristContext()\n`
    for (const [version, rewritten] of [
      ["0.6.0", true],
      ["0.5.0", false],
    ]) {
      const template = embeddedTemplate(version)
      const dir = scaffold(template, { version })
      writeFileSync(path.join(dir, "src/app/use-w.ts"), old)
      const report = runUpgrade({ cwd: dir, templateDir: template, cliVersion: version, publishedAt: noLookup })
      const after = readFileSync(path.join(dir, "src/app/use-w.ts"), "utf8")
      if (rewritten) {
        expect(report.codemods).toEqual([{ file: "src/app/use-w.ts", changes: ["useGristContext → useGrist"] }])
        expect(after).toBe(`import { useGrist } from "grist-widget-sdk"\nexport const useW = () => useGrist()\n`)
      } else {
        expect(report.codemods).toEqual([])
        expect(after).toBe(old)
      }
    }
  })

  it("changes nothing on a widget already on this template", () => {
    const template = embeddedTemplate("0.9.0")
    const dir = scaffold(template, { version: "0.9.0" })
    const report = runUpgrade({ cwd: dir, templateDir: template, cliVersion: "0.9.0", publishedAt: noLookup })
    expect(report.written).toEqual([])
    expect(report.deleted).toEqual([])
    expect(report.packageChanges).toEqual([])
    expect(git(dir, "status", "--porcelain")).toBe("")
  })
})
