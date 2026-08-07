# EnergySim game host

Adapter between Atomic Adventures and sibling **`sims/energy-sims`**.

| Path | Role |
| --- | --- |
| `pkg/` | Prebuilt **web** WASM (Vite / browser) |
| `pkg-node/` | Prebuilt **nodejs** WASM (Vitest smoke) |
| `fixtures/` | Clearwater Station / Diversion + ideal-teaching JSON |
| `energySimBackend.js` | Transport-swappable session API (vendored) |
| `stationOps.js` | Long-lived Clearwater Station ops session |
| `hostHydroInputs.js` | `facilities.hydro` → `set_hydro_input` |
| `telemetryFromSnapshot.js` | Engine snapshot → console telemetry |

**Default:** WASM on the player device. Optional HTTP when `VITE_ENERGY_SIM_URL` is set.

Rebuild clients + fixtures + WASM (requires Rust + wasm-pack):

```sh
npm run sync:energy-sim -w game
```
