# Photovoltaic Simulation

[DRAFT] — Specification for solar PV simulations. **Part II** technology — the player restores the solar field discovered on the eBuggy tour in Part I.

## Part II Focus — PV as the surface sequel to hydro

Part II is **PV-centric** on the **surface campus**. Zanzibar must:

1. **Return** to the solar field he discovered while driving the eBuggy
2. **Learn** irradiance, tilt, shading, and inverter behavior — not PV in the abstract, but **this campus array**
3. **Integrate** variable solar output with ongoing hydro operations
4. **Understand** why hydro + solar may not be enough — baseload need foreshadows Part III

Hydro continues running in the background during Part II.

## Scope

- **Panel layout** — Orientation, tilt, shading
- **Inverter** — DC to AC conversion, efficiency
- **Grid integration** — Load matching, storage (optional)

## Key Concepts to Teach

| Concept | Simulation Element |
|---------|-------------------|
| Solar irradiance | Time-of-day, weather, latitude |
| Tilt and orientation | Optimal angle; azimuth |
| Shading | Obstacles reduce output |
| I-V curve | Current vs. voltage; MPPT |
| Inverter efficiency | DC → AC losses |

## Proposed Interactions

1. **Panel placement** — Arrange panels; adjust tilt/azimuth; see output over day
2. **Shading analysis** — Add obstacles (trees, buildings); observe impact
3. **System sizing** — Match array to load; add inverter

## Parameters (Simplified)

- Latitude
- Panel tilt (°)
- Panel azimuth (°)
- Panel capacity (kW)
- Shading factor (0–1)
- Time of day / season

## Outputs

- Power (kW)
- Daily energy (kWh)
- Efficiency (%)

## Failure Modes (Educational)

- Oversizing inverter
- Poor tilt → low winter output
- Shading hotspots

## Reference Data

- *TBD — NREL PVWatts or similar for irradiance*
