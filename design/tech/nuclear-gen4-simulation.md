# Nuclear Gen IV Simulation

[DRAFT] — Specification for Gen IV reactor simulations, starting with sodium-cooled fast reactor.

## Scope

- **Sodium-cooled fast reactor (SFR)** — Primary focus
- **Other Gen IV** — Molten salt, gas-cooled, etc. — as they come online in real life

## Key Concepts to Teach (SFR)

| Concept | Simulation Element |
|---------|-------------------|
| Fast neutrons | No moderator; different physics |
| Sodium coolant | Liquid metal; high heat capacity; reacts with water/air |
| Fuel cycle | Breeding, transmutation |
| Negative reactivity feedback | Inherent safety |
| Pool vs. loop design | Different configurations |

## Proposed Interactions

1. **Core configuration** — Fuel arrangement; coolant flow
2. **Transient** — Reactivity insertion; observe feedback
3. **Coolant behavior** — Temperature, flow; sodium-specific hazards (simplified)

## Parameters (Simplified)

- Power level
- Coolant flow
- Fuel composition (simplified)
- Control rod position

## Outputs

- Reactor power
- Coolant temperature
- Neutron flux (simplified indicator)
- Safety status

## Future Gen IV Additions

- **Molten salt reactor (MSR)** — Liquid fuel, different dynamics
- **Gas-cooled (VHTR, SFR)** — Helium, different heat transfer
- *Add specs as designs mature and become publicly documented*

## Reference Data

- IAEA Gen IV reports
- Natrium (TerraPower/GEH) — sodium-cooled
- *TBD — Specific designs for calibration*
