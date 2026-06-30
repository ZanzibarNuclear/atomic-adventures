# Character, Artifacts, and Inventory Management

**Status:** Character foundation, wellbeing, learning progression, quests, and
physical holders implemented; close-up/lesson/simulation surfaces remain phased
**Scope:** Player character state, authored artifacts such as items,
containers, documents, and future media records; inventory, wellbeing,
knowledge, skills, quests, requirements/effects, save data, and the
player-facing character panel

See [character-wellbeing.md](character-wellbeing.md) for focused notes on
health, hunger, thirst, calorie/water targets, and future survival tuning.

---

## Purpose

Atomic Adventures needs to represent possessions and character progression
without adding a new hard-coded field for every key, tool, lesson, injury, or
quest. Authors must be able to define those concepts, place or award them, use
them as requirements, and choose how they appear to the player.

Authoring separates **character development** from **artifacts**. Character
development covers Zanzibar's profile, wellbeing stats, available knowledge,
skills, accomplishments, and quests. Artifacts are authored things the world can
contain or grant: keys, tools, backpacks, food, water, instruction cards,
manuals, and future media records such as training videos. These domains are
related at runtime, but separating them in the builder keeps authoring intent
clear.

This contract separates:

1. **Definitions** — authored facts such as what a flashlight or Hydro Operator
   skill is.
2. **Placements and rewards** — authored ways the player can acquire or change
   those things.
3. **Player state** — the quantities, values, and progress belonging to one
   playthrough.

Definitions are content. Player state is save data. A live content refresh may
change labels or descriptions, but must not replace the player's possessions
or progress.

## Design Principles

- **Data-driven, not code-driven.** New ordinary artifacts, stats, skills,
  quests, and documents do not require a Vue or JavaScript change.
- **Stable IDs.** Runtime state and cross-content references use immutable,
  kebab-case IDs.
- **One mutation language.** Story choices, world interactions, simulations,
  and developer tools use the same validated requirements and effects.
- **Explicit semantics.** A skill and a quest are not disguised as unrelated
  flags merely because flags already exist.
- **Author control with guardrails.** Authors control definitions, ordering,
  visibility, descriptions, rewards, and gates; the engine controls supported
  types and operations.
- **No authored scripting.** Content cannot contain JavaScript, arbitrary
  expressions, or component names that execute unregistered code.
- **Serializable state.** All player-owned state remains JSON-safe for local
  saves and later server-side saves.

## System Boundaries

The character system owns:

- player profile display;
- carried and discovered items;
- numeric and ranked stats;
- time-driven needs such as hunger and thirst;
- learned knowledge and concepts;
- acquired skills and qualifications;
- quest and objective progress;
- found documents;
- shared requirement evaluation and effect application.

It does not own:

- map geometry or movement;
- facility simulation internals;
- authored story prose and beat selection;
- account identity or authentication;
- NPC party state;
- arbitrary combat or equipment-slot rules.

Those systems may read character state and apply character effects through the
contract below.

## Canonical Authored Content

Character and artifact definitions are currently stored as one ordered JSON
document named `character-main` in `game/content/atomic-adventures.sqlite`.
This follows the existing coarse-document model used for outdoor world and
building content. The persisted name is retained for compatibility even though
the authoring UI now presents the broader concept as Content. YAML may be
exported for review or interchange, but direct YAML edits are not live until
imported:

```bash
npm run character:export -w game -- /tmp/character-main.yaml
npm run character:import -w game -- /tmp/character-main.yaml
```

The document contains independent ordered catalogs:

```yaml
id: character-main

profile:
  id: zanzibar-nuhero
  name: Zanzibar Nuhero
  portrait: characters/zanzibar/default.webp
  summary: Curious explorer and aspiring energy systems operator.

panel:
  tabs: [overview, inventory, knowledge, skills, quests, documents]
  statGroups:
    - { id: wellbeing, label: Wellbeing, order: 10 }
    - { id: progression, label: Progression, order: 20 }
  inventoryGroups:
    - { id: keys, label: Keys, order: 10 }
    - { id: tools, label: Tools, order: 20 }
    - { id: books, label: Books and manuals, order: 30 }

items: []
stats: []
knowledge: []
skills: []
quests: []
documents: []
```

