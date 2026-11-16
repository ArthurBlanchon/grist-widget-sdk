import { Fragment, useMemo, useState } from "react"

import { defineGristWidget } from "grist-widget-sdk"

import { detectLocale, useT } from "@shared/i18n"
import { Badge } from "@shared/ui/badge"
import { Button } from "@shared/ui/button"

import { AGGREGATES, BLANK, aggregate, groupItems, keysOf, numberOf, pivotItems, type Aggregate, type Item } from "./group"
import { messages } from "./messages"

export const widget = defineGristWidget({
  title: "Grouped view",
  description: "Rows grouped by a column, with counts and totals; with a second column, a pivot table. Clicking a group filters the linked widgets.",
  requiredAccess: "read table",
  allowSelectBy: true,
  columns: [
    { name: "Group", title: "Group by" },
    { name: "Label", optional: true, title: "Row label" },
    { name: "Across", optional: true, title: "Across (pivot table)" },
    { name: "Value", type: "Numeric,Int", optional: true, title: "Value to total" },
  ],
})

/** Groups (list or pivot rows), rows of an open group and pivot columns shown at a time, each with a button for the next. Totals count every row. */
const GROUPS_SHOWN = 50
const ITEMS_SHOWN = 10
const COLUMNS_SHOWN = 20

