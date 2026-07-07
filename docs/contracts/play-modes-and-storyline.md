# Play Modes and Storyline Control

**Status:** Planned contract
**Scope:** playable game mode selection, storyline progression, action policy,
objectives, save data, Story Builder scenario authoring, and references from
world/content authoring

---

## Purpose

Atomic Adventures supports two different player promises:

- **Story mode**: the player is Zanzibar in the canonical Part I story.
  Story beats, objectives, and suggested actions present Zanzibar's internal
  experience and encourage the canonical path without revealing discoveries
  before Zanzibar makes them.
- **Open-world mode**: the player explores freely, defines their own goals, and
  experiments with rooms, maps, facilities, artifacts, and actions without
  being cast as Zanzibar's authored story.

These modes are intentionally separate. A location-triggered story beat should
not carry the burden of being prose, quest logic, action policy, objective UI,
and open-world discovery text at the same time. Storyline sequencing belongs to
a first-class scenario controller. World and facility systems remain the source
of truth for physical possibility, movement, safety, and survival pressure.

## Design Principles

- **Explicit mode choice.** A new playthrough chooses `story` or
  `open-world` before ordinary play begins.
- **Story mode is Zanzibar's point of view.** Story mode presents the
  authored sequence through Zanzibar's perceptions, memories, worries, and
  guesses. It should not name the utility station, hydro facility, eBuggy, or
  other undiscovered things before Zanzibar has reason to know them.
- **Story mode is guided by prompts, not by locking the player onto rails.**
  Story mode should always surface at least one plausible story-continuing
  action, but ordinary movement remains available when the world allows it. Story
  actions and ordinary actions should look the same to the player. Detours may
  cost time, energy, hydration, satiety, or safety.
- **Beats are prose, not the quest engine.** Beats may attach narrative to a
  step, location, or event, but storyline steps own objectives, story-continuing
  prompts, completion, and progression.
- **One action policy for prompts and nonmovement gates.** Storyline policy
  must apply consistently to story-continuing prompts, beat choices, stage views,
  item actions, facility actions, and other story-sensitive interactions.
  It should not block ordinary movement unless a concrete authored scene has a
  special physical or narrative reason.
- **Open-world is broad, not impossible.** Open-world mode exposes broad room,
  map, and action access while preserving movement rules, facility prerequisites,
  inventory requirements, and invalid-state safety rails.
- **Survival pressure is shared.** Both modes use character wellbeing, time, and
  activity costs. Story mode may warn and frame consequences in Zanzibar's
  voice, but wandering too long can still put the character in serious trouble.
- **Mode state is save state.** Save/load preserves selected mode, storyline
  position, objectives, character state, inventory, flags, facility state, and
  physical location.
- **No rejoin puzzle.** Switching an open-world save back into a
  canonical storyline is out of scope because open-world play may
  create valid but non-canonical facility and inventory states.

## Runtime State

Player save data includes the selected mode and, when relevant, storyline
progress:

```js
{
  playMode: "story" | "open-world",
  storyline: {
    scenarioId: "part-i-opener",
    stepId: "survive-in-the-woods",
    completedStepIds: [],
    objective: "Keep moving. Find something that can help you survive."
  }
}
```

`playMode` is required. New playthroughs default to `story` unless the
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

| Mode | Player-facing promise | Default |
| --- | --- | --- |
| Story | Experience Zanzibar's story from the inside. | Yes |
| Open-world | Explore and experiment freely as a player-authored run. | No |

For the current implementation, a save cannot switch from `open-world` back into `story`.
Supporting that later requires a deliberate rejoin contract that can map
arbitrary world, inventory, and facility states onto a valid story step.

A future one-way "continue as open-world" escape from story mode may be added
when useful, but it is not required for the current implementation.

## Scenario Content

A storyline scenario is an authored document in SQLite, exported to production
runtime JSON with the rest of content. Storyline YAML is an import/export
snapshot format only.

Storyline documents should be coarse-grained like the existing world
and character documents. Story arc IDs use story-facing names, not software
phase names:

```yaml
id: part-i-opener
label: Part I Opener
defaultMode: story
startStep: survive-in-the-woods

steps:
  - id: survive-in-the-woods
    objective: Keep moving. Find something that can help you survive.
    beat: forest-lost-opening
    allowed:
      movement:
        mode: unrestricted
      storyForwardActions:
        - route:east-pines
      optionalActions:
        - stage:inventory
    completesWhen:
      location: { place: outdoors, hex: gate-woods }
    nextScenario: part-i-station
```

Field meanings:

| Field | Meaning |
| --- | --- |
| `id` | Stable scenario ID. |
| `label` | Author-facing scenario label. |
| `defaultMode` | Suggested new-game default; the initial Part I story uses `story`. |
| `startStep` | First step ID for a new storyline playthrough. |
| `steps` | Ordered canonical story steps. |

Step meanings:

