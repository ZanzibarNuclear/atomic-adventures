# Room Fixtures And Appliances

**Status:** Specified for implementation — kitchen is the first full room;
general model applies to other rooms later  
**Scope:** Fixed, non-portable equipment authored on building rooms: appliances,
sinks, purifiers, cabinets as world holders, and player interactions with them  
**Related:** [station-electrical-grid.md](station-electrical-grid.md),
[indoor-stands.md](indoor-stands.md), [character-inventory.md](character-inventory.md),
[world-authoring.md](world-authoring.md), [location-media.md](location-media.md),
[play-modes-and-story-mode.md](play-modes-and-story-mode.md)

---

## Purpose

Room fixtures are **building structure**: stoves, sinks, installed purifiers,
induction stations, and similar equipment that Zanzibar cannot put in a
backpack. Players interact with them in place. Portable meals, utensil sets,
tablets, and boxes of food are **artifacts/items** under
[character-inventory.md](character-inventory.md).

This contract defines:

- how fixtures are authored on rooms and edited in World Builder;
- how runtime control state is stored and saved;
- how players reach and operate fixtures (stands, messages, actions);
- the **Kitchen** fixture set required for Part I survival play: cabinet meal
  storage, running water, and tablet purifier fill/charge.

Electrical demand of powered fixtures (per-device `loadW` / `loadWByLevel`,
circuit membership, contribution to station \(P_{load}\)) is owned by
[station-electrical-grid.md](station-electrical-grid.md). World Builder authors
those fields alongside fixture controls. This document owns
**controls, reach, and processes** (including non-electric ones).

---

## Design Goals

- Prefer **building-owned fixtures** over portable “fake appliances.”
- Prefer **stand-scoped reach** for physical interaction (at the sink, at the
  stove, at the cabinets)—same pattern as nearby pickups.
- Keep **control state** (burner level, tap flow, purifier charge) in facility
  runtime state, not as one-off story flags, unless a flag is a true milestone.
- Use the **play message bus** for short results (“You flip the switch, but
  nothing happens.” / “Cold water runs from the tap.”).
- Support **discovery**: nearby items at a stand are announced in the message
  area; fixture affordances appear as actions when in reach.
- Allow the same fixture **kinds** in other rooms later (lab sink, workshop
  burner) without a new model.

---

## Building vs Artifact

| Object | Owner | Examples |
| --- | --- | --- |
| Fixed equipment | Building `rooms[].fixtures` | Stove, sink, purifier unit, induction pot station |
| Room lighting | Building `rooms[].lighting` | Wall switch + LEDs ([station-electrical-grid.md](station-electrical-grid.md)) |
| Fixed storage | Building holders (fixed) | Cabinet drawers, pantry shelves |
| Portable goods | Character catalog items/instances | Tastee Tack meals, meal boxes, knife set, plates, purifier tablets |
| Consumable process inputs | Items used **with** a fixture | Tablets added to purifier; water is fixture process state, not an item unless bottled |

**Rule:** If Zanzibar cannot carry it out of the room as a whole, it is a
fixture (or fixed holder). If he can pocket, pack, or move it between holders,
it is an artifact/item.

---

## General Fixture Model

### Authored shape (building document)

Fixtures are listed on the room that owns them:

```yaml
rooms:
  - id: kitchen
    stands:
      - id: cabinets
      - id: stove
      - id: sink
      - id: kitchen-table
    fixtures:
      - id: kitchen-stove
        kind: stove
        stand: stove
        label: Electric range
        burners: 4
        burnerLevels: [off, low, medium, high]
        # loadWByLevel later — see station-electrical-grid
      - id: kitchen-sink
        kind: sink
        stand: sink
        label: Kitchen sink
        flowLevels: [off, low, medium, high]
      - id: kitchen-purifier
        kind: water-purifier
        stand: sink
        label: Countertop purifier
        power: none              # tablet process; not bus-powered
        requiresTabletItem: purifier-tablet   # catalog item id
      - id: kitchen-induction-pot
        kind: induction-hot-pot
        stand: stove             # or a dedicated stand when authored
        label: Induction hot pot
        power: station-bus
        heatLevels: [off, low, medium, high]
```

