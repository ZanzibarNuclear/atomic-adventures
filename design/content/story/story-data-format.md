# Story Data Format

Specification for the declarative data format that drives the CYOA engine.

## Design Goals

- **Authorable without code** — Writers edit YAML files, not Vue components
- **Expressive enough** — Conditions, flags, gates, branching, items, simulations
- **Simple enough** — A passage is a passage. No Turing-complete scripting language.
- **One file per area** — Hub is one file, each facility is one file. Keeps things manageable.

## File Structure

```
content/
  story/
    hub.yaml           # Central facility
    hydro.yaml         # Hydroelectric plant
    ap1000.yaml        # PWR reactor
    gen4.yaml          # Sodium-cooled fast reactor
    solar.yaml         # PV array
    fusion.yaml        # Tokamak facility
```

Each file is a self-contained area. The engine loads them all and links them via `go_to` references.

## Schema

### Top Level

```yaml
area: hydro # Unique area ID
name: Hydroelectric Plant
description: A dormant diversion plant — intake, penstock, and powerhouse on a mountain stream.
start: arrival # Entry passage ID
ambient: water-drip, wind # Default ambient audio for this area

passages:
  # ... (see below)
```

### Passage

The core unit. A passage is a place, a moment, or a beat in the story.

```yaml
passages:
  arrival:
    text: |
      The path opens onto a concrete platform overlooking the
      powerhouse. The penstock climbs the slope above you,
      silent. A control building sits to the left, its windows
      dark. To the right, a steel staircase leads to the intake.
    image: hydro/arrival-overlook.jpg
    ambient: water-lap, wind-gentle # Override area default
    choices:
      - text: Enter the control building
        go_to: control-building
      - text: Descend the staircase
        go_to: intake
      - text: Examine the overlook railing
        go_to: overlook-railing
```

### Choices with Conditions

Choices can be conditional — shown only when flags are set (or not set).

```yaml
control-building:
  text: |
    The control room is dim. A long console stretches beneath
    cracked monitors. A thick operations manual sits open on
    a desk, its pages dusty but legible.
  choices:
    - text: Read the operations manual
      go_to: ops-manual
      set_flags: [read_ops_manual]
    - text: Try the console switches
      go_to: console-dead
      require: { not: [read_ops_manual] }
    - text: Try the console switches
      go_to: console-attempt
      require: { all: [read_ops_manual] }
    - text: Go back outside
      go_to: arrival
```

### Flags

Simple booleans that track what the player has done or learned. Set on choices, cleared explicitly if needed.

```yaml
- text: Read the operations manual
  go_to: ops-manual
  set_flags: [read_ops_manual]
  clear_flags: [confused_by_console]
```

Flags are global and persistent within a playthrough. Keep names scoped by convention: `hydro.read_ops_manual`, `hub.visited_hydro`, etc.

### Items

Objects the player picks up. Like flags but with a name and optional description for an inventory UI.

```yaml
- text: Take the flashlight
  go_to: dark-corridor
  add_items:
    - id: flashlight
      name: Flashlight
      description: A heavy-duty flashlight. Still works.
```

Items can be required by choices:

```yaml
- text: Illuminate the turbine hall
  go_to: turbine-hall-lit
  require: { items: [flashlight] }
```

### Found Documents

In-world learning materials — logbooks, manuals, diagrams. Displayed in a reading UI, not inline.

```yaml
ops-manual:
  text: |
    You open the operations manual to a bookmarked page.
    Diagrams show water flow through three turbine types.
  document:
    id: turbine-types
    title: "Operations Manual — Ch. 3: Turbine Selection"
    content: |
      Francis turbines: medium head, high flow.
      Pelton turbines: high head, low flow.
      Kaplan turbines: low head, very high flow.

      Power output: P = η × ρ × g × Q × H
      where η = turbine efficiency, Q = flow rate, H = head
    image: hydro/turbine-diagram.png
  set_flags: [read_turbine_types]
  choices:
    - text: Close the manual
      go_to: control-building
```

### Simulation Gates

