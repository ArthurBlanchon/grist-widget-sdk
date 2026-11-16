import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react"

import { defineGristWidget } from "grist-widget-sdk"

import { useT } from "@shared/i18n"
import { Badge } from "@shared/ui/badge"
import { Button } from "@shared/ui/button"
import { Card, CardContent } from "@shared/ui/card"
import { Input } from "@shared/ui/input"
import { reportUrl } from "@shared/report-url"

import { boardColumns, moveColumn, neighbour, readOrder } from "./board"
import { messages } from "./messages"

export const widget = defineGristWidget({
  title: "Kanban board",
  description: "Move cards between status columns by dragging, or with the arrow keys.",
  reportUrl: reportUrl(),
  requiredAccess: "full",
  // Options carry their version (ADR 0017): version 1, read as before.
  optionsVersion: 1,
  allowSelectBy: true,
  columns: [
    { name: "Title", type: "Text", title: "Card title" },
    { name: "Status", type: "Choice,Text", title: "Status" },
    { name: "Notes", type: "Text", optional: true, title: "Notes on the card" },
  ],
})

type Card = { id: number; title: string; status: string; notes: string | null }

/** Cards a column shows at a time (the selected one always among them), and columns a board shows. */
const CARDS_SHOWN = 50
const COLUMNS_SHOWN = 20

