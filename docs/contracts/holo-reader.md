# Holo-Reader Lessons

**Status:** Draft contract for the Part I learning-content vertical slice  
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

This contract defines the first durable shape for that system. It is an outline
with enough specificity to guide implementation, while leaving detailed media
formats and simulator adapters to concrete Part I lesson content.

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

The initial implementation should support:

- opening a lesson by stable ID;
- returning to the map without changing logical location;
- displaying lesson sections in authored order;
- keeping in-progress view state transient while the lesson is open;
- discarding incomplete lesson progress when the player exits before passing
  the required assessment;
- committing player progress only when a defined completion or assessment
  outcome succeeds;
- replaying completed lessons without duplicating one-time rewards.

Lesson UI state such as the current section, expanded diagram, paused media
time, and selected answer is view state. It is not player progress unless a
validated lesson outcome commits it. If the player exits before completion,
the next attempt starts from the beginning.

## Authored Lesson Content

Lessons are authored catalog entries in a `learning-main` content document
owned by `/builder/content`. `learning-main` is separate from `character-main`:
lessons may reference character knowledge, skills, documents, quests, and
effects, but they are not character definitions themselves.

Draft lesson shape:

```yaml
lessons:
  - id: hydro-power-intro
    title: Hydro Power, Water You Waiting For?
    summary: How elevation difference and flow rate determine hydro power.
    technology: hydro
    group: hydro-basics
    durationMinutes: 30
    availability:
      require:
        flags:
          all: [library-power-on]
    teaches:
      knowledge: [hydro-head-and-flow]
    sections:
      - id: source
        title: Water as stored energy
        kind: narrative
        body: |
          ...
      - id: diagram
        title: Head, flow, and power
        kind: diagram
        asset: lessons/hydro/head-flow.webp
        caption: Elevation and flow combine to set the available power.
      - id: check
        title: Predict the stronger site
        kind: assessment
        assessment: hydro-head-flow-check
    completion:
      mode: assessment
      requireAssessment: hydro-head-flow-check
      passThreshold: 1
      effects:
        - { op: knowledge.acquire, id: hydro-head-and-flow }
```

Supported first-version section kinds should stay small:

| Kind | Meaning |
| --- | --- |
| `narrative` | Authored explanatory text and optional narration metadata |
| `diagram` | Static image or annotated image with caption |
| `media` | Registered video/audio asset or external-safe media reference |
| `interaction` | Registered built-in interaction, such as a drag, match, slider, or prediction task |
| `assessment` | Question or task that can produce a pass/fail or scored outcome |
| `simulation` | Registered embedded practice surface with host-validated outcomes |

Lesson content may reference registered assets and registered interaction IDs.
It may not reference arbitrary component names.

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
| Concept text | `content/simulators/hydro-power.md` | Rewrite into in-world lesson sections |
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

Credit must distinguish three states:

| State | Meaning |
| --- | --- |
| `discovered` | The player found or unlocked the lesson/document |
| `viewed` | The player opened or browsed the lesson |
| `completed` | The player satisfied the authored completion rule |

Only `completed` lessons award knowledge by default. Viewing can mark a
document read if the author explicitly wants that, but it should not silently
grant conceptual knowledge.

Assessment progress stores successful completion, not wrong attempts. Wrong
answers are an important learning path during the lesson, but they are not
persisted as a score or penalty. Completion records should store enough state
to avoid duplicate one-time rewards and support future review:

```js
{
  lessons: {
    "hydro-power-intro": {
      discoveredAt: "2026-06-30T00:00:00.000Z",
      viewedAt: "2026-06-30T00:03:00.000Z",
      completedAt: "2026-06-30T00:08:00.000Z",
      passedAssessments: {
        "hydro-power-intro-same-power": {
          passedAt: "2026-06-30T00:08:00.000Z"
        }
      }
    }
  }
}
```

The save shape may live under a future character-progress field, but it must
remain JSON-safe and separate from authored lesson definitions.

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

Completing a lesson advances game time by the lesson's authored duration.
When no lesson-specific duration is authored, the default duration is 30
in-game minutes. Replaying an already completed lesson does not duplicate
one-time rewards or repeatedly spend completion time.

## Builder Contract

The Content Builder should add a **Lessons** area alongside Character,
Artifacts, and Preview. It owns:

- lesson catalog entries, grouping, ordering, and tags;
- section authoring for text, diagrams, media, interactions, assessments, and
  embedded simulations;
- assessment prompts, accepted answers, scoring, hints, and feedback;
- completion rules and authored effects;
- references to knowledge, skills, documents, quests, flags, assets, and
  registered simulation outcomes;
- external availability requirements, such as requiring library power to be on
  before a holo-reader lesson can launch;
- internal completion requirements, such as requiring a particular assessment
  to be passed;
- preview states for unavailable, discovered, in-progress, completed, and
  replayed lessons;
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
      payload:
        lessonId: hydro-power-intro
        source: library-holo-reader
        mode: learn
    require:
      flags:
        all: [library-power-on]
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
- includes a diagram or simple visual model of reservoir/intake, penstock, and
  turbine;
- asks the player to predict which site or setting produces more power;
- awards `knowledge.acquire: hydro-head-and-flow` on a passing assessment.

This should be integrated before building a broad lesson library. The contract
should evolve from the working slice rather than speculative section types.

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

- duplicate or malformed lesson, section, assessment, and outcome IDs;
- unknown knowledge, skill, quest, document, flag, asset, interaction, or
  simulation references;
- completion rules with no reachable success path;
- effects that fail the shared character-effect validation;
- assessment answers that cannot be scored;
- lesson entry points that reference a missing lesson;
- arbitrary component names, script content, or unregistered external embeds.

Warnings should identify:

- lessons that teach no knowledge and grant no other visible progress;
- knowledge that is required by story/world/simulation content but never
  taught by a reachable lesson or other authored source;
- lessons with completion effects but no assessment or explicit completion
  action;
- repeatable lessons that grant non-repeatable rewards;
- long lessons without section breaks or progress indicators;
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

- Choose the exact power-on flag ID during implementation by checking current
  story, world, and facility-state conventions. The examples above use
  `library-power-on` as a placeholder until that audit is done.
- Use `holo-reader` as the stand ID for the library holo-reader.
- When extracting future lessons from simulator prototypes, decide per lesson
  whether the best form is static sections, registered interactions, embedded
  simulator-backed sections, or a mixture.

## Implementation Sequence

1. Add `learning-main` persistence, validation, API, import/export, revisions,
   production JSON export, and live-update support.
2. Add Content Builder lesson catalog editing, section editing, assessment
   editing, requirements, completion effects, validation, preview, and
   cross-content reference search.
3. Register a `lesson` game-view renderer that replaces the whole game area
   below the persistent header.
4. Add the power-gated `holo-reader` stand action that opens the lesson browser
   and can launch `hydro-power-intro`.
5. Implement one section renderer for narrative/formula/example content and
   one retryable multiple-choice assessment renderer.
6. Commit completion outcomes through the existing validated effects service,
   advance authored lesson time once, and show an award/rejoin screen.
7. Add simulator-backed lesson sections after the host outcome contract is
   exercised by a built-in assessment.

Each step must preserve the separation between authored content, transient view
state, committed player progress, and external simulator internals.
