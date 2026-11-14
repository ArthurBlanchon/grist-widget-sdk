/**
 * The Vite (and Vitest) configuration of every catalog widget. A widget's
 * vite.config.ts is one line:
 *
 *   export default widgetViteConfig(import.meta.dirname)
 *
 * so a build or test setting changes once, for the whole catalog.
 */
import path from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import type { UserConfig } from "vite"

const shared = import.meta.dirname

export function widgetViteConfig(widgetDir: string): UserConfig & { test: Record<string, unknown> } {
  return {
    // Relative URLs: a released version works at any path, on both origins.
    base: "./",
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@shared": shared,
        "@": path.join(widgetDir, "src"),
      },
      // One React for the widget and the shared components.
      dedupe: ["react", "react-dom"],
    },
    test: {
      environment: "jsdom",
      root: widgetDir,
    },
  }
}
