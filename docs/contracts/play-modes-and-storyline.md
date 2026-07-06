# Play Modes and Storyline Control

**Status:** Planned alpha contract
**Scope:** playable game mode selection, storyline progression, action policy,
objectives, save data, Story Builder scenario authoring, and references from
world/content authoring

---

## Purpose

Atomic Adventures supports two different player promises:

- **Storyline mode**: the player is Zanzibar in the canonical Part I story.
  The runtime may gate actions, limit movement, force transitions, advance time,
  and show a clear objective so the authored story remains coherent.
- **Open-world mode**: the player explores freely, defines their own goals, and
  experiments with rooms, maps, facilities, artifacts, and actions without
  being forced through the canonical story sequence.

These modes are intentionally separate. A location-triggered story beat should
not carry the burden of being prose, quest logic, action policy, objective UI,
and open-world discovery text at the same time. Storyline sequencing belongs to
a first-class scenario controller. World and facility systems remain the source
of truth for physical possibility and safety.

## Design Principles

- **Explicit mode choice.** A new playthrough chooses `storyline` or
  `open-world` before ordinary play begins.
- **Storyline is guided by default for alpha.** Alpha should introduce a new
  player to hydro startup through Zanzibar's canonical story unless the player
  deliberately chooses free exploration.
- **Beats are prose, not the quest engine.** Beats may attach narrative to a
  step, location, or event, but storyline steps own objectives, gating, forced
  movement, and progression.
- **One action policy.** Storyline gating must apply to button lists, map
  clicks, direct movement handlers, room interactions, pickups, doors, stage
  views, and authored story choices. Hidden actions must not be reachable
  through another UI path.
- **Open-world is broad, not impossible.** Open-world mode exposes broad room,
  map, and action access while preserving movement rules, facility prerequisites,
  inventory requirements, and invalid-state safety rails.
- **Mode state is save state.** Save/load preserves selected mode, storyline
  position, objectives, character state, inventory, flags, facility state, and
  physical location.
- **No rejoin puzzle for alpha.** Switching an open-world save back into a
  canonical storyline is out of scope for alpha because open-world play may
  create valid but non-canonical facility and inventory states.

## Runtime State

Player save data includes the selected mode and, when relevant, storyline
progress:

```js
{
  playMode: "storyline" | "open-world",
  storyline: {
    scenarioId: "part-i-hydro-alpha",
    stepId: "read-startup-card",
    completedStepIds: ["intro"],
    objective: "Read the laminated startup card."
  }
}
```

`playMode` is required. New alpha playthroughs default to `storyline` unless the
player chooses `open-world`.

`storyline` is active only when `playMode` is `storyline`. It records the
current scenario and step, plus completed step IDs. The saved `objective` is a
convenience cache for quick restore; the authored scenario remains the source
of truth after content loads.

Open-world saves keep `storyline` null or inactive. They continue to persist
ordinary player state: location, discoveries, flags, story seen state, character
holdings, lessons, clock, and facility state.

## Mode Selection

Starting a new game presents an explicit mode choice before normal play:

| Mode | Player-facing promise | Alpha default |
| --- | --- | --- |
| Storyline | Follow Zanzibar's guided hydro startup story. | Yes |
| Open-world | Explore and experiment freely. The canonical story may not hold your hand. | No |

For alpha, a save cannot switch from `open-world` back into `storyline`.
Supporting that later requires a deliberate rejoin contract that can map
arbitrary world, inventory, and facility states onto a valid story step.

A future one-way "continue as open-world" escape from storyline may be added
when useful, but it is not required for alpha.

## Scenario Content

A storyline scenario is an authored document in SQLite, exported to production
runtime JSON with the rest of content. Storyline YAML is an import/export
snapshot format only.

The alpha scenario document should be coarse-grained like the existing world
and character documents:

```yaml
id: part-i-hydro-alpha
label: Hydro Startup Storyline
defaultMode: storyline
startStep: intro

steps:
  - id: read-startup-card
    objective: Read the laminated startup card.
    beat: hydro-card-on-console
    allowed:
      stageViews:
        - { kind: document, id: hydro-startup-card }
      indoorActions:
        - pickup:hydro-startup-card
        - item-action:hydro-startup-card.read
      movement:
        mode: current-location-only
    completesWhen:
      flag: artifacts.hydro-startup-card.read
    next: inspect-intake
```

Field meanings:

