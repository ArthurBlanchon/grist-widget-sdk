import { useState, type ReactNode } from "react"

import { GristContextProvider, newConnection, type UseGristOptions } from "../use-grist"

export type GristWidgetProviderProps = {
  /** Read once, at mount: what the widget asks Grist for. */
  options?: UseGristOptions
  children: ReactNode
}

/**
 * Connects to Grist for the widgets below it: `useGrist()` under it reads this
 * connection. `mountGristWidget()` renders it; render it yourself only for a
 * page that manages its own React root.
 */
export function GristWidgetProvider({ options, children }: GristWidgetProviderProps) {
  const [connection] = useState(() => newConnection(options))
  return <GristContextProvider value={connection}>{children}</GristContextProvider>
}
