# Game Time

**Status:** Contract for authored game time, time-gated beats, duration costs,
resource drift, and simulation-time integration  
**Scope:** `game/` runtime, story builder, world builder, content API, save/load,
character wellbeing, movement, and simulations

---

## Purpose

Atomic Adventures uses **authored game time**. The clock belongs to the saved
game state and advances because the player takes actions, travels, rests,
watches or runs a simulation, or reaches a designed transition. It is not tied
to real wall-clock time, and it does not advance while the game is closed.

Time supports four related design needs:

1. **Story pacing** - beats can appear only during the right day, time window,
   story phase, or milestone state.
2. **Action cost** - movement, search, repair, reading, eating, rest, and
   simulation work can spend game minutes.
3. **State drift** - character vitals and world resources can accumulate or
   deplete over elapsed game time.
4. **Operations play** - restored energy systems can run over minutes, days,
   and weeks without requiring the player to watch every second.

The vitals bar and character overview observe this authored game time. The UI
does not spend minutes; it simply re-renders when movement, story choices,
indoor actions, item use, rest, or simulations call the normal time-advance
boundary.

## Clock Model

The player save owns a serializable clock:

| Field | Meaning |
| --- | --- |
| `elapsedMinutes` | Total game minutes since the start of the saved playthrough |
| `day` | One-based story day, derived from midnight crossings |
| `minuteOfDay` | Minutes since local midnight, `0` through `1439` |

`elapsedMinutes` is the canonical monotonic counter. `day` and `minuteOfDay`
are the author-facing calendar projection. The current implementation stores
all three fields and normalizes midnight rollover when time advances.

The start clock should be authored in a scenario or game settings document:

```yaml
clock:
  startDay: 1
  startDate: 2126-07-02
  startMinuteOfDay: 720 # 12:00 PM
```

Part I currently starts on Tuesday, July 2, 2126 at noon. The builder should
eventually expose these scenario settings instead of hard-coding them in the
runtime.

## Advancing Time

All ordinary time changes must pass through one runtime boundary:
`advanceGameTime(gameState, minutes, activity)`.

`minutes` is a positive game-minute duration. Fractional minutes are allowed
internally, but authored content should prefer whole minutes unless a simulation
has a clear reason for finer resolution.

`activity` describes the character exertion profile used for stat drift:

| Activity | Use for |
| --- | --- |
| `resting` | Sleep, quiet waiting, sitting through a video |
| `light` | Reading, indoor walking, eating, normal interaction |
| `moderate` | Outdoor walking, carrying small gear, routine field work |
| `strenuous` | Climbing, heavy repair, emergency work, running |

Time advancement must be deterministic. Advancing 180 minutes once and advancing
1 minute 180 times must produce the same clock, character, and resource state,
apart from intentionally rounded display values.

If a time advance fails because a required effect cannot be applied, the action
that requested it must fail atomically: do not move the player, do not set
flags, and do not partially apply resource changes.

## Action Durations

Every player action that changes the world should have either an authored
duration or a documented default. "Free" actions should be deliberate: opening a
panel, inspecting character stats, or changing a stage view does not spend time.

Recommended defaults:

| Action | Default duration | Activity |
| --- | ---: | --- |
| Outdoor adjacent hex travel | 15 minutes | `moderate` |
| Indoor room or stand movement | 1 minute | `light` |
| Exterior building-node movement | 3 minutes | `light` |
| Open or close an obvious gate/door | 1 minute | `light` |
| Cross an obvious passage | 2 minutes | `light` or `moderate` |
| Search a small area | 10 minutes | `light` |
| Find and pass through a hidden opening | Search time + 2 minutes | `moderate` |
| Read a short document | 5 minutes | `resting` or `light` |
| Eat or drink | 5 to 20 minutes | `resting` |
| Watch lesson video | Video length in game minutes | `resting` |
| Sleep | Authored duration to target wake time | `resting` |

