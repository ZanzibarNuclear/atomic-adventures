# Character and Inventory Management

**Status:** Proposed contract for Part I implementation  
**Scope:** Player character state, authored items, inventory, stats, skills,
quests, documents, requirements/effects, save data, and the player-facing
character panel

---

## Purpose

Atomic Adventures needs to represent possessions and character progression
without adding a new hard-coded field for every key, tool, lesson, injury, or
quest. Authors must be able to define those concepts, place or award them, use
them as requirements, and choose how they appear to the player.

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

- **Data-driven, not code-driven.** New ordinary items, stats, skills, quests,
  and documents do not require a Vue or JavaScript change.
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

Character definitions are stored as one ordered JSON document named
`character-main` in `game/content/atomic-adventures.sqlite`. This follows the
existing coarse-document model used for outdoor world and building content.
YAML may be exported for review or interchange, but direct YAML edits are not
live until imported.

The document contains independent ordered catalogs:

```yaml
id: character-main

profile:
  id: zanzibar-nuhero
  name: Zanzibar Nuhero
  portrait: characters/zanzibar/default.webp
  summary: Curious explorer and aspiring energy systems operator.

panel:
  tabs: [overview, inventory, skills, quests, documents]
  statGroups:
    - { id: wellbeing, label: Wellbeing, order: 10 }
    - { id: progression, label: Progression, order: 20 }
  inventoryGroups:
    - { id: keys, label: Keys, order: 10 }
    - { id: tools, label: Tools, order: 20 }
    - { id: books, label: Books and manuals, order: 30 }

items: []
stats: []
skills: []
quests: []
documents: []
```

The character document defines the player-facing catalog. World documents
define physical placements. Story beats define narrative grants and changes.
Simulations report outcomes through registered effect payloads. None of those
consumers may define an item inline.

Production builds export the document to
`/content/character.json`. Development loads it from the local content API and
receives `character.updated` SSE notifications.

## Authoring Workspace

Character content is edited in a dedicated `/builder/character` route. Keeping
it separate prevents character catalog drafts from being mixed with Story
Builder beat drafts, World Builder geometry drafts, or player save state.

The workspace provides:

- profile and character-panel configuration;
- item, stat, skill, quest, and document catalogs;
- ordering and grouping controls;
- reference search showing every use of a selected ID;
- validation, revision history, restore, import, and export;
- preview of empty, early-game, and populated panel states.

Story Builder and World Builder consume the catalog:

- Story Builder selects requirements and effects from known IDs.
- World Builder places catalog items and selects acquisition behavior.
- Simulation configuration selects known stats, skills, quests, and rewards.

Authors should not need to copy IDs manually for normal builder workflows.

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
| `visible` | `always`, `when-acquired`, or `hidden` |
| `inspect` | Optional authored detail shown from the inventory |
| `relatedDocument` | Optional document opened from the item detail |

`kind` affects display and filtering but does not grant hidden behavior. A key
opens a door only when that door explicitly requires its item ID. A tool is
usable only where an authored action or simulation accepts it.

Items are not defined inside choices or pickups. This avoids conflicting names
and descriptions for the same ID.

### Inventory State

The player inventory is a map keyed by item ID:

```json
{
  "lobby-exterior-key": { "quantity": 1 },
  "trail-rations": { "quantity": 3 }
}
```

The first implementation supports quantities, not independently named item
instances. Per-copy durability, randomized properties, equipment slots, and
dropping objects into arbitrary world locations are later extensions. If a
tool needs condition or charges in Part I, model those as an authored stat
until a demonstrated need justifies item-instance state.

Inventory operations clamp at zero and at `maxQuantity`. An effect that cannot
be fully applied fails before any sibling effect is committed unless it is
explicitly marked optional.

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

The player cannot drop, destroy, or consume an item unless an authored action
applies an explicit removal effect. Quest-critical items should ordinarily be
non-consumable.

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

## Skills and Qualifications

Skills represent learned capabilities rather than temporary measurements:

```yaml
skills:
  - id: hydro-operations
    label: Hydro operations
    description: Understanding and operating a small hydroelectric system.
    mode: ranked
    maxRank: 3
    rankLabels: [Introduced, Practiced, Qualified]
    visible: when-acquired
    order: 10
```

A skill uses either:

- `acquired` — absent or acquired; or
- `ranked` — integer rank from `0` through `maxRank`.

Player state stores the current rank and optional acquisition timestamp.
Training, story, and simulations grant or raise ranks through effects. Skill
definitions may describe ranks, but they do not automatically watch flags or
simulation values. The event that earns a rank applies it explicitly.

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
| Items | `item.add`, `item.remove` |
| Stats | `stat.set`, `stat.add` |
| Skills | `skill.acquire`, `skill.set-rank`, `skill.add-rank` |
| Quests | `quest.make-available`, `quest.start`, `quest.set-status`, `quest.advance-objective`, `quest.complete-objective` |
| Documents | `document.discover`, `document.mark-read` |
| Flags | `flag.set`, `flag.clear` |

Effects are validated against the authored catalog. Applying an effect list is
atomic: validate all requirements, references, bounds, quantities, and state
transitions first; then commit all effects and emit one player-state update.
This prevents receiving a reward while failing to consume its required item.

