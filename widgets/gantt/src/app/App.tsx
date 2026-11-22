import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { fr } from "date-fns/locale"
import { Calendar, CalendarDays, CalendarRange, Settings, X } from "lucide-react"

import { defineGristWidget, type GristColumnInfo } from "grist-widget-sdk"

import { detectLocale, useT } from "@shared/i18n"
import {
  GanttFeatureList,
  GanttFeatureListGroup,
  GanttFeatureRow,
  GanttHeader,
  GanttProvider,
  GanttSidebar,
  GanttSidebarGroup,
  GanttSidebarItem,
  GanttTimeline,
  GanttToday,
  type Range,
} from "@shared/kibo-ui/gantt"
import { Button } from "@shared/ui/button"
import { NativeSelect, NativeSelectOption } from "@shared/ui/native-select"
import { OptionsDraftNotice, useOptionsDraft } from "@shared/options-draft"
import { reportUrl } from "@shared/report-url"

import { choiceStyles } from "./colors"
import { calendarDay, toGristDay } from "./dates"
import { buildGroups, labeled, type Task } from "./groups"
import { messages } from "./messages"

export const widget = defineGristWidget({
  title: "Gantt chart",
  description: "Tasks on a timeline, grouped and in rows; drag a bar to move it, or its ends to change its dates.",
  reportUrl: reportUrl(),
  requiredAccess: "full",
  // Grist's "Open configuration" opens the widget's configuration view, as its settings icon does.
  hasCustomOptions: true,
  optionsVersion: 1,
  columns: [
    { name: "Title", type: "Text", title: "Task" },
    { name: "Start", type: "Date", title: "Start date" },
    { name: "End", type: "Date", title: "End date" },
    { name: "Group", type: "Text,Choice,Ref", optional: true, title: "Group (a section of the sidebar)" },
    { name: "Sequence", type: "Text,Choice,Ref", optional: true, title: "Row (tasks that share a timeline row)" },
    { name: "Status", type: "Choice", optional: true, title: "Status (bar colour, from its choices)" },
  ],
})

type Scale = Extract<Range, "daily" | "weekly" | "monthly">
const SCALES: readonly Scale[] = ["daily", "weekly", "monthly"]

/** The scale the chart opens on: the widget options' `defaultScale`, weeks when unset or unknown. */
export function readDefaultScale(options: Record<string, unknown> | null | undefined): Scale {
  const value = options?.defaultScale
  return SCALES.includes(value as Scale) ? (value as Scale) : "weekly"
}
type UpdateRecord = ReturnType<typeof widget.useGrist>["updateRecord"]

/** What moving or resizing a bar writes: the row's Start and End, as the days the bar now covers. */
export function writeDates(updateRecord: UpdateRecord, rowId: number, startAt: Date, endAt: Date) {
  return updateRecord(rowId, { Start: toGristDay(startAt), End: toGristDay(endAt) })
}

/** Tasks the chart shows at a time, in the section's order. */
const TASKS_SHOWN = 50

