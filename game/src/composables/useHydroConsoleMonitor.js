import { computed, onBeforeUnmount, onMounted, ref, unref, watch } from "vue";
import { useHydroFacility } from "./useHydroFacility.js";
import { deriveStationLoads } from "../lib/simulations/energySim/hostStationLoads.js";

const MONITOR_SAMPLE_MS = 1000;
const MONITOR_MINUTES_PER_SAMPLE = 1;
const MAX_VISIBLE_SAMPLES = 48;

/** Engine advisory strings → Note (not alarming). Host problems stay Warning/Fault. */
const ENGINE_NOTE_PATTERNS = [
  /exceeds design flow/i,
  /capped at ratedPowerKw/i,
  /capped at maxSafeFlow/i,
  /plant offline/i,
];

const statusLabels = {
  "configuration-missing": "Configuration missing",
  "engine-unavailable": "Simulator unavailable",
  "faulted": "Faulted",
  "insufficient-flow": "Insufficient flow",
  "insufficient-pressure": "Insufficient pressure",
  "offline": "Offline",
  "online": "Online",
  "ready": "Ready",
  "spinning-up": "Spinning up",
  "startup-blocked": "Startup blocked",
};

const diagnosticLabels = {
  "configuration-missing": "The selected hydro configuration was not found.",
  "engine-unavailable": "Energy simulator failed to run. This is a defect — not a secondary plant model.",
  "intake-blocked": "The intake is blocked.",
  "intake-closed": "The intake gate is closed.",
  "intake-debris-reducing-flow": "Debris is reducing captured flow.",
  "intake-needs-clearing": "The intake still needs field clearing.",
  "low-pressure": "Penstock pressure is below the startup target.",
  "low-stream-flow": "Stream flow is below the useful range.",
  "low-turbine-speed": "The turbine is below the target speed.",
  "major-penstock-leak": "A major penstock leak is preventing stable operation.",
  "manual-valves-not-open": "Manual valves are not fully open.",
  "penstock-leakage": "Penstock leakage is reducing output.",
  "station-power-off": "Station power is offline.",
  "startup-incomplete": "The generator startup sequence is incomplete.",
  "grid-brownout": "Station demand is near or above available generation.",
  "grid-shortage": "Station load exceeds available generation.",
};

const guidedActionLabels = {
  "clear-intake-debris": {
    title: "Return to the upstream bank",
    body: "Use the ordinary field action to clear debris from the intake.",
  },
  "open-intake": {
    title: "Stay at the upstream bank",
    body: "Use the ordinary field action to open the intake.",
  },
  "align-pipeflow": {
    title: "Return to the midstream bank",
    body: "Use the ordinary field action to align the upstream valve.",
  },
  "open-turbine-valve": {
    title: "Return to the downstream bank",
    body: "Use the ordinary field action to open the turbine valve.",
  },
  "connect-power": {
    title: "Stay in the control room",
    body: "Use the ordinary control-room action to connect station power.",
  },
};

/**
 * @param {object} gameState
 * @param {import('vue').Ref<boolean>|boolean} validPanel
 * @param {import('vue').Ref<object|null>|object|null} [stationContextRef]
 *   Optional reactive context: { facility, activeStageKind, flags }
 */
