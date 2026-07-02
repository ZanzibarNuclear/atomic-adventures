const hydroStartupActionPatches = Object.freeze({
  "clear-intake-debris": {
    type: "facility-change",
    label: "Intake cleared and opened",
    state: {
      intakeClear: true,
      intakeOpen: true,
      debrisFraction: 0,
    },
  },
  "align-pipeflow": {
    type: "facility-change",
    label: "Upstream manual valve opened",
    state: {
      manualValves: {
        upstreamOpen: true,
      },
    },
  },
  "open-turbine-valve": {
    type: "facility-change",
    label: "Powerhouse manual valve opened",
    state: {
      manualValves: {
        powerhouseOpen: true,
      },
    },
  },
  "connect-power": {
    type: "state-transition",
    label: "Hydro generator startup completed",
    stateFor: (elapsedMinutes) => ({
      startupComplete: true,
      online: true,
      lastCheckpointElapsedMinutes: elapsedMinutes,
    }),
  },
});

export function hydroStartupActionPatch(actionId) {
  return hydroStartupActionPatches[actionId] ?? null;
}
