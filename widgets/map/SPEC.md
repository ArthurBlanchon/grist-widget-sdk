---
slug: map
title: Map
category: maps
status: beta
access: read table
bundle-kb: 400
---

# Map

## Job

People who keep places in Grist (clients, sites, stores, interventions)
see them on a map. In points mode, each row with coordinates is a point,
coloured by its category; points close together cluster, and clicking one
selects its row, so linked widgets follow. In countries mode, each
country is coloured by a value (a sum per country, or a count of rows).

This is the world-map widget brought into the catalog on the component it
already used, mapcn's map (shadcn registry, MIT, on MapLibre GL,
BSD-3-Clause), in `widgets/_shared/ui/map.tsx`, with a points mode added.

## Columns

| Column | Type | Required | Use |
| --- | --- | --- | --- |
| Latitude | Numeric | no | with Longitude, places a row as a point |
| Longitude | Numeric | no | with Latitude |
| Label | Any | no | a point's name, in its card |
| Category | Any | no | a point's colour, with a legend |
| Country | Text | no | without coordinates: the row's country, as an ISO code (`FR` or `FRA`) |
| Value | Numeric or Int | no | the number summed per country; without it, rows are counted |

The mode follows the mapping: points when Latitude and Longitude are
mapped, otherwise countries when Country is.

## Access

`read table`: it reads the rows and moves the selection.

## Size

About 375 KB of JavaScript (gzip), budget 400 KB: MapLibre GL is most of
it. It loads in a chunk of its own once Grist has answered, so the widget
shows its first state at once.

## Network

The base map's tiles and fonts come from CARTO's basemaps
(`basemaps.cartocdn.com`), mapcn's default: the widget's only network
calls. The countries' shapes are Natural Earth's (public domain), served
with the widget.

## Acceptance criteria

- **AC-1** Given rows with a latitude and a longitude, each is a point at
  those coordinates.
- **AC-2** Given rows without valid coordinates, they are left out and the
  header says how many.
- **AC-3** Given a Category column, points are coloured by category, from
  the theme's colours, with a legend.
- **AC-4** Given a point clicked, its row is selected in Grist and a card
  shows its label.
- **AC-5** Given a Country column and no coordinates, the map colours each
  country by the sum of its rows' values, or by its number of rows without
  a Value column.
- **AC-6** Given country codes of two or three letters, in any case, they
  are read the same.
- **AC-7** Given the map's colours, they come from the shared theme,
  read again when Grist switches between light and dark.
- **AC-8** Given neither coordinates nor a country mapped, the widget says
  what to map.
- **AC-9** Given a browser that prefers French, the widget's text is in
  French.
- **AC-10** Given a label or a category that is HTML, it is shown as text.

## Out of scope

- Geocoding addresses into coordinates: the Address geocoder (later) does
  it, into columns this widget reads.
- Regions other than countries (French departments, US states).
- Drawing shapes or routes.

## Demo data

Stores: about forty shops across Europe with their city as label, a
format (Hypermarket, Supermarket, Convenience) as category, their
coordinates, their country, and a yearly revenue as value.
