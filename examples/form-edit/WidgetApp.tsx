import { useState, type FormEvent, type ReactNode } from "react"

import { defineGristWidget, type GristWidgetRow } from "grist-widget-sdk"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export const widget = defineGristWidget({
  title: "Row editor",
  description: "Edit the selected row in a polished form. Showcases typed records, updateRecord, write status, and error UI.",
  requiredAccess: "full",
  columns: [
    { name: "Title", type: "Text" },
    { name: "Description", type: "Text", optional: true },
    { name: "Done", type: "Bool" },
    { name: "Priority", type: "Text", optional: true },
  ],
})

type Task = GristWidgetRow<typeof widget>
type Grist = ReturnType<typeof widget.useGrist>

type Draft = {
  title: string
  description: string
  done: boolean
  priority: string
}

function readDraft(task: Task | null): Draft {
  return {
    title: task?.Title ?? "",
    description: task?.Description ?? "",
    done: task?.Done === true,
    priority: task?.Priority ?? "",
  }
}

export function WidgetApp() {
  // GristBoundary (mountGristWidget renders it) shows the connection and
  // asks for Title and Done until they are mapped.
  const w = widget.useGrist()

  if (w.mode === "empty" || !w.record) {
    return (
      <Empty
        title="No row selected"
        body="Select a row in the host Grist section to edit it here."
      />
    )
  }

  return <RowEditor key={String(w.record.id)} w={w} />
}

function RowEditor({ w }: { w: Grist }) {
  const [draft, setDraft] = useState<Draft>(() => readDraft(w.mappedRecord))
  const [saveError, setSaveError] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaveError(null)
    try {
      await w.updateRecord({
        Title: draft.title,
        Description: draft.description || null,
        Done: draft.done,
        Priority: draft.priority || null,
      })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <form
      onSubmit={save}
      className="flex h-svh min-h-0 flex-col gap-4 overflow-auto p-6"
    >
      <header>
        <h1 className="text-lg font-medium">Row #{String(w.record!.id)}</h1>
        <p className="text-sm text-muted-foreground">
          Edit fields, then save back to Grist via{" "}
          <code className="rounded bg-muted px-1 text-xs">updateRecord</code>.
        </p>
      </header>

      <Field label="Title">
        <Input
          required
          value={draft.title}
          onChange={(e) =>
            setDraft((d) => ({ ...d, title: e.target.value }))
          }
        />
      </Field>

      <Field label="Description">
        <Input
          value={draft.description}
          onChange={(e) =>
            setDraft((d) => ({ ...d, description: e.target.value }))
          }
        />
      </Field>

      <Field label="Priority">
        <Input
          placeholder="High / Medium / Low"
          value={draft.priority}
          onChange={(e) =>
            setDraft((d) => ({ ...d, priority: e.target.value }))
          }
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 rounded border-input"
          checked={draft.done}
          onChange={(e) =>
            setDraft((d) => ({ ...d, done: e.target.checked }))
          }
        />
        <span>Mark as done</span>
      </label>

      {saveError ? (
        <Alert variant="destructive">
          <AlertTitle>Save failed</AlertTitle>
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-auto flex items-center gap-2 border-t pt-3">
        <Button type="submit" disabled={w.actionStatus === "running"}>
          {w.actionStatus === "running" ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setDraft(readDraft(w.mappedRecord))}
          disabled={w.actionStatus === "running"}
        >
          Reset
        </Button>
        {w.actionStatus === "error" && w.actionError ? (
          <span className="text-xs text-destructive">{w.actionError}</span>
        ) : null}
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-svh items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h2 className="font-medium">{title}</h2>
        {body ? (
          <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        ) : null}
      </div>
    </div>
  )
}
