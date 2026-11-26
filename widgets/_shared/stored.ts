/**
 * A cell as `fetchRows(tableId)` returns it, Grist's stored form, turned into
 * the form the section's rows have: a list without its `"L"` tag. The
 * section's rows come decoded, so a list there is its items, and a first
 * choice "L" is a choice (#133): never strip a tag from them.
 */
export function fromStored(value: unknown): unknown {
  return Array.isArray(value) && value[0] === "L" ? value.slice(1) : value
}
