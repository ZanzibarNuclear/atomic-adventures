import { computed, onBeforeUnmount, onMounted, ref, unref, watch } from "vue";
import { formatOperationalConsoleTime } from "../lib/character/gameTime.js";
import { useHydroFacility } from "./useHydroFacility.js";
import { deriveStationLoads } from "../lib/simulations/energySim/hostStationLoads.js";

/** Real-time sample interval while the console is open. */
const MONITOR_SAMPLE_MS = 1000;
const MAX_VISIBLE_SAMPLES = 48;

/** High-level operator status for the prominent Status strip. */
const statusLabels = {
  "configuration-missing": "Fault",
  "engine-unavailable": "Fault",
  "faulted": "Fault",
  "insufficient-flow": "Offline",
  "insufficient-pressure": "Offline",
  "offline": "Offline",
  "online": "Online",
  "ready": "Offline",
  "spinning-up": "Online",
  "startup-blocked": "Offline",
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
    body: "Use the ordinary field action to set the bypass for penstock flow.",
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
  let monitorTimer = null;

  const latestSample = computed(() => sampleBuffer.value.at(-1) ?? null);
  const telemetry = computed(() => latestSample.value?.telemetry ?? hydroFacility.telemetry.value);
  const statusLabel = computed(() => {
    const raw = telemetry.value?.status;
    return statusLabels[raw] ?? (hydroState.value.online ? "Online" : "Offline");
  });
  const guidedActions = computed(() => nextGuidedActions(hydroState.value));
  const equipment = computed(() => buildEquipmentState(hydroState.value, telemetry.value));
  const markerLines = computed(() => markerPositions(sampleBuffer.value, eventMarkers.value));
  const powerGraph = computed(() => graphSeries(sampleBuffer.value, [
    { id: "power", label: "Power output", color: "#88d68d", metric: "generatorOutputKw", max: 10 },
  ]));
  const pressureGraph = computed(() => graphSeries(sampleBuffer.value, [
    { id: "pressure", label: "Water pressure", color: "#66b8e6", metric: "penstockPressureKpa", max: 300 },
  ]));
  const speedGraph = computed(() => graphSeries(sampleBuffer.value, [
    { id: "speed", label: "Turbine speed", color: "#ffd36f", metric: "turbineSpeedRpm", max: 1200 },
  ]));
  const gameTimeLabel = computed(() => formatOperationalConsoleTime(gameState.clock));

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
    await hydroFacility.refreshEngine({
      ...engineOptions({ durationSecs: 0.05 }),
    });
    // Physics tick while watching; host game clock is not mutated here.
    const nextTelemetry = await hydroFacility.tickEngine(1);
    const sample = {
      id: `sample-${sampleBuffer.value.length}`,
      elapsedSeconds: sampleBuffer.value.length,
      telemetry: nextTelemetry,
    };
    sampleBuffer.value = [...sampleBuffer.value, sample].slice(-MAX_VISIBLE_SAMPLES);
  }

  async function loadHistorySamples() {
    const latest = await hydroFacility.refreshEngine(engineOptions({
      durationSecs: hydroState.value.online ? 25 : 2,
    }));
    sampleBuffer.value = [{
      id: "sample-engine-0",
      elapsedSeconds: 0,
      telemetry: latest,
    }];
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
    equipment,
    guidedActions,
    latestSample,
    markerLines,
    powerGraph,
    pressureGraph,
    speedGraph,
    gameTimeLabel,
    statusLabel,
    telemetry,
  };
}

/**
 * Plant schematic equipment + badge state for the operational console.
 *
 * Bypass: host step 3 (`upstreamOpen`). Hydraulically, Open returns flow to the
 * cascade; Closed routes water down the penstock to the turbine. Completing
 * step 3 sets the host path open for penstock service → badge shows Closed.
 */
export function buildEquipmentState(hydroState, telemetry = {}) {
  const intakeClear = Boolean(hydroState.intakeClear);
  const intakeOpen = Boolean(hydroState.intakeOpen);
  const bypassClosedForPenstock = Boolean(hydroState.manualValves?.upstreamOpen);
  const turbineValveOpen = Boolean(hydroState.manualValves?.powerhouseOpen);
  const rpm = Number(telemetry.turbineSpeedRpm ?? 0);
  const generatorEngaged = Boolean(hydroState.online) && rpm > 0;
  const gridConnected = Boolean(
    telemetry.busEnergized
      ?? (hydroState.online && rpm > 0),
  );

  return {
    intakeClear: {
      ok: intakeClear,
      label: intakeClear ? "Intake clear" : "Intake blocked",
    },
    intakeOpen: {
      ok: intakeOpen,
      label: intakeOpen ? "Intake open" : "Intake closed",
    },
    bypass: {
      // Good operating path: bypass closed so penstock is fed
      ok: bypassClosedForPenstock,
      label: bypassClosedForPenstock ? "Closed" : "Open",
    },
    turbineValve: {
      ok: turbineValveOpen,
      label: turbineValveOpen ? "Valve open" : "Valve closed",
    },
    generator: {
      ok: generatorEngaged,
      label: generatorEngaged ? "Engaged" : "Disengaged",
    },
    grid: {
      ok: gridConnected,
      label: gridConnected ? "Connected" : "Disconnected",
    },
    pathToBypass: intakeClear && intakeOpen,
    pathToTurbine: intakeClear && intakeOpen && bypassClosedForPenstock,
    pathToGenerator: intakeClear && intakeOpen && bypassClosedForPenstock && turbineValveOpen,
    pathToGrid: generatorEngaged && gridConnected,
  };
}

function nextGuidedActions(state) {
  if (!state.intakeClear) return [guidedAction("clear-intake-debris")];
  if (!state.intakeOpen) return [guidedAction("open-intake")];
  if (!state.manualValves.upstreamOpen) return [guidedAction("align-pipeflow")];
  if (!state.manualValves.powerhouseOpen) return [guidedAction("open-turbine-valve")];
  if (!state.startupComplete || !state.online) return [guidedAction("connect-power")];
  return [];
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

function markerPositions(_samples, _markers) {
  return [];
}

function round(value, decimals) {
  const scale = 10 ** decimals;
  return Math.round(Number(value) * scale) / scale;
}
