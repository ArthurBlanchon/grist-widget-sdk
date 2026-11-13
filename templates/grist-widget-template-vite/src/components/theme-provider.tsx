// shadcn components (a toaster, a mode toggle) import the theme from here.
// grist-widget-sdk/app owns it: inside Grist the widget follows Grist's
// light/dark theme; on the dev server and the release page, the OS setting,
// a saved choice and the `d` key.
export { useTheme } from "grist-widget-sdk/app"