The content document defines the player-facing character and artifact catalog.
World documents define physical placements. Story beats define narrative grants
and changes. Simulations report outcomes through registered effect payloads.
None of those consumers may define an artifact inline.

Production builds export the document to
`/content/character.json`. Development loads it from the local content API and
receives `character.updated` SSE notifications.

## Authoring Workspace

Character and artifact content is edited in the dedicated `/builder/content`
route. `/builder/content` is the current route; `/builder/character` is
obsolete and is not registered. Keeping this workspace separate prevents
content catalog drafts from being mixed with Story Builder beat drafts, World
Builder geometry drafts, or player save state.

The workspace provides:

- a **Character** mode for profile, panel configuration, stats, knowledge,
  skills, and quests;
- an **Artifacts** mode for items, containers, consumables, manuals,
  instruction cards, documents, and future media records;
- ordering and grouping controls;
- reference search showing every use of a selected ID;
- validation, revision history, restore, import, and export;
- a **Preview** mode for empty, early-game, and populated panel states.

Story Builder and World Builder consume the catalog:

- Story Builder selects requirements and effects from known IDs.
- World Builder places catalog items and selects acquisition behavior.
- Simulation configuration selects known stats, knowledge, skills, quests, and
  rewards.

Authors should not need to copy IDs manually for normal builder workflows.

The development route `/builder/content` now implements this workspace with
separate Character, Artifacts, and Preview modes. Story and Utility Station
builders consume the same catalog for requirements, effects, keys, pickups,
and interactions. Cross-content validation rejects removing a definition that
is still referenced.

## Item Definitions

An item definition describes a kind of object, not a particular pickup:

```yaml
items:
  - id: intake-toolkit
    label: Intake maintenance toolkit
    description: Hand tools suitable for clearing and servicing the intake.
    kind: tool
    group: tools
    icon: items/intake-toolkit.webp
    tags: [hydro, maintenance]
    carrying: unique
    maxQuantity: 1
    portable: true
    visible: when-acquired
    inspect:
      text: The tools are old, carefully maintained, and complete.
    relatedDocument: intake-maintenance-notes
```

Supported fields are:

| Field | Meaning |
| --- | --- |
| `id` | Stable global item ID |
| `label` | Player-facing name |
| `description` | Short inventory description |
| `kind` | Semantic type such as `key`, `tool`, `book`, `consumable`, `part`, or `quest` |
| `group` | Inventory group configured for the panel |
| `icon` | Optional asset reference |
| `tags` | Author labels for filtering and future rules; tags do not execute behavior |
| `carrying` | `unique` or `stack` |
| `maxQuantity` | Maximum carried quantity; `1` for unique items |
| `portable` | Whether the item can move between holders |
| `visible` | `always`, `when-acquired`, or `hidden` |
| `inspect` | Optional authored detail shown from the inventory |
| `relatedDocument` | Optional document opened from the item detail |

`kind` affects display and filtering but does not grant hidden behavior. A key
opens a door only when that door explicitly requires its item ID. A tool is
usable only where an authored action or simulation accepts it.

Items are not defined inside choices or pickups. This avoids conflicting names
and descriptions for the same ID.

### Holdings and Item State

Inventory is not one global bag. Every physical item stack or unique item has a
holder. This supports carrying a tool, putting it in a backpack, leaving the
backpack in a room, or storing tools in a vehicle.

```json
{
  "stacks": {
    "stack-rations-1": {
      "item": "trail-rations",
      "quantity": 3,
      "holder": "container:backpack-1"
    }
  },
  "instances": {
    "backpack-1": {
      "item": "field-backpack",
      "holder": "character:zanzibar-nuhero"
    },
    "bolt-cutter-1": {
      "item": "bolt-cutter",
      "holder": "vehicle:ebuggy"
    }
  }
}
```

Stackable items use stack records. Unique items and container items use
instance records so their holder and contents remain stable. Instances do not
initially support randomized properties or durability. If a tool needs
condition or charges in Part I, model those as an authored stat until a
demonstrated need justifies additional instance state.

