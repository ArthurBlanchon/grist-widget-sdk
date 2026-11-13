import { defineGristWidget } from "grist-widget-sdk"

import { Button } from "@/components/ui/button"

export const widget = defineGristWidget({
  title: "Table writes",
  description: "addRecord and updateRecord under declared names; upsert and destroy via w.table.",
  requiredAccess: "full",
  columns: [{ name: "Title", type: "Text" }],
})

export function WidgetApp() {
  const w = widget.useGrist()

  return (
    <div className="flex flex-wrap gap-2 p-4">
      <Button
        type="button"
        onClick={() => void w.addRecord({ Title: "New" })}
      >
        add
      </Button>
      <Button
        type="button"
        disabled={!w.record}
        onClick={() => void w.updateRecord({ Title: "Updated" })}
      >
        update
      </Button>
      <Button
        type="button"
        onClick={() =>
          void w.table.upsert({
            require: w.mapBack({ Title: "Existing" }),
            fields: w.mapBack({ Title: "Existing" }),
          })
        }
      >
        upsert
      </Button>
      <Button
        type="button"
        disabled={!w.records?.length}
        onClick={() => {
          const ids = (w.records ?? [])
            .slice(0, 3)
            .map((r) => r.id)
          if (ids.length) void w.table.destroy(ids)
        }}
      >
        destroy (first 3)
      </Button>
    </div>
  )
}