export default function App() {
  const w = widget.useGrist()
  const t = useT(messages)
  const [dragged, setDragged] = useState<number | null>(null)
  const [newColumn, setNewColumn] = useState("")
  const [error, setError] = useState<string | null>(null)

  const [listed, setListed] = useState<Record<string, number>>({})
  const cards = useMemo<Card[]>(
    () =>
      (w.mappedRecords ?? []).map((row) => ({
        id: row.id,
        title: row.Title?.trim() || t("untitled"),
        status: row.Status ?? "",
        notes: row.Notes || null,
      })),
    [w.mappedRecords, t],
  )
  const order = readOrder(w.widgetOptions)
  const columns = boardColumns(
    order,
    cards.map((c) => c.status),
  )

  async function save(write: () => Promise<unknown>) {
    setError(null)
    try {
      await write()
    } catch (err) {
      setError(t("saveFailed", { error: err instanceof Error ? err.message : String(err) }))
    }
  }

  // A moved card becomes the selected one: past the 50 a column shows, it stays in view.
  const moveCard = (card: Card, status: string) =>
    card.status === status
      ? Promise.resolve()
      : save(async () => {
          await w.updateRecord(card.id, { Status: status })
          await w.setCursorPosition({ rowId: card.id })
        })
  const saveOrder = (next: readonly string[]) => save(() => w.patchWidgetOptions({ columns: next }))

  function addColumn(e: FormEvent) {
    e.preventDefault()
    const name = newColumn.trim()
    if (!name || columns.includes(name)) return
    setNewColumn("")
    void saveOrder([...columns, name])
  }

  // A card moved from the keyboard keeps the focus in its new column, and the move is announced.
  const cardRefs = useRef(new Map<number, HTMLElement>())
  const focusAfterMove = useRef<{ id: number; status: string } | null>(null)
  const [announcement, setAnnouncement] = useState("")
  useEffect(() => {
    const pending = focusAfterMove.current
    if (!pending) return
    const moved = cards.find((c) => c.id === pending.id)
    if (moved?.status !== pending.status) return
    cardRefs.current.get(moved.id)?.focus()
    focusAfterMove.current = null
  }, [cards])

  function onCardKey(e: KeyboardEvent, card: Card) {
    const delta = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0
    if (delta === 0) return
    e.preventDefault()
    const target = neighbour(columns, card.status, delta)
    if (target === null) return
    focusAfterMove.current = { id: card.id, status: target }
    setAnnouncement(t("moved", { title: card.title, status: target || t("noStatus") }))
    void moveCard(card, target)
  }

  return (
    <main className="flex h-svh min-h-0 flex-col gap-3 bg-background p-4 text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-medium">{t("title")}</h1>
          <span className="text-xs text-muted-foreground">{t("cardCount", { n: cards.length })}</span>
        </div>
        <form className="flex gap-2" onSubmit={addColumn}>
          <Input
            aria-label={t("newColumn")}
            placeholder={t("newColumn")}
            value={newColumn}
            onChange={(e) => setNewColumn(e.target.value)}
            className="h-8 w-44"
          />
          <Button type="submit" size="sm" variant="secondary" disabled={!newColumn.trim()}>
            {t("addColumn")}
          </Button>
        </form>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <p id="card-hint" className="sr-only">
        {t("cardHint")}
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {cards.length === 0 && columns.length === 0 ? (
        <p className="m-auto max-w-sm text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto">
          {columns.slice(0, COLUMNS_SHOWN).map((status, index) => {
            const label = status || t("noStatus")
            const inColumn = cards.filter((c) => c.status === status)
            return (
              <section
                key={status}
                aria-label={label}
                className="flex w-72 shrink-0 flex-col gap-2 rounded-lg border bg-muted/40 p-3"
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = "move"
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const card = cards.find((c) => c.id === dragged)
                  setDragged(null)
                  if (card) void moveCard(card, status)
                }}
              >
                <header className="flex items-center gap-1">
                  <h2 className="flex-1 truncate text-sm font-semibold">{label}</h2>
                  <Badge variant="secondary">{inColumn.length}</Badge>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={t("moveColumnLeft", { name: label })}
                    disabled={index === 0}
                    onClick={() => void saveOrder(moveColumn(columns, status, -1))}
                  >
                    ‹
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={t("moveColumnRight", { name: label })}
                    disabled={index === columns.length - 1}
                    onClick={() => void saveOrder(moveColumn(columns, status, 1))}
                  >
                    ›
                  </Button>
                </header>
                <ul className="flex min-h-16 flex-col gap-2 overflow-y-auto">
                  {inColumn.filter((card, j) => j < (listed[status] ?? CARDS_SHOWN) || card.id === w.record?.id).map((card) => (
                    <li key={card.id}>
                      <Card
                        role="button"
                        tabIndex={0}
                        draggable
                        ref={(el: HTMLDivElement | null) => {
                          if (el) cardRefs.current.set(card.id, el)
                          else cardRefs.current.delete(card.id)
                        }}
                        aria-label={card.notes ? t("cardNotes", { title: card.title, notes: card.notes, status: label }) : t("card", { title: card.title, status: label })}
                        aria-describedby="card-hint"
                        aria-pressed={w.record?.id === card.id}
                        onClick={() => void w.setCursorPosition({ rowId: card.id })}
                        onKeyDown={(e) => onCardKey(e, card)}
                        onDragStart={() => setDragged(card.id)}
                        onDragEnd={() => setDragged(null)}
                        className="cursor-grab gap-0 py-0 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring aria-pressed:ring-2 aria-pressed:ring-primary"
                      >
                        <CardContent className="flex flex-col gap-1 p-3">
                          <span className="text-sm font-medium">{card.title}</span>
                          {card.notes ? (
                            <span className="line-clamp-3 text-xs text-muted-foreground">{card.notes}</span>
                          ) : null}
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                  {inColumn.length === 0 ? <li className="text-xs text-muted-foreground">{t("noCards")}</li> : null}
                </ul>
                {inColumn.length > (listed[status] ?? CARDS_SHOWN) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-auto whitespace-normal"
                    onClick={() => setListed((l) => ({ ...l, [status]: (l[status] ?? CARDS_SHOWN) + CARDS_SHOWN }))}
                  >
                    {t("moreCards", {
                      n: Math.min(CARDS_SHOWN, inColumn.length - (listed[status] ?? CARDS_SHOWN)),
                      // The selected card past the cut is shown already.
                      left: inColumn.filter((c, j) => j >= (listed[status] ?? CARDS_SHOWN) && c.id !== w.record?.id).length,
                    })}
                  </Button>
                ) : null}
              </section>
            )
          })}
          {columns.length > COLUMNS_SHOWN ? (
            <p role="status" className="w-56 shrink-0 self-start text-xs text-muted-foreground">
              {t("moreColumns", { n: columns.length - COLUMNS_SHOWN })}
            </p>
          ) : null}
        </div>
      )}
    </main>
  )
}
