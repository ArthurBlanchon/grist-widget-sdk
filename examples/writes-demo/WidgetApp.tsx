import {
  useGrist,
  useWidgetMetadata,
  type UseGristOptions,
} from "grist-widget-sdk"

import { Button } from "@/components/ui/button"

export const GRIST_OPTIONS: UseGristOptions = {
  requiredAccess: "full",
  columns: [{ name: "Title", type: "Text" }],
}

export const WIDGET_METADATA = {
  title: "Table writes",
  description: "create, update, upsert, destroy via w.table.",
} as const

export function WidgetApp() {
  useWidgetMetadata(WIDGET_METADATA)
  const w = useGrist()

  if (!w.columnMappingStatus.ok) {
    return <p className="p-4 text-sm">Map the Title column.</p>
  }

  return (
    <div className="flex flex-wrap gap-2 p-4">
      <Button
        type="button"
        onClick={() =>
          void w.table.create({ fields: w.mapBack({ Title: "New" }) })
        }
      >
        create
      </Button>
      <Button
        type="button"
        disabled={!w.record}
        onClick={() => {
          if (!w.record) return
          void w.table.update({
            id: w.record.id as number,
            fields: w.mapBack({ Title: "Updated" }),
          })
        }}
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
            .map((r) => r.id as number)
          if (ids.length) void w.table.destroy(ids)
        }}
      >
        destroy (first 3)
      </Button>
    </div>
  )
}
