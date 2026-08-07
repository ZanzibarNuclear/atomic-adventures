# Energy-sim sole path — legacy hydro rip-out

**Status:** Implemented 2026-08-07 (Phases 0–2). Phase 3 polish optional.  
**Goal:** One physics universe (energy-sims WASM in the player browser). Remove
the unmaintained parallel hydro JS model. Host facility inputs stay.

Related contracts:

- [hydro-simulator.md](../contracts/hydro-simulator.md) — runtime transport, no fallback
- [station-electrical-grid.md](../contracts/station-electrical-grid.md) — host connect vs engine bus
- [holo-reader.md](../contracts/holo-reader.md) — penstock lab WASM only

---

## Architecture (current truth)

```txt
Player browser
  ├── game host (Vue)
  │     facilities.hydro     field + operator inputs (saveable)
  │     flags / media / lights   host read models
  │     console UI               displays engine telemetry
  └── energy-sims WASM (default)
        Clearwater Station session
        plant + grid physics, busEnergized, kW, loads

Optional lab only: VITE_ENERGY_SIM_URL → HTTP same API (not a second model)
```

- The game is **not competitive**; client-side WASM is the intended ship path.
- There is **no** requirement for a secure remote engine for Part I physics.
- Optional HTTP is for lab/debug against energy-sim-server, same fixtures.

---

## What to keep vs delete

### Keep (host model — not “legacy physics”)

| Piece | Role |
| --- | --- |
| `facilities.hydro` shape | intake, valves, debris, leakage, online, startupComplete, eventLog, engineCheckpoint |
| Field / startup actions | Player sequence that mutates host state |
| Story flags (`hub.hydro_online`, …) | Content gates after validated outcomes |
| `hostHydroInputs.js` / `hostStationLoads.js` | Map host → engine commands |
| `stationOps.js` / WASM pkg / fixtures | Official engine path |
| Dev Tools power toggle | Snap host to full startup (or reset) + force engine sync |

These may move/rename (e.g. `lib/simulations/hydro/` → host-only module names)
but must not reimplement \(P = \eta \rho g Q H\).

### Delete (parallel plant model)

| Piece | Why |
| --- | --- |
| `hydro/telemetry.js` (`generateHydroTelemetry`) | Forked power formula |
| `hydro/config.js` (`upper-penstock` / `mill-brook` baseline) | Superseded plant numbers |
| `hydro/history.js` physics replay via `generateHydroTelemetry` | Alternate universe graphs |
| `lib/learning/hydroPower.js` if only used by the above | Formula helper for the fork |
| Tests that assert the old baseline kW numbers | Pin wrong plant |
| Call sites that fall back to JS telemetry on engine failure | Dual path |

---

## Implementation phases

### Phase 0 — Contracts (this pass)

- [x] Document WASM default, no dual-path, host vs engine boundaries
- [x] Grid contract: binary host connect for lights/media; engine for numbers
- [x] Holo-reader: lab is WASM-only
- [x] Feature-gaps pointer to this plan

### Phase 1 — Cut fallbacks (code) — done

1. **`useHydroFacility`** — engine telemetry or `unavailableEngineTelemetry` only.
2. **`useHydroConsoleMonitor`** — engine samples + host event markers only.
3. **`loadBackend` / client comments** — WASM default; no legacy primary.
4. **Fail visibly** — `engine-unavailable` status/fault on console.

### Phase 2 — Delete dead plant code — done

1. Removed `telemetry.js`, `config.js`, `history.js`, `hydroPower.js`,
   legacy `hydroRuntime.test.js`.
2. Host `state.js` / `events.js` / `startupActions.js` kept; `activeConfigId` gone.
3. Runtime plant ids use `clearwater-diversion` (not `upper-penstock`).

### Phase 3 — Power model polish (optional same PR or follow-up)

1. **Dev Tools** (already close): keep realistic full path on / full reset off
   + `forceRecreate` / advance so console matches. Document in Dev menu copy if
   needed.
2. **Indoor binary power** stays host connect intent for lights/media stability
   after load (contract).
3. **Later (not blocking rip-out):** optional brownout dimming from engine
   `lightLevel` / `gridStatus` without multi-state save enum.
4. Do **not** replace save with only engine-derived multi-state power; engine
   rehydrates after load.

### Phase 4 — Verification

- [x] `npm run test` — 360 passed after rip-out (2026-08-07)
- [x] WASM smoke: Clearwater online path produces >1 kW
  (`energySim/stationOps.smoke.test.js`, penstock lab test)
- [ ] Play: startup sequence → console shows energy-sims telemetry
- [ ] Play: Dev Tools power on/off → lights media + engine sync
- [ ] Play: holo penstock lab evaluates without host facility mutation
- [x] Engine fail path → `engine-unavailable` / zeros, no JS plant kW

---

## Power flag advice (product)

| Need | Recommendation |
| --- | --- |
| Save “I connected the plant” | Host `online` + field path + story flags |
| Console kW / bus / brownout | Engine snapshot only |
| Lights on/off photos | Host binary for Part I (stable across load) |
| Dev “see lit vs unlit” | Keep Dev toggle: snap host startup + sync engine |
| Full / brownout / spinning / off as save enum | **Not yet** — derive for UI from engine + host path |

Host connect intent remains useful even with a grid: the player’s breaker /
connect-power action is a fact of play. The engine answers “what does that
mean for generation and the bus right now?”

---

## Out of scope for this rip-out

- Renaming every illustrative `upper-penstock` example in long contract
  appendices (follow-up doc hygiene).
- Full load-shed productization and authored `loadW` everywhere.
- Competitive anti-cheat / authoritative remote sim.
- Replacing host field actions with pure engine UI.
