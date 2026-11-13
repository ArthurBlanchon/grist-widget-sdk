import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    app: "src/app/index.ts",
    emulator: "src/emulator/index.ts",
    "emulator/testing": "src/emulator/testing/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "@testing-library/react"],
})
