# Milestones, Temporal Predicates, and Achievements

**Status:** Contract for progression milestones, derived temporal predicates,
authored event triggers, and their boundary with achievements  
**Scope:** `game/` runtime, story builder, content API, save/load, character
progression, simulations, and authoring validation

---

## Purpose

Atomic Adventures needs to ask "has this happened?", "is it currently the
right time?", and "has the player earned this?". These sound similar in
authoring, but they are different state shapes:

1. **Temporal predicates** are derived from the game clock. They are queryable
   facts such as "Day 55" or "Day 1 afternoon." They are not recorded every time
   they pass.
2. **Authored milestones** are sparse recorded facts. They mark story,
   discovery, operations, or world events that actually happened in this
   playthrough.
3. **Achievements and qualifications** are derived awards. They summarize
   player-facing accomplishment, knowledge, skill, or account/playthrough
   progress.

Design rule: **clock facts are queryable; authored milestones are remembered;
achievements are awarded.**

## Temporal Predicates

Temporal predicates are computed from the saved game clock described in
[time.md](time.md). They do not need to be predefined in content. If the clock
says the player is on Day 55, then `day 55` is true. If the clock says it is
12:15 PM, then the configured phase makes `afternoon` true.

Useful author-facing forms:

```yaml
time:
  days: [55]
  phase: afternoon
```

Equivalent conceptual predicates may be useful in previews, validation, or
debug tools:

```text
time.day.55
time.phase.afternoon
time.day.55.afternoon
```

These names are conveniences, not save data. The runtime should derive them
from `clock.day`, `clock.minuteOfDay`, `clock.elapsedMinutes`, and the current
phase table.

### Temporal Events

Authored content may be scheduled by temporal predicates without storing a
milestone for every elapsed day or phase:

```yaml
meteor-day-55:
  trigger: { event: meteor-shower }
  time:
    days: [55]
    phase: night
  text: A white-green line burns silently through the upper sky.
```

If a temporal event merely becomes eligible because the clock reached that
window, no milestone is required. If the event actually fires and future
content needs to know that the player witnessed, missed, or responded to it,
record an authored milestone such as `sky.meteor-seen` or
`sky.meteor-missed`.

### First Crossings

Entering a day or phase is not automatically persisted. The game may choose to
record a sparse authored milestone for a specific crossing when story logic
needs history rather than current time:

```yaml
id: day-2.started
kind: story
source: rest-choice
```

Use this for meaningful transitions, such as waking on Day 2 after sleeping in
the library. Do not create automatic milestones for every day, every phase, or
every minute window by default.

## Authored Milestones

An authored milestone is a named event recorded in player state after an
atomic story, simulation, item, movement, or operations action succeeds.

Examples:

| Milestone | Kind | Notes |
| --- | --- | --- |
| `gate.found` | discovery | Useful because there are alternate routes to the utility yard |
| `library.sleep-1` | story | Records the meaningful overnight transition into Day 2 |
| `first-meal.eaten` | survival | Missing it can trigger exhaustion/collapse content |
| `lesson.hydro-head-flow.completed` | knowledge | A holo-reader lesson was consumed |
| `hydro.head-flow.applied` | application | The player used that knowledge in a real situation |
| `hydro.online` | operations | Starts energy storage and operations pacing |
| `solar-field.seen` | discovery | Can unlock Part II foreshadowing |

Milestones should record at least:

```yaml
id: hydro.online
kind: operations
elapsedMinutes: 1830
day: 2
minuteOfDay: 1110
source: hydro-startup-sim
```

The timestamp lets later content ask not only "did this happen?" but "how long
has it been since this happened?"

### Milestone Kinds

`kind` is authoring metadata, not a hard runtime partition. Suggested values:

| Kind | Use For |
| --- | --- |
| `story` | Required narrative transitions and chapter beats |
| `discovery` | Places, artifacts, shortcuts, or clues found |
| `knowledge` | Lessons, documents, or concepts explicitly consumed |
| `application` | Knowledge used successfully in context |
| `operations` | Facility states, restored systems, or ongoing production events |
| `survival` | Food, water, rest, injury, or wellbeing thresholds |
| `world` | External events, weather, sky events, damage, or environmental changes |

