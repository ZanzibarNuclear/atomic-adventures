# Character Wellbeing

**Scope:** Character stats, food, water, time drift, thresholds, health effects,
and future tuning for player survival pressure.

Atomic Adventures currently has early wellbeing mechanics: health, hunger, and
thirst are authored stats; game time can drift those stats; consumable item
actions can change them; thresholds can apply health effects over time. This
contract captures the intended direction and open design questions without
requiring final survival-balance rules yet.

## Current Model

Zanzibar has three visible wellbeing stats:

- `health` is a meter where higher is better. `100` is healthy.
- `hunger` is a meter where higher is worse.
- `thirst` is a meter where higher is worse.

Consumables can apply character effects:

```yaml
actions:
  - id: eat
    label: Eat energy bar
    effects:
      - { op: stat.add, id: hunger, value: -18 }
```

Time can increase need meters by activity profile:

```yaml
drift:
  perGameHour:
    resting: 1.5
    light: 3
    moderate: 5
    strenuous: 8
```

Thresholds can describe states and apply effects:

```yaml
thresholds:
  - at: 90
    state: starving
    effectsPerGameHour:
      - { op: stat.add, id: health, value: -2 }
```

## Meter Semantics

The current UI shows health, hunger, and thirst as comparable meters, but their
directions differ. This is potentially confusing:

- Health at `100` is good.
- Hunger at `100` is bad.
- Thirst at `100` is bad.

Future UI should make meter direction explicit. Possible approaches:

- Add stat metadata such as `direction: higher-is-better` or
  `direction: lower-is-better` and render colors/labels accordingly.
- Rename or reframe badness meters into positive reserves, such as `satiety` or
  `hydration`, where higher is better.
- Keep hunger/thirst as negative-pressure meters but label them clearly as
  needs or hazards rather than presenting them like health.

The existing character content already uses `direction` in places; future UI
should honor it consistently.

## Daily Needs

The character document should eventually support authored daily targets:

```yaml
wellbeing:
  caloriesPerDay: 2400
  waterMlPerDay: 2500
```

These targets should describe Zanzibar's baseline needs. Activity, temperature,
injury, illness, clothing, and environmental conditions may modify them.

Open questions:

- Should calories and water be tracked as daily intake totals, as reservoir
  meters, or both?
- Should hunger/thirst drift be derived from calorie and water deficits instead
  of authored directly per stat?
- At what time boundary does the game evaluate daily targets?
- How forgiving should the system be in an educational adventure, where survival
  pressure should create stakes but not dominate exploration?

## Intake And Overconsumption

Food and water are not only “reduce hunger/thirst” buttons. Future mechanics
may include:

- calorie values;
- hydration values;
- satiety or fullness;
- electrolytes/salt;
- spoilage or contamination;
- caffeine or medication effects;
- overconsumption penalties.

Overeating or drinking too much water should be possible to model, but it
should not become tedious. Potential effects include nausea, slowed activity,
reduced focus, or health impact in extreme cases.

## Health Sources

Health is affected by more than hunger and thirst. Future health influences may
include:

- injury from falls, electrical hazards, sharp tools, or failed equipment work;
- cold, heat, wet clothing, and exposure;
- illness or contaminated food/water;
- exhaustion and sleep debt;
- stress or panic;
- radiation or industrial hazards in later parts;
- medical supplies and rest.

Health effects should be explainable to the player. Avoid hidden punishment
from systems the player has not had a fair chance to understand.

## Activity And Time

Current time advancement accepts an activity profile:

- `resting`
- `light`
- `moderate`
- `strenuous`

Future tuning should consider whether activities should affect:

- calorie burn;
- water loss;
- fatigue;
- injury risk;
- recovery rate;
- travel speed or action duration.

The game should prefer authored, understandable activity costs over opaque
simulation precision.

## Tuning Principles

- Wellbeing should support story tension and grounded decision-making, not turn
  the game into a survival spreadsheet.
- Early Part I should be forgiving while teaching the vocabulary: health, food,
  water, exertion, rest.
- Consumable numbers should be easy to author and easy to explain.
- Thresholds should use clear player-facing states: thirsty, dehydrated,
  hungry, starving, exhausted, injured.
- Death or irreversible failure should be rare and intentionally designed.

## Areas To Explore

- A dedicated `wellbeing` block in the character document for daily targets and
  tuning constants.
- UI treatments for meters with opposite directions.
- Derived hunger/thirst from calorie and water balance.
- Fullness and safe water-intake bounds.
- Fatigue/sleep as a separate axis from health.
- Environmental modifiers such as heat, cold, rain, and exertion.
- Clear feedback when an item action affects multiple stats.
- Save compatibility when wellbeing formulas change.

