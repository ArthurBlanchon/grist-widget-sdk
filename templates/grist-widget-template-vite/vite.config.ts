import { readFileSync } from "fs"
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
// `vitest/config`'s defineConfig is a superset of vite's own -- same build
// config still works, and it adds the `test` field below. Importing it here
// (rather than a separate vitest.config.ts) means `pnpm test` reuses this
// file's `@` alias and plugins instead of duplicating them.
import { defineConfig } from "vitest/config"

// Read here (Node context) rather than importing package.json into src/ --
// keeps the whole file out of the bundle, exposing only the one field the
// landing page footer needs.
const pkg = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf8"))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  define: {
    __CREATE_GRIST_WIDGET_VERSION__: JSON.stringify(pkg.createGristWidgetVersion ?? null),
  },
  test: {
    environment: "jsdom",
    // A widget with no test file yet reports green, not "No test files
    // found": the template's own tests are the widget's to keep or delete.
    passWithNoTests: true,
  },
})