export default function App() {
  const w = widget.useGrist()
  const t = useT(messages)
  const locale = detectLocale()
  // The buttons change the view for now; the configuration sets the scale it opens on.
  const defaultScale = readDefaultScale(w.widgetOptions)
  const [scale, setScale] = useState<Scale>(defaultScale)
  // What the configuration writes is a draft of the section until Grist's Save: the notice says so.
  const draft = useOptionsDraft(w.widgetOptions)
  // A new default (the options arrive, or the configuration saves one) moves the view to it.
  const [shownDefault, setShownDefault] = useState<Scale>(defaultScale)
  if (shownDefault !== defaultScale) {
    setShownDefault(defaultScale)
    setScale(defaultScale)
  }
  const [error, setError] = useState<string | null>(null)

  // Choice colours, from the columns' settings in Grist.
  const [columns, setColumns] = useState<ReadonlyMap<string, GristColumnInfo>>(new Map())
  const { listColumns } = w
  const tableId = w.currentTableId
  useEffect(() => {
    if (!tableId) return
    let live = true
    listColumns(tableId).then(
      (cols) => live && setColumns(new Map(cols.map((c) => [c.colId, c]))),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [listColumns, tableId])

  const colOf = (name: string) => {
    const id = w.mappings[name]
    return typeof id === "string" ? id : undefined
  }
  const groupCol = colOf("Group")
  const sequenceCol = colOf("Sequence")
  const statusCol = colOf("Status")
  const styles = useMemo(
    () => ({
      group: choiceStyles(groupCol ? columns.get(groupCol)?.widgetOptions : undefined),
      status: choiceStyles(statusCol ? columns.get(statusCol)?.widgetOptions : undefined),
    }),
    [columns, groupCol, statusCol],
  )

  const { tasks, skipped } = useMemo(() => {
    const raw = new Map((w.records ?? []).map((r) => [r.id, r as Record<string, unknown>]))
    const out: Task[] = []
    let missing = 0
    for (const row of w.mappedRecords ?? []) {
      const start = calendarDay(row.Start)
      const end = calendarDay(row.End)
      if (!start || !end) {
        missing++
        continue
      }
      const r: Record<string, unknown> = raw.get(row.id) ?? {}
      out.push({
        id: row.id,
        title: row.Title?.trim() || t("untitled"),
        start,
        end,
        group: labeled(row.Group, groupCol ? r[`gristHelper_${groupCol}`] : undefined, t("noGroup")),
        sequence: sequenceCol
          ? labeled(row.Sequence, r[`gristHelper_${sequenceCol}`], t("noRow"))
          : { key: `task:${row.id}`, label: row.Title?.trim() || t("untitled") },
        status: typeof row.Status === "string" && row.Status ? row.Status : null,
      })
    }
    return { tasks: out, skipped: missing }
  }, [w.mappedRecords, w.records, groupCol, sequenceCol, t])

  // The first tasks, in the section's order, TASKS_SHOWN at a time.
  const [listed, setListed] = useState(TASKS_SHOWN)
  const shownTasks = useMemo(() => tasks.slice(0, listed), [tasks, listed])
  const groups = useMemo(() => buildGroups(shownTasks, styles), [shownTasks, styles])

  const { updateRecord } = w
  const move = useCallback(
    async (id: string, startAt: Date, endAt: Date | null) => {
      if (!endAt) return
      setError(null)
      try {
        await writeDates(updateRecord, Number(id), startAt, endAt)
      } catch (err) {
        setError(t("saveFailed", { error: err instanceof Error ? err.message : String(err) }))
      }
    },
    [updateRecord, t],
  )

  if (tasks.length === 0) {
    return <p className="m-auto flex h-svh max-w-sm items-center p-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
  }

  // The counts cover every task, the ones not shown included.
  const sequenceCount = new Set(tasks.map((task) => `${task.group.key}\u0000${task.sequence.key}`)).size
  const groupCount = new Set(tasks.map((task) => task.group.key)).size

  return (
    <main className="flex h-svh min-h-0 flex-col bg-background text-foreground">
      <OptionsDraftNotice visible={draft.visible && !w.readOnly} hide={draft.hide} />
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2 text-sm">
        <div>
          <h1 className="font-medium">{t("title")}</h1>
          <p className="text-xs text-muted-foreground">
            {t("stats", { tasks: tasks.length, rows: sequenceCount, groups: groupCount })}
            {skipped ? ` · ${t("skipped", { n: skipped })}` : ""}
            {tasks.length > listed ? ` · ${t("shownOf", { n: listed })}` : ""}
          </p>
        </div>
        {tasks.length > listed ? (
          <Button size="sm" variant="outline" className="h-auto whitespace-normal" onClick={() => setListed((n) => n + TASKS_SHOWN)}>
            {t("moreTasks", { n: Math.min(TASKS_SHOWN, tasks.length - listed), left: tasks.length - listed })}
          </Button>
        ) : null}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border p-1" role="group" aria-label={t("scale")}>
            {(
              [
                ["daily", CalendarDays, t("daily")],
                ["weekly", CalendarRange, t("weekly")],
                ["monthly", Calendar, t("monthly")],
              ] as const
            ).map(([value, Icon, label]) => (
              <Button key={value} variant={scale === value ? "secondary" : "ghost"} size="icon-sm" aria-pressed={scale === value} title={label} onClick={() => setScale(value)}>
                <Icon aria-hidden />
                <span className="sr-only">{label}</span>
              </Button>
            ))}
          </div>
          {w.readOnly ? null : (
            <Button variant="ghost" size="icon-sm" title={t("settings")} aria-expanded={w.configurationOpen} onClick={w.openConfiguration}>
              <Settings aria-hidden />
              <span className="sr-only">{t("settings")}</span>
            </Button>
          )}
        </div>
      </header>

      {w.configurationOpen ? (
        <Configuration
          defaultScale={defaultScale}
          readOnly={w.readOnly}
          save={async (next) => {
            await w.patchWidgetOptions({ defaultScale: next })
            draft.wrote({ defaultScale: next })
          }}
          close={w.closeConfiguration}
          t={t}
        />
      ) : null}

      {error ? (
        <p role="alert" className="px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 p-2">
        <GanttProvider key={scale} className="h-full" range={scale} locale={locale === "fr" ? fr : undefined} labels={{ move: t("moveBar"), start: t("startOf"), end: t("endOf") }}>
          <GanttSidebar label={t("tasks")} durationLabel={t("duration")}>
            {groups.map((group) => (
              <GanttSidebarGroup key={group.id} name={group.name}>
                {group.sequences.map((sequence, i) => (
                  <GanttSidebarItem key={sequence.id} feature={sequence.sidebarFeature} rowCount={sequence.rowCount} showTopDivider={i > 0} />
                ))}
              </GanttSidebarGroup>
            ))}
          </GanttSidebar>
          <GanttTimeline>
            <GanttHeader />
            <GanttFeatureList>
              {groups.map((group) => (
                <GanttFeatureListGroup key={group.id}>
                  {group.sequences.map((sequence, i) => (
                    <GanttFeatureRow key={sequence.id} features={sequence.features} onMove={move} showTopDivider={i > 0}>
                      {(feature) => <p className="min-w-0 flex-1 truncate text-xs">{feature.name}</p>}
                    </GanttFeatureRow>
                  ))}
                </GanttFeatureListGroup>
              ))}
            </GanttFeatureList>
            <GanttToday />
          </GanttTimeline>
        </GanttProvider>
      </div>
    </main>
  )
}

type T = ReturnType<typeof useT<keyof (typeof messages)["en"]>>

/**
 * The widget's configuration view: Grist's "Open configuration" and the
 * settings icon both open it (useGrist().configurationOpen). A choice
 * applies at once, to the widget's options: Grist keeps them as a draft of
 * the section until its own Save, which the notice at the top says
 * (_shared/options-draft). ✕ and Escape close it.
 */
function Configuration({
  defaultScale,
  readOnly,
  save,
  close,
  t,
}: {
  defaultScale: Scale
  readOnly: boolean
  save: (scale: Scale) => Promise<unknown>
  close: () => void
  t: T
}) {
  const [error, setError] = useState<string | null>(null)
  const first = useRef<HTMLSelectElement>(null)
  const id = useId()
  useEffect(() => first.current?.focus(), [])

  async function choose(next: Scale) {
    setError(null)
    try {
      await save(next)
    } catch (err) {
      setError(t("saveSettingsFailed", { error: err instanceof Error ? err.message : String(err) }))
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation()
      close()
    }
  }

  return (
    <section role="dialog" aria-label={t("configuration")} onKeyDown={onKeyDown} className="flex shrink-0 flex-col gap-3 border-b bg-card px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium">{t("configuration")}</h2>
        <Button variant="ghost" size="icon-sm" title={t("close")} onClick={close}>
          <X aria-hidden />
          <span className="sr-only">{t("close")}</span>
        </Button>
      </div>
      <div className="flex max-w-xs flex-col gap-1">
        <label htmlFor={`${id}-scale`} className="font-medium">
          {t("defaultScale")}
        </label>
        <NativeSelect
          ref={first}
          id={`${id}-scale`}
          aria-describedby={`${id}-hint`}
          value={defaultScale}
          disabled={readOnly}
          onChange={(e) => void choose(e.target.value as Scale)}
        >
          {SCALES.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {t(value)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <span id={`${id}-hint`} className="text-xs text-muted-foreground">
          {t("defaultScaleHint")}
        </span>
      </div>
      {readOnly ? <p className="text-xs text-muted-foreground">{t("settingsReadOnly")}</p> : null}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  )
}