Inventory operations clamp at zero and at `maxQuantity`. An effect that cannot
be fully applied fails before any sibling effect is committed unless it is
explicitly marked optional.

### Holders, Containers, and Access

A holder is a stable place capable of owning items:

| Holder | Example |
| --- | --- |
| Character | Zanzibar's hands, pockets, or directly carried gear |
| Container item | A backpack, tool case, or water bottle |
| Vehicle cargo | The eBuggy's cargo area |
| Fixed world container | A kitchen cabinet, locker, or tool rack |
| World placement | An item left at a room, stand, exterior node, or hex |

Container-capable item definitions add:

```yaml
items:
  - id: field-backpack
    label: Field backpack
    kind: container
    carrying: unique
    portable: true
    container:
      capacity:
        slots: 12
        massKg: 15
      accepts:
        kinds: [key, tool, book, consumable, part]
      nesting: false
```

Capacity may use slots, mass, or both. Item mass is optional until a container
or movement rule uses it. `nesting: false` is the default and prevents
containers inside containers; this avoids recursive inventory puzzles while
still supporting the backpack use case.

Vehicles and fixed world containers use the same capacity and acceptance
shape, but their definitions belong to world content rather than the item
catalog. Their contents belong to player/world save state.

An item is **accessible** when:

- it is directly held by the character;
- it is inside a container currently held by the character; or
- an action explicitly includes a nearby holder, such as eBuggy cargo while
  standing beside the eBuggy.

Ordinary item requirements use accessible items. Authors can narrow the scope:

```yaml
items:
  all:
    - { id: bolt-cutter, quantity: 1, access: carried }
    - { id: intake-toolkit, quantity: 1, access: nearby }
```

`carried` includes the character and carried containers. `nearby` additionally
includes holders exposed by the current room, stand, exterior node, vehicle,
or interaction. `anywhere` is reserved for authoring diagnostics and should
not gate normal physical actions.

Moving the eBuggy changes the vehicle holder's world location without changing
its contents. A tool in eBuggy cargo therefore arrives with the vehicle but is
not usable from across the map. A tool in a backpack moves with the backpack;
leaving the backpack behind leaves its contents behind.

### Placements and Acquisition

A physical pickup belongs to a world or building document and references a
catalog item:

```yaml
pickups:
  - id: control-room-toolkit
    room: control-room
    item: intake-toolkit
    quantity: 1
    label: Toolkit beneath the console
    once: true
    require:
      not: [hydro.toolkit-taken]
```

The pickup ID identifies the world occurrence; the item ID identifies what is
added to inventory. One-time pickup IDs are stored separately in player state
so moving or relabeling a pickup does not duplicate it.

Story choices, simulations, and actions may also grant items. Acquiring an item
uses the same effect regardless of source.

The player may transfer items between currently accessible holders when
capacity and acceptance rules permit it. Leaving an item in the world creates
or updates a stable placement at the current location. Items cannot teleport
between inaccessible holders.

An item is destroyed or consumed only when an explicit action applies a
removal effect. Quest-critical items should ordinarily be non-consumable.

### Consumables and Item Actions

Food, water, medicine, and similar objects define player-invoked actions
rather than relying on hard-coded item kinds:

```yaml
items:
  - id: turkey-cranberry-meal
    label: Turkey-cranberry Tastee Tack
    kind: consumable
    carrying: stack
    maxQuantity: 20
    properties:
      calories: 720
      hydrationMl: 40
    actions:
      - id: eat
        label: Eat meal
        consume: 1
        timeMinutes: 20
        effects:
          - { op: stat.add, id: hunger, value: -55 }
          - { op: stat.add, id: thirst, value: -4 }

  - id: purified-water
    label: Purified water
    kind: consumable
    carrying: stack
    properties:
      hydrationMl: 500
    actions:
      - id: drink
        label: Drink water
        consume: 1
        timeMinutes: 5
        effects:
          - { op: stat.add, id: thirst, value: -45 }
```

Properties such as calories are authored descriptive and mechanical metadata.
The action's validated effects remain authoritative so the game does not hide
a universal nutrition formula in code. A later balancing tool may calculate
suggested hunger effects from calories while still saving the explicit result.