export default function App() {
  const w = widget.useGrist()
  const t = useT(messages)
  const locale = detectLocale()
  const [fn, setFn] = useState<Aggregate>("sum")
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [listed, setListed] = useState(GROUPS_SHOWN)
  const [itemsListed, setItemsListed] = useState<Readonly<Record<string, number>>>({})
  const [filter, setFilter] = useState<string | null>(null)

  const hasValue = Boolean(w.mappings.Value)
  const pivot = Boolean(w.mappings.Across)
  const items = useMemo<Item[]>(
    () =>
      (w.mappedRecords ?? []).map((row) => ({
        id: row.id,
        groups: keysOf(row.Group),
        across: keysOf(row.Across),
        value: numberOf(row.Value),
        label: keysOf(row.Label).join(", ") || `#${row.id}`,
      })),
    [w.mappedRecords],
  )

  const number = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale])
  const name = (key: string) => (key === BLANK ? t("blank") : key)
  /** What a set of rows adds up to: the chosen total of their values, or their count. */
  const total = (rows: Item[]) => {
    if (!hasValue) return number.format(rows.length)
    const v = aggregate(
      rows.map((r) => r.value),
      fn,
    )
    return v === null ? "—" : number.format(v)
  }

  /** Filter the linked widgets to these rows, or show them all again when `key` is the active filter. */
  function filterTo(key: string, rows: Item[]) {
    const off = filter === key
    setFilter(off ? null : key)
    void w.setLinkedRowSelection(off ? null : rows.map((r) => r.id))
  }

  const groups = useMemo(() => (pivot ? [] : groupItems(items)), [items, pivot])

  if (items.length === 0) {
    return <p className="m-auto flex h-svh max-w-sm items-center p-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
  }

  return (
    <main className="flex h-svh min-h-0 flex-col gap-3 bg-background p-3 text-foreground">
      <header className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-xs text-muted-foreground">{t("count", { n: number.format(items.length) })}</p>
        {hasValue ? (
          <div role="group" aria-label={t("total")} className="flex gap-1">
            {AGGREGATES.map((a) => (
              <Button key={a} size="sm" variant={fn === a ? "secondary" : "ghost"} aria-pressed={fn === a} onClick={() => setFn(a)}>
                {t(a)}
              </Button>
            ))}
          </div>
        ) : null}
      </header>

      {pivot ? <PivotTable items={items} name={name} total={total} filter={filter} filterTo={filterTo} format={number.format} t={t} /> : null}

      {!pivot ? (
        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {groups.slice(0, listed).map((g) => {
            const open = !collapsed.has(g.key)
            const shown = itemsListed[g.key] ?? ITEMS_SHOWN
            const label = name(g.key)
            return (
              <li key={g.key} className="rounded-lg border">
                <div className="flex items-center gap-2 px-2 py-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-w-0 flex-1 justify-start"
                    aria-expanded={open}
                    onClick={() =>
                      setCollapsed((c) => {
                        const next = new Set(c)
                        if (open) next.add(g.key)
                        else next.delete(g.key)
                        return next
                      })
                    }
                  >
                    <span aria-hidden>{open ? "▾" : "▸"}</span>
                    <span className="truncate font-medium">{label}</span>
                  </Button>
                  <Badge variant="secondary">{t("rows", { n: number.format(g.items.length) })}</Badge>
                  <Button
                    variant={filter === g.key ? "default" : "outline"}
                    size="sm"
                    aria-pressed={filter === g.key}
                    aria-label={t("filterGroup", { name: label, total: total(g.items) })}
                    onClick={() => filterTo(g.key, g.items)}
                  >
                    {total(g.items)}
                  </Button>
                </div>
                {open ? (
                  <ul className="flex flex-col border-t py-1">
                    {g.items.slice(0, shown).map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-current={w.record?.id === item.id ? "true" : undefined}
                          onClick={() => void w.setCursorPosition({ rowId: item.id })}
                          className="flex w-full items-center gap-2 px-4 py-1 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none aria-current:font-semibold"
                        >
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {hasValue && item.value !== null ? <span className="tabular-nums">{number.format(item.value)}</span> : null}
                        </button>
                      </li>
                    ))}
                    {g.items.length > shown ? (
                      <li className="px-2 pt-1">
                        <More
                          label={t("moreItems", { n: number.format(Math.min(ITEMS_SHOWN * 5, g.items.length - shown)), left: number.format(g.items.length - shown) })}
                          onClick={() => setItemsListed((m) => ({ ...m, [g.key]: shown + ITEMS_SHOWN * 5 }))}
                        />
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      {groups.length > listed ? (
        <More
          label={t("moreGroups", { n: number.format(Math.min(GROUPS_SHOWN, groups.length - listed)), left: number.format(groups.length - listed) })}
          onClick={() => setListed((n) => n + GROUPS_SHOWN)}
        />
      ) : null}
    </main>
  )
}

function PivotTable({
  items,
  name,
  total,
  filter,
  filterTo,
  format,
  t,
}: {
  items: Item[]
  name: (key: string) => string
  total: (rows: Item[]) => string
  filter: string | null
  filterTo: (key: string, rows: Item[]) => void
  format: (n: number) => string
  t: ReturnType<typeof useT<keyof (typeof messages)["en"]>>
}) {
  const p = useMemo(() => pivotItems(items), [items])
  const [rowsListed, setRowsListed] = useState(GROUPS_SHOWN)
  const [columnsListed, setColumnsListed] = useState(COLUMNS_SHOWN)
  const columns = p.columns.slice(0, columnsListed)
  const cell = (key: string, rows: Item[], label: string) =>
    rows.length === 0 ? (
      <td className="px-2 py-1 text-right text-muted-foreground">·</td>
    ) : (
      <td className="p-0 text-right">
        <button
          type="button"
          aria-pressed={filter === key}
          aria-label={label}
          onClick={() => filterTo(key, rows)}
          className="w-full px-2 py-1 text-right tabular-nums hover:bg-accent focus-visible:bg-accent focus-visible:outline-none aria-pressed:bg-primary aria-pressed:text-primary-foreground"
        >
          {total(rows)}
        </button>
      </td>
    )
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-muted">
          <tr>
            <th scope="col" className="px-2 py-1 text-left font-medium">
              <span className="sr-only">{t("groups")}</span>
            </th>
            {columns.map((c) => (
              <th key={c} scope="col" className="px-2 py-1 text-right font-medium">
                {name(c)}
              </th>
            ))}
            <th scope="col" className="px-2 py-1 text-right font-semibold">
              {t("all")}
            </th>
          </tr>
        </thead>
        <tbody>
          {p.rows.slice(0, rowsListed).map((r) => (
            <tr key={r} className="border-t">
              <th scope="row" className="px-2 py-1 text-left font-medium">
                {name(r)}
              </th>
              {columns.map((c) => (
                <Fragment key={c}>{cell(`${r}\u0000${c}`, p.cell(r, c), t("filterCell", { row: name(r), column: name(c) }))}</Fragment>
              ))}
              {cell(`${r}\u0000*`, p.rowItems(r), t("filterGroup", { name: name(r), total: total(p.rowItems(r)) }))}
            </tr>
          ))}
          <tr className="border-t font-semibold">
            <th scope="row" className="px-2 py-1 text-left">
              {t("all")}
            </th>
            {columns.map((c) => (
              <Fragment key={c}>{cell(`*\u0000${c}`, p.columnItems(c), t("filterGroup", { name: name(c), total: total(p.columnItems(c)) }))}</Fragment>
            ))}
            {cell("*", p.all, t("filterAll"))}
          </tr>
        </tbody>
      </table>
      <div className="flex flex-wrap gap-2 p-2 empty:hidden">
        {p.rows.length > rowsListed ? (
          <More
            label={t("moreGroups", { n: format(Math.min(GROUPS_SHOWN, p.rows.length - rowsListed)), left: format(p.rows.length - rowsListed) })}
            onClick={() => setRowsListed((n) => n + GROUPS_SHOWN)}
          />
        ) : null}
        {p.columns.length > columnsListed ? (
          <More
            label={t("moreColumns", { n: format(Math.min(COLUMNS_SHOWN, p.columns.length - columnsListed)), left: format(p.columns.length - columnsListed) })}
            onClick={() => setColumnsListed((n) => n + COLUMNS_SHOWN)}
          />
        ) : null}
      </div>
    </div>
  )
}

/** The button that shows the next groups, rows or columns. */
function More({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" className="h-auto self-start whitespace-normal" onClick={onClick}>
      {label}
    </Button>
  )
}
