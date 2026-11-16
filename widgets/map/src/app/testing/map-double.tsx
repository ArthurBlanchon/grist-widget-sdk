/**
 * Test doubles for the map: MapLibre needs WebGL, which jsdom lacks. They
 * render what would be drawn as plain elements, so tests read the points,
 * their colours and the countries' totals. The real map runs in CI's
 * real-Grist check.
 */
import type { ReactNode } from "react"

type Feature = { geometry: { coordinates: [number, number] }; properties: { id: number } }

export const mapDouble = {
  Map: ({ children }: { children?: ReactNode }) => <div data-testid="map">{children}</div>,
  MapControls: () => null,
  MapClusterLayer: ({
    data,
    pointColor,
    onPointClick,
  }: {
    data: { features: Feature[] }
    pointColor: string
    onPointClick?: (f: Feature, c: [number, number]) => void
  }) => (
    <ul data-testid="layer" data-color={pointColor}>
      {data.features.map((f) => (
        <li key={f.properties.id}>
          <button type="button" data-lonlat={f.geometry.coordinates.join(",")} onClick={() => onPointClick?.(f, f.geometry.coordinates)}>
            point {f.properties.id}
          </button>
        </li>
      ))}
    </ul>
  ),
  MapPopup: ({ children }: { children?: ReactNode }) => <div role="dialog">{children}</div>,
  useMap: () => ({ map: null, isLoaded: false }),
}

/**
 * For AC-volume: the map as MapLibre makes it, its points drawn on one
 * canvas (WebGL), not one element each.
 */
export const drawnMapDouble = {
  ...mapDouble,
  MapClusterLayer: ({ data }: { data: { features: Feature[] } }) => <canvas data-testid="layer" data-points={data.features.length} />,
}

export const countryLayerDouble = {
  WorldCountryLayer: ({
    counts,
    palette,
    valueLabel,
  }: {
    counts: ReadonlyMap<string, number>
    palette: { scale: string[] }
    valueLabel: (v: number) => string
  }) => (
    <ul data-testid="countries" data-scale={palette.scale.join(" ")}>
      {[...counts].map(([code, n]) => (
        <li key={code}>
          {code}: {valueLabel(n)}
        </li>
      ))}
    </ul>
  ),
}
