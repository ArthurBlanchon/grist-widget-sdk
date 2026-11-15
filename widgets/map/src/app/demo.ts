import type { GristWidgetDemo } from "grist-widget-sdk"

// City, country (ISO), latitude, longitude.
const CITIES: [string, string, number, number][] = [
  ["Paris", "FR", 48.857, 2.352], ["Lyon", "FR", 45.764, 4.836], ["Marseille", "FR", 43.296, 5.37], ["Lille", "FR", 50.629, 3.057],
  ["Bordeaux", "FR", 44.838, -0.579], ["Berlin", "DE", 52.52, 13.405], ["Munich", "DE", 48.137, 11.575], ["Hamburg", "DE", 53.551, 9.994],
  ["Cologne", "DE", 50.938, 6.96], ["Frankfurt", "DE", 50.111, 8.682], ["Madrid", "ES", 40.417, -3.704], ["Barcelona", "ES", 41.385, 2.173],
  ["Valencia", "ES", 39.47, -0.376], ["Seville", "ES", 37.389, -5.984], ["Rome", "IT", 41.903, 12.496], ["Milan", "IT", 45.464, 9.19],
  ["Naples", "IT", 40.852, 14.268], ["Turin", "IT", 45.07, 7.687], ["Amsterdam", "NL", 52.368, 4.904], ["Rotterdam", "NL", 51.924, 4.478],
  ["Brussels", "BE", 50.85, 4.352], ["Antwerp", "BE", 51.219, 4.402], ["Lisbon", "PT", 38.722, -9.139], ["Porto", "PT", 41.158, -8.629],
  ["Vienna", "AT", 48.208, 16.373], ["Zurich", "CH", 47.377, 8.541], ["Geneva", "CH", 46.204, 6.143], ["Warsaw", "PL", 52.23, 21.012],
  ["Kraków", "PL", 50.065, 19.945], ["Prague", "CZ", 50.075, 14.438], ["Budapest", "HU", 47.498, 19.04], ["Copenhagen", "DK", 55.676, 12.568],
  ["Stockholm", "SE", 59.329, 18.069], ["Gothenburg", "SE", 57.709, 11.975], ["Oslo", "NO", 59.914, 10.752], ["Helsinki", "FI", 60.17, 24.938],
  ["Dublin", "IE", 53.35, -6.26], ["Athens", "GR", 37.984, 23.728], ["Bucharest", "RO", 44.426, 26.103], ["Ljubljana", "SI", 46.056, 14.506],
]
const FORMATS = ["Hypermarket", "Supermarket", "Convenience"]

/** A retailer's stores across Europe: points by format, or countries coloured by revenue. */
export const demo: GristWidgetDemo = {
  tables: {
    Stores: {
      columns: { City: "Text", Format: "Choice", Latitude: "Numeric", Longitude: "Numeric", Country: "Text", Revenue: "Numeric" },
      choices: { Format: FORMATS },
      rows: CITIES.map(([City, Country, Latitude, Longitude], i) => {
        const Format = FORMATS[(i * 2) % 3]
        const base = Format === "Hypermarket" ? 42 : Format === "Supermarket" ? 15 : 3
        return { City, Format, Latitude, Longitude, Country, Revenue: Math.round((base + ((i * 7) % 10) / 2) * 1e6) }
      }),
    },
  },
  mapping: { Latitude: "Latitude", Longitude: "Longitude", Label: "City", Category: "Format", Country: "Country", Value: "Revenue" },
}
