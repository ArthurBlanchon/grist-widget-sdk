import { useEffect, useMemo, useState } from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, Pie, PieChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, XAxis, YAxis, Cell } from "recharts"

import { defineGristWidget } from "grist-widget-sdk"

import { detectLocale, useT } from "@shared/i18n"
import { Button } from "@shared/ui/button"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@shared/ui/chart"

import { messages } from "./messages"
import { AGGREGATES, KINDS, buildData, readSettings, type ChartKind } from "./series"

export const widget = defineGristWidget({
  title: "Chart builder",
  description: "Bar, line, area, pie, radar or combined charts of a table, grouped by a column, in the theme's colours.",
  requiredAccess: "full",
  columns: [
    { name: "Label", title: "Group by (the chart's categories)" },
    { name: "Values", type: "Numeric,Int", allowMultiple: true, title: "Numbers to chart (a series each)" },
  ],
})

const colour = (i: number) => `var(--chart-${(i % 5) + 1})`

export default function App() {
  const w = widget.useGrist()
  const t = useT(messages)
  const locale = detectLocale()
  const { kind, fn } = readSettings(w.widgetOptions)

  // Series names: the mapped columns' labels in Grist.
  const mappedValues = w.mappings.Values
  const valueCols = Array.isArray(mappedValues) ? mappedValues : mappedValues ? [mappedValues] : []
  const seriesCount = valueCols.length
  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(new Map())
  const { listColumns } = w
  const tableId = w.currentTableId
  useEffect(() => {
    if (!tableId) return
    let live = true
    listColumns(tableId).then(
      (cols) => live && setLabels(new Map(cols.map((c) => [c.colId, c.label?.trim() || c.colId]))),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [listColumns, tableId])

  const series = valueCols.map((col, i) => ({ key: `s${i}`, name: labels.get(col) ?? col }))
  // The React compiler memoizes this; the rows are a section's, so it stays light.
  const data = buildData((w.mappedRecords ?? []).map((r) => ({ label: r.Label, values: r.Values ?? [] })), seriesCount, fn, t("blank"))
  const config: ChartConfig = Object.fromEntries(series.map((s, i) => [s.key, { label: s.name, color: colour(i) }]))
  const number = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale])

  const save = (patch: Record<string, unknown>) => void w.patchWidgetOptions(patch)

  return (
    <main className="flex h-svh min-h-0 flex-col gap-2 bg-background p-3 text-foreground">
      <header className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t("kind")} className="flex flex-wrap gap-1">
          {KINDS.map((k) => (
            <Button key={k} size="sm" variant={kind === k ? "secondary" : "ghost"} aria-pressed={kind === k} onClick={() => save({ chart: k })}>
              {t(k)}
            </Button>
          ))}
        </div>
        <div role="group" aria-label={t("aggregate")} className="ml-auto flex gap-1">
          {AGGREGATES.map((a) => (
            <Button key={a} size="sm" variant={fn === a ? "secondary" : "ghost"} aria-pressed={fn === a} onClick={() => save({ aggregate: a })}>
              {t(a)}
            </Button>
          ))}
        </div>
      </header>

      {data.length === 0 || series.length === 0 ? (
        <p className="m-auto max-w-sm text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <ChartContainer config={config} className="min-h-0 w-full flex-1" aria-hidden data-kind={kind}>
            {chart(kind, data, series, kind === "pie" ? data.map((_, i) => colour(i)) : [])}
          </ChartContainer>
          <table className="sr-only">
            <caption>{t("tableCaption")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("label")}</th>
                {series.map((s) => (
                  <th key={s.key} scope="col">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.label}>
                  <th scope="row">{d.label}</th>
                  {series.map((s) => (
                    <td key={s.key}>{number.format(Number(d[s.key]))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  )
}

type Series = { key: string; name: string }

function chart(kind: ChartKind, data: Record<string, unknown>[], series: Series[], sliceColours: string[]) {
  const tooltip = <ChartTooltip content={<ChartTooltipContent />} />
  const legend = <ChartLegend content={<ChartLegendContent />} />
  const axes = (
    <>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="label" tickLine={false} axisLine={false} />
      <YAxis tickLine={false} axisLine={false} width="auto" />
    </>
  )
  const fill = (s: Series) => `var(--color-${s.key})`
  switch (kind) {
    case "bar":
    case "stacked":
      return (
        <BarChart data={data} accessibilityLayer>
          {axes}
          {tooltip}
          {legend}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={fill(s)} radius={4} stackId={kind === "stacked" ? "all" : undefined} />
          ))}
        </BarChart>
      )
    case "line":
      return (
        <LineChart data={data} accessibilityLayer>
          {axes}
          {tooltip}
          {legend}
          {series.map((s) => (
            <Line key={s.key} dataKey={s.key} name={s.name} stroke={fill(s)} strokeWidth={2} dot={false} type="monotone" />
          ))}
        </LineChart>
      )
    case "area":
      return (
        <AreaChart data={data} accessibilityLayer>
          {axes}
          {tooltip}
          {legend}
          {series.map((s) => (
            <Area key={s.key} dataKey={s.key} name={s.name} stroke={fill(s)} fill={fill(s)} fillOpacity={0.3} type="monotone" />
          ))}
        </AreaChart>
      )
    case "combined":
      // The first series as bars, the others as lines over them.
      return (
        <ComposedChart data={data} accessibilityLayer>
          {axes}
          {tooltip}
          {legend}
          {series.map((s, i) =>
            i === 0 ? <Bar key={s.key} dataKey={s.key} name={s.name} fill={fill(s)} radius={4} /> : <Line key={s.key} dataKey={s.key} name={s.name} stroke={fill(s)} strokeWidth={2} type="monotone" />,
          )}
        </ComposedChart>
      )
    case "pie":
      // The first series, a slice per label.
      return (
        <PieChart>
          {tooltip}
          <Pie data={data} dataKey={series[0]!.key} nameKey="label" innerRadius="40%">
            {data.map((d, i) => (
              <Cell key={String(d.label)} fill={sliceColours[i]} />
            ))}
          </Pie>
        </PieChart>
      )
    case "radar":
      return (
        <RadarChart data={data}>
          {tooltip}
          {legend}
          <PolarGrid />
          <PolarAngleAxis dataKey="label" />
          {series.map((s) => (
            <Radar key={s.key} dataKey={s.key} name={s.name} stroke={fill(s)} fill={fill(s)} fillOpacity={0.25} />
          ))}
        </RadarChart>
      )
  }
}