## Criteria

Milestones may depend on temporal predicates, authored milestones, and
structured player state. Keep criteria author-facing and concrete. Do not
reintroduce a broad scripting language just to express simple unlocks.

Example authored event:

```yaml
events:
  - id: meteor-day-55
    when:
      time: { days: [55], phase: night }
      milestones:
        after: [hydro.online]
    grants: [sky.meteor-seen]
```

Example knowledge application milestone:

```yaml
milestones:
  - id: hydro.head-flow.applied
    kind: application
    require:
      milestones: [lesson.hydro-head-flow.completed]
      location: { room: turbine-hall }
      action: set-guide-vane-opening
```

Example operations unlock:

```yaml
beats:
  hidden-elevator-hint:
    trigger: { place: indoors, room: control-room }
    time:
      afterMilestone: hydro.online
    text: The campus load panel now shows a sealed elevator drawing standby power.
```

Criteria should be evaluated at the same atomic boundary as the action that can
grant the milestone. If the action fails, no milestone should be recorded.

## Relationship To Achievements

Achievements, badges, qualifications, and skill ranks are not the same as
milestones:

- A **milestone** records that something happened in this playthrough.
- An **achievement** or **qualification** records that the player earned a
  visible award, skill rank, or badge because enough evidence accumulated.

Achievements may use milestones as criteria, and milestone grants may provide
evidence for achievements:

```yaml
skillAwards:
  - id: hydro-operations.rank-2
    require:
      milestones: [hydro.online]
      evidence:
        - { id: operating-days, op: gte, value: 5 }
```

Use milestones for story and world unlocks. Use achievements and skills for
player-facing recognition, qualifications, and durable progress summaries. A
future account-wide achievement system should remain separate from playthrough
milestones.

## Persistence

Player saves should eventually serialize structured milestone records:

```yaml
milestones:
  hydro.online:
    id: hydro.online
    kind: operations
    elapsedMinutes: 1830
    day: 2
    minuteOfDay: 1110
    source: hydro-startup-sim
```

The current implementation may back `afterMilestone` and `beforeMilestone` with
namespaced flags. That is acceptable as an implementation bridge, but the
author-facing contract should stay milestone-shaped so content can move to
structured records without renaming story criteria.

Do not persist derived temporal predicates such as `time.day.55` by default.
Persist only authored milestones that indicate something actually happened or
was intentionally recorded.

## Authoring And Validation

The builder should eventually support:

- a milestone catalog with `id`, `label`, `kind`, description, and optional
  source/action metadata;
- milestone grants from story choices, simulations, item actions, and world
  events;
- milestone criteria in story beat time/state filters;
- preview controls for clock time plus milestone state;
- validation for unknown milestone IDs once a milestone catalog exists;
- warnings for scheduled temporal events that can become eligible but have no
  trigger path;
- distinction between milestone criteria and achievement/skill award criteria.

Validation should reject:

- malformed milestone IDs;
- duplicate milestone IDs in one catalog;
- unknown milestone references when catalogs exist;
- criteria that mix mutually exclusive temporal windows;
- milestone grants from non-atomic or failure-prone actions unless the action
  commits through the shared effect boundary.

## Current Implementation Map

| Concern | Location |
| --- | --- |
| Clock-derived day, minute, phase filters | `game/src/composables/useStory.js` |
| Story `afterMilestone` / `beforeMilestone` bridge | `game/src/composables/useStory.js`, currently via flags |
| Story choice milestone-like grants | `sets` / `set_flags` in story choices |
| Story choice time and milestone commit boundary | `game/src/composables/useStory.js` |
| Skill evidence and award rules | `game/src/lib/character/` |
| Player save flags bridge | `game/src/composables/useGameState.js` |

## Open Decisions

- When should milestones move from flags to a structured save field?
- Should the milestone catalog live with story content, character content, or a
  separate progression document?
- Should world events such as a Day 55 meteor be represented as event beats,
  scheduled event definitions, or operations/world-system effects?
- How should missed temporal events be recorded when the player is not in the
  right place to witness them?
- Which achievements are playthrough-local and which are future account-wide
  awards?
