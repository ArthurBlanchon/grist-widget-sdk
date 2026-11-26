// A ChoiceList whose first choice is "L" (a size) keeps it, read and
// written back (#133). Grist sends lists decoded (keepEncoded off): ["L", "M"]
// is the choices L and M, and writes need the tag: ["L", "L", "M"].
import { act, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { defineGristWidget } from "../../src/sdk"
import { renderWithGrist } from "../../src/emulator/testing"

const widget = defineGristWidget({ requiredAccess: "full", columns: [{ name: "Sizes", type: "ChoiceList" }] })

describe("a ChoiceList with a first choice \"L\"", () => {
  it("reads as its choices and is written back unchanged", async () => {
    let w: ReturnType<typeof widget.useGrist> | null = null
    function App() {
      w = widget.useGrist()
      return <p>{w.mappedRecord ? `sizes ${JSON.stringify(w.mappedRecord.Sizes)}|${w.cellIssues.length}` : "none"}</p>
    }
    const { emulator } = renderWithGrist(<App />, { widget, rows: [{ Sizes: ["L", "M"] }] })
    expect(await screen.findByText('sizes ["L","M"]|0')).toBeTruthy()
    expect(emulator.state.tables.get("Table1")!.rows[0]!.Sizes).toEqual(["L", "L", "M"])

    await act(async () => {
      await w!.updateRecord({ Sizes: w!.mappedRecord!.Sizes })
    })
    expect(emulator.state.tables.get("Table1")!.rows[0]!.Sizes).toEqual(["L", "L", "M"])
    expect(await screen.findByText('sizes ["L","M"]|0')).toBeTruthy()
  })
})
