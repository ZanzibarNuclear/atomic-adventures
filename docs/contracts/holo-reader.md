# Holo-Reader Lessons

**Status:** Implemented MVP contract for the Part I learning-content vertical slice  
**Scope:** `game/` lesson runtime, Content Builder lesson authoring, story/world
entry points, player learning credit, and future hydro simulator integration

---

## Purpose

The holo-reader presents authored learning material as an in-world device, not
as an out-of-game help screen. Zanzibar experiences it as multi-sensory
instruction: projected scenes, narration, diagrams, tactile or spatial cues,
interactive checks, and embedded practice. The player sees a readable,
interactive lesson surface that teaches real concepts before those concepts
unlock story actions, simulations, skills, or facility operations.

This contract defines the first durable shape for that system. The MVP supports
authored text, formulas, symbol tables, worked examples, retryable
multiple-choice checks, and completion effects. Additional visual, media,
interaction, and simulator-backed lesson types should extend this contract as
they are implemented.

## Goals

- Make learning content feel like a world object: a holo-reader lesson opened
  from a room, item, console, story choice, or document library.
- Let authors create and organize hydro lessons in the Content Builder without
  editing code.
- Award progress only through explicit completion or assessment outcomes.
- Distinguish player-demonstrated learning from Zanzibar merely viewing prose.
- Keep lesson state, player state, content definitions, and external simulator
  internals separate.
- Reuse the existing stage-view, character requirement, and effect contracts.

## Relationship to Existing Contracts

Holo-reader lessons use the `lesson` game-view kind from
[stage-views.md](stage-views.md). For the library holo-reader, opening a
lesson replaces the whole game area below the persistent header: map, active
story beat, narrative card, and play panel are hidden while the player is
immersed in the lesson. Exiting the holo-reader restores the current map, room,
stand, camera, story context, and available actions.

Learning credit uses the shared character requirements and effects in
[character-inventory.md](character-inventory.md). Lessons may grant
`knowledge.acquire`, `document.mark-read`, `skill.add-evidence`, quest effects,
flags, or other registered character effects, but only through the validated
effect boundary.

Lessons may include embedded practice or simulations. Those surfaces follow the
same host-owned outcome boundary described for simulations: the lesson or
embedded simulator reports a registered outcome ID and payload; the game host
validates and commits effects atomically.

## Runtime Model

A lesson is opened through a game view:

```js
{
  kind: "lesson",
  payload: {
    lessonId: "hydro-power-intro",
    source: "library-holo-reader",
    mode: "learn"
  }
}
```

The current implementation supports:

- opening a lesson by stable ID;
- returning to the map without changing logical location;
- displaying lesson pages, frames, and blocks in authored order;
- keeping in-progress view state transient while the lesson is open;
- discarding incomplete lesson progress when the player exits before passing
  the required quiz;
- committing player progress only when the authored quiz or a future defined
  completion outcome succeeds;
- replaying completed lessons without duplicating one-time rewards.

### Lesson Revisions And Switching

Authored lesson IDs are stable player-progress keys. Do not overwrite a
published lesson ID with an in-progress rewrite when the original lesson may
need to remain playable. Instead, create a new lesson with its own stable ID,
copy the intended completion effects, and keep the prior lesson intact until
the revision is ready.

Lesson revisions may be exposed side by side when comparison is useful. The
live holo-reader catalog shows only lessons where `published` is not `false`.
The Content Builder must let authors publish or unpublish a lesson without
deleting it. This lets authors keep a revision in `learning-main` without
exposing it to players, but it is not required for every revision. To switch a
lesson revision into the playable path, publish the new lesson and unpublish the
previous lesson in the same authoring update if the older lesson should leave
the catalog. To switch back, reverse those published states. Story, world,
inventory, and document entry points that open a specific lesson by ID must be
updated in the same change when they are meant to target the new revision.

For the hydro alpha rewrite, keep the original `hydro-power-intro` lesson
unchanged while authoring the beginner rewrite as `hydro-power-intro-alpha`.
Both versions are available in the holo-reader catalog so players and authors
can compare them. Both should grant the same required hydro
knowledge/progression effects unless the progression contract intentionally
changes. Completion state remains per lesson ID, while character effects remain
idempotent through the shared validated effect service.