export function useHydroConsoleMonitor(gameState, validPanel, stationContextRef = null) {
  const hydroFacility = useHydroFacility(gameState);
  const hydroState = hydroFacility.hydroState;
  const sampleBuffer = ref([]);
  const eventMarkers = ref([]);
  const monitorStartedAtMs = ref(Date.now());
  const monitorStartedAtElapsedMinutes = ref(elapsedMinutes(gameState));
  let monitorTimer = null;

  const latestSample = computed(() => sampleBuffer.value.at(-1) ?? null);
  const telemetry = computed(() => latestSample.value?.telemetry ?? hydroFacility.telemetry.value);
  const statusLabel = computed(() => statusLabels[telemetry.value.status] ?? telemetry.value.status);
  const diagnostics = computed(() => buildDiagnostics(telemetry.value, hydroState.value));
  const guidedActions = computed(() => nextGuidedActions(hydroState.value));
  const readouts = computed(() => buildReadouts(telemetry.value));
  const fieldChecks = computed(() => buildFieldChecks(hydroState.value));
  const markerLines = computed(() => markerPositions(sampleBuffer.value, eventMarkers.value));
  // Clearwater Diversion is ~8 kW rated; scale graphs to plant of record.
  const powerGraph = computed(() => graphSeries(sampleBuffer.value, [
    { id: "power", label: "Power output", color: "#88d68d", metric: "generatorOutputKw", max: 10 },
  ]));
  const pressureSpeedGraph = computed(() => graphSeries(sampleBuffer.value, [
    { id: "pressure", label: "Pressure", color: "#66b8e6", metric: "penstockPressureKpa", max: 300 },
    { id: "speed", label: "Turbine speed", color: "#ffd36f", metric: "turbineSpeedRpm", max: 1200 },
  ]));

  function engineOptions(extra = {}) {
    const ctx = unref(stationContextRef) ?? {};
    const facility = ctx.facility ?? null;
    const loads = deriveStationLoads({
      hydroOnline: hydroState.value.online,
      facility,
      activeStageKind: ctx.activeStageKind ?? null,
      flags: ctx.flags ?? gameState.flags,
    });
    return { loads, ...extra };
  }

  async function addMonitorSample() {
    if (!unref(validPanel)) return;
    const elapsedSimMinutes = monitorStartedAtElapsedMinutes.value +
      Math.floor((Date.now() - monitorStartedAtMs.value) / MONITOR_SAMPLE_MS) * MONITOR_MINUTES_PER_SAMPLE;
    // Keep loads in sync each tick (setLoad via refresh/sync path)
    await hydroFacility.refreshEngine({
      ...engineOptions({ durationSecs: 0.05 }),
    });
    const nextTelemetry = await hydroFacility.tickEngine(1);
    const sample = {
      id: `sample-${elapsedSimMinutes}-${sampleBuffer.value.length}`,
      elapsedMinutes: elapsedSimMinutes,
      telemetry: nextTelemetry,
    };
    sampleBuffer.value = [...sampleBuffer.value, sample].slice(-MAX_VISIBLE_SAMPLES);
  }

  async function loadHistorySamples() {
    const latest = await hydroFacility.refreshEngine(engineOptions({
      durationSecs: hydroState.value.online ? 25 : 2,
    }));
    const now = elapsedMinutes(gameState);
    sampleBuffer.value = [{
      id: `sample-engine-${now}`,
      elapsedMinutes: now,
      telemetry: latest,
    }];
    // Host event log markers (field history), not a parallel physics replay
    eventMarkers.value = (hydroState.value.eventLog ?? [])
      .filter((event) => Number.isFinite(Number(event.elapsedMinutes)))
      .map((event) => ({
        id: event.eventId,
        elapsedMinutes: Number(event.elapsedMinutes),
        type: event.type,
        label: event.label || event.type,
        actionId: event.payload?.actionId ?? null,
      }));
  }

  onMounted(() => {
    void loadHistorySamples().then(() => {
      if (!sampleBuffer.value.length) void addMonitorSample();
    });
    monitorTimer = window.setInterval(() => {
      void addMonitorSample();
    }, MONITOR_SAMPLE_MS);
  });

  onBeforeUnmount(() => {
    if (monitorTimer != null) window.clearInterval(monitorTimer);
  });

  if (stationContextRef && typeof stationContextRef === "object" && "value" in stationContextRef) {
    watch(stationContextRef, () => {
      if (!unref(validPanel)) return;
      void hydroFacility.refreshEngine(engineOptions({ durationSecs: 1 }));
    }, { deep: true });
  }

  return {
    diagnostics,
    fieldChecks,
    guidedActions,
    latestSample,
    markerLines,
    powerGraph,
    pressureSpeedGraph,
    readouts,
    sampleTimeLabel,
    statusLabel,
    telemetry,
  };
}

function buildDiagnostics(telemetry, hydroState) {
  const items = [];
  for (const id of telemetry.faults ?? []) {
    items.push(diagnosticLine(id, "Fault"));
  }
  for (const id of telemetry.warnings ?? []) {
    items.push(diagnosticLine(id, kindForDiagnostic(id)));
  }
  if (!hydroState.online) {
    items.push(diagnosticLine("station-power-off", "Warning"));
  }
  const gridStatus = telemetry.gridStatus;
  if (gridStatus === "brownout") {
    items.push(diagnosticLine("grid-brownout", "Warning"));
  } else if (gridStatus === "shortage") {
    items.push(diagnosticLine("grid-shortage", "Warning"));
  }
  return items;
}

