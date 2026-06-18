# Part I — Unlock Catalog

[DRAFT] — Concrete unlock chains for Part I: hydro progression, campus discoveries, and Part II foreshadowing.

See also [Progression Design](progression-design.md) (staged complexity, gate types) and [Story Overview](story/story-overview.md).

## Unlock model

An **unlock** is something the player gains access to — a control, a room, a vehicle, a story beat, or the next challenge. Most progression unlocks use **prerequisite challenges**: step *N* is not available until step *N−1* is solved.

| Concept | Meaning | Example |
| -------- | -------- | -------- |
| **Challenge** | A solvable problem with clear success criteria | Clear intake debris |
| **Requires** | Prior challenges, flags, or exploration | `hydro.clear-intake-debris` |
| **Sets** | Story/sim flags on success | `hydro.intake-clear` |
| **Unlocks** | What becomes available next | Turbine valve control enabled |

**Two tracks (both matter in Part I):**

1. **Progression** — Hydro (and later power-management) challenges in order. Required for competence and the Part II threshold.
2. **Discovery** — Campus exploration, other tech sightings, lore. Often **optional for the next hydro step** but required for a full picture of the facility and Act II expectations.

Flag naming (implementation): dot-scoped kebab-case per [Story Data Format](story/story-data-format.md) — e.g. `hydro.level-1-complete`, `hub.buggy-charged`.

---

## Hydro — Level 1 (startup)

**Milestone:** Station power on. **Level 1 complete.**

The first win should feel straightforward: four visible steps, each teaching one link in the chain. The game can still deliver the staged-complexity beat *after* this — operations will show that “running once” is not “running a plant.”

| Step | Challenge ID | Player does | Success signal | Requires |
| ---- | ------------- | ----------- | -------------- | -------- |
| 1 | `hydro.clear-intake-debris` | Clear debris at the intake (field visit and/or remote indication) | Intake path open; telemetry ready for flow | Library prep (manual read) — *soft gate, TBD* |
| 2 | `hydro.confirm-penstock-pressure` | Observe penstock / head pressure rise as water fills the line | Gauges show stable rising pressure | `hydro.clear-intake-debris` |
| 3 | `hydro.open-turbine-valve` | Open valve admitting flow to the turbine | Flow to turbine; turbine begins to spin | `hydro.confirm-penstock-pressure` |
| 4 | `hydro.energize-generator` | Switch on / sync generator to campus load | **Power in the station** — lights, charge port, control room fully live | `hydro.open-turbine-valve` |

**On Level 1 complete:**

- Sets `hydro.level-1-complete`, `hub.hydro_online`
- Unlocks: holo-readers (power-gated library beat), EV charge port, campus circuits at baseline load
- Unlocks discovery track: **buggy charge and compound exploration** (see below)

---

## Hydro — Operations (Level 2+)

After Level 1, hydro shifts to **recurring rounds**. Each round is one focused problem (plausible solo-operator scope). Later rounds may require discoveries (e.g. enabling a new campus circuit after finding solar).

| Round | Challenge theme | Teaches | Example requires | Sets / unlocks |
| ----- | ----------------- | ------- | ---------------- | -------------- |
| 2a | **Pressure loss** — leaky penstock section | Integrity matters; find leak, isolate or repair | `hydro.level-1-complete` | `hydro.penstock-integrity-ok` |
| 2b | **Read the gauges** | Telemetry literacy; normal vs. alarm ranges | 2a or parallel after first “too easy” ops day | `hydro.telemetry-trained` |
| 2c | **Match load to capacity** | Supply ≥ demand; brownout if not | `hydro.telemetry-trained` | `hub.load-balance-basic` |
| 2d | **Excess capacity** | Curtailment, waste heat, or storage opportunity — not all load can be dumped | `hub.load-balance-basic` | `hub.excess-generation-handled` |
| 2e | **Intake maintenance (again)** | Debris / season; flow variability | recurring schedule | — |
| 2f | **Weather / low flow** | Reduce load or accept limits | prior ops rounds | — |
| … | *More rounds TBD* | Stacks complexity over **weeks** | prior round + optional discovery flags | — |

