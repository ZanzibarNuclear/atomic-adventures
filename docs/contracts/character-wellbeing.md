# Character Wellbeing

**Scope:** Character stats, food, water, time drift, thresholds, health effects,
and future tuning for player survival pressure.

Atomic Adventures currently has early wellbeing mechanics: health, hunger, and
thirst are authored stats; game time can drift those stats; consumable item
actions can change them; thresholds can apply health effects over time. The
player-facing model is now broader than those legacy stats: the character
overview should present positive vitals, named condition states, and health as
the result of sustained or severe problems rather than as a duplicate of every
need meter.

## Player-Facing Model

Character overview vitals follow one rule:

**Higher bar = better condition.**

The preferred visible vitals are:

- `Health` — current physical condition. Higher is better.
- `Satiety` — food reserve / how fed Zanzibar is. Higher is better.
- `Hydration` — water reserve / how hydrated Zanzibar is. Higher is better.
- `Rested` — fatigue and sleep reserve. Higher is better.
- `Composure` — emotional steadiness. Higher is better.

Use words alongside or instead of numbers where words are clearer. Examples:

- Health: healthy, stable, weak, critical, collapsed.
- Satiety: sated, fed, hungry, very hungry, starving.
- Hydration: hydrated, okay, thirsty, dehydrated, severely dehydrated.
- Rested: rested, tired, exhausted, spent.
- Composure: calm, alert, nervous, scared, panicked.

Avoid showing a large badness meter such as `Hunger 90 / 100` in the overview.
If the underlying stat is negative-pressure, translate it into a positive
reserve before rendering it.

## Legacy Stat Compatibility

The current authored content still stores:

- `health` as a positive meter where `100` is healthy.
- `hunger` as a negative-pressure meter where higher is worse.
- `thirst` as a negative-pressure meter where higher is worse.

Until content migrates, the overview derives:

```text
Satiety = hunger.max - hunger.value + hunger.min
Hydration = thirst.max - thirst.value + thirst.min
```

Effects and drift may continue to modify `hunger` and `thirst` directly. The
display layer is responsible for translating them into `Satiety` and
`Hydration`.

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

## Health, Max Health, And Penalties

Health should not drop at the first sign of hunger, thirst, fear, or fatigue.
Needs should have forgiving ranges, then warning states, then sustained harm.

Use thresholds and time:

- Mild hunger or thirst should change labels and possibly story affordances, not
  immediately damage health.
- Severe dehydration should affect health sooner and faster than starvation.
- Starvation should develop slowly over days, first reducing energy and recovery
  before causing serious health loss.
- Exhaustion should reduce action quality and recovery before directly harming
  health.
- Extreme panic or stress should mostly affect choices, precision, learning,
  perception, or simulation performance; direct health effects should be rare.

The preferred future health model has both current and maximum health:

```text
Current Health: 72 / 86
```

Maximum health can be lowered by sustained or serious problems:

- dehydration;
- starvation;
- exhaustion;
- injury;
- poison or sickness;
- extreme environmental exposure.

Current health should recover only up to the current max. Eating, drinking,
resting, treatment, or calmer circumstances can raise the max again.

The current implementation only has a single `health` meter. Until max health is
implemented, threshold effects may apply direct health drift for severe states,
but the player-facing language should still explain why health is changing.

## Conditions

Conditions are named states, not ordinary percentage bars. The overview should
use words such as:

- injured: no injuries, bruised, minor injury, moderate injury, severe injury;
- poisoned: no poison, mild poison, poisoned, dangerously poisoned;
- sick: no sickness, under the weather, sick, severely sick.

Conditions may influence:

- maximum health;
- current health drift;
- recovery rate;
- action difficulty;
- travel or interaction restrictions;
- fatigue or composure drift.

Do not show ambiguous labels such as `Poison 37` unless a future simulation
gives that number direct player meaning.

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

Health is affected by more than food and water. Health influences may include:

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

Current time advancement accepts an activity profile. The broader game-time
contract, including clock state, action durations, and simulation time, lives
in [time.md](time.md). Progression milestones are defined in
[milestones.md](milestones.md).

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
- Vitals should render in one direction: higher means better.
- Conditions should use named severity states rather than unexplained amounts.
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