Field rules:

- `id` — kebab-case, unique within the building.
- `kind` — registered fixture kind (see below).
- `stand` — optional; when set, operate/inspect actions require the player’s
  `currentStand` to match (or an authored equivalent reach rule).
- `label` — player-facing name.
- `power` — `none` | `station-bus` (default `station-bus` for electrical kinds,
  `none` for sink and tablet purifier).
- Kind-specific config (burner count, levels, item ids) as required by kind.

### Registered kinds (Part I)

| Kind | Electrical? | Primary controls |
| --- | --- | --- |
| `stove` | Yes | Per-burner level: `off`, `low`, `medium`, `high` |
| `sink` | No | Flow level: `off`, `low`, `medium`, `high` |
| `water-purifier` | No (tablet) | Has tablet, filled, process stage |
| `induction-hot-pot` | Yes | Heat level: `off`, `low`, `medium`, `high` |

Additional kinds may be added without changing this ownership model.

### Runtime state

Fixture control state is saved with the indoor facility snapshot (names
illustrative):

```js
facility.fixtures = {
  "kitchen-stove": {
    burners: ["off", "off", "off", "off"],  // length = authored burners
  },
  "kitchen-sink": {
    flow: "off",
  },
  "kitchen-purifier": {
    hasTablet: false,
    filled: false,
    stage: "idle",   // idle | charging | ready | empty
  },
  "kitchen-induction-pot": {
    heat: "off",
  },
};
```

Rules:

1. Defaults apply when a key is missing after load or content add.
2. Live authoring of fixture config must not wipe player state for existing
   fixture ids (same rule as light switches).
3. Story flags may record milestones (e.g. first purified water) but must not
   be the only store of burner/flow/purifier state.

### Reach and actions

1. When `stand` is set, fixture operate actions are available only while the
   player is at that stand (or the fixture’s authored reach set).
2. When the player arrives at a stand, **portable items within reach** are
   announced on the play message bus (e.g. “There is a bolt cutter.” /
   kitchen: meal boxes). That discovery path is general, not kitchen-only.
3. Fixture actions appear in the play panel alongside pickups and transfers.
4. Short results use the **play message bus** (`source` such as `action` or
   `fixture`), not story prose alone.

### Dead bus / impossible process

For `power: station-bus` fixtures:

- Setting a control above `off` while the bus is dead either:
  - **arms** the control and posts a notice that nothing energizes, or
  - refuses with a clear notice—
  Implementation must pick one policy per kind and keep it consistent with
  light-switch UX where possible (remembered control + “nothing happens”).
- Drawing load is **0 W** while the bus is dead regardless of control position
  ([station-electrical-grid.md](station-electrical-grid.md)).

For `power: none` fixtures (sink, tablet purifier), bus state does not block
the process except where water/power plumbing is later authored.

---

## Fixed Holders And Portable Kitchen Goods

Cabinets and pantries are **fixed holders** (and usually stands), not fixtures
of kind `stove`. Fixture list and holders cooperate:

| Stand / holder | Typical contents |
| --- | --- |
| `cabinets` (drawers) | Boxes of Tastee Tack, utensils, loose meals |
| Hidden pantry (later) | Additional boxes |
| Character / backpack | Meals and boxes the player carries |

### Tastee Tack

- **Meal** — consumable catalog item; eating applies satiety (and any authored
  effects) through the character effects service.
- **Box** — portable **container** item with capacity for N meals. Players may
  move boxes between fixed holders and carried holders, and move meals in/out
  of open boxes when both are accessible.

### Utensils

Knife sets, plates, bowls: portable artifacts. They may start in cabinet
holders. They do not use fixture control state unless a future “in use on
stove” placement is specified.

### Minimum transfer support (kitchen)

Players must be able to:

1. Stand at **cabinets** and see that meal boxes (or meals) are present
   (message bus + pickup/transfer actions).
