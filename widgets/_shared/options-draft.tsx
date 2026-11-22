/**
 * What a widget writes to its options is a draft of its section in Grist,
 * as Grist's sort and filters are: the section's header then shows Grist's
 * Save, which keeps it for everyone, and Revert, which drops it. A widget
 * hears its own write (the options come back) and a Revert (the saved
 * options come back), but not a Save: Grist sends nothing then.
 *
 * In a widget's configuration view: `useOptionsDraft` tracks what the view
 * wrote, and `OptionsDraftNotice`, a warning, says to click Save while the
 * section still holds it. It goes with a Revert, and with the view: the
 * hook lives in the view, so closing it forgets the write.
 */
import { useState } from "react"
import { TriangleAlert } from "lucide-react"

import { defineMessages, useT } from "@shared/i18n"
import { Alert, AlertDescription } from "@shared/ui/alert"

const messages = defineMessages({
  en: {
    draft: "Settings changed: click Save at the top of this section to keep them for everyone.",
  },
  fr: {
    draft: "Paramètres modifiés : cliquez sur Enregistrer en haut de cette section pour les garder pour tous.",
  },
})

type Options = Record<string, unknown> | null | undefined

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * What the view wrote, and whether to say so: `wrote(patch)` after each
 * write; `visible` while every key of the last patch still holds in
 * `options` (a Revert, or another change, ends it).
 */
export function useOptionsDraft(options: Options) {
  const [patch, setPatch] = useState<Record<string, unknown> | null>(null)
  const visible = patch !== null && Object.entries(patch).every(([key, value]) => same(options?.[key], value))
  return { visible, wrote: (next: Record<string, unknown>) => setPatch(next) }
}

/** The warning, in the configuration view, while its settings are a draft of the section. */
export function OptionsDraftNotice({ visible }: { visible: boolean }) {
  const t = useT(messages)
  if (!visible) return null
  return (
    <Alert variant="warning" role="status">
      <TriangleAlert aria-hidden />
      <AlertDescription>{t("draft")}</AlertDescription>
    </Alert>
  )
}
