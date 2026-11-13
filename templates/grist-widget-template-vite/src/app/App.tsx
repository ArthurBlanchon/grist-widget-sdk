import { defineGristWidget } from "grist-widget-sdk"

import { Button } from "@/components/ui/button"

/**
 * The widget's declaration: the access it asks for, the columns the user maps
 * in Grist's panel (with their types), its title and description. Everything
 * reads it: `widget.useGrist()` types the records and writes from it,
 * `mountGristWidget()` asks Grist for it, the tests map its columns.
 */
export const widget = defineGristWidget({
  title: "Grist Widget Template",
  description: "Mark the selected task done.",
  requiredAccess: "full",
  columns: [
    { name: "Title", type: "Text" },
    { name: "Done", type: "Bool" },
  ],
})

export default function App() {
  const w = widget.useGrist()

  if (w.mode === "new-row")
    return <p className="p-6 text-sm">Add the row in Grist, then select it.</p>
  if (w.mode === "empty" || !w.mappedRecord)
    return <p className="p-6 text-sm">Select a task in Grist.</p>

  const { Title, Done } = w.mappedRecord
  return (
    <main className="flex flex-col gap-4 p-6 text-sm">
      <h1 className="text-base font-medium">{Title || "Untitled"}</h1>
      <Button
        className="self-start"
        disabled={w.actionStatus === "running"}
        onClick={() => w.updateRecord({ Done: !Done })}
      >
        {Done ? "Mark as not done" : "Mark as done"}
      </Button>
    </main>
  )
}