2. **Take** a box or meal from a cabinet drawer holder into hand/backpack.
3. **Put** a box or meal back into an accessible cabinet/pantry holder when
   capacity allows.

Transfers use [character-inventory.md](character-inventory.md) holder rules
(`nearby` includes current stand’s fixed holders).

---

## Kitchen Fixtures (Part I Minimum)

The utility-station **kitchen** room is the first complete fixture package.
Other rooms reuse the same kinds with different config.

### Required stands

| Stand id (example) | Purpose |
| --- | --- |
| `cabinets` | Reach into drawers; meal boxes and utensils |
| `stove` | Range burners; optional induction pot |
| `sink` | Tap water; purifier at or beside sink |
| `kitchen-table` | Optional sit/eat surface (may remain non-fixture) |

Existing content may already define `cabinets`, `stove`, and `kitchen-table`;
**`sink` must be authored** for sink and purifier reach if not present.

### Required fixtures

| Fixture id (example) | Kind | Stand | Minimum player interactions |
| --- | --- | --- | --- |
| `kitchen-stove` | `stove` | `stove` | Set each burner to off/low/medium/high; status shows which burners are on when bus is live |
| `kitchen-sink` | `sink` | `sink` | Set flow off/low/medium/high; message when water runs or stops |
| `kitchen-purifier` | `water-purifier` | `sink` | Add tablet (consume tablet item); fill from sink or explicit fill action; complete purification when rules say ready; obtain purified water item or filled bottle |
| `kitchen-induction-pot` | `induction-hot-pot` | `stove` or own stand | Set heat level; requires station bus for effect; used to boil/heat water quickly |

Authors may omit induction pot from the first playable slice only if purifier
alone covers Day-1 water; the kind remains in the contract for the kitchen
package.

### Minimum play loop (acceptance)

A player in Story or Open-world mode, standing in the kitchen, can:

1. **Cabinets**
   - Approach `cabinets`.
   - See discovery message for reachable meal boxes / meals / utensils.
   - Move at least one meal or meal box **out** of a cabinet holder.
   - Move a meal or meal box **into** a cabinet holder (capacity permitting).

2. **Sink**
   - Approach `sink`.
   - Turn water **on** to a non-off flow level and receive a clear message that
     water is running.
   - Turn water **off**.

3. **Purifier**
   - While at purifier reach (`sink` stand unless authored otherwise):
     - **Add a tablet** when the player has a purifier tablet item and the unit
       accepts one (consumes the tablet, sets `hasTablet`).
     - **Fill** the unit when water is available (sink flowing or an authored
       fill action that requires water context), sets `filled`.
     - When tablet + filled conditions and any time/process rules are met,
       obtain **purified water** (item grant or bottle fill) through the shared
       effects service—not a flag-only “I drank” story choice.

4. **Power relationship**
   - Sink and tablet purifier work **without** station bus power.
   - Stove burners and induction pot only produce heat effect when the bus is
     energized; controls may still be set with a dead-bus notice policy.

### Purifier process (supported)

Logical stages:

| Stage | Meaning |
| --- | --- |
| `idle` | Empty or incomplete |
| `charging` | Tablet present, filled, process running (optional time) |
| `ready` | Safe water available to take |
| `empty` | Just dispensed; returns toward idle |

Minimum viable process without a long timer:

1. Add tablet → `hasTablet: true`.
2. Fill (requires sink water on, or explicit “fill from tap” while flow ≠ off)
   → `filled: true`.
3. If both true → `stage: ready` (or after optional short `timeMinutes`).
4. “Take purified water” / “Fill bottle” → effects grant water; clear tablet
   and/or filled per authored once/consumable rules.

Invalid actions post messages, e.g. “The purifier needs a treatment tablet.”
/ “Fill the reservoir first.”

### Stove process (supported minimum)

1. Authored `burners` count (default 4 for kitchen).
2. Each burner has level `off | low | medium | high`.
3. Player actions: set a named or indexed burner to a level (e.g. “Set left-front
   burner to medium”).
4. Status when bus on: summarize active burners; when bus off: do not claim
   heat.
