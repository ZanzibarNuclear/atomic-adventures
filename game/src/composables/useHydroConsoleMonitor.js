import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useHydroFacility } from "./useHydroFacility.js";
import { summarizeHydroSamples } from "../lib/simulations/hydro/index.js";

const MONITOR_SAMPLE_MS = 1000;
const MONITOR_MINUTES_PER_SAMPLE = 1;
const MAX_VISIBLE_SAMPLES = 48;

const statusLabels = {
  "configuration-missing": "Configuration missing",
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
  "intake-blocked": "The intake is blocked.",
  "intake-closed": "The intake gate is closed.",
  "intake-debris-reducing-flow": "Debris is reducing captured flow.",
  "intake-needs-clearing": "The intake still needs field clearing.",
  "low-pressure": "Penstock pressure is below the startup target.",
  "low-stream-flow": "Mill Brook flow is below the useful range.",
  "low-turbine-speed": "The turbine is below the target speed.",
  "major-penstock-leak": "A major penstock leak is preventing stable operation.",
  "manual-valves-not-open": "Manual valves are not fully open.",
  "penstock-leakage": "Penstock leakage is reducing output.",
  "station-power-off": "Station power is offline.",
  "startup-incomplete": "The generator startup sequence is incomplete.",
};

const guidedActionLabels = {
  "clear-intake-debris": {
    title: "Return to the upstream bank",
    body: "Use the ordinary field action to clear and open the intake.",
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

export function useHydroConsoleMonitor(gameState, validPanel) {
  const hydroFacility = useHydroFacility(gameState);
  const hydroState = hydroFacility.hydroState;
  const sampleBuffer = ref([]);
  const eventMarkers = ref([]);
  const monitorStartedAtMs = ref(Date.now());
  const monitorStartedAtElapsedMinutes = ref(elapsedMinutes(gameState));
  let monitorTimer = null;

  const latestSample = computed(() => sampleBuffer.value.at(-1) ?? null);
  const telemetry = computed(() => latestSample.value?.telemetry ?? hydroFacility.telemetry.value);
  const eventLog = computed(() => hydroState.value.eventLog.slice(-6).reverse());
  const statusLabel = computed(() => statusLabels[telemetry.value.status] ?? telemetry.value.status);
  const diagnostics = computed(() => [
    ...telemetry.value.faults.map((id) => diagnosticLine(id, "Fault")),
    ...telemetry.value.warnings.map((id) => diagnosticLine(id, "Warning")),
    ...(!hydroState.value.online ? [diagnosticLine("station-power-off", "Warning")] : []),
  ]);
  const guidedActions = computed(() => nextGuidedActions(hydroState.value));
  const readouts = computed(() => buildReadouts(telemetry.value));
  const fieldChecks = computed(() => buildFieldChecks(hydroState.value));
  const lastReport = computed(() => summarizeHydroSamples(sampleBuffer.value, eventMarkers.value));
  const markerLines = computed(() => markerPositions(sampleBuffer.value, eventMarkers.value));
  const powerGraph = computed(() => graphSeries(sampleBuffer.value, [
    { id: "power", label: "Power output", color: "#88d68d", metric: "generatorOutputKw", max: 1 },
  ]));
  const pressureSpeedGraph = computed(() => graphSeries(sampleBuffer.value, [
    { id: "pressure", label: "Pressure", color: "#66b8e6", metric: "penstockPressureKpa", max: 180 },
    { id: "speed", label: "Turbine speed", color: "#ffd36f", metric: "turbineSpeedRpm", max: 1000 },
  ]));
  const flowHeadGraph = computed(() => graphSeries(sampleBuffer.value, [
    { id: "flow", label: "Flow", color: "#9be4d4", metric: "flowM3s", max: 0.014 },
    { id: "head", label: "Net head", color: "#d8b7ff", metric: "netHeadM", max: 18 },
  ]));

  function addMonitorSample() {
    if (!validPanel.value) return;
    const elapsedSimMinutes = monitorStartedAtElapsedMinutes.value +
      Math.floor((Date.now() - monitorStartedAtMs.value) / MONITOR_SAMPLE_MS) * MONITOR_MINUTES_PER_SAMPLE;
    const sample = {
      id: `sample-${elapsedSimMinutes}-${sampleBuffer.value.length}`,
      elapsedMinutes: elapsedSimMinutes,
      telemetry: hydroFacility.readTelemetry(),
    };
    sampleBuffer.value = [...sampleBuffer.value, sample].slice(-MAX_VISIBLE_SAMPLES);
  }

  function loadHistorySamples() {
    const graphData = hydroFacility.readGraphData({
      fromElapsedMinutes: Math.max(0, elapsedMinutes(gameState) - 60),
      stepMinutes: 5,
    });
    sampleBuffer.value = graphData.samples.slice(-MAX_VISIBLE_SAMPLES);
    eventMarkers.value = graphData.markers;
  }

  onMounted(() => {
    loadHistorySamples();
    if (!sampleBuffer.value.length) addMonitorSample();
    monitorTimer = window.setInterval(addMonitorSample, MONITOR_SAMPLE_MS);
  });

  onBeforeUnmount(() => {
    if (monitorTimer != null) window.clearInterval(monitorTimer);
  });

  return {
    diagnostics,
    eventLog,
    eventMarkers,
    fieldChecks,
    flowHeadGraph,
    guidedActions,
    lastReport,
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

function buildReadouts(telemetry) {
  return [
    { id: "output", label: "Output", value: `${telemetry.generatorOutputKw.toFixed(3)} kW` },
    { id: "pressure", label: "Pressure", value: `${telemetry.penstockPressureKpa.toFixed(1)} kPa` },
    { id: "speed", label: "Turbine", value: `${telemetry.turbineSpeedRpm} rpm` },
    { id: "flow", label: "Flow", value: `${telemetry.flowM3s.toFixed(3)} m3/s` },
    { id: "head", label: "Net head", value: `${telemetry.netHeadM.toFixed(2)} m` },
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
  if (!state.intakeClear || !state.intakeOpen) return [guidedAction("clear-intake-debris")];
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
