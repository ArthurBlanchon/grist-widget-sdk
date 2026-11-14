// The ESLint configuration of every catalog widget, and of this folder.
// A widget's eslint.config.js re-exports it.
import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "grist", message: "Read Grist through grist-widget-sdk (widget.useGrist()), never the grist global." },
      ],
      // Rendering data as HTML is how a document's content attacks its reader.
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "Catalog widgets never render data as HTML (plan §5).",
        },
        {
          selector: "CallExpression[callee.name='eval']",
          message: "No eval in catalog widgets (plan §5).",
        },
      ],
    },
  },
])
