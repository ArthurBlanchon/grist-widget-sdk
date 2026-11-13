import { mountGristWidget } from "grist-widget-sdk/app"

import "./index.css"
import * as entry from "./app/App.tsx"

// Inside Grist: the widget, behind the SDK's connection screens and alerts,
// in Grist's light/dark theme. Opened anywhere else (`pnpm dev`, a deployed
// URL): a page saying where to see it, never a fake preview, since an
// emulator can't stand in for real Grist (see AGENTS.md). `pnpm test` is the
// local loop to trust.
//
// Everything the widget customises is an export of src/app/App.tsx (its
// `widget` declaration, and optionally `Alerts`, `LocalDevPage`,
// `ReleasePage`), so this file is the same in every widget.
mountGristWidget(entry, { dev: import.meta.env.DEV })
