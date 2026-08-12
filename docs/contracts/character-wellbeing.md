# Character Wellbeing

**Scope:** Character stats, food, water, time drift, thresholds, health effects,
and future tuning for player survival pressure.

Atomic Adventures wellbeing is authored as positive reserve stats such as
satiety, hydration, energy, and composure, plus condition/damage inputs such as
base health, injury, poison, and sickness. Game time can drift reserve stats,
consumable item actions can change them, and thresholds can apply health effects
or other consequences over time. The character overview presents positive
vitals, named condition states, and health as a calculated result of sustained
or severe problems rather than as a standalone need meter.

The playable game surfaces serious reserve states as **status sentences** on the
play panel (for example “Zanzibar is parched…”) and as meters in the **Health**
dialog / character overview. The game timestamp is a separate map HUD line.
Wellbeing chrome is not shown before a play mode is active. Health is a
calculated result used for crisis and failure, not a free-floating need meter on
the overview list (overview shows satiety, hydration, energy, composure, and
named conditions).

## Player-Facing Model

Character overview vitals follow one rule:

**Higher bar = better condition.**

The preferred visible vitals are:

- `Satiety` — food reserve / how fed Zanzibar is. Higher is better.
- `Hydration` — water reserve / how hydrated Zanzibar is. Higher is better.
- `Energy` — fatigue and sleep reserve. Higher is better.
- `Composure` — emotional steadiness. Higher is better.

Calculated health can still use words for failure logic, diagnostics, or
future presentation outside the vitals list: healthy, stable, weak, critical,
collapsed.

Use words alongside or instead of numbers where words are clearer. Examples:

- Satiety: stuffed, full, peckish, hungry, starving.
- Hydration: hydrated, thirsty, parched, dehydrated.
- Energy: energized, tired, exhausted, dozing, spent.
- Composure: calm, concerned, nervous, scared, panicked.

Those player-facing words are authored per stat with `displayStates`. Each
entry is a minimum reserve value for that label and tone:

```yaml
displayStates:
  - { at: 80, state: energized, tone: positive }
  - { at: 50, state: rested, tone: positive }
  - { at: 34, state: tired, tone: warning }
  - { at: 18, state: exhausted, tone: error }
  - { at: 1, state: barely awake, tone: error }
  - { at: 0, state: asleep uncontrollably, tone: error }
```

That yields the ranges: energized 80-100, rested 50-79, tired 34-49,
exhausted 18-33, barely awake 1-17, and asleep uncontrollably at 0.

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

### Topping off (partial consumption)

Wellbeing meters refuse consumption only when the **primary** recovery meter
is already at its **authored max** (not merely in the top display band such as
Hydrated or Stuffed). Soft refusals are enough:

- satiety max → "You're not hungry right now."
- hydration max → "You're not thirsty right now."
- energy max → "You're already well rested."

When the player is below max but a full sip/bite/meal would overshoot, the
engine spends only enough of the item to reach max (a top-off nibble/sip) and
leaves the remainder for later. Meals still gate on satiety as primary so a
full hydration bar does not block eating food that also adds a little water.

The same top-off rule applies to energy if rest/food restores it.

### Proactive rest breaks (character sheet)

The character **Health actions** card offers proactive breaks that advance
authored game time:

| Action | Target | Duration | Notes |
| --- | --- | --- | --- |
| **Eat** | satiety | item time | First food in hands → packs → nearby; auto-consumes (see quick consume) |
| **Drink** | hydration | item time | First drink in hands → packs → nearby; auto-consumes |
| **Rest** | energy | 15 min | Always available; **1×** energy unit (no energy change at 100%) |
| **Nap** | energy + composure | 30 min | Energy **2×** unit; composure **1×** composure unit (10% of max / hr) |
| **Sleep** | energy + composure | until ~80% energy | Energy **2×** unit; composure **3×** unit (30% of max / hr); nap tops off |
| **Meditate** | composure + energy | 10 / 20 / 30 min | Composure **2× sleep** (60% of max / hr); energy at **nap** rate |

Balancing knobs in `wellbeingActions.js`:

- `ENERGY_RECOVERY_UNIT_PER_HOUR` — Rest energy per game hour; Nap / Sleep /
  Meditate use `ENERGY_RECOVERY_MULTIPLIER` (1 / 2 / 2 / 2).
- `COMPOSURE_RECOVERY_UNIT_PERCENT_PER_HOUR` — Nap composure as % of max per
  hour; Sleep / Meditate use `COMPOSURE_RECOVERY_MULTIPLIER` (1 / 3 / 6), so
  sleep is 3× nap and meditate is 2× sleep.

Authored energy/composure drift still applies to other time advances; these
buttons apply the unit rates above so intentional recovery stays tunable.

### Quick Eat / Drink

