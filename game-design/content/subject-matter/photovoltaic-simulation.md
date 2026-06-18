# Photovoltaic Simulation

[DRAFT] — Specification for solar PV simulations.

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
