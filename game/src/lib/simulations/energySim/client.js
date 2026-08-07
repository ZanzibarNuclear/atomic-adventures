/**
 * Thin adapter to the energy-sims remote engine.
 * Source of truth for the HTTP/WS client lives in sims/energy-sims/clients/js.
 * This copy is vendored so the game does not need a monorepo path dependency.
 *
 * Enable with VITE_ENERGY_SIM_URL (e.g. http://127.0.0.1:8787).
 * When unset, helpers return null / no-op so legacy hydro prototypes stay primary.
 */

/**
 * @param {{ baseUrl?: string, fetchImpl?: typeof fetch }} [options]
 */
export function createEnergySimClient(options = {}) {
  const baseUrl = (options.baseUrl ?? defaultBaseUrl() ?? "").replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!baseUrl) {
    return null;
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("energySim client requires fetch");
  }

  async function request(path, init = {}) {
    const res = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    const text = await res.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (!res.ok) {
      const msg = body?.error ?? res.statusText ?? `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  return {
    baseUrl,
    health: () => request("/health"),
    createSession: (config) =>
      request("/v1/sessions", {
        method: "POST",
        body: typeof config === "string" ? config : JSON.stringify(config),
      }),
    getSnapshot: (sessionId) =>
      request(`/v1/sessions/${encodeURIComponent(sessionId)}`),
    start: (sessionId) =>
      request(`/v1/sessions/${encodeURIComponent(sessionId)}/start`, {
        method: "POST",
      }),
    stop: (sessionId) =>
      request(`/v1/sessions/${encodeURIComponent(sessionId)}/stop`, {
        method: "POST",
      }),
    advance: (sessionId, body) =>
      request(`/v1/sessions/${encodeURIComponent(sessionId)}/advance`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    tick: (sessionId, body) =>
      request(`/v1/sessions/${encodeURIComponent(sessionId)}/tick`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    applyCommands: (sessionId, commands) =>
      request(`/v1/sessions/${encodeURIComponent(sessionId)}/commands`, {
        method: "POST",
        body: JSON.stringify({ commands }),
      }),
    setLoad: (sessionId, id, drawing) =>
      request(`/v1/sessions/${encodeURIComponent(sessionId)}/commands`, {
        method: "POST",
        body: JSON.stringify({
          commands: [{ type: "set_load", id, drawing: Boolean(drawing) }],
        }),
      }),
  };
}

export function defaultBaseUrl() {
  try {
    return import.meta.env?.VITE_ENERGY_SIM_URL ?? null;
  } catch {
    return null;
  }
}

export function isEnergySimEnabled() {
  return Boolean(defaultBaseUrl());
}

/**
 * Present engine snapshot for control-room UI (incl. brownout dimming hint).
 * @param {object|null} snapshot
 */
export function presentSnapshot(snapshot) {
  if (!snapshot) return null;
  const brownout =
    snapshot.gridStatus === "brownout" || snapshot.gridStatus === "shortage";
  return {
    simTimeS: snapshot.simTimeS,
    electricalPowerKw: snapshot.electricalPowerKw,
    targetElectricalPowerKw: snapshot.targetElectricalPowerKw,
    turbineSpeedRpm: snapshot.turbineSpeedRpm,
    availableGenerationKw: snapshot.availableGenerationKw,
    totalLoadKw: snapshot.totalLoadKw,
    marginKw: snapshot.marginKw,
    busEnergized: snapshot.busEnergized,
    gridStatus: snapshot.gridStatus,
    brownout,
    lightLevel: brownout ? 0.4 : snapshot.busEnergized ? 1.0 : 0.0,
    energyGeneratedKwh: snapshot.energyGeneratedKwh,
    warnings: snapshot.warnings ?? [],
  };
}
