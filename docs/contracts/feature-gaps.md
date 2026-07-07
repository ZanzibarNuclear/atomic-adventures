# Feature Gaps

This document tracks behavior described by the contracts that is planned,
partial, or intentionally waiting for a concrete content need. It is not a
parking lot for old systems. When a gap is closed, update the relevant contract,
tests, implementation map, and this list in the same change.

## Story Beats And Scenes

- Implement the broader planned passage schema only when a current story need
  requires it: scene conditions, choice visibility rules, choice-specific
  character effects, passage-to-passage `go_to`, variants, simulation gates,
  images, ambient audio, and dedicated open-world scene semantics.
- Add scene `modes` support where the current content needs distinct
  Story-mode and open-world prose.
- Add stand-level story triggers if a room needs prose that depends on the
  avatar's precise `currentStand`, not just `currentRoom` or `exteriorNode`.
- Keep future scene conditions targeted. Avoid rebuilding a general-purpose
  requirement engine inside scenes.

## Play Modes And Story Mode

- Add new-game mode selection with Story as the default and
  Open-world as an explicit freeform option.
- Add `playMode` and active `story` arc/beat state to saves.
- Implement StoryArc content, runtime loading, production JSON export, live
  authoring updates, and revision history.
- Implement `useStoryArc`, typed completion conditions, beat effects, and
  visible story action building.
- Apply Story mode action availability consistently to play-panel buttons, map
  clicks, movement handlers, room actions, pickups, item actions, stage views,
  doors, switches, passages, and transitions.
- Add Story Builder story arc authoring and reference-aware rename/delete support
  across Story Builder, World Builder, and Content Builder.
- Migrate hydro startup into the appropriate Part I story arc and keep
  open-world hydro startup broad but physically valid.
- Defer switching arbitrary open-world saves back into Story mode until there
  is a dedicated rejoin contract.

## Stage Views

- Complete the focused inventory stage surface: holder groups, item selection,
  item details, authored item actions, and valid transfers.
- Reuse the focused inventory component inside the full Character view's
  Inventory tab when both surfaces need the same interaction model.
- Expand close-up stage kinds for documents, lessons, consoles, and
  simulations as Part I content starts using them.

## Holo-Reader Lessons

- Add the `learning-main` content document, repository, validation, API,
  revision history, import/export, production JSON export, and SSE updates.
- Implement the first full-game holo-reader view, lesson progress state,
  assessment completion flow, lesson time advancement, award/rejoin screen, and
  idempotent credit awards through the shared effects service.
- Add Content Builder lesson authoring for sections, assessments, completion
  rules, internal and external requirements, effect payloads, validation,
  preview states, and cross-content references.
- Integrate one hydro lesson with real completion credit before broadening the
  lesson library or embedding simulator-backed sections.

## Character, Inventory, And Content

- Finish connecting shared requirement and effect authoring across Story
  Builder and World Builder.
- Integrate simulation outcomes through the same validated character effects
  service used by item actions and world interactions.
- Add backpack and eBuggy holders, transfer workflows, persistent contents, and
  capacity rules when those holders become playable.
- Add hunger/thirst drift, authored food/water actions, and the player-facing
  presentation needed to make those systems understandable.
- Broaden validation and reference-safety checks for effects, destructive item
  operations, container cycles, unreachable skill awards, quest-critical item
  consumption, and duplicate player-facing labels.
- Define the player-save update plan for reference-aware character ID renames
  before allowing renames that touch saved state.
- Move cross-device character state to the planned account store when player
  registration exists.

## Character Wellbeing

- Decide whether max health is part of the first survival loop. The current
  implementation calculates visible health from a hidden base health input plus
  severe reserve and condition penalties.
- Add named conditions, threshold-driven penalties, daily need targets,
  fullness/safe water intake bounds, fatigue, environmental modifiers, and
  wellbeing tuning once the Part I survival pressure needs them.
- Replace wellbeing formulas deliberately: document the replacement steps,
  update saves/content/tests if needed, and delete the superseded path.

## Game Time

- Add authored story arc start settings instead of hard-coding Part I's opening
  time.
- Complete rest and sleep-until workflows, including Day 1 to Day 2 pacing and
  milestone/flag commits.
- Add builder controls for start clock, phase windows, default action
  durations, scene time criteria, milestone gating, overlapping-scene warnings,
  route timing estimates, and previewing content at a chosen time state.
- Define simulation time modes and the commit boundary for simulations that
  preview results before accepting them.

## Milestones

- Replace the current flag-shaped milestone bridge with structured milestone
  records in player saves.
- Decide where milestone catalogs live: story content, character content, or a
  separate progression document.
- Add builder support for milestone definitions, milestone grants, time
  predicates, and validation of unknown references.
- Define missed-event behavior for temporal events the player is not present to
  witness.
- Decide which achievements are playthrough-local and which belong to a future
  account-wide system.

## Hex Viewport

- Add the player-facing gameplay/full map toggle when the player needs an
  overview of discovered territory.
- Add optional pan animation after movement if it improves readability without
  obscuring the current hex.

## Hexcrawling

- Multi-hex auto-pathfinding is not defined. Add it only when a concrete travel
  workflow needs it, and keep the same reachable-border and safe-stand rules.
- Replace sampled local search with explicit reachable sub-areas only when
  authored geometry exposes a resolver failure, such as U-shaped barriers,
  narrow corridors, endpoint-connected enclosures, or approach-dependent stands
  that require walking around a barrier end.

## Indoor Stands

- Add authored edges or paths between stands only when rooms need constrained
  local navigation.
- Add furniture and obstacle collision, curved movement paths, threshold
  overrides, fixture-generated interaction points, pose-specific avatar
  rendering, stand-level story triggers, and stand requirements when specific
  room content needs them.

## World And Local Transitions

- Add validator checks for duplicate transition IDs, invalid exterior nodes,
  invalid world stands, MAP markers that are not reachable from local geometry,
  transitions whose `entryFrom` lists conflict, and return stands that violate
  barrier clearance.

## World Authoring

- Decide whether route and feature geometry should expand the fitted outdoor
  frame. Today the frame fits the authored hex footprint.
- Verify draft movement audit behavior against the current implementation and
  make it part of the World Builder workflow if it is not wired end to end.
- Verify live replacement behavior for outdoor/building documents during active
  movement and transitions.
