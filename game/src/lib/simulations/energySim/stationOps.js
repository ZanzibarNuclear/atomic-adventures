/**
 * Long-lived Clearwater Station ops session for gameplay.
 * Engine owns physics; host owns field flags and story outcomes.
 */

import clearwaterStation from "./fixtures/clearwater-station.json";
import { hostStateToHydroInputs } from "./hostHydroInputs.js";
import { getEnergySimBackend } from "./loadBackend.js";
import { telemetryFromSnapshot } from "./telemetryFromSnapshot.js";
import { presentGrid, presentHydro, presentSnapshot } from "./energySimPresent.js";

/** @type {string|null} */
let sessionId = null;
/** @type {object|null} */
let lastSnapshot = null;
/** @type {object|null} */
let lastTelemetry = null;

/**
 * Whether an ops session is currently open.
 */
export function hasOpsSession() {
  return Boolean(sessionId);
}

export function getLastOpsSnapshot() {
  return lastSnapshot;
}

export function getLastOpsTelemetry() {
  return lastTelemetry;
}

/**
 * Ensure a Clearwater Station session exists and matches host field state.
 *
 * @param {object} hydroState - facilities.hydro
 * @param {{
 *   durationSecs?: number,
 *   forceRecreate?: boolean,
 *   loads?: Record<string, boolean>,
 * }} [options]
 */
export async function syncOpsSession(hydroState, options = {}) {
  const backend = await getEnergySimBackend();
  if (!backend) {
    return { ok: false, reason: "no-backend", snapshot: null, telemetry: null };
  }

  if (options.forceRecreate) {
    disposeOpsSession(backend);
  }

  if (!sessionId) {
    await createSession(backend, hydroState);
  }

  const inputs = hostStateToHydroInputs(hydroState);
  await backend.setHydroInput(sessionId, inputs);

  if (options.loads && typeof options.loads === "object") {
    for (const [id, drawing] of Object.entries(options.loads)) {
      await backend.setLoad(sessionId, id, Boolean(drawing));
    }
  }

  const durationSecs =
    options.durationSecs ??
    (hydroState.online ? 25 : 1);

  const report = await backend.advance(sessionId, { durationSecs });
  lastSnapshot = report?.snapshot ?? (await backend.getSnapshot(sessionId));
  lastTelemetry = telemetryFromSnapshot(lastSnapshot, hydroState);

  return {
    ok: true,
    sessionId,
    snapshot: lastSnapshot,
    telemetry: lastTelemetry,
    presented: presentSnapshot(lastSnapshot),
    hydro: presentHydro(lastSnapshot),
    grid: presentGrid(lastSnapshot),
    backend,
  };
}

/**
 * Short live tick while the control console is open.
 * @param {object} hydroState
 * @param {number} [dtSecs]
 */
export async function tickOpsSession(hydroState, dtSecs = 1) {
  const backend = await getEnergySimBackend();
  if (!backend) {
    return { ok: false, reason: "no-backend", telemetry: null };
  }
  if (!sessionId) {
    return syncOpsSession(hydroState, { durationSecs: Math.max(1, dtSecs) });
  }

  const inputs = hostStateToHydroInputs(hydroState);
  await backend.setHydroInput(sessionId, inputs);
  lastSnapshot = await backend.tick(sessionId, { dtSecs });
  lastTelemetry = telemetryFromSnapshot(lastSnapshot, hydroState);
  return {
    ok: true,
    sessionId,
    snapshot: lastSnapshot,
    telemetry: lastTelemetry,
    presented: presentSnapshot(lastSnapshot),
  };
}

/**
 * Serialize engine state for the save game.
 * @returns {Promise<object|null>}
 */
export async function captureOpsCheckpoint() {
  if (!sessionId) return null;
  const backend = await getEnergySimBackend();
  if (!backend) return null;
  try {
    return await backend.checkpoint(sessionId);
  } catch (err) {
    console.warn("[energySim] checkpoint failed", err);
    return null;
  }
}

/**
 * Drop the live ops session (does not clear host flags).
 * @param {object} [backend]
 */
export function disposeOpsSession(backend = null) {
  if (sessionId && backend?.dispose) {
    backend.dispose(sessionId);
  } else if (sessionId) {
    getEnergySimBackend().then((b) => {
      if (b && sessionId) b.dispose(sessionId);
      sessionId = null;
    });
  }
  sessionId = null;
  lastSnapshot = null;
  lastTelemetry = null;
}

/** Test helper */
export function resetOpsSessionState() {
  sessionId = null;
  lastSnapshot = null;
  lastTelemetry = null;
}

async function createSession(backend, hydroState) {
  if (hydroState?.engineCheckpoint && typeof backend.createSessionFromCheckpoint === "function") {
    try {
      const restored = await backend.createSessionFromCheckpoint(hydroState.engineCheckpoint);
      sessionId = restored.sessionId;
      lastSnapshot = restored.snapshot;
      if (lastSnapshot?.phase === "configured" || lastSnapshot?.phase === "Configured") {
        await backend.start(sessionId);
        lastSnapshot = await backend.getSnapshot(sessionId);
      }
      return;
    } catch (err) {
      console.warn("[energySim] checkpoint restore failed; creating fresh session", err);
    }
  }

  const created = await backend.createSession(clearwaterStation);
  sessionId = created.sessionId;
  lastSnapshot = created.snapshot;
  await backend.start(sessionId);
  lastSnapshot = await backend.getSnapshot(sessionId);
}
