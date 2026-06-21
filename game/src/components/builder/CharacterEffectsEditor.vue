<script setup>
const EFFECT_OPERATIONS = [
  "flag.set", "flag.clear",
  "item.add", "item.remove",
  "stat.set", "stat.add",
  "knowledge.acquire", "knowledge.forget",
  "skill.acquire", "skill.set-rank", "skill.add-rank", "skill.add-evidence",
  "quest.make-available", "quest.start", "quest.set-status",
  "quest.advance-objective", "quest.complete-objective",
  "document.discover", "document.mark-read",
];

const QUEST_STATUSES = ["unavailable", "available", "active", "completed", "failed", "abandoned"];

const props = defineProps({
  effects: { type: Array, required: true },
  characterCatalog: { type: Object, required: true },
  addLabel: { type: String, default: "Add effect" },
});

function addEffect() {
  props.effects.push({ op: "flag.set", id: "" });
}

function removeEffect(index) {
  props.effects.splice(index, 1);
}

function effectDomain(effect) {
  return String(effect.op ?? "").split(".")[0];
}

function catalogKey(effect) {
  const domain = effectDomain(effect);
  return domain === "item" ? "items"
    : domain === "stat" ? "stats"
      : domain === "skill" ? "skills"
        : domain === "quest" ? "quests"
          : domain === "document" ? "documents"
            : domain;
}

function effectCatalog(effect) {
  return props.characterCatalog[catalogKey(effect)] ?? [];
}

function selectedDefinition(effect) {
  return effectCatalog(effect).find((entry) => entry.id === effect.id) ?? null;
}

function skillEvidence(effect) {
  return selectedDefinition(effect)?.practice?.evidence ?? [];
}

function questObjectives(effect) {
  return selectedDefinition(effect)?.objectives ?? [];
}

function setEffectOperation(effect, op) {
  effect.op = op;
  const domain = effectDomain(effect);
  if (domain === "flag") effect.id = "";
  else effect.id = effectCatalog(effect)[0]?.id ?? "";
  initializeEffectFields(effect);
}

function setEffectId(effect, id) {
  effect.id = id;
  initializeEffectFields(effect);
}

function initializeEffectFields(effect) {
  const op = effect.op ?? "";
  delete effect.evidence;
  delete effect.objective;
  delete effect.status;
  if (!op.startsWith("item.")) delete effect.quantity;
  if (!op.startsWith("stat.") && op !== "skill.add-evidence" && op !== "quest.advance-objective") {
    delete effect.value;
  }
  if (!op.includes("rank")) delete effect.rank;

  if (op.startsWith("item.")) effect.quantity ??= 1;
  if (op.startsWith("stat.")) effect.value ??= 0;
  if (op.includes("rank")) effect.rank ??= 1;
  if (op === "skill.add-evidence") {
    effect.evidence = skillEvidence(effect)[0]?.id ?? "";
    effect.value ??= 1;
  }
  if (op === "quest.set-status") effect.status = effect.status ?? "active";
  if (op === "quest.advance-objective" || op === "quest.complete-objective") {
    effect.objective = questObjectives(effect)[0]?.id ?? "";
  }
  if (op === "quest.advance-objective") effect.value ??= 1;
}
</script>

<template>
  <div class="effects-editor">
    <article
      v-for="(effect, effectIndex) in effects"
      :key="effectIndex"
      class="effect-row">
      <select :value="effect.op" @change="setEffectOperation(effect, $event.target.value)">
        <option v-for="op in EFFECT_OPERATIONS" :key="op" :value="op">{{ op }}</option>
      </select>

      <input
        v-if="effectDomain(effect) === 'flag'"
        v-model="effect.id"
        placeholder="flag.id">
      <select
        v-else
        :value="effect.id"
        @change="setEffectId(effect, $event.target.value)">
        <option v-for="entry in effectCatalog(effect)" :key="entry.id" :value="entry.id">
          {{ entry.label ?? entry.title }} ({{ entry.id }})
        </option>
      </select>

      <input
        v-if="effectDomain(effect) === 'item'"
        v-model.number="effect.quantity"
        type="number"
        min="1"
        placeholder="quantity">
      <input
        v-if="effectDomain(effect) === 'stat'"
        v-model.number="effect.value"
        type="number"
        placeholder="value">
      <input
        v-if="effectDomain(effect) === 'skill' && effect.op.includes('rank')"
        v-model.number="effect.rank"
        type="number"
        placeholder="rank">
      <select v-if="effect.op === 'skill.add-evidence'" v-model="effect.evidence">
        <option v-for="entry in skillEvidence(effect)" :key="entry.id" :value="entry.id">
          {{ entry.label ?? entry.id }} ({{ entry.id }})
        </option>
      </select>
      <input
        v-if="effect.op === 'skill.add-evidence'"
        v-model.number="effect.value"
        type="number"
        min="1"
        placeholder="evidence value">
      <select v-if="effect.op === 'quest.set-status'" v-model="effect.status">
        <option v-for="status in QUEST_STATUSES" :key="status" :value="status">{{ status }}</option>
      </select>
      <select
        v-if="effect.op === 'quest.advance-objective' || effect.op === 'quest.complete-objective'"
        v-model="effect.objective">
        <option v-for="objective in questObjectives(effect)" :key="objective.id" :value="objective.id">
          {{ objective.label ?? objective.id }} ({{ objective.id }})
        </option>
      </select>
      <input
        v-if="effect.op === 'quest.advance-objective'"
        v-model.number="effect.value"
        type="number"
        min="1"
        placeholder="progress">

      <button type="button" class="sm muted" @click="removeEffect(effectIndex)">
        Remove
      </button>
    </article>

    <button type="button" class="sm" @click="addEffect">{{ addLabel }}</button>
  </div>
</template>

<style scoped>
.effects-editor {
  display: grid;
  gap: 0.6rem;
}
.effect-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr)) auto;
  gap: 0.5rem;
  align-items: center;
}
</style>
