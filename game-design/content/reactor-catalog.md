# Reactor & Extension Catalog

[DRAFT] — Shared list of power technologies for **Atomic Adventures** (trilogy + post-game extensions) and future spin-offs (e.g. **Nuclear Magnate**). Not story canon until referenced in beats or sim specs.

## How this catalog is used

| Layer | Role |
| ----- | ---- |
| **Release trilogy** | One fixed SMR for Part III — [Aalo-1 class](research/aalo-atomics.md) |
| **Post-game extensions** | Optional modules unlocked **after the campus SMR is running** — new sims, wings, or story beats; **do not replace** Part III |
| **Future games** | Same research + sim components reused; player **chooses** from catalog (e.g. tycoon / builder) |

Extensions are **extra to try**, not alternate endings. Hydro, PV, and the Part III SMR remain the core learning path.

## Release trilogy (fixed)

| ID | Technology | Real-world anchor | Sim / research |
| -- | ---------- | ----------------- | -------------- |
| `hydro-penstock` | Diversion hydro | Campus penstock plant | [hydro-simulation.md](subject-matter/hydro-simulation.md) |
| `pv-campus-array` | Photovoltaics | Surface solar field | [photovoltaic-simulation.md](subject-matter/photovoltaic-simulation.md) |
| `smr-aalo-1` | Sodium LMR (thermal) | [Aalo-1 / Aalo-X](research/aalo-atomics.md) | [nuclear-gen4-simulation.md](subject-matter/nuclear-gen4-simulation.md) |

## Post-game extensions (planned)

Unlocked when `hub.smr_operational` (or equivalent Part III completion flag) is set. Each extension adds content; prior parts stay playable.

| ID | Name | Adds | Prerequisite | Spec / research |
| -- | ---- | ---- | ------------ | --------------- |
| `ext-oklo-recycle` | **Waste recycling & fast reactor** | Pyroprocessing wing + **Aurora-class** fast module to burn U/TRU; Aalo SMR **keeps running** on fresh fuel | Part III complete | [oklo-aurora-extension.md](subject-matter/oklo-aurora-extension.md), [oklo-aurora.md](research/oklo-aurora.md), [pyroprocessing.md](research/pyroprocessing.md) |
| `ext-natrium` | Natrium-class SFR | Fast sodium, different neutronics; optional breeding lore | Part III complete | Research TBD |
| `ext-msr` | Molten salt reactor | Liquid-fuel / salt-coolant sim (separate from pyro bath) | Part III complete | [fusion-simulation.md](subject-matter/fusion-simulation.md) notes MSR distinction |
| `ext-ap1000` | Gen III+ PWR | PWR chapter for contrast with SMR | Part III complete | [nuclear-ap1000-simulation.md](subject-matter/nuclear-ap1000-simulation.md) |
| `ext-pumped-storage` | Pumped hydro | Storage complement to hydro + PV | Part I + II complete | [hydro research](research/hydro.md) — out of scope Part I |
| `ext-fusion` | Tokamak | Aspirational capstone | TBD | [fusion-simulation.md](subject-matter/fusion-simulation.md) |

_Add rows as extensions are scoped. Each needs: unlock flag, map/building hook, sim component ID, learning objectives._

## Oklo extension — relationship to Part III SMR

The **`ext-oklo-recycle`** pack is **additive**:

```
Part III complete → Aalo SMR operational (baseload)
        ↓
Extension unlock → restore sealed recycling wing (+ cask pad)
        ↓
Pyro line online → U/TRU metal fuel available
        ↓
Optional: bring **Aurora fast module** online to consume U/TRU
        (Aalo continues on LEU UO₂ — spectrum mismatch if you cross fuels)
```

Story fiction: the DoE campus was built to demonstrate a **full portfolio** including closed fuel cycle; recycling was dormant until the player restores baseload power and team capacity.

## Future spin-off: Nuclear Magnate (concept)

Possible **follow-up game** — different genre (builder / tycoon), shared tech stack:

- Player grows a power business: **site selection, financing, construction, operations**
- **Choose reactor model** from this catalog (and later additions)
- Reuse simulation components from Atomic Adventures; less CYOA, more economic loop
- Atomic Adventures remains the **story-first tutorial**; Magnate is **sandbox scale-up**

Not in scope for the trilogy vertical slice. Catalog entries should stay **modular** so Magnate can mix hydro, PV, SMR, and extension technologies without rewriting Part III.

## Catalog maintenance

When adding a real-world design:

1. Add **research** note under `content/research/`
2. Add or extend **subject-matter** sim spec
3. Register row in this catalog with `id`, unlock rules, and links
4. Mark **trilogy** vs **extension** vs **Magnate-only**

## Open questions

- [ ] Extension delivery: DLC routes in same app vs separate menu vs sequel hub
- [ ] One extension at a time vs bundled “campus complete” pack
- [ ] Magnate naming, scope, and which catalog entries ship first
- [ ] Cross-extension interactions (e.g. PV + pumped storage + SMR dispatch game)

## Revision notes

- [x] Catalog created; Oklo extension defined as post-SMR add-on (2026-06)
