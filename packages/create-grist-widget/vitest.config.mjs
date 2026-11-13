import { defineConfig } from "vitest/config"

// Plain node environment, no jsdom/React surface here — this package is a
// CLI, not a UI. Matches this package's existing all-.mjs/no-TypeScript
// style (no reason to introduce a TS toolchain just for a config file).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.mjs"],
  },
})
