import { sortHydroEvents } from "./events.js";
import { createHydroState, normalizeHydroState, withHydroStatePatch } from "./state.js";
import { generateHydroTelemetry } from "./telemetry.js";

const DEFAULT_WINDOW_MINUTES = 60;
const DEFAULT_STEP_MINUTES = 5;

export function buildHydroGraphData(state, options = {}) {
  const normalized = normalizeHydroState(state);
  const toElapsedMinutes = finite(options.toElapsedMinutes ?? normalized.lastCheckpointElapsedMinutes);
  const fromElapsedMinutes = finite(
    options.fromElapsedMinutes ?? Math.max(0, toElapsedMinutes - DEFAULT_WINDOW_MINUTES),
  );
  const stepMinutes = Math.max(1, finite(options.stepMinutes ?? DEFAULT_STEP_MINUTES));
  const eventLog = sortHydroEvents(normalized.eventLog ?? []);
  const timeline = sampleTimes(fromElapsedMinutes, toElapsedMinutes, stepMinutes);
  const samples = timeline.map((elapsedMinutes) => {
    const replayedState = eventLog.length
      ? stateAtElapsedMinutes(normalized, eventLog, elapsedMinutes)
      : normalized;
    return {
      id: `history-${Math.round(elapsedMinutes * 1000)}`,
      elapsedMinutes,
      telemetry: generateHydroTelemetry(replayedState),
    };
  });
  const markers = eventLog
    .filter((event) => event.elapsedMinutes >= fromElapsedMinutes && event.elapsedMinutes <= toElapsedMinutes)
    .map((event) => ({
      id: event.eventId,
      elapsedMinutes: event.elapsedMinutes,
      type: event.type,
      label: event.label || event.type,
      actionId: event.payload?.actionId ?? null,
    }));

  return {
    fromElapsedMinutes,
    toElapsedMinutes,
    samples,
    markers,
    report: summarizeHydroSamples(samples, markers),
  };
}

export function summarizeHydroSamples(samples = [], markers = []) {
  if (!samples.length) {
    return {
      averageOutputKw: 0,
      generatedEnergyKwh: 0,
      brownoutMinutes: 0,
      online: false,
      latestWarning: null,
      markerCount: markers.length,
    };
  }

  let generatedEnergyKwh = 0;
  let brownoutMinutes = 0;
  let latestWarning = null;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const next = samples[index + 1];
    const durationMinutes = next
      ? Math.max(0, next.elapsedMinutes - sample.elapsedMinutes)
      : 0;
    generatedEnergyKwh += sample.telemetry.generatorOutputKw * (durationMinutes / 60);
    if (sample.telemetry.status !== "online") brownoutMinutes += durationMinutes;
    const warning = [...(sample.telemetry.faults ?? []), ...(sample.telemetry.warnings ?? [])].at(-1);
    if (warning) latestWarning = warning;
  }

  const durationHours = Math.max(
    0,
    (samples.at(-1).elapsedMinutes - samples[0].elapsedMinutes) / 60,
  );
  return {
    averageOutputKw: durationHours > 0 ? generatedEnergyKwh / durationHours : samples.at(-1).telemetry.generatorOutputKw,
    generatedEnergyKwh,
    brownoutMinutes,
    online: samples.at(-1).telemetry.status === "online",
    latestWarning,
    markerCount: markers.length,
  };
}

function stateAtElapsedMinutes(currentState, eventLog, elapsedMinutes) {
  const replayed = createHydroState({
    activeConfigId: currentState.activeConfigId,
    eventLog,
    leakageFraction: 0,
  });
  return eventLog
    .filter((event) => event.elapsedMinutes <= elapsedMinutes)
    .reduce((state, event) => {
      const patch = event.payload?.patch ?? event.payload;
      return patch && typeof patch === "object"
        ? withHydroStatePatch(state, patch)
        : state;
    }, replayed);
}

function sampleTimes(fromElapsedMinutes, toElapsedMinutes, stepMinutes) {
  if (toElapsedMinutes <= fromElapsedMinutes) return [toElapsedMinutes];
  const times = [];
  for (let time = fromElapsedMinutes; time < toElapsedMinutes; time += stepMinutes) {
    times.push(time);
  }
  times.push(toElapsedMinutes);
  return times;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