Lesson UI state such as page position, selected answer, feedback state,
expanded diagram, or paused media time is view state. It is not player progress
unless a validated lesson outcome commits it. If the player exits before
completion, the next attempt starts from the beginning.

## Authored Lesson Content

Lessons are authored catalog entries in a `learning-main` content document
owned by `/builder/content`. `learning-main` is separate from `character-main`:
lessons may reference character knowledge, skills, documents, quests, and
effects, but they are not character definitions themselves.

Current lesson shape:

```yaml
id: learning-main
lessons:
  - id: hydro-power-intro
    title: Hydro Power, Water You Waiting For?
    summary: How elevation difference and flow rate determine hydro power.
    order: 10
    availableWhen:
      flags:
        all: [hub.hydro_online]
        any: []
        not: []
      knowledge:
        all: []
        any: []
        not: []
    completion:
      awardTitle: Hydro Power Theory
      awardText: Zanzibar understands how head, flow, and efficiency combine.
      effects:
        - { op: knowledge.acquire, id: hydro-head-and-flow }
    pages:
      - id: water-to-wires
        title: Water To Wires
        frames:
          - id: downhill-water
            title: Water Above, Power Below
            blocks:
              - type: paragraph
                body: |
                  ...
              - type: image
                src: /learning/hydro/cascading-waterfall-head.png
                alt: A cascading waterfall drops from an upper pool to a lower stream.
                caption: Water loses height as gravity pulls it downhill.
              - type: paragraph
                body: |
                  ...
          - id: simple-rule
            title: The Simple Rule
            blocks:
              - type: formula
                formula: "$$P_\\text{elec} = \\eta\\,\\rho\\,g\\,Q\\,H_\\text{net}$$"
                caption: Electrical power equals hydraulic power times efficiency.
              - type: symbols
                rows:
                  - { symbol: "$Q$", meaning: Volume flow through the turbine, units: "$\\mathrm{m^3/s}$" }
          - id: water-path-check
            kind: quiz
            title: Check Your Understanding
            questions:
              - id: same-power
                type: multiple-choice
                prompt: Which setup produces more electrical power?
                options:
                  - id: a-more
                    label: Setup A produces more
                    feedback: Not quite. Setup A has twice the head but half the flow.
                  - id: same
                    label: They produce the same power
                    feedback: Correct. Flow and net head multiply.
                correctOptionId: same
```

Lesson authoring uses `pages`, where each page contains one or more framed
learning objects, and each frame contains mixed content blocks or quiz
questions.

## Pages, Frames, And Blocks

Lessons may span multiple pages. A page is a navigation unit: the player moves
through it with Next/Back controls rather than one long table-of-contents list.
Pages should be small enough to feel readable in one sitting, and may contain
one or more related frames.

A frame is the visible bordered unit on a page. A frame may combine paragraphs,
images, diagrams, formulas, symbol tables, examples, videos, interactions, and
other supported blocks in authored order. This lets one concept live in one
visual container while still mixing prose and media naturally.

Quiz questions may be authored as their own frame with `kind: quiz`. A quiz
frame can assess the immediately preceding frame, several related frames on the
same page, previous pages, or the whole lesson. Completion credit is committed
only after all required quiz or assessment frames for the lesson pass.

Supported content block types are:

| Type | Meaning |
| --- | --- |
| `paragraph` | Authored explanatory prose; frames may contain multiple paragraphs |
| `formula` | Displayed math with optional caption |
| `symbols` | Symbol, meaning, and units table |
| `examples` | Worked example cards with givens, result, and explanation |
| `diagram` | Ordered visual flow steps with optional explanatory body text |
| `image` | Public image asset with required alt text and optional caption |
| `video` | Future registered video/media asset with captions or transcript |
| `interaction` | Future registered interaction ID with declared inputs and outcomes |

Supported quiz question types currently include retryable `multiple-choice`.
Future assessment, simulation, media, and interaction blocks should reference
registered assets, registered interaction IDs, or host-validated simulation
outcomes, not arbitrary component names or script content.

## Simulator Extraction and Reuse

Existing educational material may be adapted from sibling projects, beginning
with `../welcome`. Treat that source as editable reference material, not as a
runtime dependency for Atomic Adventures.

The `welcome` project uses this pattern:

- simulator markdown in `content/simulators/*.md`;
- frontmatter `component: "ComponentName"`;
- Vue components in `app/components/simulators/`;
- shared physics helpers in `utils/`;
- static media under `public/images/simulators/`.

Atomic Adventures should extract simulator material in layers:

| Layer | Example from `welcome` | Atomic Adventures use |
| --- | --- | --- |
| Concept text | `content/simulators/hydro-power.md` | Rewrite into in-world lesson frames |
| Static assets | `public/images/simulators/*.svg`, covers | Copy or recreate as registered lesson assets with captions |
| Physics kernels | `utils/fluidMechanics.ts` | Port into local registered simulation/assessment helpers |
| Presets | Hydro plant styles/sites; pipe diameter/length examples | Convert into lesson scenarios and assessment inputs |
| Interactive component | `HydroPowerSimulator.vue`, `PipeFlow*.vue` | Adapt into registered lesson interactions or simulation views |
| Outcome points | Computed power, Reynolds regime, head loss, pump operating point | Declare host-validated assessment or simulation outcomes |

Do not import sibling Vue components by filesystem path at runtime. If a
simulator becomes part of the game, copy or port the needed code into `game/`,
register it through the close-up/simulation registry, and expose only declared
inputs and outcomes to lesson content.

Reusable physics formulas should live in ordinary modules that can be tested
independently from Vue rendering. Lesson assessments and simulations should
call those modules, so the same calculation supports:

- a visual lesson readout;
- an assessment answer check;
- a simulator outcome;
- future automated tests.

When extracting from a sibling simulator, record:

- source path and source simulator title;
- copied assets and their destination asset IDs;
- supported inputs, units, ranges, defaults, and presets;
- computed outputs and their units;
- assessment/outcome IDs;
- known simplifications and model limits;
- accessibility text for visual or animated material.

This keeps future extraction from isotope, atom-builder, fusion, solar, or
reactor simulators consistent with the hydro slice.

## Assessments and Learning Credit

Credit currently distinguishes completion from mere viewing:

| State | Meaning |
| --- | --- |
| `completed` | The player satisfied the authored completion rule |

Only `completed` lessons award knowledge by default. Viewing can mark a
document read if the author explicitly wants that, but it should not silently
grant conceptual knowledge.

Assessment progress stores successful completion, not wrong attempts. Wrong
answers are an important learning path during the lesson, but they are not
persisted as a score or penalty. Completion records store the state currently
needed to avoid duplicate one-time rewards:

```js
{
  lessons: {
    "hydro-power-intro": {
      completedAt: "2026-06-30T00:08:00.000Z"
    }
  }
}
```

The save shape may live under a future character-progress field, but it must
remain JSON-safe and separate from authored lesson definitions.

`discoveredAt`, `viewedAt`, and per-assessment pass records should be added
only when gameplay, lesson analytics, multi-assessment completion, or resume
behavior needs them.

Assessment authoring should support:

- multiple-choice checks where distractors diagnose misconceptions;
- prediction tasks that ask the player to choose or estimate an outcome before
  revealing feedback;
- simulator-backed outcomes, such as correctly reaching a target hydro output;
- retries until passing, feedback, and review after passing;
- one-time and repeatable rewards.

Passing should be based on the player's interaction, not merely the avatar's
fictional competence. Zanzibar can still narrate or react to the result, but
lesson completion credit should be tied to a real player answer or practice
outcome.

Lesson duration is an editorial scoping device only. Lesson content does not
persist or enforce duration, does not advance game time on completion, and does
not show a duration to players. Replaying an already completed lesson does not
duplicate one-time rewards.

## Builder Contract

The Content Builder should add a **Lessons** area alongside Character,
Artifacts, and Preview. It owns:

- lesson catalog entries, ordering, and publish state;
- page authoring, frame ordering, and mixed block authoring for paragraphs,
  images, diagrams, formulas, symbol tables, examples, and future registered
  video, interaction, assessment, and simulation types;
- quiz prompts, answer options, correct answers, and feedback;
- completion acknowledgements and authored effects;
- references to knowledge, skills, documents, quests, flags, and future assets
  and registered simulation outcomes;
- external `availableWhen` requirements, such as requiring station power to be
  on before a holo-reader lesson can launch;