**Reality-check pattern:** After Level 1, the first operations day may repeat “all green” — then a leak (or similar) breaks the illusion. See [Staged Complexity](progression-design.md#staged-complexity-through-real-world-challenges).

---

## Part II threshold (progression capstone)

Not a single challenge — a **bundle** of progression + time + discovery (exact weights TBD):

| Requirement | Role |
| ----------- | ---- |
| `hydro.level-1-complete` | Plant has been started |
| Sustained ops — *N* rounds passed (2a–2f and successors) | Operator competence, not one-shot luck |
| `hub.hydro_operator_qualified` | Composite: maintenance on schedule, load scenarios passed |
| Optional: key **discovery** flags | Elevator clue only visible when campus is understood |

**Unlocks:** Hidden elevator discoverable / powered / callable → Part II.

---

## Discovery track (campus and other tech)

Discoveries **reward exploration** and **foreshadow** technologies without requiring full restoration before the elevator. They can gate optional load (e.g. charging storage) or holo-reader chapters.

| Discovery | ID (draft) | How player finds it | Requires (minimum) | Unlocks / foreshadows |
| --------- | ----------- | --------------------- | -------------------- | --------------------- |
| **EV buggy** | `hub.buggy-found` | Garage — already in shelter beat | Shelter / garage explored | Known before power; charge needs `hub.hydro_online` |
| **Buggy charged & compound tour** | `hub.buggy-mobile` | Charge at port; drive campus | `hydro.level-1-complete` | New outdoor/building access; environmental storytelling |
| **Battery storage array** | `hub.storage-discovered` | Compound exploration or ops doc / telemetry hint | `hub.buggy-mobile` or ops round *TBD* | Teaches storage vs. generation; optional future load-shifting puzzle |
| **Solar panel field** | `hub.solar-discovered` | Visible from buggy route or map in control room | `hub.buggy-mobile` | PV chapter foreshadow; panels dormant until Part I extension or Part II |
| **Act II — advanced modular reactor** | `hub.reactor-tease` | Holo-reader chapter, conference room, signage on descent-adjacent structures | `hub.hydro_online` + holo-readers; stronger after weeks of ops | **Part II expectation:** what lies below is not more surface hydro — modular advanced nuclear (align naming with [World & Style](story/world-and-style.md) Gen IV / facility map when fixed) |

**Design intent:**

- **Buggy** — Celebration and **spatial** adventure; player sees scale of DoE campus.
- **Storage + solar** — “This place was a full energy portfolio” without forcing PV sim before elevator.
- **Reactor tease** — Curiosity hook for descent; details stay sparse until Part II.

Discoveries should not skip hydro competence for the elevator — they **complement** the operations spine.

---

## Cross-beat unlock map (summary)

```
Shelter → garage (buggy found)
    → library (study)
    → hydro L1 chain (4 steps) → hub.hydro_online
        → holo-readers, buggy charge, compound discoveries (storage, solar, reactor tease)
        → hydro ops rounds (leak, gauges, load, excess, …)
        → hub.hydro_operator_qualified → hidden elevator → Part II
```

---

## Open questions

- [ ] Soft vs. hard gate: must library be visited before intake debris challenge?
- [ ] Field trip: does clearing debris require a buggy trip to intake, remote only, or both?
- [ ] Calendar: which discovery beats land in “startup week” vs. “operations weeks”?
- [ ] Solar/storage: interactable in Part I (mini-puzzle) or discover-only until Part II?
- [ ] Elevator discovery trigger: pure competence flag vs. clue found while exploring with buggy

## Revision Notes

- [x] Level 1 hydro four-step chain and Level 1 complete milestone (2026-06)
- [x] Operations round themes (leak, gauges, load, excess) as draft list (2026-06)
- [x] Discovery track: buggy, storage, solar, Act II reactor tease (2026-06)
- [ ] Wire challenge IDs into story YAML areas and sim component gates