**Eat** and **Drink** are hurry actions on the health card. They scan:

1. what the player is holding;
2. other carried containers (packs);
3. nearby world holders (ground / within reach).

The first matching food or beverage is transferred into hand if needed and
consumed with the default consume option (typically “all remaining” / full
unit). Matching uses action ids/labels (`eat` / `drink` / `sip`) and, as a
fallback, the primary positive meter effect (`satiety` vs `hydration`).

Feedback names the item and source (“You eat the Meal from your pack.”). If
nothing is found: “No food in reach.” / “No drink in reach.” Soft refuse when
the primary meter is already full. For choosier selection, use inventory.
Rules:

- Nap/Sleep refuse when energy is already full (soft: "You're already well rested.").
- Sleep also refuses when energy is already at or above 80% (suggest nap to top off).
- Rest is always allowed; at full energy it spends 15 minutes without changing energy.
- Rest/Nap/Sleep use `advanceGameTime(..., "resting")` for time and baseline
  energy drift; Nap adds an extra energy grant so net recovery is twice resting.
- Other resting drift (food/water decline) still applies during these breaks.
- Meditate advances resting time and grants a portion of composure.
- Opening the character sheet itself does not spend time; only these actions do.

Conditions on the health card list only **active** conditions as a compact
comma-separated line, or **None** when the player is fine.

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

## Calculated Health And Penalties

Health should not drop at the first sign of low satiety, low hydration, fear, or fatigue.
Needs should have forgiving ranges, then warning states, then sustained harm.

Use thresholds and time:

- Mild satiety or hydration pressure should change labels and possibly story
  affordances, not immediately damage health.
- Severe dehydration should affect health sooner and faster than starvation.
- Starvation should develop slowly over days, first reducing energy and recovery
  before causing serious health loss.
- Exhaustion should reduce action quality and recovery. At zero energy the
  player should have to sleep/rest before doing ordinary actions; low energy
  alone must not kill the character.
- Extreme panic or stress should affect choices, precision, learning,
  perception, or simulation performance; panic alone must not kill the
  character.

Health is calculated from authored inputs. The first implementation keeps a
hidden `health` input as the base physical condition for direct injury, poison,
sickness, or scripted damage, then subtracts tunable penalties from severe
survival and condition states. The visible health vital is derived from that
calculation.

Future health models may add both current and maximum health:

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
- exhaustion and sleep debt as action/recovery constraints;
- stress or panic as choice, precision, perception, or learning constraints;
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
- Story mode should have real survival pressure during the opening
  forest sequence. Wandering, backtracking, and strenuous shortcuts can consume
  time, hydration, satiety, and energy. The intended path should be forgiving,
  but repeatedly walking in circles can lead to serious impairment and
  eventually a clear failure state.
- Consumable numbers should be easy to author and easy to explain.
- Thresholds should use clear player-facing states: thirsty, parched, dehydrated,
  hungry, starving, exhausted, injured.
- Vitals should render in one direction: higher means better.
- Conditions should use named severity states rather than unexplained amounts.
- Death or irreversible failure should be rare and intentionally designed.

## Pre-empty crisis alerts

When satiety, hydration, or calculated health enters the **display band just
above empty** (for example Parched before Dehydrated, Hungry before Starving,
Critical before Collapsed), the playable game shows a one-shot **information
modal** with a clear instruction (drink, eat, tend injuries). Dismissing the
modal does not change stats; it only acknowledges the warning.

- Energy at zero is **not** a failure: force rest / sleep mode instead of a
  death modal. A pre-empty energy warning is optional later.
- Composure at panic is **not** fatal; later work should distort available
  actions and perception rather than ending the game.
- Collapse / empty health is the irreversible failure panel (restart or new
  game), not the pre-empty warning.
  The first playable slice may include a simple "You lose. Play again?" outcome when calculated
  health reaches zero through sustained neglect, dehydration, starvation,
  poison, injury, sickness, or other physical harm.

## Opening Survival Pressure

The first Story mode concern is survival, not hydro startup. Zanzibar begins
lost in the forest, low on food and water, and moving by instinct. The
wellbeing system should make this situation matter without punishing normal
story progression.

Minimum behavior:

- the vitals bar and character overview update as game-time actions change
  reserves and derived health;
- travel and authored actions advance time with an activity profile;
- time drift reduces relevant reserves such as hydration, satiety, and energy;
- low reserves surface clear warning states in the character/status UI and may
  influence story beats;
- reaching zero energy forces rest/sleep before ordinary actions continue;
- calculated health reaching zero triggers a failure scene;
- food, water, shelter, and rest discovered in the utility station can resolve
  the first crisis.

The exact drift numbers are tuning data, not contract constants. Tune them so
canonical progress is tense but survivable, while
excessive wandering or repeated nonproductive actions can fail.

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
