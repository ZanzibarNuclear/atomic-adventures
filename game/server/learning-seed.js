export const learningSeed = {
  id: "learning-main",
  lessons: [
    {
      id: "hydro-power-intro",
      title: "Hydro Power, Water You Waiting For?",
      summary: "Learn how flow, head, and efficiency determine hydroelectric power.",
      order: 10,
      tags: ["hydro", "power", "water"],
      availableWhen: {
        flags: { all: ["hub.hydro_online"] },
      },
      timeMinutes: 30,
      activity: "light",
      completion: {
        awardTitle: "Hydro Power Theory",
        awardText: "Zanzibar understands how head, flow, and efficiency combine to make electrical power.",
        effects: [
          { op: "knowledge.acquire", id: "hydro-head-and-flow" },
        ],
      },
      sections: [
        {
          type: "text",
          title: "Water Above, Power Below",
          body: "A hydro plant turns the energy of falling water into electricity. Water enters at an intake, travels downhill through a penstock, spins a turbine, and leaves through a tailrace. The generator attached to the turbine turns that motion into electrical power.",
        },
        {
          type: "formula",
          title: "Electrical Power",
          formula: "P_elec = eta * rho * g * Q * H_net",
          caption: "Electrical power equals efficiency times hydraulic power.",
        },
        {
          type: "symbols",
          title: "What the Symbols Mean",
          rows: [
            { symbol: "P_elec", meaning: "Electrical power delivered by the plant", units: "watts (W)" },
            { symbol: "eta", meaning: "Overall efficiency of the turbine, generator, and wiring", units: "0 to 1" },
            { symbol: "rho", meaning: "Density of water", units: "about 1000 kg/m^3" },
            { symbol: "g", meaning: "Gravitational acceleration", units: "9.8 m/s^2" },
            { symbol: "Q", meaning: "Volume flow through the turbine", units: "m^3/s" },
            { symbol: "H_net", meaning: "Useful vertical drop after losses", units: "m" },
          ],
        },
        {
          type: "examples",
          title: "Quick Examples",
          examples: [
            {
              title: "Small Creek",
              givens: ["eta = 0.70", "Q = 0.20 m^3/s", "H_net = 12 m"],
              result: "P_elec = 0.70 * 1000 * 9.8 * 0.20 * 12 = 16,464 W, about 16 kW",
              explanation: "A modest flow can still help if the water drops far enough.",
            },
            {
              title: "More Flow",
              givens: ["eta = 0.80", "Q = 2.0 m^3/s", "H_net = 8 m"],
              result: "P_elec = 0.80 * 1000 * 9.8 * 2.0 * 8 = 125,440 W, about 125 kW",
              explanation: "Ten times the flow gives much more power, even with less head.",
            },
            {
              title: "Higher Head",
              givens: ["eta = 0.90", "Q = 5.0 m^3/s", "H_net = 50 m"],
              result: "P_elec = 0.90 * 1000 * 9.8 * 5.0 * 50 = 2,205,000 W, about 2.2 MW",
              explanation: "Power rises directly with both flow and useful drop.",
            },
          ],
        },
      ],
      quiz: [
        {
          id: "double-flow",
          type: "multiple-choice",
          prompt: "If efficiency and net head stay the same, what happens to electrical power when flow Q doubles?",
          options: [
            {
              id: "half",
              label: "It is cut in half",
              feedback: "Flow is multiplied in the formula, so increasing flow does not reduce power.",
            },
            {
              id: "double",
              label: "It doubles",
              feedback: "Right. Power scales directly with flow when the other values stay fixed.",
            },
            {
              id: "unchanged",
              label: "It stays the same",
              feedback: "Flow is one of the main terms in the formula, so changing it changes power.",
            },
            {
              id: "square",
              label: "It becomes four times larger",
              feedback: "That would be a squared relationship, but Q appears once in this formula.",
            },
          ],
          correctOptionId: "double",
        },
      ],
    },
  ],
};
