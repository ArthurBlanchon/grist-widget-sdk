/**
 * What a widget writes to its options is a draft of its section in Grist,
 * as Grist's sort and filters are: the section's header then shows Grist's
 * Save, which keeps it for everyone, and Revert, which drops it. A widget
 * hears its own write (the options come back) and a Revert (the saved
 * options come back), but not a Save: Grist sends nothing then.
 *
 * `useOptionsDraft` tracks the options this widget wrote, and
 * `OptionsDraftNotice` says to click Save while they are the section's
 * options: until a Revert or another change replaces them, the reader hides
 * it (after a Save, which the widget can't see), or the page reloads.
 */
import { useState } from "react"
import { X } from "lucide-react"

import { defineMessages, useT } from "@shared/i18n"
import { Button } from "@shared/ui/button"

const messages = defineMessages({
  en: {
    draft: "Settings changed: click Save at the top of this section to keep them for everyone.",
    hide: "Hide this message",
  },
  fr: {
    draft: "Paramètres modifiés : cliquez sur Enregistrer en haut de cette section pour les garder pour tous.",
    hide: "Masquer ce message",
  },
})

type Options = Record<string, unknown> | null | undefined

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * The draft this widget wrote to its options, and whether to say so.
 * `wrote(patch)` after each write; `visible` while every key of the last
 * patch still holds in `options` (a Revert or another change ends it) and
 * the reader hasn't hidden it.
 */
export function useOptionsDraft(options: Options) {
  const [patch, setPatch] = useState<Record<string, unknown> | null>(null)
  const [hidden, setHidden] = useState(false)
  const holds = patch !== null && Object.entries(patch).every(([key, value]) => same(options?.[key], value))
  return {
    visible: holds && !hidden,
    wrote(next: Record<string, unknown>) {
      setPatch(next)
      setHidden(false)
    },
    hide: () => setHidden(true),
  }
}

/** The notice at the top of the widget while its settings are a draft of the section. */
export function OptionsDraftNotice({ visible, hide }: { visible: boolean; hide: () => void }) {
  const t = useT(messages)
  if (!visible) return null
  return (
    <div role="status" className="flex shrink-0 items-start gap-2 border-b bg-accent px-4 py-2 text-sm text-accent-foreground">
      <p className="min-w-0 flex-1">{t("draft")}</p>
      <Button variant="ghost" size="icon-xs" title={t("hide")} onClick={hide}>
        <X aria-hidden />
        <span className="sr-only">{t("hide")}</span>
      </Button>
    </div>
  )
}