function kindForDiagnostic(id) {
  const text = String(id);
  if (ENGINE_NOTE_PATTERNS.some((re) => re.test(text))) return "Note";
  // Host kebab ids stay Warning unless known soft
  if (
    text === "intake-debris-reducing-flow"
    || text === "penstock-leakage"
    || text === "low-turbine-speed"
  ) {
    return "Note";
  }
  return "Warning";
}

function buildReadouts(telemetry) {
  return [
    { id: "output", label: "Output", value: `${Number(telemetry.generatorOutputKw ?? 0).toFixed(3)} kW` },
    { id: "pressure", label: "Pressure", value: `${Number(telemetry.penstockPressureKpa ?? 0).toFixed(1)} kPa` },
    { id: "speed", label: "Turbine", value: `${telemetry.turbineSpeedRpm ?? 0} rpm` },
  ];
}

function buildFieldChecks(hydroState) {
  return [
    { id: "intake-clear", label: "Intake clear", ok: hydroState.intakeClear },
    { id: "intake-open", label: "Intake open", ok: hydroState.intakeOpen },
    { id: "upstream-valve", label: "Upstream valve", ok: hydroState.manualValves.upstreamOpen },
    { id: "powerhouse-valve", label: "Powerhouse valve", ok: hydroState.manualValves.powerhouseOpen },
    { id: "startup", label: "Startup complete", ok: hydroState.startupComplete },
    { id: "online", label: "Station power", ok: hydroState.online },
  ];
}

function nextGuidedActions(state) {
  if (!state.intakeClear) return [guidedAction("clear-intake-debris")];
  if (!state.intakeOpen) return [guidedAction("open-intake")];
  if (!state.manualValves.upstreamOpen) return [guidedAction("align-pipeflow")];
  if (!state.manualValves.powerhouseOpen) return [guidedAction("open-turbine-valve")];
  if (!state.startupComplete || !state.online) return [guidedAction("connect-power")];
  return [];
}

function diagnosticLine(id, kind) {
  return {
    id,
    kind,
    label: diagnosticLabels[id] ?? id,
  };
}

function guidedAction(id) {
  return {
    id,
    ...(guidedActionLabels[id] ?? {
      title: "Return to the map",
      body: "Use the next ordinary field action.",
    }),
  };
}

function graphSeries(samples, specs) {
  return specs.map((spec) => ({
    ...spec,
    points: sparklinePoints(samples, spec.metric, spec.max),
    value: samples.at(-1)?.telemetry?.[spec.metric] ?? 0,
  }));
}

function sparklinePoints(samples, metric, maxValue) {
  if (samples.length === 0) return "";
  if (samples.length === 1) {
    const y = graphY(samples[0].telemetry[metric], maxValue);
    return `0,${y} 100,${y}`;
  }
  return samples.map((sample, index) => {
    const x = (index / (samples.length - 1)) * 100;
    return `${round(x, 2)},${graphY(sample.telemetry[metric], maxValue)}`;
  }).join(" ");
}

function graphY(value, maxValue) {
  const normalized = Math.min(1, Math.max(0, Number(value) / maxValue));
  return round(36 - normalized * 32, 2);
}

function markerPositions(samples, markers) {
  if (samples.length < 2) return [];
  const first = samples[0].elapsedMinutes;
  const last = samples.at(-1).elapsedMinutes;
  const span = Math.max(1, last - first);
  return markers
    .filter((marker) => marker.elapsedMinutes >= first && marker.elapsedMinutes <= last)
    .map((marker) => ({
      ...marker,
      x: round(((marker.elapsedMinutes - first) / span) * 100, 2),
    }));
}

function elapsedMinutes(gameState) {
  const value = Number(gameState?.clock?.elapsedMinutes);
  return Number.isFinite(value) ? value : 0;
}

function sampleTimeLabel(sample) {
  if (!sample) return "No samples yet";
  return `${Math.round(sample.elapsedMinutes)} min`;
}

function round(value, decimals) {
  const scale = 10 ** decimals;
  return Math.round(Number(value) * scale) / scale;
}