- the completion path currently represented by passing the authored quiz;
- preview of the authored lesson content and completion acknowledgement;
- reference search for every story/world/content use of a lesson ID.

The player normally opens the library holo-reader from the `holo-reader` stand.
When the player is seated there and the authored power requirement passes, the
holo-reader presents a browser of available lesson titles from `learning-main`.
Selecting a title opens that lesson.

Story Builder and World Builder may also reference lessons as direct entry
points when a scene needs to open a specific lesson:

```yaml
choices:
  - text: Load Hydro Power, Water You Waiting For?
    view:
      kind: lesson
      id: hydro-power-intro
      source: library-holo-reader
```

The action opens the holo-reader view; it does not grant completion effects
unless the lesson outcome later commits them. World fixtures, inventory items,
and documents may later expose lesson-opening actions as well.

## Hydro Vertical Slice

The first useful slice should include one hydro lesson that proves lesson
loading, presentation, assessment, and completion credit. The first lesson is
`hydro-power-intro`, titled **Hydro Power, Water You Waiting For?**:

- teaches that available hydro power depends on head, flow rate, water density,
  gravity, and efficiency;
- should include visual models and images of reservoir/intake, penstock,
  valves, gauges, turbine, generator, and tailrace concepts;
- asks the player to predict which site or setting produces more power;
- awards `knowledge.acquire: hydro-head-and-flow` on a passing assessment.

This should be integrated before building a broad lesson library. The contract
should evolve from the working slice rather than speculative content types.

## Hydro Source Material

The first hydro lessons can draw from the sister project content in
`../welcome/content/simulators/`:

| Source | Best use in Atomic Adventures |
| --- | --- |
| `hydro-power.md` | Primary beginner lesson for head, flow, gross head, net head, losses, turbine/generator conversion, and storage/run-of-river/micro-hydro comparisons |
| `pipe-flow-laminar.md` | Beginner support lesson for smooth pipe flow, Reynolds number, wall friction, pressure drop, and why pipe diameter strongly affects losses |
| `pipe-flow.md` | Intermediate reference or optional advanced lesson for Darcy-Weisbach losses, roughness, minor losses, Moody-style friction, and pump/system operating points |

The corresponding simulator components are:

| Component/source | Extractable lesson pieces |
| --- | --- |
| `../welcome/app/components/simulators/HydroPowerSimulator.vue` | Plant style and site presets; flow, gross head, head loss, efficiency sliders; net head, hydraulic power, electrical power, daily energy comparisons; dam/reservoir and hillside/forebay/penstock schematics |
| `../welcome/app/components/simulators/PipeFlowLaminarSimulator.vue` | Laminar cross-section visual; pipe diameter and length presets; volume-flow slider keyed to Reynolds transition; Hagen-Poiseuille pressure drop; D^4 diameter sensitivity; simple flow-volume animation |
| `../welcome/app/components/simulators/PipeFlowSimulator.vue` | Water/sodium property comparison; Reynolds regime; Darcy friction factor; straight-pipe head loss; minor losses; equivalent length; Moody-style chart; pump/system operating point |
| `../welcome/utils/fluidMechanics.ts` | `hydraulicPowerWatts`, fluid properties, Reynolds number, Hagen-Poiseuille pressure drop, Darcy-Weisbach head loss, minor losses, pump-head matching |

The first hydro lesson should adapt `hydro-power.md` rather than embed it
unchanged. It can become a short holo-reader sequence:

1. Show the hydro path: intake, penstock, turbine, generator, tailrace.
2. Teach gross head, head loss, and net head.
3. Teach that electrical power scales with flow and net head:

   ```text
   P_elec = eta * rho * g * Q * H_net
   ```

4. Ask the player to predict which of two sites or settings produces more
   power.
5. Award `knowledge.acquire: hydro-head-and-flow` only after the player passes
   the prediction check.

Pipe-flow material should enter when Part I needs the player to understand why
a clogged intake, narrow penstock, long run, rough pipe, bends, or air in the
line reduces delivered head. The beginner path should use plain concepts first:
flow regime, friction, pressure drop, and head loss. The intermediate
Darcy-Weisbach/Moody material should be optional until a simulator stage
actually asks the player to reason about roughness, fittings, or pump operating
points.

Candidate hydro lesson IDs:

| Lesson ID | Source | Teaches | Likely reward |
| --- | --- | --- | --- |
| `hydro-power-intro` | `hydro-power.md` | Power depends on flow and net head | `knowledge.acquire: hydro-head-and-flow` |
| `hydro-net-head-losses` | `hydro-power.md`, `pipe-flow-laminar.md` | Losses reduce usable head before the turbine | `knowledge.acquire: hydro-net-head-losses` |
| `hydro-penstock-friction` | `pipe-flow-laminar.md`, later `pipe-flow.md` | Pipe length, diameter, viscosity, roughness, and fittings affect pressure/head loss | `knowledge.acquire: hydro-penstock-friction` |

Candidate assessment/outcome IDs:

| Outcome ID | Source calculation | Passing behavior |
| --- | --- | --- |
| `hydro-predict-power-ranking` | `P_elec = eta * rho * g * Q * H_net` | Player chooses the higher-power site from two scenarios |
| `hydro-identify-zero-output` | Net head or flow reaches zero | Player identifies why the generator is not producing power |
| `hydro-reduce-head-loss` | Head-loss inputs or pipe-loss helper | Player chooses the intervention that increases net head |
| `pipe-recognize-transition` | Reynolds number | Player predicts smooth, transitional, or turbulent flow |
| `pipe-diameter-loss-effect` | Hagen-Poiseuille or Darcy-Weisbach helper | Player recognizes that a narrower pipe sharply increases losses |

These are content candidates, not mandatory IDs. Once a lesson ID is referenced
by story, world, simulation, or save data, it becomes a stable authored ID and
should follow the normal reference-safety rules.

## Validation

Blocking validation should reject:

- duplicate or malformed lesson IDs, page IDs, frame IDs, quiz IDs, answer
  option IDs, and future block, asset, interaction, assessment, or outcome IDs;
- unknown knowledge, skill, quest, document, asset, interaction, or simulation
  references where a validated catalog exists;
- effects that fail the shared character-effect validation;
- quiz answers that cannot be scored;
- lesson entry points that reference a missing lesson;
- arbitrary component names, script content, or unregistered external embeds.

Warnings should identify:

- lessons that teach no knowledge and grant no other visible progress;
- knowledge that is required by story/world/simulation content but never
  taught by a reachable lesson or other authored source;
- lessons with completion effects but no quiz or explicit completion action;
- repeatable lessons that grant non-repeatable rewards;
- long lessons without page breaks, frame breaks, or progress indicators;
- media references without captions, transcripts, or text alternatives.

## Accessibility and Presentation

The holo-reader may be fictionalized as multi-sensory for Zanzibar, but the
player-facing UI must not rely on a single sense. Every core lesson concept
needs a text path. Diagrams need captions or descriptions. Audio/video needs
captions or transcripts before it can be required progression content. Color,
motion, and sound may reinforce an idea but must not be the only way to answer
an assessment.

The lesson surface should feel focused and in-world, but it remains a game
view: keyboard navigation, readable text sizing, clear progress, and an
available Exit Holo-Reader action are required. Exiting before completion
returns the player to the surrounding map/story view without granting lesson
completion.

## Implementation Research

- The audited power flag for lesson availability is `hub.hydro_online`.
- Use `holo-reader` as the stand ID for the library holo-reader.
- When extracting future lessons from simulator prototypes, decide per lesson
  whether the best form is static frames, registered interactions, embedded
  simulator-backed frames, or a mixture.

## Implemented Sequence And Extension Point

1. Add `learning-main` persistence, validation, API, import/export, revisions,
   production JSON export, and live-update support.
2. Add Content Builder lesson catalog editing, page/frame/block editing,
   assessment editing, requirements, completion effects, validation, preview,
   and cross-content reference search.
3. Register a `lesson` game-view renderer that replaces the whole game area
   below the persistent header.
4. Add the power-gated `holo-reader` stand action that opens the lesson browser
   and can launch `hydro-power-intro`.
5. Implement renderers for lesson content blocks plus a retryable
   multiple-choice quiz renderer.
6. Commit completion outcomes through the existing validated effects service,
   and show an award/rejoin screen.
7. Add simulator-backed lesson frames after the host outcome contract is
   exercised by a built-in assessment.

Each step must preserve the separation between authored content, transient view
state, committed player progress, and external simulator internals.
