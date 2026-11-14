import { mountGristWidget } from "grist-widget-sdk/app"

import "@shared/theme.css"
import * as entry from "./app/App.tsx"

mountGristWidget(entry, { dev: import.meta.env.DEV })
