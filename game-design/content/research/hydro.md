# Hydro — Research Notes

[INTEGRATED] — Decision captured in [Hydro Simulation](../subject-matter/hydro-simulation.md). Story docs may still use older "dam" language in places — update as Part I prose is written.

## Decision: diversion penstock, no large dam

**Date:** 2026-05-24

For the campus hydro plant (Part I first power), we use **diversion / run-of-river** hydro on **Clearwater Run** (**Clearwater Diversion** plant; **Clearwater Station** bus). Plant of record: sibling `../sims/energy-sims`. Draft name “Mill Brook” is superseded:

1. **Divert** stream flow at an intake (weir or headworks — not a large impoundment dam)
2. **Convey** water through a **penstock** downhill
3. **Drive** a **turbine–generator** in a hillside powerhouse
4. **Control** remotely from the hydro control room in the main building (Clearwater Station)

Power: **P = η ρ g Q H** — head from elevation drop along the penstock, not reservoir height.

Part I simulation focus: **startup** (one-time), then **operations** (weeks of maintenance and power management). Hydro competence gates **Part II** (PV restoration).

## Why this fits the game

- **Geography:** Clearwater Run drains from Clearwater Pond toward the campus (`regional-geography.md`). Names are discovery-gated for the player.
- **Teaching:** Same core physics without reservoir dynamics as a first lesson.
- **Story beat:** Library → control room → power on → EV buggy.
- **Near-future liberty:** Advanced turbines and controls; physics unchanged.
- **Engine:** Clearwater fixtures in energy-sims — not forked game constants.

## Deferred / optional later

- Storage dams, spillways, pumped storage — separate chapter or advanced sandbox
- Full turbine-selector sandbox — after Part I gate is working
- Working official names into discovery content and retiring remaining Mill Brook / Upper Penstock prose

## Open questions

- [ ] Intake location: on Clearwater Run, at Clearwater Pond outlet, or a dedicated branch?
- [ ] Campus load threshold for simulation pass/fail (align with energy-sims station loads)
- [x] Rename regional map feature → **Clearwater Diversion** (was Upper Penstock Plant)
- [ ] Player-facing vocabulary: weir, intake, penstock, powerhouse — vs. simplified terms
- [ ] Small forebay pond at intake, or strictly run-of-river?
- [ ] Discovery beats for Clearwater Run / Diversion / Station names

## References to gather

- [ ] Example small diversion hydro plants (head, flow, MW) for calibration
- [ ] Typical penstock materials, pressure, and length vs. head
- [ ] Run-of-river vs. storage dam — holo-reader comparison content (post–first power)
