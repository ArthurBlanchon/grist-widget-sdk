import type { GanttFeature, GanttStatus } from "@shared/kibo-ui/gantt"
import { computeSequenceSubRowCount } from "@shared/kibo-ui/gantt/row-layout"

import { barStyle, groupColor, type ChoiceStyle } from "./colors"

/** A task as the Gantt reads it from a row. */
export type Task = {
  id: number
  title: string
  start: Date
  end: Date
  group: Labeled
  sequence: Labeled
  status: string | null
}

/** A grouping value: a stable key, and what the person reads. */
export type Labeled = { key: string; label: string }

export type Sequence = { id: string; name: string; rowCount: number; features: GanttFeature[]; sidebarFeature: GanttFeature }
export type Group = { id: string; name: string; status: GanttStatus; sequences: Sequence[] }

const asText = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim())

/**
 * A Text, Choice or Ref cell as a grouping value. A Ref's label is the
 * display helper Grist sends with the row (`gristHelper_<colId>`).
 */
export function labeled(value: unknown, helper: unknown, empty: string): Labeled {
  const ref = typeof value === "number" ? value : value && typeof value === "object" && "rowId" in value ? Number((value as { rowId: unknown }).rowId) : NaN
  if (Number.isFinite(ref) && ref > 0) {
    const label = Array.isArray(helper) ? helper.map(asText).find(Boolean) : asText(helper)
    return { key: `ref:${ref}`, label: label || `#${ref}` }
  }
  const text = asText(value)
  return text ? { key: text, label: text } : { key: "", label: empty }
}

const status = (id: string, name: string, s: { fillColor: string; textColor?: string }): GanttStatus => ({
  id,
  name,
  color: s.fillColor,
  textColor: s.textColor,
})

function span(features: GanttFeature[]) {
  return {
    startAt: new Date(Math.min(...features.map((f) => f.startAt.getTime()))),
    endAt: new Date(Math.max(...features.map((f) => f.endAt.getTime()))),
  }
}

/**
 * Tasks in groups, then sequences (a row of the timeline each), in the
 * order they first appear. Overlapping tasks of a sequence stack.
 */
export function buildGroups(
  tasks: readonly Task[],
  styles: { group: Map<string, ChoiceStyle>; status: Map<string, ChoiceStyle> },
): Group[] {
  const groups = new Map<string, { label: string; sequences: Map<string, { label: string; features: GanttFeature[] }> }>()
  for (const task of tasks) {
    const end = task.end < task.start ? task.start : task.end
    const g = groups.get(task.group.key) ?? { label: task.group.label, sequences: new Map() }
    groups.set(task.group.key, g)
    const s = g.sequences.get(task.sequence.key) ?? { label: task.sequence.label, features: [] }
    g.sequences.set(task.sequence.key, s)
    const bar = barStyle(task.status ? styles.status.get(task.status) : undefined)
    s.features.push({
      id: String(task.id),
      name: task.title,
      startAt: task.start,
      endAt: end,
      status: status(String(task.id), task.title, bar),
      lane: `${task.group.key}::${task.sequence.key}`,
    })
  }

  return [...groups.entries()].map(([groupKey, g], gi) => {
    const groupStatus = status(`group-${gi}`, g.label, { fillColor: groupColor(styles.group.get(groupKey), gi) })
    const sequences = [...g.sequences.entries()].map(([seqKey, s], si) => {
      const features = [...s.features].sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
      const id = `group-${gi}-seq-${si}-${groupKey}-${seqKey}`
      return { id, name: s.label, rowCount: computeSequenceSubRowCount(features), features, sidebarFeature: { id, name: s.label, ...span(features), status: groupStatus } }
    })
    return { id: `group-${gi}-${groupKey}`, name: g.label, status: groupStatus, sequences }
  })
}
