# Regional Geography

[DRAFT] — Fictional terrain for Part I. Setting is **somewhere in Maine**; the player does not know this immediately.

## Naming: Clearwater Run & Clearwater Diversion

**Status (2026-07-29):** Player-facing / engine-facing names locked for Stage 1 hydro. Draft map labels **Mill Brook** and **Upper Penstock Plant** (table and ASCII map below) are **superseded**. Apply a thorough rename pass across story docs, contracts, game copy, and map art when ready.

| Role | Name | Notes |
|------|------|--------|
| Watercourse | **Clearwater Run** | Rain and snowmelt; plentiful but not large. “Run” stays slightly ambiguous (stream vs small river)—fine for scale. Fictional tributary of a **river TBD** below campus. |
| Campus plant | **Clearwater Diversion** | Diversion / run-of-river powerhouse (intake, penstock, turbine, generator)—not a big dam. |
| Engine fixtures | `clearwater-diversion`, session `clearwater-utility` | In `sims/energy-sims` (`fixtures/plants/`, `fixtures/stations/`). |

### Hydrology / character (for later backstory)

- Fed by **rain and snowmelt** off the high ground (Clearwater Pond / Flagstaff Ridge area)—the English *clear* is literal: clean mountain water, not murky lowland flow.
- Scale: enough water for a small teaching diversion plant (order of a few kW in the energy-sims fixture), not a gorge-spanning project.
- Downstream: Clearwater Run joins a larger, still-unnamed river below the campus; that river’s name can be chosen later without renaming the Run or the plant.

### Possible origin of the English name (for later lore)

There is **no single pan‑Indigenous word** for “clearwater.” Maine-ish framing points to **Wabanaki** peoples and related Algonquian languages (Abenaki, Penobscot, Passamaquoddy–Maliseet, Mi’kmaq, etc.)—related, not interchangeable.

**Documented building blocks (research notes, not a game product SKU):**

| Language / area | Term | Rough sense |
|-----------------|------|-------------|
| Western Abenaki | *nebi* | water |
| Penobscot | *nəpi* / *nepi* | water (also in community water-song materials) |
| Western Abenaki | *wôbi* | white (often “bright / light-colored” in place names) |
| Real place-name pattern | *Wôbatekw* | Abenaki name for Vermont’s White River (“white” + river element) |

In this region, “clear / pure / bright water” is often closer to **white/bright + water/river** than to the English adjective *clear*. English **Clearwater** is a common historical **calque**: settlers (or maps) translating a descriptive older name into everyday English.

**Story options (prefer later; keep respectful):**

1. **Calque origin (recommended for fiction)** — In-world, **Clearwater Run** is the everyday English name. Local tradition (elder, plaque, holo-reader) holds that it calques an older Wabanaki description of **bright / pure water** (snowmelt and rain). The game keeps **Clearwater** as the player-facing name; any Indigenous form is **mentioned with care**, not invented as a catchy brand.
2. **Point at real patterns, don’t invent compounds** — Safe to note that Abenaki-style place naming includes “white/bright” + water/river (e.g. *Wôbatekw*). Do **not** invent forms like *Wôbi-nebi-run* unless a speaker or language program signs off.
3. **If a real language form ever appears on a map or in dialogue** — Treat as **language work**: pick a specific nation/language, use community dictionaries or educators, and prefer consultation over cleverness. Living languages are not set dressing.

**Practical default until a lore pass:** Clearwater Run + Clearwater Diversion stand alone; optional one- or two-line calque origin when the area’s backstory is filled out. River below campus remains open.

## Map asset

| File | Purpose |
|------|---------|
| `game-design/art/maps/fictional-maine-regional-map-v1.png` | Concept regional topo map (Sunol / USGS trail-map style) |
| Reference style | `assets/Sunol_Regional_Wilderness-*.png` (user-provided) |

*v1 is AI-generated — useful for mood and layout. Labels and geometry are approximate. For production, consider a code-drawn SVG or cartographer pass.*

## Canonical features (v1 map)

These names are the **story canon** for this draft map. Adjust as design evolves.

*Watercourse / plant:* prefer **Clearwater Run** and **Clearwater Diversion** (see [Naming](#naming-clearwater-run--clearwater-diversion)). Struck rows below are draft labels still on the v1 map asset.

| Feature | Type | Story role |
|---------|------|------------|
| **Flagstaff Ridge** | Peak (1360 ft) | Landmark; orients the player in the mountains |
| **Clearwater Pond** | Pond | Natural water feature; possible forest approach landmark |
| ~~**Mill Brook**~~ → **Clearwater Run** | Stream / run | Drainage from pond toward the campus; rain & snowmelt |
| **Pine Hollow Trail** | Hiking trail (dotted red) | Likely Zanzibar's approach path through the woods |
| **Ridge Line Trail** | Hiking trail (dotted red) | Connects parking area to campus via high route |
| **County Road 14** | Gravel road (dashed blue) | Public access; parking (P) at trailhead |
| ~~**Upper Penstock Plant**~~ → **Clearwater Diversion** | Diversion hydro powerhouse | Campus hydro — intake, penstock, turbine, generator on Clearwater Run |
| **Research Campus** | Building cluster | Secret DoE research facility (not public knowledge) |

## Approximate layout

```
                    Flagstaff Ridge (1360')
                           |
    County Road 14 ---- P (parking)
           |               |
           |         Pine Hollow Trail ----\
           |               |                 \
      Clearwater Pond   Ridge Line Trail ---- Research Campus
           |                                      |
     Clearwater Run                    Clearwater Diversion
     (was: Mill Brook)                 (was: Upper Penstock)
                                                  |
                                             [powerhouse]
```

## Map conventions (matching reference style)

- Contour interval: **200 feet**
- Trails: dotted red; mileage decimals along segments
- Roads: dashed blue
- Grid: lat/long overlay (~45°07'N, 69°22'W — fictional Maine coords)
- Icons: peak triangle, parking P, building cluster

## Open questions

- [ ] Does Zanzibar arrive via Pine Hollow Trail, Ridge Line Trail, or off-trail through forest?
- [ ] Is the campus labeled on any *in-world* map the player finds, or unmarked?
- [ ] How far is the trailhead parking from the campus (hours on foot when hungry)?
- [ ] Regenerate map with corrected legend text, or redraw as SVG for production?

## Revision notes

- *Align with [Story Overview](story-overview.md) prologue beats*
- *Add building-level map when main-building layout is defined*