The key mechanic. A passage can launch a simulation and require a result before proceeding.

```yaml
turbine-challenge:
  text: |
    The console is alive now. Three turbine bays are visible
    through the window. The system is asking you to select
    the right turbine for current conditions.
  simulation:
    id: hydro-turbine-select # Simulation component ID
    params: # Initial parameters passed to sim
      head: 45
      flow_rate: 120
      available_turbines: [francis, pelton, kaplan]
    gate: # What constitutes success
      condition: turbine_selected_correctly
      on_success:
        go_to: turbine-running
        set_flags: [hydro.turbine_restored]
        text: |
          The turbine spins up. A deep hum fills the hall.
          Through the window, you see water surging through
          the penstock.
      on_failure:
        go_to: turbine-challenge-retry
        text: |
          The turbine shudders and stops. Something wasn't right.
          The manual might have the answer.
```

### Mini-Game Integration

Same pattern as simulations, but referencing an external app.

```yaml
converter-puzzle:
  text: |
    A chalkboard on the wall is covered in half-erased
    calculations. The numbers don't add up.
  minigame:
    id: crazy-converter # External app ID
    mode: iframe # or "component"
    params:
      prompt: "How many liters per second to generate 5 MW at 30m head?"
    gate:
      condition: correct_answer
      on_success:
        go_to: pump-room-unlocked
        set_flags: [hydro.converter_solved]
```

### Area Transitions

Moving between areas (e.g., hub to hydro):

```yaml
# In hub.yaml
hydro-portal:
  text: |
    A heavy door with a faded blue label: HYDROELECTRIC.
    A transport car waits on a narrow track beyond it.
  choices:
    - text: Take the transport to the hydro plant
      go_to: hydro:arrival # area:passage syntax
      require: { all: [hub.hydro_unlocked] }
    - text: The door is locked
      go_to: hydro-portal-locked
      require: { not: [hub.hydro_unlocked] }
```

### Passage Variants

Sometimes a passage should read differently based on state:

```yaml
powerhouse-overlook:
  variants:
    - require: { not: [hydro.turbine_restored] }
      text: |
        The penstock runs silent up the slope. No water moves
        through the turbine hall.
    - require: { all: [hydro.turbine_restored] }
      text: |
        Water roars through the penstock. The turbine is alive again.
        You can feel the vibration in the railing.
      ambient: water-roar, turbine-hum
  choices:
    - text: Return to the control building
      go_to: control-building
```

## Conditions Reference

Conditions use a simple expression model:

```yaml
# All flags must be set
require: { all: [flag_a, flag_b] }

# Any flag must be set
require: { any: [flag_a, flag_b] }

# Flags must NOT be set
require: { not: [flag_a, flag_b] }

# Player must have items
require: { items: [flashlight, keycard] }

# Combine (all conditions must be true)
require:
  all: [read_ops_manual]
  items: [flashlight]
  not: [already_tried_console]
```

## State Model

The engine tracks:

| State              | Type                | Scope  | Persistence |
| ------------------ | ------------------- | ------ | ----------- |
| Current passage    | `area:passage`      | Global | Saved       |
| Flags              | `Set<string>`       | Global | Saved       |
| Items              | `Map<id, Item>`     | Global | Saved       |
| Documents found    | `Set<id>`           | Global | Saved       |
| Simulation results | `Map<id, result>`   | Global | Saved       |
| Visited passages   | `Set<area:passage>` | Global | Saved       |

All state is serializable to JSON for save/load.

## Conventions

- **Passage IDs** — kebab-case, unique within an area: `control-building`, `turbine-hall-lit`
- **Cross-area references** — `area:passage` syntax: `hydro:arrival`, `hub:main-hall`
- **Flag names** — dot-scoped: `hydro.read_ops_manual`, `hub.hydro_unlocked`
- **Item IDs** — flat kebab-case: `flashlight`, `reactor-keycard`
- **Simulation IDs** — match Vue component names: `hydro-turbine-select`, `ap1000-startup`
- **Image paths** — relative to an assets directory: `hydro/arrival-overlook.jpg`
