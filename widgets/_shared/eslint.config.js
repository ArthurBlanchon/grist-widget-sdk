// The ESLint configuration of every catalog widget, and of this folder.
// A widget's eslint.config.js re-exports it.
import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  globalIgnores(["dist", "plugin-api"]),
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
        // A link or a source from data can be javascript: or data:. Every
        // computed href or src goes through grist-widget-sdk's httpUrl(),
        // which keeps http(s) only (plan to 0.8.0, §3). A URL the widget
        // makes itself (a blob: of a fetched attachment, a mailto:) says so
        // with an eslint-disable comment and its reason, for review.
        {
          selector:
            // On HTML elements only (a lowercase tag): a component's `data` or
            // `src` prop (Recharts' data) is no URL.
            "JSXOpeningElement[name.name=/^[a-z]/] > JSXAttribute[name.name=/^(href|src|srcSet|action|formAction|poster|data|xlinkHref)$/] > JSXExpressionContainer > :not(CallExpression[callee.name='httpUrl'], Literal, JSXEmptyExpression)",
          message:
            "A computed href or src goes through httpUrl() from grist-widget-sdk. A URL the widget made itself: disable this line, with the reason.",
        },
        // srcDoc renders its value as a page: data as HTML.
        {
          selector: "JSXAttribute[name.name='srcDoc']",
          message: "Catalog widgets never render data as HTML: no srcDoc (plan §5).",
        },
        // The rule above trusts the name: only the SDK's httpUrl may carry it.
        {
          selector: "VariableDeclarator[id.name='httpUrl'], FunctionDeclaration[id.name='httpUrl']",
          message: "httpUrl is grist-widget-sdk's: import it, don't declare one.",
        },
      ],
    },
  },
])