| Field | Meaning |
| --- | --- |
| `id` | Stable scenario ID. |
| `label` | Author-facing scenario label. |
| `defaultMode` | Suggested new-game default; alpha uses `storyline`. |
| `startStep` | First step ID for a new storyline playthrough. |
| `steps` | Ordered canonical story steps. |

Step meanings:

| Field | Meaning |
| --- | --- |
| `id` | Stable step ID. |
| `objective` | Short player-facing current task. Required. |
| `beat` | Optional story beat ID to present while the step is active. |
| `allowed` | Action policy additions and restrictions for the step. |
| `completesWhen` | Typed completion predicate. |
| `onEnter` | Optional effects, stage view, movement, or time passage when the step starts. |
| `onComplete` | Optional effects, stage view, movement, or time passage after completion. |
| `next` | Next step ID, or null for scenario completion. |

## Completion Predicates

Completion predicates should stay typed and small. They are not a general
boolean scripting language.

Supported alpha predicate families should include:

| Predicate | Example | Meaning |
| --- | --- | --- |
| `flag` | `artifacts.hydro-startup-card.read` | A global story/game flag is set. |
| `facility` | `{ hydro.intakeReady: true }` | A facility state field has the expected value. |
| `location` | `{ place: indoors, room: control-room }` | Player reached a specific location. |
| `holding` | `{ item: hydro-startup-card, holder: character:zanzibar-nuhero }` | A required artifact is held by an accessible holder. |
| `lesson` | `{ id: hydro-power-intro-alpha, status: completed }` | A lesson reached a known progress state. |

If a new predicate is needed, add it with runtime evaluation, builder controls,
validation, tests, and this contract together. Do not add arbitrary nested
boolean expressions until a concrete authored sequence proves they are needed.

## Action Policy

The storyline controller produces an action policy for the current step. The
policy is consumed by play-panel builders, map click handlers, movement
handlers, stage-view launchers, and room interaction handlers.

The policy has two jobs:

1. Allow the current step's required and supporting actions.
2. Hide or block actions that would obscure or break the current story beat.

In storyline mode, an action may be shown only when both conditions are true:

1. The underlying world/facility/character rule allows it.
2. The current storyline step allows it, or the action is part of the always
   available shell.

Always available shell actions may include saving, loading, developer tools in
development, returning from a focused stage view to the map, and opening
non-mutating character/status views when the current step does not explicitly
forbid them.

In open-world mode, the storyline policy is inactive. Action visibility comes
from map, facility, inventory, character, and stage-view rules.

## Allowed Actions

The `allowed` shape should describe player intent in stable IDs, not component
implementation details. Alpha should support these categories:

| Category | Meaning |
| --- | --- |
| `movement.hexes` | World hexes the player may enter. |
| `movement.rooms` | Indoor rooms the player may enter. |
| `movement.exteriorNodes` | Local exterior nodes the player may enter. |
| `movement.transitions` | Map transition IDs the player may use. |
| `movement.mode` | Coarse restriction such as `current-location-only`, `local-area`, or `unrestricted`. |
| `storyChoices` | Story choice IDs or generated stable choice references allowed for this step. |
| `stageViews` | Focused views such as documents, lessons, inventory, console, or simulation. |
| `indoorActions` | Authored room actions, fixture actions, door actions, switches, and pickups. |
| `outdoorActions` | Passage crossing, unlocking, searching, route, and barrier actions. |
| `itemActions` | Artifact actions such as read, inspect, place, carry, plug in, or charge. |
| `developerActions` | Development-only diagnostics explicitly allowed for testing. |

If an allowed action references an object that the underlying system considers
invalid, unavailable, or unsafe, the action remains unavailable. Storyline
policy cannot bypass physical movement, door, holder, or facility rules.

## Forced Effects

Storyline steps may need forced movement, forced time passage, or forced stage
views to keep the canonical story coherent. These effects are authored in
`onEnter` or `onComplete`:

```yaml
onComplete:
  timeMinutes: 10
  activity: light
  move:
    place: indoors
    room: control-room
  view:
    kind: console
    id: hydro
  setFlags:
    - story.hydro-startup.returned-to-console
```

Forced effects are still validated. Movement destinations must exist. Stage
views must use registered kinds. Time advancement must use a supported activity
profile. Character and facility changes must use the shared validated effect
service when they mutate character or inventory state.

## Beats in Each Mode

Story beats remain the prose layer described in
[story-beats.md](story-beats.md). A beat may be scoped by mode:

```yaml
modes: [storyline]
storylineStep: read-startup-card
```

Rules:

- `modes` omitted means the beat is eligible in both modes.
- `modes: [storyline]` means only storyline saves can select the beat.
- `modes: [open-world]` means only open-world saves can select the beat.
- `storylineStep` restricts a beat to the named active step and implies
  `storyline` eligibility.
- Storyline step beats should preserve Zanzibar's authored voice and canonical
  story.
- Open-world beats should be ambient, discovery-oriented, or explanatory. They
  should not imply that the player is following canonical story timing.

## Objectives

Storyline mode must show the current objective clearly in the player-facing UI.
The objective should answer "what matters right now?" without requiring the
player to infer it from prose.

Open-world mode should not show a canonical objective. It may show freeform
status such as current location, facility status, active warnings, or optional
experiments, but the UI must make clear that the player is not following the
authored storyline.

## Builder Responsibilities

Storyline authoring belongs with Story Builder because it composes story beats,
objectives, conditions, choices, stage views, and movement gates. The first
implementation may be a Scenario panel inside `/builder/story`; a separate
route can be added later if scenario authoring grows.

The Story Builder should support:

- creating and editing scenarios;
- ordering steps;
- editing objective text;
- associating a step with a story beat;
- selecting allowed hexes, rooms, exterior nodes, transitions, actions, stage
  views, and item actions from known content;
- editing completion predicates;
- editing `onEnter` and `onComplete` forced effects;
- validating unresolved references and unreachable or contradictory gates;
- previewing the visible action set for a selected step.

World Builder and Content Builder remain separate, but their reference systems
must include storyline references:

- renaming a referenced hex, room, exterior node, transition, item, lesson,
  document, or action updates storyline references in the same transaction when
  reference-aware renames are supported;
- deletion is rejected when it would leave a storyline reference unresolved;
- selected world or content objects should show which storyline steps reference
  them.

## Hydro Alpha Scenario

The alpha storyline scenario should encode the canonical hydro startup sequence:

1. Choose Storyline mode.
2. Establish Zanzibar's situation and first objective.
3. Read or pick up the laminated startup card.
4. Go to the intake.
5. Clear debris and open the intake.
6. Align the upstream/diversion valve.
7. Open the turbine or powerhouse pipe valve.
8. Return to the control room.
9. Connect station power.
10. Check the simplified console.
11. Complete hydro startup.

Storyline mode should prevent optional exploration from burying these steps.
Open-world mode should allow the same hydro facility to be started out of the
canonical order when the underlying facility rules permit it.

## Production and Live Authoring

Scenario content is canonical in `game/content/atomic-adventures.sqlite`.
Production builds export runtime scenario JSON alongside story, world,
building, character, and learning content. Development serves scenario content
through the local API and publishes SSE updates after successful saves.

Open game windows may refresh scenario content without losing player state. If
the active scenario or step still exists, the runtime re-evaluates objective,
allowed actions, and completion state. If the active step is removed or becomes
invalid during live authoring, development builds should show a clear authoring
error and fall back to a safe blocked policy for storyline mode rather than
silently exposing open-world actions.

## Tests

Alpha requires tests for:

- new-game mode selection and storyline default;
- save/load of `playMode`, scenario ID, step ID, completed steps, objectives,
  inventory, flags, character state, and facility state;
- story beat filtering by `modes` and `storylineStep`;
- action policy hiding and blocking movement/actions outside the current step;
- map clicks respecting the same policy as play-panel buttons;
- forced movement, forced time passage, forced stage views, and step effects;
- hydro startup completion in storyline mode with gates active;
- open-world startup with broad action access and valid out-of-order completion;
- live authoring refresh of active scenario data.

## Implementation Map

| Concern | Expected location |
| --- | --- |
| Play mode and storyline save state | `game/src/composables/useGameState.js` |
| Scenario loading | `game/src/composables/useStorylineContent.js` or equivalent |
| Storyline controller and action policy | `game/src/composables/useStoryline.js` |
| Beat filtering by mode/step | `game/src/composables/useStory.js` |
| Action-policy consumption | `game/src/composables/usePlayPanel.js`, map handlers, indoor/outdoor actions |
| Mode/objective UI | `game/src/views/GameView.vue` and HUD components |
| Scenario validation/projection | `game/server/storyline-model.js` or story model sibling |
| Scenario repository/API/revisions | `game/server/` content repositories and API routes |
| Story Builder scenario UI | `game/src/views/BuilderView.vue` or extracted builder components |
| Scenario tests | `game/src/composables/`, `game/src/lib/maps/testing/`, and `game/server/` |
