import type { GanttFeature } from "./index"

/** Same overlap packing as {@link GanttFeatureRow} in the Kibo Gantt component. */
export function computeSequenceSubRowCount(features: readonly GanttFeature[]): number {
  const sortedFeatures = [...features].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime(),
  )

  const subRowEndTimes: Date[] = []

  for (const feature of sortedFeatures) {
    let subRow = 0

    while (
      subRow < subRowEndTimes.length &&
      subRowEndTimes[subRow]! > feature.startAt
    ) {
      subRow++
    }

    if (subRow === subRowEndTimes.length) {
      subRowEndTimes.push(feature.endAt)
    } else {
      subRowEndTimes[subRow] = feature.endAt
    }
  }

  return Math.max(1, subRowEndTimes.length)
}
