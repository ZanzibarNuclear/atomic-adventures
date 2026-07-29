# Regional Geography

[DRAFT] — Fictional terrain for Part I. Setting is **somewhere in Maine**; the player does not know this immediately.

> **Naming update (2026-07-29):** The campus stream is **Clearwater Run** (rain/snowmelt; fictional tributary of a river TBD below campus). The campus plant is **Clearwater Diversion**. Draft labels **Mill Brook** and **Upper Penstock Plant** below are superseded; apply a thorough rename pass across story docs, contracts, and game copy when ready. Canonical fixture ids in `sims/energy-sims`: `clearwater-diversion`, stream narrative name Clearwater Run.

## Map asset

| File | Purpose |
|------|---------|
| `game-design/art/maps/fictional-maine-regional-map-v1.png` | Concept regional topo map (Sunol / USGS trail-map style) |
| Reference style | `assets/Sunol_Regional_Wilderness-*.png` (user-provided) |

*v1 is AI-generated — useful for mood and layout. Labels and geometry are approximate. For production, consider a code-drawn SVG or cartographer pass.*

## Canonical features (v1 map)

These names are the **story canon** for this draft map. Adjust as design evolves.

| Feature | Type | Story role |
|---------|------|------------|
| **Flagstaff Ridge** | Peak (1360 ft) | Landmark; orients the player in the mountains |
| **Clearwater Pond** | Pond | Natural water feature; possible forest approach landmark |
| **Mill Brook** | Stream | Drainage from pond toward the campus |
| **Pine Hollow Trail** | Hiking trail (dotted red) | Likely Zanzibar's approach path through the woods |
| **Ridge Line Trail** | Hiking trail (dotted red) | Connects parking area to campus via high route |
| **County Road 14** | Gravel road (dashed blue) | Public access; parking (P) at trailhead |
| **Upper Penstock Plant** | Diversion hydro powerhouse | Campus hydro — intake, penstock, turbine, generator on Mill Brook |
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
        Mill Brook                          Upper Penstock Plant
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