5. Cooking food on a burner may be a later binding (item + burner on); not
   required for the cabinet/sink/purifier minimum, but burner controls must
   exist so kitchen discovery is real.

### Sink process (supported minimum)

1. Flow levels: `off | low | medium | high`.
2. Turning flow above `off` posts a short message (gradient may only change
   copy or future fill rate).
3. Purifier fill requires flow ≠ `off` unless a separate “use stored water”
   path is authored.

### Induction hot pot (supported when present)

1. Heat levels like burners; `power: station-bus`.
2. Used to boil water quickly when power is available (alternative or
   complement to purifier for story).
3. Does not replace the tablet purifier’s cold-treatment path.

---

## Player-Facing Surfaces

| Surface | Role |
| --- | --- |
| Play panel actions | Operate fixtures; pick up / transfer items |
| Play message bus | Discovery of nearby items; action results |
| Status lines | Ongoing fixture summary when useful (optional) |
| Inventory / holders | Move meals and boxes between cabinets and packs |
| Story scenes | Atmosphere only; must not be the only way to get food/water effects |

---

## Story Mode

Story mode may **highlight** cabinet, sink, and purifier actions on Day 1, but
must not:

- grant `day1.found-food` / water flags without real inventory or effects when
  building actions exist; or
- require a flag such as `story.the-garage` solely to see kitchen fixtures if
  the player reached the kitchen by a valid path.

Open-world uses the same fixture rules with broader action visibility.

---

## Authoring (World Builder)

### Room detail

World Builder room edit exposes:

- **Lighting** (existing)
- **Fixtures** list: add/remove/reorder; kind-specific fields; stand picker
  from room stands
- Links or panels for **fixed holders** on the same room (cabinets, pantry)

### Content Builder

- Catalog: Tastee Tack meal, meal box container, utensils, purifier tablets,
  purified water / bottles
- Starting placements: boxes in kitchen cabinet holders; optional hidden pantry

### Validation

- Fixture `stand` must exist on the room when set.
- `burners` ≥ 1 for `stove`.
- `requiresTabletItem` must reference a catalog item when kind is
  `water-purifier`.
- Holder capacity must accept authored starting boxes.

---

## Implementation Map (Reference)

| Concern | Home |
| --- | --- |
| Fixture authoring | Building document `rooms[].fixtures` |
| Fixture runtime state | Indoor facility snapshot |
| Electrical draw | [station-electrical-grid.md](station-electrical-grid.md) |
| Holders / meals / tablets | Character catalog + building holders |
| Nearby item messages | Play message bus + indoor reach helpers |
| Actions | Indoor play panel / fixture action builder |

---

## Acceptance Criteria

### General

1. Fixtures are building-owned, room-authored, builder-editable.
2. Portable goods are items/containers; fixed storage is holders.
3. Fixture control state saves and loads.
4. Stand reach gates operate actions when `stand` is set.
5. Electrical fixtures respect bus rules for **effect** and **load**.

### Kitchen minimum

6. Player can move meals or meal boxes **out of** and **into** kitchen cabinet
   holders.
7. Player can run the kitchen sink (flow on/off at least one non-off level) with
   clear feedback.
8. Player can **add a tablet** to the purifier and **fill** it, then obtain
   purified water through real item/effects rules.
9. Discovery messages list reachable cabinet contents at the cabinets stand.
10. The first kitchen visit has no Eat and drink / Purify water shortcuts.
    Those appear only after the matching skills are acquired (see
    [character-inventory.md](character-inventory.md)). Flag-only kitchen
    “Eat and drink” is not part of the loop.

---

## Out Of Scope (Until Extended)

- Full recipe cooking sim and nutrition chemistry.
- Dishwasher, garbage disposal, or multi-basin plumbing graphs.
- Requiring the player to stand exactly on a wall switch for every fixture
  (optional puzzle later).
- Lab or bathroom fixture packages (same model, separate content).

---

## Document History

- **2026-07-22** — Initial contract: building-owned fixtures, kitchen minimum
  (cabinets/meals, sink, tablet purifier), link to electrical load rules.