## Stats

Stats are authored character values suitable for health metrics, progression,
reputation, experience, and similar quantities:

```yaml
stats:
  - id: health
    label: Health
    description: Zanzibar's current physical condition.
    group: wellbeing
    type: meter
    default: 100
    min: 0
    max: 100
    format: percent
    visible: always
    order: 10

  - id: operator-level
    label: Operator level
    group: progression
    type: integer
    default: 0
    min: 0
    max: 10
    visible: always
```

Supported stat types are:

- `integer` — whole-number value;
- `decimal` — numeric value with authored display precision;
- `meter` — bounded numeric value rendered as a meter;
- `boolean` — named yes/no condition for player-facing state;
- `enum` — one value from an authored option list.

Definitions provide defaults, bounds, display format, group, order, and
visibility. Player saves store only current values. Numeric effects clamp to
authored bounds.

Derived formulas are not part of the first implementation. Simulations may
calculate results in code and return ordinary stat effects. This keeps authored
content declarative and prevents a second programming language from growing
inside JSON.

### Time-Driven Needs and Wellbeing

Stats may opt into controlled change when the game clock advances:

```yaml
stats:
  - id: hunger
    label: Hunger
    group: wellbeing
    type: meter
    default: 35
    min: 0
    max: 100
    direction: lower-is-better
    drift:
      perGameHour:
        resting: 1.5
        light: 3
        moderate: 5
        strenuous: 8
    thresholds:
      - at: 70
        state: hungry
      - at: 90
        state: starving
        effectsPerGameHour:
          - { op: stat.add, id: health, value: -2 }

  - id: thirst
    label: Thirst
    group: wellbeing
    type: meter
    default: 45
    min: 0
    max: 100
    direction: lower-is-better
    drift:
      perGameHour:
        resting: 3
        light: 6
        moderate: 10
        strenuous: 15
    thresholds:
      - at: 65
        state: thirsty
      - at: 85
        state: dehydrated
        effectsPerGameHour:
          - { op: stat.add, id: health, value: -4 }
```

Needs advance only with the authored **game clock**, never from real wall-clock
time while the game is closed. Each time-consuming action reports duration and
an activity profile: `resting`, `light`, `moderate`, or `strenuous`. Walking,
manual labor, operating a console, sleeping, eating, and driving may therefore
advance needs at different rates.

The character system integrates rates over elapsed game time, clamps values,
evaluates crossed thresholds in order, and applies threshold effects
atomically. Large time jumps such as sleep must produce the same result as
equivalent smaller increments.

Activity profiles are engine-defined; authors select among them and configure
rates. Authors cannot add executable rate formulas. Weather or injuries may
apply registered rate multipliers later if Part I demonstrates the need.

`health`, `hunger`, and `thirst` remain independent authored stats. Hunger and
thirst affect health only through explicit threshold effects, allowing
balancing without hard-coding a survival model into the engine.

## Knowledge

Knowledge represents concepts the character has learned and can apply. It is
distinct from discovering a document and from developing a practiced skill:

```yaml
knowledge:
  - id: hydro-head-and-flow
    label: Head and flow
    description: How elevation difference and flow rate determine available hydro power.
    group: hydro
    visible: when-acquired
    sourceLabel: Holo-reader lesson
```

Knowledge is acquired, not ranked, in the first implementation. A holo-reader
lesson, book, conversation, or successful observation applies:

```yaml
effects:
  - { op: knowledge.acquire, id: hydro-head-and-flow }
```

Story beats, choices, simulations, and world activities may require it:

```yaml
require:
  knowledge:
    all: [hydro-head-and-flow]
```

Discovering or marking a document read does not automatically grant knowledge.
The authored reading or lesson action explicitly grants the concepts it
teaches. This permits introductory material, optional reading, assessments,
and lessons that teach several concepts.

## Skills, Practice, and Qualifications

Skills represent learned capabilities rather than temporary measurements:

```yaml
skills:
  - id: hydro-operations
    label: Hydro operations
    description: Understanding and operating a small hydroelectric system.
    mode: ranked
    maxRank: 3
    rankLabels: [Introduced, Practiced, Qualified]
    practice:
      evidence:
        - { id: operating-days, label: Successful operating days, target: 10 }
        - { id: leak-repairs, label: Leaks patched, target: 1 }
      awards:
        - rank: 1
          badge: badges/hydro-introduced.webp
          require:
            knowledge: { all: [hydro-head-and-flow] }
        - rank: 2
          badge: badges/hydro-practiced.webp
          require:
            evidence:
              - { id: operating-days, op: gte, value: 5 }
        - rank: 3
          badge: badges/hydro-qualified.webp
          require:
            evidence:
              - { id: operating-days, op: gte, value: 10 }
              - { id: leak-repairs, op: gte, value: 1 }
    visible: when-acquired
    order: 10
```

A skill uses either:

- `acquired` — absent or acquired; or
- `ranked` — integer rank from `0` through `maxRank`.

Player state stores the current rank, acquisition timestamp, and authored
practice-evidence counters. Successful gameplay events apply evidence:

```yaml
effects:
  - { op: skill.add-evidence, id: hydro-operations, evidence: operating-days, value: 1 }
  - { op: skill.add-evidence, id: hydro-operations, evidence: leak-repairs, value: 1 }
```

After an atomic effect list commits, the character system evaluates skill award
rules and grants newly satisfied ranks in order. This is a constrained
achievement/badge model: authors compose requirements from known knowledge,
evidence counters, quests, stats, and flags without writing scripts.
Each award may supply a badge image and player-facing earned text.
Milestones may participate in these criteria, but they remain playthrough
events rather than badges themselves; see [milestones.md](milestones.md).

Evidence is awarded for meaningful outcomes, not button presses. For example,
the hydro simulation awards an operating day only after the plant completes a
successful day, and awards a leak repair only after the repair outcome.

Skills may also be granted directly for story-controlled exceptions, but
practice-based skills should use evidence rules so their acquisition criteria
remain visible and auditable in the Content Builder's Character mode.

The character panel shows qualifications in the Skills tab and may summarize
selected skills on Overview.

## Quests and Objectives

Quests provide structured player-facing progress. They do not replace story
beats; they summarize goals and completion state across beats, movement, and
simulations.

```yaml
quests:
  - id: restore-hydro
    label: Restore station power
    description: Bring the campus hydro plant back online.
    group: main
    visible: when-started
    objectives:
      - { id: clear-intake, label: Clear the intake debris, order: 10 }
      - { id: confirm-pressure, label: Confirm penstock pressure, order: 20 }
      - { id: energize-generator, label: Energize the generator, order: 30 }
```

Quest status is one of:

`unavailable`, `available`, `active`, `completed`, `failed`, or `abandoned`.

Objective status is one of:

`pending`, `active`, `completed`, or `failed`.

Objectives may optionally define a numeric target for counters such as
`Complete 3 operating rounds`. Content effects start quests, change statuses,
advance counters, and complete objectives. Completing every objective does not
silently complete the quest unless `autoComplete: true` is authored.

Completed quests remain visible in the Journal unless the definition is
explicitly hidden. Quest state belongs to the player save, not `storySeen`.

## Documents and Books

Documents are authored readable content such as manuals, logbooks, diagrams,
and holo-reader lessons. They are catalog entries so the same document can be
found through a physical book, a console, or a story reward:

```yaml
documents:
  - id: intake-maintenance-notes
    title: Intake Maintenance Notes
    summary: Field notes on debris removal and safe intake inspection.
    body: |
      ...
    group: manuals
    order: 10
```

Player state records discovered document IDs and optional read timestamps.
Owning an item and discovering a document are separate operations: taking a
book may do both, while a wall placard may discover a document without adding
inventory.

The Documents tab is a library, not a second inventory list.

## Requirements

All gameplay consumers use one requirement shape. Populated groups are
combined with logical AND:

```yaml
require:
  flags:
    all: [hub.hydro-online]
    not: [storm.active]
  items:
    all:
      - { id: intake-toolkit, quantity: 1 }
    any:
      - { id: flashlight, quantity: 1 }
      - { id: emergency-lantern, quantity: 1 }
  stats:
    - { id: health, op: gte, value: 25 }
  skills:
    - { id: hydro-operations, op: gte, rank: 1 }
  knowledge:
    all: [hydro-head-and-flow]
  evidence:
    - { skill: hydro-operations, id: operating-days, op: gte, value: 5 }
  quests:
    - { id: restore-hydro, status: active }
  documents:
    all: [intake-maintenance-notes]
```

Supported numeric operators are `eq`, `ne`, `gt`, `gte`, `lt`, and `lte`.
Enum and boolean stats support `eq` and `ne`.

Requirements are side-effect free. They may gate:

- beat eligibility;
- individual story choices;
- world interactions and pickups;
- doors and passages;
- simulations and simulation stages;
- document availability.

When a player-facing action is unavailable, authors choose whether it is
hidden or disabled with a hint. The default is disabled with a generated,
non-spoiling explanation when the relevant definition is already known to the
player.

The existing shorthand `require: { all, any, not }` remains a flag alias during
migration. Existing `require.items: [id]` is normalized to item requirements
with quantity `1`.

## Effects

Story choices, world actions, pickups, and simulation outcomes use an ordered
effect list:

```yaml
effects:
  - { op: item.add, id: intake-toolkit, quantity: 1 }
  - { op: stat.add, id: operator-xp, value: 25 }
  - { op: skill.set-rank, id: hydro-operations, rank: 1 }
  - { op: quest.start, id: restore-hydro }
  - { op: quest.complete-objective, quest: restore-hydro, objective: clear-intake }
  - { op: document.discover, id: intake-maintenance-notes }
  - { op: flag.set, id: hydro.clear-intake-debris }
```

The registered first-version operations are:

| Domain | Operations |
| --- | --- |
| Items | `item.add`, `item.remove`, `item.transfer` |
| Stats | `stat.set`, `stat.add` |
| Knowledge | `knowledge.acquire`, `knowledge.forget` |
| Skills | `skill.acquire`, `skill.set-rank`, `skill.add-rank`, `skill.add-evidence` |
| Quests | `quest.make-available`, `quest.start`, `quest.set-status`, `quest.advance-objective`, `quest.complete-objective` |
| Documents | `document.discover`, `document.mark-read` |
| Flags | `flag.set`, `flag.clear` |

Effects are validated against the authored catalog. Applying an effect list is
atomic: validate all requirements, references, bounds, quantities, and state
transitions first; then commit all effects and emit one player-state update.
This prevents receiving a reward while failing to consume its required item.

Choice effects use the operation list above. Existing building pickups
normalize into an `item.add` effect. `item.add` places new items with the
character unless the effect names another accessible holder.

Item transfer is a state operation with source and destination holders:

```yaml
effects:
  - op: item.transfer
    item: bolt-cutter
    quantity: 1
    from: nearby
    to: vehicle:ebuggy
```

The runtime resolves symbolic holders such as `character`,
`current-container`, and `current-vehicle` from interaction context. Authored
content may reference stable holder IDs but may not manufacture arbitrary
runtime instance IDs.

## Runtime Integration

### Story

`useStory` evaluates character requirements when selecting beats and choices.
Choosing an action applies its effects before movement, matching the current
flag-before-movement behavior. If any required effect cannot be committed, no
movement occurs and the player receives an actionable error.

### World and doors

World and building documents reference item IDs but do not own definitions.
Door locks use ordinary item requirements. Pickups, storage interactions, item
transfers, and fixture interactions apply effects through the shared character
service.

The current building-local `items` catalog is migrated into `character-main`.
Building documents retain only placements and references.

### Simulations

Simulations receive a read-only snapshot of the character fields declared in
their configuration. On a registered outcome, they return an outcome ID and
effect payload. The host validates and commits the payload; embedded or
external simulations do not mutate player state directly.

Successful simulations may grant knowledge, practice evidence, skills, quest
progress, and items in one atomic outcome. Repeating a simulation does not
duplicate one-time evidence unless its authored outcome permits repetition.

### Game clock and activity

The future game-clock system owns current game time and the duration of days.
The character system owns the effect of elapsed time on character stats.

Any action that advances time supplies:

- elapsed game minutes;
- one registered activity profile;
- optional contextual modifiers approved by the host.

Movement, story, rest, item actions, and simulations all pass through the same
clock-advance boundary. Character need changes are committed before the next
beat is selected, so a beat may react to hunger, thirst, health, time, or the
result of the completed activity.

### Flags

Flags remain useful for hidden narrative facts and world state. A value that
the player should understand and inspect belongs in a stat, knowledge entry,
skill, quest, item, or document instead. Content should not maintain duplicate
flag and character state.

### Save/load

Player character state is global, not nested beneath the indoor map:

```json
{
  "character": {
    "holdings": {
      "stacks": {},
      "instances": {}
    },
    "stats": {
      "health": 100,
      "operator-level": 1
    },
    "skills": {
      "hydro-operations": {
        "rank": 1,
        "acquiredAt": "...",
        "evidence": {
          "operating-days": 3,
          "leak-repairs": 0
        }
      }
    },
    "knowledge": {
      "hydro-head-and-flow": { "acquiredAt": "..." }
    },
    "quests": {
      "restore-hydro": {
        "status": "active",
        "objectives": {
          "clear-intake": { "status": "completed", "count": 1 }
        }
      }
    },
    "documents": {
      "intake-maintenance-notes": {
        "discoveredAt": "...",
        "readAt": null
      }
    }
  }
}
```

Invalid or unknown saved values load conservatively and produce a development
warning rather than discarding the whole save.

World save state also stores the contents and locations of vehicle holders,
fixed containers, and runtime item placements. A save is internally invalid if
one item belongs to multiple holders or a holder cycle exists.

### Live authoring

On `character.updated`, the game replaces definitions while preserving player
state:

- changed labels, descriptions, grouping, and icons update immediately;
- added definitions become available to content;
- renamed IDs require an explicit reference-aware rename and save migration;
- deletion is rejected while world, story, simulation, or authored content
  references the ID;
- if a stale save contains an unknown ID, its state is retained as an orphan
  but hidden from normal UI until the definition returns or a migration maps it.

## Scenario Checks

The intended Part I cases map to the contract as follows:

1. **Hunger, thirst, food, and water** — Hunger and thirst are meter stats with
   activity-dependent drift. Game-clock advancement changes them; threshold
   effects can reduce health. Food and water are authored consumables whose
   actions consume quantity, advance time, and reduce the appropriate need.
   Calories and hydration remain visible author metadata.
2. **Holo-reader knowledge** — Completing a lesson applies one or more
   `knowledge.acquire` effects. A later beat, choice, action, or simulation can
   require that knowledge ID without relying on a hidden flag.
3. **Practice becoming skill** — Successful operating days, repairs, and other
   meaningful outcomes add named evidence counters. Authored award rules grant
   skill ranks and badges when their evidence and knowledge requirements pass.
4. **Backpack storage** — The backpack is a unique portable container instance.
   Keys, meals, and instruction cards can transfer into it. If the backpack is
   left in a room, its contents remain with it and are no longer carried.
5. **Tools carried or transported by eBuggy** — A tool may be held directly,
   placed in a carried backpack, or transferred to the eBuggy holder. The
   vehicle transports its contents. An action can require the tool to be
   `carried` or merely `nearby`, preventing remote use.

These examples require no item-specific or lesson-specific JavaScript. Engine
code implements the finite concepts—time drift, effects, holders, transfers,
requirements, and skill awards—while authors supply IDs, values, placements,
lesson rewards, and progression criteria.

## Player-Facing Character Panel

The game provides one character view that can open without changing the
player's map location or interrupting save state. It occupies the app's primary
game-view surface, replacing the map temporarily in the same way as a location
close-up, holo-reader lesson, document, console, or simulation. It is not a
small panel squeezed beside the playable map.

The app shell owns switching between Map and Character and provides a
consistent **Return to map** action. Returning restores the same logical
location, room or stand, map camera, narrative context, and available actions.
Opening the character view does not create a movement or story event.

The default tabs are:

