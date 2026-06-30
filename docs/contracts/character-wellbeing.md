# Character Wellbeing

**Scope:** Character stats, food, water, time drift, thresholds, health effects,
and future tuning for player survival pressure.

Atomic Adventures wellbeing is authored as positive reserve stats: health,
satiety, hydration, energy, and composure. Game time can drift those stats,
consumable item actions can change them, and thresholds can apply health effects
or other consequences over time. The character overview presents positive
vitals, named condition states, and health as the result of sustained or severe
problems rather than as a duplicate of every need meter.

## Player-Facing Model

Character overview vitals follow one rule:

**Higher bar = better condition.**

The preferred visible vitals are:

- `Health` — current physical condition. Higher is better.
- `Satiety` — food reserve / how fed Zanzibar is. Higher is better.
- `Hydration` — water reserve / how hydrated Zanzibar is. Higher is better.
- `Energy` — fatigue and sleep reserve. Higher is better.
- `Composure` — emotional steadiness. Higher is better.

Use words alongside or instead of numbers where words are clearer. Examples:

- Health: healthy, stable, weak, critical, collapsed.
- Satiety: sated, fed, hungry, very hungry, starving.
- Hydration: hydrated, okay, thirsty, dehydrated, severely dehydrated.
- Energy: rested, tired, exhausted, spent.
- Composure: calm, alert, nervous, scared, panicked.

Those player-facing words are authored per stat with `displayStates`. Each
entry is a minimum reserve value for that label and tone:

```yaml
displayStates:
  - { at: 80, state: rested, tone: positive }
  - { at: 50, state: tired, tone: warning }
  - { at: 25, state: exhausted, tone: error }
  - { at: 5, state: spent, tone: error }
  - { at: 0, state: asleep on feet, tone: error }
```

Vitals do not need identical display bands. Health might enter `critical` at
`5`, while satiety, hydration, energy, and composure can use their own authored
labels and cutoffs.

Avoid showing a large badness meter such as `Hunger 90 / 100` in the overview.
Author the positive reserve directly as `satiety` or `hydration`; do not keep an
inverse internal meter and translate it in the display layer.

Consumables can apply character effects:

```yaml
actions:
  - id: eat
    label: Eat energy bar
    effects:
      - { op: stat.add, id: satiety, value: 18 }
```

Time can reduce reserve meters by activity profile:

```yaml
drift:
  perGameHour:
    resting: -1.5
    light: -3
    moderate: -5
    strenuous: -8
```

Thresholds can describe states and apply effects:

```yaml
thresholds:
  - at: 10
    state: starving
    effectsPerGameHour:
      - { op: stat.add, id: health, value: -2 }
```

For positive reserve stats, thresholds are low-water marks: a threshold with
`at: 10` applies when the reserve is `10` or lower. Crises happen as important
reserves run out.

`displayStates` and `thresholds` are related but separate:

- `displayStates` names what the player sees at the current reserve value.
- `thresholds` apply authored gameplay consequences over time.

Do not assume every visible state must have a gameplay effect, or that every
gameplay threshold must be a displayed state.

## Health, Max Health, And Penalties

Health should not drop at the first sign of low satiety, low hydration, fear, or fatigue.
Needs should have forgiving ranges, then warning states, then sustained harm.

Use thresholds and time:

- Mild satiety or hydration pressure should change labels and possibly story
  affordances, not immediately damage health.
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
- Should satiety/hydration drift be derived from calorie and water deficits
  instead of authored directly per stat?
- At what time boundary does the game evaluate daily targets?
- How forgiving should the system be in an educational adventure, where survival
  pressure should create stakes but not dominate exploration?

## Intake And Overconsumption

Food and water are not only “fill the reserve” buttons. Future mechanics
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
- Derived satiety/hydration from calorie and water balance.
- Fullness and safe water-intake bounds.
- Fatigue/sleep as a separate axis from health.
- Environmental modifiers such as heat, cold, rain, and exertion.
- Clear feedback when an item action affects multiple stats.
- Clear replacement steps when wellbeing formulas change, followed by deleting
  the superseded path.