Outdoor travel uses the current map scale: one center-to-center hex step is
about 0.5 miles, and the default walking cost is 15 minutes. Four adjacent hex
steps therefore cost about one hour before any story, search, passage, or
barrier-specific time is added.

Barrier interactions add time because they are real actions, not just geometry:
finding the hole in the fence, opening a stuck gate, crossing a bridge, or
working around a blocked route should each spend authored minutes. The movement
resolver decides whether a move is possible; the time system accounts for how
long the chosen path and associated interaction took.

## Time-Gated Beats

Time is a first-class beat eligibility criterion, separate from the action
context `match` fields such as `originHex`, `mapTransition`, and
`transitionDirection`.

Recommended beat shape:

```yaml
library-morning-day-2:
  trigger: { place: indoors, room: library }
  time:
    days: [2]
    phase: morning
  text: Morning light pools across the soft chairs where Zanzi slept.
```

Supported time criteria should grow in small, author-facing pieces:

| Criterion | Meaning |
| --- | --- |
| `days` | Explicit list of story days, such as `[1]` or `[2, 3]` |
| `dayFrom` / `dayTo` | Inclusive day range |
| `minuteOfDayFrom` / `minuteOfDayTo` | Local clock window; may wrap midnight |
| `phase` | Named time-of-day bucket, such as `morning`, `afternoon`, `evening`, `night` |
| `elapsedFrom` / `elapsedTo` | Inclusive elapsed-minute window from playthrough start |
| `afterMilestone` | Named milestone that must have occurred |
| `beforeMilestone` | Named milestone that must not have occurred yet |

Time criteria are eligibility filters. They do not replace the primary trigger:
a beat still needs a location or event trigger. Time-specific beats should win
over less specific beats at the same location when all other specificity is
equal. If multiple time-specific beats overlap at the same location, the builder
should warn and authors should make the windows or milestone criteria distinct.
Milestone semantics are defined in [milestones.md](milestones.md); this contract
only defines how the clock makes time windows eligible.

Example:

```yaml
utility-yard-first-day:
  trigger: { place: outdoors, hex: utility-yard }
  time: { days: [1], minuteOfDayFrom: 600, minuteOfDayTo: 720 }
  text: The utility yard is still reachable before noon if Zanzi keeps moving.

utility-yard-after-dark:
  trigger: { place: outdoors, hex: utility-yard }
  time: { phase: night }
  text: The yard is a dark grid of fences and silent equipment.
```

## Time Phases

Named phases keep authors from hard-coding minute math in every beat. The
default phase table should be configurable by the world/scenario settings:

| Phase | Default window |
| --- | --- |
| `morning` | 6:00 AM - 11:59 AM |
| `afternoon` | 12:00 PM - 4:59 PM |
| `evening` | 5:00 PM - 8:59 PM |
| `night` | 9:00 PM - 5:59 AM |

Phase criteria are semantic story tools, not lighting physics. A future visual
lighting system may use the same clock, but story eligibility should not depend
on the renderer.

## Milestones

Milestones are covered by [milestones.md](milestones.md). In brief:

- temporal predicates such as Day 55 or Day 1 afternoon are derived from the
  clock and are not persisted by default;
- authored milestones such as `library.sleep-1` or `hydro.online` are sparse
  recorded facts with timestamps;
- achievements and qualifications are derived awards, not the primary story
  unlock primitive.

Time-gated beats may use `afterMilestone` and `beforeMilestone` to combine
clock windows with authored progression state.

## Day Transitions And Rest

Days advance mechanically at midnight, but story days should transition through
authored rest or end-of-day beats when the narrative needs a clear break.

Part I design goals:

- Zanzi should be able to reach the utility station within the first two game
  hours from the start, including plausible barrier/search overhead.
- Food and water discoveries should be paced so Zanzi can avert the first
  personal crisis on Day 1.
- If he reaches the library/conference area by evening, sleeping in a chair,
  on a table, or in soft seating can become an authored rest choice.
