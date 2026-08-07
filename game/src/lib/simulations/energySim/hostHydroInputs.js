/**
 * Map host `facilities.hydro` ops state → energy-sims `set_hydro_input` fields.
 * Command fields are snake_case (engine command schema).
 */

import { normalizeHydroState } from "../hydro/state.js";

/**
 * Whether the field path can admit flow (intake + both manual valves).
 * @param {object} state
 */
export function hydroPathOpen(state) {
  const n = normalizeHydroState(state);
  return (
    n.intakeClear &&
    n.intakeOpen &&
    n.manualValves.upstreamOpen &&
    n.manualValves.powerhouseOpen
  );
}

/**
 * @param {object} state - facilities.hydro host state
 * @returns {{
 *   gate_opening: number,
 *   debris_clog_fraction: number,
 *   leakage_fraction: number,
 *   online: boolean,
 * }}
 */
export function hostStateToHydroInputs(state) {
  const n = normalizeHydroState(state);
  return {
    gate_opening: hydroPathOpen(n) ? 1 : 0,
    debris_clog_fraction: clamp01(n.debrisFraction),
    leakage_fraction: clamp01(n.leakageFraction),
    online: n.online === true,
  };
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
