// A ChoiceList whose first choice is "L" (a size) keeps it (#133): the
// section's rows come decoded, fetchRows(tableId) gives the stored form.
import { describe, expect, it } from "vitest"

import { cellText } from "./cell-text"
import { display, fieldOf, fromForm, toForm } from "./grist-fields"
import { fromStored } from "./stored"

const sizes = fieldOf({ colId: "Sizes", type: "ChoiceList", label: "Sizes" })

describe('a choice "L"', () => {
  it("is a choice in a decoded list, shown as text", () => {
    expect(cellText(["L", "M"], "en")).toBe("L, M")
    expect(display(["L", "M"])).toBe("L, M")
  })

  it("is a choice in the form, and written back with the list tag", () => {
    expect(toForm(sizes, ["L", "M"])).toEqual(["L", "M"])
    expect(fromForm(sizes, ["L", "M"])).toEqual({ ok: true, value: ["L", "L", "M"] })
  })

  it("loses only the tag when a stored list is decoded", () => {
    expect(fromStored(["L", "L", "M"])).toEqual(["L", "M"])
    expect(fromStored(["L"])).toEqual([])
    expect(fromStored("L")).toBe("L")
  })
})