- Waking should advance the clock, record a sparse Day 2 transition milestone, and
  make Day 2 beats eligible without losing location, inventory, or player state.

Rest choices should prefer "sleep until" semantics over fixed durations when
that is what the story means:

```yaml
choices:
  - text: Sleep in the library chair
    time:
      until:
        dayOffset: 1
        minuteOfDay: 420 # 7:00 AM
      activity: resting
    set_flags: [day-1.sleep, day-2.started]
```

The current choice schema supports `timeMinutes` and `activity`; `sleep until`
is a proposed extension.

### Library Day 1 To Day 2 Example

The first concrete time-gated story case is the library overnight transition.
It should work without moving the player to another room or requiring an event
beat.

Author two room-triggered beats:

```yaml
library-arrival:
  trigger: { place: indoors, room: library }
  time:
    days: [1]
    phase: evening
    beforeMilestone: library.sleep-1
  text: Zanzi reaches the library as the last light fades.
  choices:
    - text: Sleep in the soft seating
      timeUntil:
        dayOffset: 1
        minuteOfDay: 420 # 7:00 AM
      activity: resting
      set_flags: [library.sleep-1, day-2.started]

library-wakeup:
  trigger: { place: indoors, room: library }
  time:
    days: [2]
    phase: morning
    afterMilestone: library.sleep-1
  text: Morning light spills across the library.
```

Runtime flow:

1. Entering the library evaluates normal room beats.
2. `library-arrival` is eligible only when the clock is Day 1 evening and the
   `library.sleep-1` milestone has not happened.
3. Choosing sleep advances time to the next day at 7:00 AM with `resting`
   activity and applies overnight character/resource drift.
4. The same choice records the sleep milestone.
5. Story re-evaluates the current room because time and milestones changed.
6. The player is still in the library, but `library-arrival` is no longer
   eligible and `library-wakeup` is now eligible.

For the first implementation, `beforeMilestone` and `afterMilestone` may be
backed by namespaced flags. If milestones later become structured save data,
the author-facing fields should remain stable; see
[milestones.md](milestones.md).

## Resource Drift And Accumulation

Time advancement is the shared tick for character stats and world resources.

Character examples:

- hunger/thirst or their future positive reserves;
- fatigue/rested level;
- composure recovery or stress decay;
- health damage from sustained severe conditions.

World and facility examples:

- hydro generation charging batteries;
- campus electronics drawing battery power;
- water reservoir changes;
- alarms escalating after unattended operation;
- food spoilage or water purification progress.

Resources should define rates in game-time units, not wall-clock units:

```yaml
resource:
  id: battery-main
  capacityKWh: 500
  rates:
    hydroOnlineKw: 85
    campusLoadKw: 12
```

When advancing time, the runtime should integrate resources in deterministic
steps or with a mathematically equivalent aggregate. The player should be able
to leave the control room, travel, sleep, and return to see batteries changed by
the elapsed game time.

## Simulation Time

Simulations may use several time modes. Each must explicitly report how it
connects back to game time.

| Mode | Meaning | Game-time behavior |
| --- | --- | --- |
| Observed real time | Player watches something unfold at normal speed, such as a video or waterfall | Spend matching game minutes if the activity matters |
| Interactive real time | Player drives, steers, or adjusts controls live | Spend game minutes according to the activity or scenario |
| Accelerated run | Simulation computes minutes/hours/days quickly | Advance game time by the simulated duration when accepted |
| Playback | Player reviews an already generated run | Usually no game-time cost, unless authored as a lesson |
| Background aggregate | Facility state advances while player is elsewhere | Applied during normal `advanceGameTime` resource drift |

A simulation must not secretly advance the shared clock just because browser
frames elapsed. It should commit time through the same effect boundary used by
story choices and item actions. If a sim has its own internal clock, that clock
is local until the sim commits a result.

### Operational console watch mode (follow-up)

