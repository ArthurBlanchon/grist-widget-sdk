import "@testing-library/jest-dom/vitest"
import { act } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, renderWithGrist, screen, waitFor, within } from "grist-widget-sdk/emulator/testing"

import App, { widget } from "./App"
import { readPalette } from "./palette"

// MapLibre needs WebGL, which jsdom lacks: the map and the country layer are doubles that show what would be drawn.
vi.mock("@shared/ui/map", async () => (await import("./testing/map-double")).mapDouble)
vi.mock("./world-country-layer", async () => (await import("./testing/map-double")).countryLayerDouble)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.documentElement.classList.remove("dark")
})

const STORES = [
  { Latitude: 45.76, Longitude: 4.84, Label: "Lyon", Category: "Hyper", Country: "FR", Value: 120 },
  { Latitude: 48.85, Longitude: 2.35, Label: "Paris", Category: "Super", Country: "fra", Value: 80 },
  { Latitude: 52.52, Longitude: 13.4, Label: "Berlin", Category: "Hyper", Country: "DE", Value: 50 },
  { Latitude: null, Longitude: null, Label: "Nowhere", Category: "Super", Country: "DE", Value: 10 },
  { Latitude: 123, Longitude: 2, Label: "Off the map", Category: "Super", Country: null, Value: null },
]

const POINTS = { Latitude: "Latitude", Longitude: "Longitude", Label: "Label", Category: "Category" }
const COUNTRIES = { Country: "Country", Value: "Value" }

function setup(mappings: Record<string, string>, rows: Record<string, unknown>[] = STORES) {
  const result = renderWithGrist(<App />, { widget, rows })
  result.emulator.setColumnMappings(mappings)
  return result
}

const layers = () => screen.getAllByTestId("layer")

describe("Map", () => {
  it("AC-1 places each row with coordinates as a point", async () => {
    setup(POINTS)
    await screen.findByText(/^3 points/)
    const lonlat = layers().flatMap((l) => within(l).getAllByRole("button").map((b) => b.dataset.lonlat))
    expect(lonlat.sort()).toEqual(["13.4,52.52", "2.35,48.85", "4.84,45.76"])
  })

  it("AC-2 leaves out rows without valid coordinates, and says how many", async () => {
    setup(POINTS)
    expect(await screen.findByText(/2 rows without valid coordinates not shown/)).toBeInTheDocument()
  })

  it("AC-3 colours points by category from the theme, with a legend", async () => {
    setup(POINTS)
    await screen.findByText(/^3 points/)
    expect(layers()).toHaveLength(2)
    const [hyper, superette] = layers()
    expect(within(hyper!).getAllByRole("button")).toHaveLength(2)
    expect(hyper!.dataset.color).not.toBe(superette!.dataset.color)
    const legend = screen.getByRole("list", { name: "Legend" })
    expect(within(legend).getByText("Hyper")).toBeInTheDocument()
    expect(within(legend).getByText("Super")).toBeInTheDocument()
  })

  it("AC-4 selects a clicked point's row and shows its label", async () => {
    const { emulator } = setup(POINTS)
    await screen.findByText(/^3 points/)
    fireEvent.click(screen.getByRole("button", { name: "point 2" }))
    await waitFor(() => expect(emulator.state.selection.rowId).toBe(2))
    expect(within(screen.getByRole("dialog")).getByText("Paris")).toBeInTheDocument()
  })

  it("AC-5 colours countries by the sum of their values, or by their number of rows", async () => {
    setup(COUNTRIES)
    const countries = await screen.findByTestId("countries")
    expect(within(countries).getByText("FR: Value: 120")).toBeInTheDocument()
    expect(within(countries).getByText("FRA: Value: 80")).toBeInTheDocument()
    expect(within(countries).getByText("DE: Value: 60")).toBeInTheDocument()
    cleanup()
    setup({ Country: "Country" })
    const counted = await screen.findByTestId("countries")
    expect(within(counted).getByText("DE: Rows: 2")).toBeInTheDocument()
    expect(within(counted).getByText("FR: Rows: 1")).toBeInTheDocument()
  })

  it("AC-6 reads two- and three-letter country codes in any case", async () => {
    setup(COUNTRIES, [
      { Country: "fr", Value: 1 },
      { Country: " FRA ", Value: 2 },
      { Country: "Fr", Value: 3 },
      { Country: "France", Value: 4 },
    ])
    const countries = await screen.findByTestId("countries")
    // "fr" and "Fr" are one code; "FRA" another (the map matches both to France); "France" is not a code.
    expect(within(countries).getByText("FR: Value: 4")).toBeInTheDocument()
    expect(within(countries).getByText("FRA: Value: 2")).toBeInTheDocument()
    expect(within(countries).queryByText(/FRANCE/)).not.toBeInTheDocument()
  })

  it("AC-7 takes its colours from the theme, read again when the theme changes", async () => {
    // A canvas that resolves each colour by the page's theme, as a browser would.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        ({
          clearRect() {},
          fillRect() {},
          fillStyle: "",
          getImageData: () => ({ data: document.documentElement.classList.contains("dark") ? [10, 20, 30, 255] : [200, 210, 220, 255] }),
        }) as unknown as CanvasRenderingContext2D,
    )
    expect(readPalette().scale[0]).toBe("#c8d2dc")
    setup(COUNTRIES)
    const countries = await screen.findByTestId("countries")
    expect(countries.dataset.scale).toContain("#c8d2dc")
    await act(async () => document.documentElement.classList.add("dark"))
    await waitFor(() => expect(screen.getByTestId("countries").dataset.scale).toContain("#0a141e"))
  })

  it("AC-8 says what to map when neither coordinates nor a country are", async () => {
    setup({ Label: "Label" })
    expect(await screen.findByText(/Map a Latitude and a Longitude column/)).toBeInTheDocument()
  })

  it("AC-9 speaks French to a browser that prefers it", async () => {
    vi.stubGlobal("navigator", { ...navigator, languages: ["fr-FR"], language: "fr-FR" })
    setup(POINTS)
    expect(await screen.findByText("Carte")).toBeInTheDocument()
    expect(screen.getByText(/2 lignes sans coordonnées valides/)).toBeInTheDocument()
  })

  it("AC-10 shows an HTML label or category as text", async () => {
    setup(POINTS, [
      { Latitude: 1, Longitude: 1, Label: "<img src=x onerror=alert(1)>", Category: "<b>A</b>", Country: null, Value: null },
      { Latitude: 2, Longitude: 2, Label: "Other", Category: "B", Country: null, Value: null },
    ])
    await screen.findByText("2 points")
    expect(screen.getByText("<b>A</b>")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "point 1" }))
    expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeInTheDocument()
    expect(document.querySelector("img, b")).toBeNull()
  })
})