Legacy choice fields such as `sets` and `set_flags` normalize into flag
effects. Existing building pickups normalize into an `item.add` effect.

## Runtime Integration

### Story

`useStory` evaluates character requirements when selecting beats and choices.
Choosing an action applies its effects before movement, matching the current
flag-before-movement behavior. If any required effect cannot be committed, no
movement occurs and the player receives an actionable error.

### World and doors

World and building documents reference item IDs but do not own definitions.
Door locks use ordinary item requirements. Pickups and fixture interactions
apply effects through the shared character service.

The current building-local `items` catalog is migrated into `character-main`.
Building documents retain only placements and references.

### Simulations

Simulations receive a read-only snapshot of the character fields declared in
their configuration. On a registered outcome, they return an outcome ID and
effect payload. The host validates and commits the payload; embedded or
external simulations do not mutate player state directly.

### Flags

Flags remain useful for hidden narrative facts and world state. A value that
the player should understand and inspect belongs in a stat, skill, quest, item,
or document instead. Content should not maintain duplicate flag and character
state unless integration with a legacy system requires it temporarily.

### Save/load

Player character state is global, not nested beneath the indoor map:

```json
{
  "character": {
    "inventory": {
      "lobby-exterior-key": { "quantity": 1 }
    },
    "stats": {
      "health": 100,
      "operator-level": 1
    },
    "skills": {
      "hydro-operations": { "rank": 1, "acquiredAt": "..." }
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

The save version must increase when this state replaces
`indoor.inventory`. Migration converts each legacy inventory ID to quantity
`1`. Invalid or unknown saved values load conservatively and produce a
development warning rather than discarding the whole save.

### Live authoring

On `character.updated`, the game replaces definitions while preserving player
state:

- changed labels, descriptions, grouping, and icons update immediately;
- added definitions become available to content;
- renamed IDs require an explicit reference-aware rename and save migration;
- deletion is rejected while world, story, simulation, or character content
  references the ID;
- if a stale save contains an unknown ID, its state is retained as an orphan
  but hidden from normal UI until the definition returns or a migration maps it.

## Player-Facing Character Panel

The game provides one character panel that can open without changing the
player's map location or interrupting save state. Desktop may use a side panel
or modal; narrow screens use a full-screen sheet.

The default tabs are:

| Tab | Contents |
| --- | --- |
| Overview | Portrait, profile, important meters, level/progression, active quest summary |
| Inventory | Grouped carried items, quantities, descriptions, inspection, linked documents |
| Skills | Acquired skills, ranks, qualifications, and authored descriptions |
| Quests | Active, available, completed, and failed quests with objectives |
| Documents | Discovered manuals, books, diagrams, logs, and read state |

Authors may reorder or hide unused tabs and configure groups, but may not
replace standard controls or inject arbitrary markup. Empty tabs show authored
or default empty-state text rather than disappearing unexpectedly.

Opening, tabbing, filtering, inspecting, and reading do not consume an item or
advance game state unless the player selects an explicit authored action.
Required story choices and simulation gates may prevent leaving their own
modal surface, but ordinary narrative cards do not block opening the character
panel.

The panel must be keyboard navigable, expose meter values as text, not rely on
color alone, and preserve the last selected tab during the current session.
The open/closed UI state is not required in save data.

## Validation and Reference Safety

Blocking validation includes:

- malformed or duplicate IDs across each catalog;
- unknown group, item, stat, skill, quest, objective, or document references;
- invalid defaults, bounds, enum values, quantities, ranks, or quest statuses;
- effects incompatible with a definition's type;
- destructive item effects that can exceed available quantity;
- duplicate quest objective IDs;
- missing assets where asset validation is available;
- attempts to delete or rename referenced definitions without a cascade plan.

Reference-aware rename updates character definitions, story requirements and
effects, world placements and locks, simulation configuration, and known save
migrations in one transaction. Restoring history creates a new revision.

Warnings should identify:

- important stats or active quests hidden from every panel tab;
- unique items granted by several repeatable sources;
- quest-critical items consumed without a replacement path;
- skills or documents never granted;
- quests with no reachable start or completion effect;
- duplicate player-facing labels that may confuse authors.

## Persistence and Deployment

| Data | Storage |
| --- | --- |
| Character, item, stat, skill, quest, and document definitions | SQLite `character-main` document |
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
2. Introduce a global character store and migrate legacy indoor inventory/save
   data.
3. Move utility-station item definitions to the character catalog while
   retaining world pickup references.
4. Implement shared requirement evaluation and atomic effects.
5. Add item requirements/effects to Story Builder and World Builder.
6. Add the tabbed character panel with Overview and Inventory first.
7. Add stats, skills, quests, and documents as Part I content needs them.
8. Integrate simulation outcomes through the same effects service.

Each increment must preserve existing keys, door behavior, pickups, save/load,
and live world/story refresh.

## Deferred Extensions

The following are deliberately outside the first contract:

- equipment slots, armor, and combat statistics;
- independently stateful item instances or durability systems;
- arbitrary item dropping and persistent world containers;
- crafting recipes and economies;
- authored stat formulas or general-purpose expressions;
- multiple playable characters, NPC inventories, and party management;
- remote authoring or collaborative conflict resolution;
- account-wide achievements distinct from a playthrough.

Add these only when a concrete game requirement cannot be represented by the
definitions, requirements, and effects above.
