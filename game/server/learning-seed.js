export const learningSeed = {
  id: "learning-main",
  lessons: [
    {
      id: "hydro-power-intro",
      title: "Hydro Power, Water You Waiting For?",
      summary: "Learn how flow, head, and efficiency determine hydroelectric power.",
      order: 10,
      published: true,
      availableWhen: {
        flags: { all: ["hub.hydro_online"] },
      },
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
    {
      id: "hydro-power-intro-alpha",
      title: "Hydro Power From Stream To Socket",
      summary: "A beginner-friendly tour of how falling water spins a turbine and powers the station.",
      order: 11,
      published: true,
      availableWhen: {
        flags: { all: ["hub.hydro_online"] },
      },
      completion: {
        awardTitle: "Hydro Power Theory",
        awardText: "Zanzibar can trace the path from stored water to spinning turbine to useful electricity.",
        effects: [
          { op: "knowledge.acquire", id: "hydro-head-and-flow" },
        ],
      },
      pages: [
        {
          id: "water-and-height",
          title: "Water And Height",
          frames: [
            {
              id: "big-picture",
              kind: "content",
              title: "The Big Picture",
              blocks: [
                {
                  type: "paragraph",
                  body: "Hydro power is electricity made from moving water. Imagine a stream pushing an old waterwheel. A hydro plant uses the same idea, but the wheel is a carefully shaped turbine and the spinning shaft turns a generator. The station's job is to guide water so gravity can do useful work.",
                },
                {
                  type: "image",
                  src: "/learning/hydro/cascading-waterfall-head.png",
                  alt: "A forest waterfall cascading through several drops from an upper pool to a lower stream.",
                  caption: "The waterfall is the plain-language version of head: water starts high, loses height, and gains motion as gravity pulls it downhill.",
                },
                {
                  type: "paragraph",
                  body: "Water stored high has energy because gravity can pull it downward. The vertical difference between the high water and the turbine is called head. More height difference usually means the water can push harder at the turbine, the way a taller slide gives a faster ride.",
                },
                {
                  type: "image",
                  src: "/learning/hydro/hydro-dam-reservoir-tailwater.png",
                  alt: "A concrete hydro dam with a high blue reservoir above it and a lower river channel below.",
                  caption: "A dam makes the height difference easy to see: lake water above the plant, tailwater below it.",
                },
              ],
            },
          ],
        },
        {
          id: "water-path",
          title: "The Water Path",
          frames: [
            {
              id: "path-overview",
              kind: "content",
              title: "Picture The Water Path",
              blocks: [
                {
                  type: "paragraph",
                  body: "Follow one parcel of water from the high side of the system to the low side.",
                },
                {
                  type: "diagram",
                  steps: [
                    "High water",
                    "Intake screen",
                    "Penstock pressure pipe",
                    "Turbine",
                    "Generator shaft",
                    "Tailrace",
                  ],
                },
                {
                  type: "paragraph",
                  body: "Flow rate means how much water moves each second. A trickle from a garden hose and a wide river may both be moving downhill, but the river carries far more water. More flow gives the turbine more water to catch, as long as the intake, pipe, and turbine are ready for it.",
                },
              ],
            },
            {
              id: "intake-and-valves",
              kind: "content",
              title: "Intake, Penstock, And Valves",
              blocks: [
                {
                  type: "paragraph",
                  body: "The intake is the doorway for water. If its screen is blocked with debris, less water reaches the plant. The penstock is the pressure pipe that carries water downhill. If a valve is closed, the water cannot move. If the pipe leaks or traps air, some of the useful push is lost before the turbine.",
                },
                {
                  type: "image",
                  src: "/learning/hydro/hydro-intake-trash-rack.png",
                  alt: "A concrete hydro intake with metal trash rack screens catching branches and leaves as water flows toward it.",
                  caption: "The intake is where water enters. The screen protects the plant, but debris on the screen reduces flow.",
                },
                {
                  type: "image",
                  src: "/learning/hydro/hydro-valve-handwheel.png",
                  alt: "A large round red handwheel on an industrial valve attached to a blue-gray hydro plant pipe.",
                  caption: "A wheel valve can open or close the water path. If the path is closed, the turbine cannot spin.",
                },
              ],
            },
          ],
        },
        {
          id: "powerhouse",
          title: "Turbine, Generator, Pressure",
          frames: [
            {
              id: "powerhouse-equipment",
              kind: "content",
              title: "Inside The Powerhouse",
              blocks: [
                {
                  type: "paragraph",
                  body: "The turbine is the waterwheel inside the plant. Water pushes its blades and spins a shaft. The generator is connected to that shaft. When the shaft turns inside the generator, the generator makes electrical power for lights, consoles, chargers, and other station systems.",
                },
                {
                  type: "image",
                  src: "/learning/hydro/hydro-pressure-gauge-40psi.png",
                  alt: "A round analog pressure gauge mounted on pipework with the needle near forty PSI.",
                  caption: "A pressure gauge is one clue that the penstock is filled and pushing. This one reads around 40 PSI.",
                },
                {
                  type: "formula",
                  formula: "$$\n\\text{power} \\propto \\text{flow} \\times \\text{useful height}\n$$",
                  caption: "For a first mental model, more water each second and more useful drop mean more possible power.",
                },
              ],
            },
            {
              id: "path-check",
              kind: "quiz",
              title: "Check The Path",
              questions: [
                {
                  id: "trace-water-path",
                  type: "multiple-choice",
                  prompt: "Which path best describes how the station makes electricity?",
                  options: [
                    {
                      id: "battery-to-water",
                      label: "Battery -> intake -> stream -> generator",
                      feedback: "Not quite. The water path starts at the intake, and the generator comes after the turbine spins.",
                    },
                    {
                      id: "intake-penstock-turbine-generator",
                      label: "Intake -> penstock -> turbine -> generator -> tailrace",
                      feedback: "Correct. Water enters, travels downhill, spins the turbine, turns the generator, and leaves through the tailrace.",
                    },
                    {
                      id: "generator-turbine-intake",
                      label: "Generator -> turbine -> intake -> penstock",
                      feedback: "Not quite. The generator is turned by the turbine; it is not the start of the water path.",
                    },
                  ],
                  correctOptionId: "intake-penstock-turbine-generator",
                },
                {
                  id: "identify-head",
                  type: "multiple-choice",
                  prompt: "In hydro power, what does head mean?",
                  options: [
                    {
                      id: "water-temperature",
                      label: "How warm the water is",
                      feedback: "Not quite. Temperature can matter in some fluid problems, but head is about height difference.",
                    },
                    {
                      id: "height-difference",
                      label: "The useful height difference gravity can pull water through",
                      feedback: "Correct. More useful height can help the water push harder at the turbine.",
                    },
                    {
                      id: "generator-size",
                      label: "The physical size of the generator",
                      feedback: "Not quite. Generator size matters for equipment limits, but head describes the water's drop.",
                    },
                  ],
                  correctOptionId: "height-difference",
                },
              ],
            },
          ],
        },
        {
          id: "field-checks",
          title: "Field Checks",
          frames: [
            {
              id: "startup-checks",
              kind: "content",
              title: "Fast Field Checks",
              blocks: [
                {
                  type: "paragraph",
                  body: "Three problems matter right away in Zanzibar's station. Debris at the intake reduces flow. Closed or misaligned valves stop the path. Leaks, rough pipe, sharp bends, and trapped air waste pressure before the turbine. The control room can only make power after the water path is open and healthy.",
                },
                {
                  type: "examples",
                  examples: [
                    {
                      title: "Good Water Path",
                      givens: ["intake clear", "valves open", "penstock filled", "tailrace open"],
                      result: "Water can reach the turbine, spin the generator, and leave the plant.",
                      explanation: "This is the path Zanzibar is trying to restore before expecting steady electricity.",
                    },
                    {
                      title: "Blocked Intake",
                      givens: ["branches across the screen", "less water entering", "same height difference"],
                      result: "Power drops because flow drops.",
                      explanation: "The hill did not change, but less water per second reaches the turbine.",
                    },
                    {
                      title: "Closed Valve",
                      givens: ["intake clear", "penstock ready", "valve closed near the turbine"],
                      result: "The turbine cannot spin because the water path is interrupted.",
                      explanation: "Hydro power needs a complete route from high water to low water.",
                    },
                  ],
                },
                {
                  type: "symbols",
                  rows: [
                    { symbol: "head", meaning: "Height difference that lets gravity push water downhill", units: "meters of height" },
                    { symbol: "flow", meaning: "How much water moves through the turbine each second", units: "water volume per second" },
                    { symbol: "intake", meaning: "The place where water enters the hydro system", units: null },
                    { symbol: "penstock", meaning: "A pressure pipe that carries water downhill to the turbine", units: null },
                    { symbol: "turbine", meaning: "The bladed wheel that water spins", units: null },
                    { symbol: "generator", meaning: "The machine turned by the turbine shaft to make electricity", units: null },
                    { symbol: "tailrace", meaning: "The channel where water leaves the plant", units: null },
                  ],
                },
                {
                  type: "paragraph",
                  body: "When Zanzibar clears debris, opens the intake, aligns valves, fills the penstock, and returns to the console, each action supports the same simple chain: water moves downhill, water spins the turbine, the turbine turns the generator, and the generator powers the station.",
                },
              ],
            },
            {
              id: "field-check-quiz",
              kind: "quiz",
              title: "Check The Startup",
              questions: [
                {
                  id: "spot-power-loss",
                  type: "multiple-choice",
                  prompt: "Branches are blocking the intake screen. What is the first reason power will fall?",
                  options: [
                    {
                      id: "less-flow",
                      label: "Less water per second reaches the turbine",
                      feedback: "Correct. Blocked intake screens reduce flow.",
                    },
                    {
                      id: "more-height",
                      label: "The height difference gets larger",
                      feedback: "Not quite. A blocked screen does not make the hill taller.",
                    },
                    {
                      id: "tailrace-reverses",
                      label: "The tailrace pushes water backward into the generator",
                      feedback: "Not quite. The practical problem is reduced flow into the system.",
                    },
                  ],
                  correctOptionId: "less-flow",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
