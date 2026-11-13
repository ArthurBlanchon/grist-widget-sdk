// The example widgets: each examples/<id>/ holding a WidgetApp.tsx. The other
// entries there (package.json, vite.config.ts, _ui/, _demos/, node_modules/)
// are the examples' host, not examples.
import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

export function listExampleIds(examplesDir) {
  return readdirSync(examplesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(examplesDir, e.name, "WidgetApp.tsx")))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b))
}
