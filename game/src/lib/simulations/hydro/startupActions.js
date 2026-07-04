const hydroStartupActionPatches = Object.freeze({
  "clear-intake-debris": {
    type: "facility-change",
    label: "Intake debris cleared",
    state: {
      intakeClear: true,
      debrisFraction: 0,
    },
  },
  "open-intake": {
    type: "facility-change",
    label: "Intake opened",
    state: {
      intakeOpen: true,
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
