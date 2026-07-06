export const storylineSeed = {
  id: "storyline-main",
  scenarios: [
    {
      id: "part-i-hydro-alpha",
      label: "Hydro Startup Storyline",
      defaultMode: "storyline",
      startStep: "intro",
      steps: [
        {
          id: "intro",
          objective: "Get oriented at the utility station.",
          allowed: { movement: { mode: "unrestricted" } },
          completesWhen: { flag: "story.intro.complete" },
          next: "read-startup-card",
        },
        {
          id: "read-startup-card",
          objective: "Read the laminated startup card.",
          allowed: {
            movement: { mode: "current-location-only" },
            stageViews: [{ kind: "document", id: "hydro-startup-card" }],
            itemActions: ["hydro-startup-card.read"],
          },
          completesWhen: { flag: "artifacts.hydro-startup-card.read" },
          next: "inspect-intake",
        },
        {
          id: "inspect-intake",
          objective: "Go to the intake and inspect the water path.",
          allowed: {
            movement: {
              mode: "local-area",
              hexes: ["utility-yard"],
              exteriorNodes: ["intake-entrance"],
            },
          },
          completesWhen: { location: { place: "indoors", exteriorNode: "intake-entrance" } },
          next: "clear-open-intake",
        },
        {
          id: "clear-open-intake",
          objective: "Clear debris and open the intake.",
          allowed: {
            movement: { mode: "local-area" },
            indoorActions: ["clear-intake-debris", "open-intake"],
          },
          completesWhen: { facility: { "hydro.intakeOpen": true } },
          next: "align-diversion-valve",
        },
        {
          id: "align-diversion-valve",
          objective: "Align the upstream diversion valve.",
          allowed: {
            movement: { mode: "local-area" },
            indoorActions: ["open-upstream-valve"],
          },
          completesWhen: { facility: { "hydro.manualValves.upstreamOpen": true } },
          next: "open-turbine-valve",
        },
        {
          id: "open-turbine-valve",
          objective: "Open the powerhouse pipe valve.",
          allowed: {
            movement: { mode: "local-area" },
            indoorActions: ["open-powerhouse-valve"],
          },
          completesWhen: { facility: { "hydro.manualValves.powerhouseOpen": true } },
          next: "return-control-room",
        },
        {
          id: "return-control-room",
          objective: "Return to the control room.",
          allowed: {
            movement: {
              mode: "local-area",
              rooms: ["control-room"],
            },
          },
          completesWhen: { location: { place: "indoors", room: "control-room" } },
          next: "connect-station-power",
        },
        {
          id: "connect-station-power",
          objective: "Connect station power.",
          allowed: {
            movement: { mode: "current-location-only" },
            indoorActions: ["connect-station-power"],
          },
          completesWhen: { facility: { "hydro.stationPowerConnected": true } },
          next: "check-console",
        },
        {
          id: "check-console",
          objective: "Check the generator console.",
          allowed: {
            movement: { mode: "current-location-only" },
            stageViews: [{ kind: "console", id: "hydro" }],
          },
          completesWhen: { facility: { "hydro.online": true } },
          next: "complete-startup",
        },
        {
          id: "complete-startup",
          objective: "Bring the hydro generator online.",
          allowed: { movement: { mode: "unrestricted" } },
          completesWhen: { facility: { "hydro.startupComplete": true } },
          next: null,
        },
      ],
    },
  ],
};
