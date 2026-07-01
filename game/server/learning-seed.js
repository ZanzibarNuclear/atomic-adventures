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
          body: "Every hydro plant begins with the same idea: move water from a higher place to a lower place. Water up high stores gravitational potential energy. As it travels downhill, that stored energy becomes moving water, and moving water can push hard enough to spin machinery.",
        },
        {
          type: "text",
          title: "From Water To Wires",
          body: "The intake admits water into the system. A penstock or channel carries it toward the turbine. The turbine blades spin, the turbine shaft turns a generator, and the generator sends electrical power into the station. Afterward, the water exits through a tailrace and rejoins the stream below. The plant borrows the water's energy; it does not consume the water.",
        },
        {
          type: "text",
          title: "Head, Flow, And Losses",
          body: "Gross head ($H_\\text{gross}$) is the full vertical drop from the intake to the turbine. Some of that drop is lost to friction, clogged screens, bends, valves, leaks, and air in the line. Net head ($H_\\text{net}$) is what remains for the turbine. Flow ($Q$) is how much water reaches the turbine each second. More flow or more net head means more power, as long as the equipment can handle it.",
        },
        {
          type: "formula",
          title: "Net Head",
          formula: "$$\nH_\\text{net} = H_\\text{gross} - \\sum h_L\n$$",
          caption: "Net head is gross head minus the head lost along the path.",
        },
        {
          type: "formula",
          title: "Electrical Power",
          formula: "$$\nP_\\text{elec} = \\eta\\,\\rho\\,g\\,Q\\,H_\\text{net}\n$$",
          caption: "Electrical power equals hydraulic power times overall efficiency.",
        },
        {
          type: "symbols",
          title: "What the Symbols Mean",
          rows: [
            { symbol: "$P_\\text{elec}$", meaning: "Electrical power delivered by the plant", units: "watts (W)" },
            { symbol: "$\\eta$", meaning: "Overall efficiency of the turbine, generator, and wiring", units: "0 to 1" },
            { symbol: "$\\rho$", meaning: "Density of water", units: "about $1000\\ \\mathrm{kg/m^3}$" },
            { symbol: "$g$", meaning: "Gravitational acceleration", units: "$9.8\\ \\mathrm{m/s^2}$" },
            { symbol: "$Q$", meaning: "Volume flow through the turbine", units: "$\\mathrm{m^3/s}$" },
            { symbol: "$H_\\text{gross}$", meaning: "Total vertical drop from intake to turbine", units: "m" },
            { symbol: "$\\sum h_L$", meaning: "Head lost to friction, screens, bends, leaks, and other losses", units: "m" },
            { symbol: "$H_\\text{net}$", meaning: "Useful vertical drop after losses", units: "m" },
          ],
        },
        {
          type: "examples",
          title: "Quick Examples",
          examples: [
            {
              title: "A Simple Starter",
              givens: ["$\\eta = 0.80$", "$Q = 1\\ \\mathrm{m^3/s}$", "$H_\\text{gross} = 12\\ \\mathrm{m}$", "$\\sum h_L = 2\\ \\mathrm{m}$", "$H_\\text{net} = 10\\ \\mathrm{m}$"],
              result: "$P_\\text{elec} = 0.80 \\times 1000 \\times 9.8 \\times 1 \\times 10 = 78{,}400\\ \\mathrm{W}$, about $78\\ \\mathrm{kW}$",
              explanation: "This is the baseline: one cubic meter of water each second, ten useful meters of drop, and 80% efficiency.",
            },
            {
              title: "Double The Flow",
              givens: ["$\\eta = 0.80$", "$Q = 2\\ \\mathrm{m^3/s}$", "$H_\\text{net} = 10\\ \\mathrm{m}$"],
              result: "$P_\\text{elec} = 0.80 \\times 1000 \\times 9.8 \\times 2 \\times 10 = 156{,}800\\ \\mathrm{W}$, about $157\\ \\mathrm{kW}$",
              explanation: "When efficiency and net head stay the same, doubling flow doubles power.",
            },
            {
              title: "Double The Net Head",
              givens: ["$\\eta = 0.80$", "$Q = 1\\ \\mathrm{m^3/s}$", "$H_\\text{net} = 20\\ \\mathrm{m}$"],
              result: "$P_\\text{elec} = 0.80 \\times 1000 \\times 9.8 \\times 1 \\times 20 = 156{,}800\\ \\mathrm{W}$, about $157\\ \\mathrm{kW}$",
              explanation: "When efficiency and flow stay the same, doubling net head also doubles power.",
            },
            {
              title: "Same Product, Same Power",
              givens: ["Setup A: $Q = 1\\ \\mathrm{m^3/s}$ and $H_\\text{net} = 20\\ \\mathrm{m}$", "Setup B: $Q = 2\\ \\mathrm{m^3/s}$ and $H_\\text{net} = 10\\ \\mathrm{m}$", "same water and same efficiency"],
              result: "Both setups have $Q\\,H_\\text{net} = 20$, so they produce the same power.",
              explanation: "A plant can trade high head for lower flow, or lower head for higher flow. The product matters.",
            },
          ],
        },
        {
          type: "text",
          title: "Plant Styles",
          body: "A small mountain stream may have little flow but a useful drop through a penstock. A run-of-river plant may have modest head but enormous flow. A storage dam has a reservoir that lets operators choose when to release water. These plants look different, but the same formula explains the first-order power in all of them.",
        },
      ],
      quiz: [
        {
          id: "same-power",
          type: "multiple-choice",
          prompt: "Two small hydro setups use the same water and the same efficiency. Setup A has $Q = 1\\ \\mathrm{m^3/s}$ and $H_\\text{net} = 20\\ \\mathrm{m}$. Setup B has $Q = 2\\ \\mathrm{m^3/s}$ and $H_\\text{net} = 10\\ \\mathrm{m}$. Which setup produces more electrical power?",
          options: [
            {
              id: "a-more",
              label: "Setup A produces more",
              feedback: "Not quite. Setup A has twice the head, but only half the flow.",
            },
            {
              id: "b-more",
              label: "Setup B produces more",
              feedback: "Not quite. Setup B has twice the flow, but only half the head.",
            },
            {
              id: "same",
              label: "They produce the same power",
              feedback: "Correct. In this formula, flow and net head multiply, so both setups have the same $Q\\,H_\\text{net}$.",
            },
            {
              id: "not-enough",
              label: "There is not enough information",
              feedback: "The water and efficiency are the same, so comparing $Q\\,H_\\text{net}$ is enough here.",
            },
          ],
          correctOptionId: "same",
        },
      ],
    },
  ],
};