| Field | Meaning |
| --- | --- |
| `id` | Stable step ID. |
| `objective` | Short internal current concern. Required. It should describe what Zanzibar can reasonably understand now. |
| `beat` | Optional story beat ID to present while the step is active. |
| `allowed` | Story-forward prompts, optional prompt categories, and nonmovement action gates for the step. |
| `completesWhen` | Typed completion predicate. |
| `onEnter` | Optional effects, stage view, movement, or time passage when the step starts. |
| `onComplete` | Optional effects, stage view, movement, or time passage after completion. |
| `next` | Next step ID, or null for scenario completion. |
| `nextScenario` | Optional handoff to another scenario's `startStep`, used at story arc boundaries such as the gate. |

## Completion Predicates

Completion predicates should stay typed and small. They are not a general
boolean scripting language.

Supported predicate families should include:

| Predicate | Example | Meaning |
| --- | --- | --- |
| `flag` | `artifacts.hydro-startup-card.read` | A global story/game flag is set. |
| `facility` | `{ hydro.intakeReady: true }` | A facility state field has the expected value. |
| `location` | `{ place: indoors, room: control-room }` | Player reached a specific location. |
| `holding` | `{ item: hydro-startup-card, holder: character:zanzibar-nuhero }` | A required artifact is held by an accessible holder. |
| `lesson` | `{ id: hydro-power-stream-to-socket, status: completed }` | A lesson reached a known progress state. |

If a new predicate is needed, add it with runtime evaluation, builder controls,
validation, tests, and this contract together. Do not add arbitrary nested
boolean expressions until a concrete authored sequence proves they are needed.

## Storyline Action Policy

The storyline controller produces an action policy for the current step. The
policy is consumed by play-panel builders, beat choices, stage-view launchers,
item actions, facility actions, and story-sensitive room or map interactions.

The policy has two jobs:

1. Make plausible story-continuing or story-returning actions visible.
2. Hide or block nonmovement actions that would reveal, complete, or mutate
   story-sensitive content before Zanzibar reaches the right context.

In story mode:

- Ordinary movement remains governed by map, passage, door, time, and wellbeing
  rules. If the player can physically walk somewhere, the storyline policy
  should not suppress the movement affordance simply because it is not the
  canonical next step.
- The play panel should always include at least one plausible
  story-continuing action when the underlying world rules allow it, without
  visually marking it as canonical.
- Optional movement and curiosity actions may stay visible when they are known
  to the player and do not reveal future discoveries.
- Facility, item, document, simulation, close-up, and mutating room actions are
  subject to the active step's policy when they could break story order or
  reveal undiscovered knowledge.

Always available shell actions may include saving, loading, developer tools in
development, returning from a focused stage view to the map, and opening
non-mutating character/status views when the current step does not explicitly
forbid them.

In open-world mode, the storyline policy is inactive. Action visibility comes
from map, facility, inventory, character, and stage-view rules.

## Allowed Actions

The `allowed` shape should describe player intent in stable IDs, not component
implementation details. The runtime should distinguish internal story-continuing
references from hard gates without exposing that distinction in the play panel:

| Category | Meaning |
| --- | --- |
| `storyForwardActions` | Internal action IDs that move Zanzibar along the canonical path. They affect availability and authoring validation, not player-facing emphasis. |
| `optionalActions` | Known curiosity actions that may stay visible without being canonical. |
| `movement.hexes` | World hexes that are story-continuing or explicitly optional, not the full set of physically reachable hexes. |
| `movement.rooms` | Indoor rooms that are story-continuing or explicitly optional. |
| `movement.exteriorNodes` | Local exterior nodes that are story-continuing or explicitly optional. |
| `movement.transitions` | Map transition IDs that are story-continuing or explicitly optional. |
| `movement.mode` | Prompt scope such as `local-area` or `unrestricted`; not a default physical movement lock. |
| `storyChoices` | Story choice IDs or generated stable choice references allowed for this step. |
| `stageViews` | Focused views such as documents, lessons, inventory, console, or simulation. |
| `indoorActions` | Authored room actions, fixture actions, door actions, switches, and pickups. |
| `outdoorActions` | Passage crossing, unlocking, searching, route, and barrier actions. |
| `itemActions` | Artifact actions such as read, inspect, place, carry, plug in, or charge. |
| `developerActions` | Development-only diagnostics explicitly allowed for testing. |

If an allowed action references an object that the underlying system considers
invalid, unavailable, or unsafe, the action remains unavailable. Storyline
policy cannot bypass physical movement, door, holder, or facility rules.

When no `storyForwardActions` are available because the player has wandered, the
runtime should still show ordinary available movement and survival/status
actions. When they are available, they should look like the rest of the action
set. The objective and beats should help the player infer a plausible direction
without naming undiscovered destinations.

## Forced Effects

Storyline steps may need forced time passage, forced stage views, or rare forced
movement to keep a specific authored moment coherent. These effects are authored in
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

Forced effects are still validated. Movement destinations must exist. Forced
movement should be rare and reserved for scenes where Zanzibar actually commits
to movement in prose or where a map transition has already been chosen. Stage
views must use registered kinds. Time advancement must use a supported activity
profile. Character and facility changes must use the shared validated effect
service when they mutate character or inventory state.