| Tab | Contents |
| --- | --- |
| Overview | Portrait, profile, wellbeing meters, level/progression, active quest summary |
| Inventory | Current holder tree: carried gear, backpack contents, and accessible nearby storage |
| Knowledge | Learned concepts and their authored descriptions |
| Skills | Acquired skills, ranks, qualifications, and authored descriptions |
| Quests | Active, available, completed, and failed quests with objectives |
| Documents | Discovered manuals, books, diagrams, logs, and read state |

Authors may reorder or hide unused tabs and configure groups, but may not
replace standard controls or inject arbitrary markup. Empty tabs show authored
or default empty-state text rather than disappearing unexpectedly.

Opening, tabbing, filtering, inspecting, and reading do not consume an item or
advance game state unless the player selects an explicit authored action.
Eating, drinking, transferring, dropping, or using an item is an explicit
action and may advance game time.
Required story choices and simulation gates may prevent leaving their own
modal surface, but ordinary narrative cards do not block opening the character
panel.

The view must be keyboard navigable, expose meter values as text, not rely on
color alone, and preserve the last selected tab during the current session.
The selected top-level game view and open/closed UI state are not required in
save data.

## Validation and Reference Safety

Blocking validation includes:

- malformed or duplicate IDs across each catalog;
- unknown group, item, stat, knowledge, skill, evidence, quest, objective,
  holder, or document references;
- invalid defaults, bounds, enum values, quantities, ranks, or quest statuses;
- effects incompatible with a definition's type;
- destructive item effects that can exceed available quantity;
- impossible container capacities, disallowed nesting, holder cycles, or one
  item assigned to several holders;
- malformed drift rates, activity profiles, thresholds, or threshold effects;
- unreachable or circular skill award rules;
- duplicate quest objective IDs;
- missing assets where asset validation is available;
- attempts to delete or rename referenced definitions without a cascade plan.

Reference-aware rename updates character definitions, story requirements and
effects, world placements and locks, simulation configuration, and known save
migrations in one transaction. Restoring history creates a new revision.

Warnings should identify:

- important stats or active quests hidden from every panel tab;
- unique items granted by several repeatable sources;
- consumables with nutrition metadata but no usable action;
- portable containers that cannot accept any item kind;
- skill evidence that no gameplay outcome awards;
- quest-critical items consumed without a replacement path;
- skills or documents never granted;
- quests with no reachable start or completion effect;
- duplicate player-facing labels that may confuse authors.

## Persistence and Deployment

| Data | Storage |
| --- | --- |
| Character, item, stat, knowledge, skill, quest, and document definitions | SQLite `character-main` document |
| Definition revisions | SQLite immutable revision history |
| Physical item placements and world interactions | Outdoor/building world documents |
| Narrative requirements and rewards | Story beat content |
| Player inventory and character progress | Versioned player save in `localStorage` |
| Future cross-device character state | Player/account store in Neon |
| YAML snapshots | Import/export only |

Moving saves to Neon must preserve the same JSON-safe character state shape.
Authored definitions remain separate from player/account rows.

## Implementation Sequence

1. Add the `character-main` repository, validation, API, export, revisions,
   and builder route.
2. Introduce a global character store backed by holder-based state.
3. Move utility-station item definitions to the character catalog while
   retaining world pickup references.
4. Implement shared requirement evaluation and atomic effects.
5. Add item requirements/effects to Story Builder and World Builder.
6. Add the tabbed character panel with Overview and Inventory first.
7. Add game-time drift for hunger/thirst and authored food/water actions.
8. Add knowledge, practice evidence, skills, quests, and documents as Part I
   content needs them.
9. Add backpack and eBuggy holders, transfers, and persistent contents.
10. Integrate simulation outcomes through the same effects service.

Each increment must preserve existing keys, door behavior, pickups, save/load,
and live world/story refresh.

## Deferred Extensions

The following are deliberately outside the first contract:

- equipment slots, armor, and combat statistics;
- item durability and randomized per-instance properties;
- unrestricted container nesting;
- crafting recipes and economies;
- authored stat formulas or general-purpose expressions;
- multiple playable characters, NPC inventories, and party management;
- remote authoring or collaborative conflict resolution;
- account-wide achievements distinct from a playthrough.

Add these only when a concrete game requirement cannot be represented by the
definitions, requirements, and effects above.
