import { useRef } from "react"

/** Incremented on every render of the component that calls this hook. */
export function useRenderCount(): number {
  const count = useRef(0)
  count.current += 1
  return count.current
}

export async function settle(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0))
}