The Part I **Operational console** ([control-panel.md](control-panel.md)) shows
authored game time on its status banner (`formatOperationalConsoleTime`:
`HH:mm:ss Weekday, Month D, YYYY`). **Today** that display does not advance
while the player watches: engine ticks update graphs only.

**Intended later policy:** while the console stage is open, advance the shared
clock at roughly **1 game second per real second** (via `advanceGameTime` or a
dedicated continuous-watch boundary); when the console closes, resume chunky
advancement from movement and actions. Until that ships, do not invent a second
frozen “monitor elapsed” clock for player-facing chrome.

## Player-Facing Display

The game may show a subtle timestamp, such as:

```text
Tuesday, July 2, 2126 · 12:15 PM
```

This should feel like a quiet watermark or HUD detail, not a constant pressure
meter. The display should update immediately after actions that spend time.

Useful display contexts:

- game header or corner watermark;
- character overview;
- story card eyebrow, such as `Day 2 · Morning`;
- save slot metadata;
- simulation summary, such as `3 hours simulated`;
- Operational console status banner (24h form; see control-panel contract).

Avoid exposing implementation counters like `elapsedMinutes: 372` in ordinary
player UI.

## Authoring And Validation

The builder should eventually expose:

- scenario start day and time;
- named phase windows;
- action durations and activity profiles;
- beat time criteria;
- milestone gating, with milestone creation defined in
  [milestones.md](milestones.md);
- warnings for overlapping time-gated beats at the same trigger;
- estimated route timing for authored paths and common discoveries;
- preview controls to evaluate content at a chosen day/time/milestone state.

Validation should reject:

- negative durations;
- unknown activity profiles;
- invalid clock minutes outside `0..1439`;
- empty or inverted windows that do not intentionally wrap midnight;
- unknown phase names;
- unknown milestone IDs when milestone catalogs exist.

## Persistence

Player saves must serialize:

- clock fields;
- authored milestone state and milestone timestamps;
- character/resource values affected by elapsed time;
- seen beats, flags, inventory, map position, and simulation/facility state.

The clock must not be recomputed from real save/load timestamps. Loading a saved
game resumes at the saved game time.

Content remains separate from player state. Time criteria, phase settings,
action durations, and simulation rate definitions live in authored content.
Clock values and authored milestone completion live in the player save.
Derived temporal predicates are recomputed from the clock rather than persisted.

## Current Implementation Map

| Concern | Location |
| --- | --- |
| Clock creation, formatting, and deterministic advancement | `game/src/lib/character/gameTime.js` |
| Character stat drift during time advancement | `game/src/lib/character/gameTime.js` |
| Shared action time helper | `game/src/lib/character/gameActivity.js` |
| Player clock persistence | `game/src/composables/useGameState.js` |
| Story choice `timeMinutes`, `activity`, `timeUntil` | `game/server/story-model.js`, StoryChoiceEditor, `useStoryArc.js` |
| Story choice time commit | `game/src/composables/useStoryArc.js` |
| Story milestone grants / criteria | `useStoryArc.js`, `storyArcModel.js` |
| Item action time commit | `game/src/lib/character/itemActions.js` |
| Outdoor movement default time | `game/src/lib/maps/composables/useOutdoorWorld.js` |
| Indoor movement and interaction time | `game/src/lib/maps/composables/indoor/` |

`timeUntil` (sleep-until style) is **implemented** for story choices. Scenario
start clock is still hard-coded for Part I in `gameTime.js` until authoring
exposes start settings.

## Open Decisions

- Should the Part I start time be 10:00 AM exactly, or should the opening beat
  choose a scenario-specific value?
- Should beat time criteria live under `time`, under a broader `when`, or as
  dedicated trigger fields in the database UI?
- What is the correct default duration for exterior-node movement around a
  building: 1, 3, or 5 minutes?
- Should food/water daily targets be evaluated at midnight, waking, or rolling
  24-hour windows?
- How visible should the timestamp be during high-tension survival beats?
- Which simulations commit clock time immediately, and which preview results
  before the player accepts the outcome?
