export const HYDRO_BASELINE_CONFIG_ID = "hydro-generator-baseline";

export const HYDRO_BASELINE_CONFIG = Object.freeze({
  configId: HYDRO_BASELINE_CONFIG_ID,
  plantId: "upper-penstock",
  label: "Upper Penstock micro-hydro baseline",
  profileKind: "baseline",
  plantType: "diversion-run-of-river",
  tags: ["alpha", "easy-mode", "micro-hydro"],
  equationInputs: {
    netHeadM: 15.24,
    designFlowM3s: 0.012,
    baseTurbineEfficiency: 0.7,
    baseGeneratorEfficiency: 0.8,
    ratedPowerKw: 1,
  },
  stream: {
    sourceId: "mill-brook",
    easyModeFlowM3s: 0.012,
    minimumUsefulFlowM3s: 0.003,
  },
  intake: {
    id: "upper-intake",
    maxCaptureFlowM3s: 0.012,
  },
  penstock: {
    id: "upper-penstock-pipe",
    grossHeadM: 18,
    nominalNetHeadM: 15.24,
  },
  turbine: {
    id: "upper-turbine",
    type: "smart-micro-hydro",
    designFlowM3s: 0.012,
    ratedSpeedRpm: 900,
    minSyncSpeedRpm: 855,
    maxSyncSpeedRpm: 945,
    baseEfficiency: 0.7,
  },
  generator: {
    id: "upper-generator",
    ratedPowerKw: 1,
    baseEfficiency: 0.8,
    electricalMode: "battery-inverter-buffered",
  },
  telemetry: {
    minimumPressureKpa: 60,
    minimumSyncSpeedRpm: 720,
    onlinePowerThresholdKw: 0.2,
  },
});

export const HYDRO_CONFIGS = Object.freeze({
  [HYDRO_BASELINE_CONFIG_ID]: HYDRO_BASELINE_CONFIG,
});

export function getHydroConfig(configId = HYDRO_BASELINE_CONFIG_ID) {
  return HYDRO_CONFIGS[configId] ?? null;
}
