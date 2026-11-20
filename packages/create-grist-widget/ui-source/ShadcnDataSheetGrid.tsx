import { forwardRef } from "react"
import {
  DynamicDataSheetGrid,
  type DataSheetGridProps,
  type DataSheetGridRef,
} from "react-datasheet-grid"
import "react-datasheet-grid/dist/style.css"

import { cn } from "@/lib/utils"

import "./ShadcnDataSheetGrid.css"

export type ShadcnDataSheetGridProps<T> = DataSheetGridProps<T> & {
  /** Classes on the outer wrapper (border, radius, layout). */
  wrapperClassName?: string
}

/**
 * Themed datasheet grid aligned with shadcn tokens (light/dark).
 * Uses `DynamicDataSheetGrid` so `columns` updates apply after mount.
 */
type ShadcnDataSheetGridComponent = <T>(
  props: ShadcnDataSheetGridProps<T> & { ref?: React.Ref<DataSheetGridRef> }
) => React.ReactElement | null

const ShadcnDataSheetGridInner = <T,>(
  { wrapperClassName, ...props }: ShadcnDataSheetGridProps<T>,
  ref: React.ForwardedRef<DataSheetGridRef>
) => {
  return (
    <div
      className={cn(
        "shadcn-dsg min-h-0 min-w-0 overflow-hidden rounded-md border border-border bg-background text-foreground shadow-sm",
        wrapperClassName
      )}
    >
      <DynamicDataSheetGrid ref={ref} {...props} />
    </div>
  )
}

export const ShadcnDataSheetGrid = forwardRef(
  ShadcnDataSheetGridInner
) as ShadcnDataSheetGridComponent

export type { DataSheetGridProps, DataSheetGridRef } from "react-datasheet-grid"
