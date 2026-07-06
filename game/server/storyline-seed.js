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
          objective: "Enter the utility station control room.",
          allowed: { movement: { mode: "unrestricted" } },
          completesWhen: { location: { place: "indoors", room: "control-room" } },
          next: "read-startup-card",
        },
        {
          id: "read-startup-card",
          objective: "Read the laminated startup card.",
          allowed: {
            movement: { mode: "local-area", rooms: ["control-room"] },
            stageViews: [{ kind: "document", id: "hydro-startup-instruction-card" }],
            indoorActions: ["read-hydro-startup-card"],
            itemActions: ["hydro-startup-instruction-card.read"],
          },
          completesWhen: { flag: "hydro.startup_card_read" },
          next: "inspect-intake",
        },
        {
          id: "inspect-intake",
          objective: "Go to the intake and inspect the water path upstream.",
          allowed: {
            movement: {
              mode: "local-area",
              hexes: ["utility-yard"],
              exteriorNodes: ["upstream-bank", "intake-entrance"],
            },
          },
          completesWhen: { location: { place: "indoors", exteriorNode: "upstream-bank" } },
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
            indoorActions: ["align-pipeflow"],
          },
          completesWhen: { facility: { "hydro.manualValves.upstreamOpen": true } },
          next: "open-turbine-valve",
        },
        {
          id: "open-turbine-valve",
          objective: "Open the powerhouse pipe valve.",
          allowed: {
            movement: { mode: "local-area" },
            indoorActions: ["open-turbine-valve"],
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
          next: "connect-power",
        },
        {
          id: "connect-power",
          objective: "Connect station power.",
          allowed: {
            movement: { mode: "current-location-only" },
            indoorActions: ["connect-power"],
          },
          completesWhen: { facility: { "hydro.online": true } },
          next: "check-console",
        },
        {
          id: "check-console",
          objective: "Check the generator console.",
          allowed: {
            movement: { mode: "current-location-only" },
            stageViews: [{ kind: "console", id: "hydro" }],
          },
          onEnter: {
            view: { kind: "console", id: "hydro", focus: "generation" },
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