## Beats in Each Mode

Story beats remain the prose layer described in
[story-beats.md](story-beats.md). A beat may be scoped by mode:

```yaml
modes: [story]
storylineStep: understand-building
```

Rules:

- `modes` omitted means the beat is eligible in both modes.
- `modes: [story]` means only story-mode saves can select the beat.
- `modes: [open-world]` means only open-world saves can select the beat.
- `storylineStep` restricts a beat to the named active step and implies
  `storyline` eligibility.
- Storyline step beats should preserve Zanzibar's authored voice and canonical
  story.
- Open-world beats should be ambient, discovery-oriented, or explanatory. They
  should not imply that the player is following canonical story timing.

## Objectives

Story mode must show the current objective clearly in the player-facing UI.
The objective is Zanzibar's internal near-term concern, not an omniscient quest
log. It should answer "what matters right now?" without revealing future
locations, artifacts, facilities, or solutions.

Good opening objective:

```text
Keep moving. Find something that can help you survive.
```

Avoid objectives such as "Go to the utility station" before the station is
discovered. As Zanzibar learns, objectives may become more concrete:

1. Keep moving. Find something that can help you survive.
2. Find a way past the fence.
3. Follow the road and look for shelter.
4. Get inside before nightfall.
5. Figure out what this building was for.
6. Find a way to turn the power back on.

Open-world mode should not show a canonical objective. It may show freeform
status such as current location, facility status, active warnings, or optional
experiments, but the UI must make clear that the player is not following the
authored storyline.

## Builder Responsibilities

Storyline authoring belongs with Story Builder because it composes story beats,
objectives, conditions, choices, stage views, and story-continuing action references. The first
implementation may be a Scenario panel inside `/builder/story`; a separate
route can be added later if scenario authoring grows.

The Story Builder should support:

- creating and editing scenarios;
- ordering steps;
- editing objective text;
- associating a step with a story beat;
- selecting story-continuing hexes, rooms, exterior nodes, transitions, actions,
  stage views, and item actions from known content;
- editing completion predicates;
- editing `onEnter` and `onComplete` forced effects;
- validating unresolved references and unreachable or contradictory prompts;
- previewing the visible action set for a selected step.

World Builder and Content Builder remain separate, but their reference systems
must include storyline references:

- renaming a referenced hex, room, exterior node, transition, item, lesson,
  document, or action updates storyline references in the same transaction when
  reference-aware renames are supported;
- deletion is rejected when it would leave a storyline reference unresolved;
- selected world or content objects should show which storyline steps reference
  them.

## Part I Guided Scenario

The Part I scenario should encode Zanzibar's full opening arc,
not only the hydro startup sequence:

1. Choose Story mode.
2. Establish that Zanzibar is lost, hungry, thirsty, and moving by instinct.
3. Encourage westward movement across the forest without naming the destination.
4. Let the fence become the discovered obstacle.
5. Allow a noncanonical downhill shortcut through a fence hole.
6. Keep the canonical uphill/westward path to the gate visible.
7. Let Zanzibar figure out the gate and follow the road.
8. Discover the utility station.
9. Explore around the building and break in through the side garage door.
10. Discover the eBuggy, stairs, conference room, kitchen, food, and water
    purifier.
11. Complete the first survival objective: crisis averted.
12. Shift the objective to understanding what the building was for.
13. Discover the laminated startup card and hydro context.
14. Go to the intake, clear debris, open intake, align the diversion valve,
    open the turbine valve, return to the control room, connect power, check
    the simplified console, and complete hydro startup.

Story mode should keep at least one canonical story-continuing prompt visible,
but it should not label that prompt as canonical or remove ordinary movement or curiosity paths. Open-world mode
uses general area descriptions and lets the player define the story they are
making, while preserving the same physical, facility, and wellbeing rules.

## Production and Live Authoring

Scenario content is canonical in `game/content/atomic-adventures.sqlite`.
Production builds export runtime scenario JSON alongside story, world,
building, character, and learning content. Development serves scenario content
through the local API and publishes SSE updates after successful saves.

Open game windows may refresh scenario content without losing player state. If
the active scenario or step still exists, the runtime re-evaluates objective,
allowed actions, and completion state. If the active step is removed or becomes
invalid during live authoring, development builds should show a clear authoring
error and fall back to a safe blocked policy for story mode rather than
silently exposing open-world actions.

## Tests

This behavior requires tests for:

- new-game mode selection and storyline default;
- save/load of `playMode`, scenario ID, step ID, completed steps, objectives,
  inventory, flags, character state, and facility state;
- story beat filtering by `modes` and `storylineStep`;
- story-continuing prompt visibility in story mode;
- ordinary movement remaining available in story mode when physically
  valid;
- nonmovement action policy hiding and blocking actions outside the current
  step;
- map clicks and play-panel movement sharing the same physical movement rules;
- forced movement, forced time passage, forced stage views, and step effects;
- survival/wellbeing consequences for excessive wandering or time passage;
- hydro startup completion in story mode with gates active;
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
