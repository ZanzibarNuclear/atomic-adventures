<script setup>
import { computed, watch } from "vue";
import BuilderBtnIcon from "../builder/BuilderBtnIcon.vue";
import PublicImagePicker from "./PublicImagePicker.vue";

const COMPARE_OPS = [
  { id: "gte", label: "at least" },
  { id: "lte", label: "at most" },
  { id: "eq", label: "exactly" },
  { id: "gt", label: "more than" },
  { id: "lt", label: "less than" },
];

const props = defineProps({
  draft: { type: Object, required: true },
  entry: { type: Object, required: true },
});

const maxRankCount = computed(() => Math.max(1, Number(props.entry.maxRank) || 1));

watch(
  () => props.entry.mode,
  (mode, previousMode) => {
    if (mode === "ranked" || previousMode !== "ranked") return;
    props.entry.maxRank = 1;
    for (const award of props.entry.practice?.awards ?? []) award.rank = 1;
  },
);

function ensurePractice() {
  const entry = props.entry;
  entry.practice ??= { evidence: [], awards: [] };
  entry.practice.evidence ??= [];
  entry.practice.awards ??= [];
  return entry.practice;
}

function addEvidence() {
  const evidence = ensurePractice().evidence;
  evidence.push({
    id: uniqueId("evidence", evidence),
    label: "",
    target: 1,
  });
}

function removeEvidence(index) {
  ensurePractice().evidence.splice(index, 1);
}

function addAward() {
  const awards = ensurePractice().awards;
  const nextRank = props.entry.mode === "ranked"
    ? Math.min(props.entry.maxRank, awards.length + 1)
    : 1;
  awards.push({
    rank: nextRank,
    earnedText: "",
    badge: null,
    require: emptyRequire(),
  });
}

function removeAward(index) {
  ensurePractice().awards.splice(index, 1);
}

function emptyRequire() {
  return {
    knowledge: { all: [] },
    skills: [],
    evidence: [],
  };
}

function awardRequire(award) {
  award.require ??= emptyRequire();
  award.require.knowledge ??= { all: [] };
  award.require.knowledge.all ??= [];
  award.require.skills ??= [];
  award.require.evidence ??= [];
  return award.require;
}

function requireSkills(award) {
  return award.require?.skills ?? [];
}

function requireEvidence(award) {
  return award.require?.evidence ?? [];
}

function rankLabel(index) {
  return props.entry.rankLabels?.[index] ?? "";
}

function setRankLabel(index, value) {
  const labels = [...(props.entry.rankLabels ?? [])];
  while (labels.length <= index) labels.push("");
  labels[index] = value;
  props.entry.rankLabels = labels;
}

function knowledgeSelected(award, id) {
  return (award.require?.knowledge?.all ?? []).includes(id);
}

function toggleKnowledge(award, id) {
  const all = awardRequire(award).knowledge.all;
  const index = all.indexOf(id);
  if (index >= 0) all.splice(index, 1);
  else all.push(id);
}

function addSkillRequire(award) {
  const other = (props.draft.skills ?? []).find((skill) => skill.id !== props.entry.id);
  awardRequire(award).skills.push({
    id: other?.id ?? "",
    op: "gte",
    rank: 1,
  });
}

function addEvidenceRequire(award) {
  const first = ensurePractice().evidence[0];
  awardRequire(award).evidence.push({
    id: first?.id ?? "",
    op: "gte",
    value: first?.target ?? 1,
  });
}

function uniqueId(prefix, entries) {
  const used = new Set(entries.map((entry) => entry.id));
  let index = entries.length + 1;
  let id = `${prefix}-${index}`;
  while (used.has(id)) {
    index += 1;
    id = `${prefix}-${index}`;
  }
  return id;
}
</script>

<template>
  <section class="field-panel">
    <div class="section-heading">
      <h4>Skill behavior</h4>
      <code>{{ entry.mode }}</code>
    </div>
    <div class="field-grid">
      <label>Mode
        <select v-model="entry.mode">
          <option value="acquired">Acquired — present or not</option>
          <option value="ranked">Ranked — practice raises a rank</option>
        </select>
      </label>
      <label v-if="entry.mode === 'ranked'">Maximum rank
        <input v-model.number="entry.maxRank" type="number" min="1">
      </label>
    </div>
    <div v-if="entry.mode === 'ranked'" class="rank-labels">
      <p class="hint">One label per rank, shown on the character sheet.</p>
      <label v-for="index in maxRankCount" :key="index">
        Rank {{ index }}
        <input
          :value="rankLabel(index - 1)"
          :placeholder="`Rank ${index}`"
          @input="setRankLabel(index - 1, $event.target.value)">
      </label>
    </div>
  </section>

  <section class="field-panel">
    <div class="section-heading">
      <h4>Practice evidence</h4>
      <code>{{ (entry.practice?.evidence ?? []).length }}</code>
    </div>
    <p class="hint">
      Optional counters such as operating days. Gameplay effects add to these;
      awards can require a count.
    </p>
    <article
      v-for="(evidence, index) in (entry.practice?.evidence ?? [])"
      :key="index"
      class="editor-card">
      <div class="field-grid">
        <label>ID<input v-model="evidence.id" placeholder="operating-days"></label>
        <label>Label<input v-model="evidence.label" placeholder="Successful operating days"></label>
        <label>Target
          <input v-model.number="evidence.target" type="number" min="1">
        </label>
      </div>
      <button type="button" class="sm danger-outline" @click="removeEvidence(index)">
        <BuilderBtnIcon name="remove" />
        Remove evidence
      </button>
    </article>
    <button type="button" class="sm add-btn" @click="addEvidence">
      <BuilderBtnIcon name="add" />
      Add evidence
    </button>
  </section>

  <section class="field-panel">
    <div class="section-heading">
      <h4>{{ entry.mode === "ranked" ? "Rank awards" : "When earned" }}</h4>
      <code>{{ (entry.practice?.awards ?? []).length }}</code>
    </div>
    <p class="hint">
      After an effect list commits, ranks are granted when these requirements
      are already true. Leave this empty to award the skill only with an
      explicit skill.acquire effect.
    </p>
    <article
      v-for="(award, index) in (entry.practice?.awards ?? [])"
      :key="index"
      class="editor-card">
      <div class="field-grid">
        <label v-if="entry.mode === 'ranked'">Rank
          <input v-model.number="award.rank" type="number" min="1" :max="entry.maxRank">
        </label>
        <label class="wide">Earned text
          <input v-model="award.earnedText" placeholder="Learned to purify water">
        </label>
        <PublicImagePicker
          class="wide"
          :model-value="award.badge ?? ''"
          folder="badges"
          label="Badge image"
          placeholder="badges/..."
          @update:model-value="award.badge = $event || null" />
      </div>

      <fieldset v-if="draft.knowledge.length" class="require-set">
        <legend>Requires knowledge</legend>
        <label
          v-for="knowledge in draft.knowledge"
          :key="knowledge.id"
          class="check-field">
          <input
            type="checkbox"
            :checked="knowledgeSelected(award, knowledge.id)"
            @change="toggleKnowledge(award, knowledge.id)">
          {{ knowledge.label || knowledge.id }}
        </label>
      </fieldset>

      <fieldset class="require-set">
        <legend>Requires other skills</legend>
        <div
          v-for="(condition, conditionIndex) in requireSkills(award)"
          :key="conditionIndex"
          class="condition-row">
          <select v-model="condition.id">
            <option
              v-for="skill in draft.skills.filter((skill) => skill.id !== entry.id)"
              :key="skill.id"
              :value="skill.id">
              {{ skill.label || skill.id }}
            </option>
          </select>
          <select v-model="condition.op">
            <option v-for="op in COMPARE_OPS" :key="op.id" :value="op.id">{{ op.label }}</option>
          </select>
          <input v-model.number="condition.rank" type="number" min="1" aria-label="Required rank">
          <button
            type="button"
            class="sm danger-outline"
            @click="awardRequire(award).skills.splice(conditionIndex, 1)">
            <BuilderBtnIcon name="remove" />
            Remove
          </button>
        </div>
        <button type="button" class="sm add-btn" @click="addSkillRequire(award)">
          <BuilderBtnIcon name="add" />
          Add skill requirement
        </button>
      </fieldset>

      <fieldset v-if="(entry.practice?.evidence ?? []).length" class="require-set">
        <legend>Requires evidence</legend>
        <div
          v-for="(condition, conditionIndex) in requireEvidence(award)"
          :key="conditionIndex"
          class="condition-row">
          <select v-model="condition.id">
            <option
              v-for="evidence in (entry.practice?.evidence ?? [])"
              :key="evidence.id"
              :value="evidence.id">
              {{ evidence.label || evidence.id }}
            </option>
          </select>
          <select v-model="condition.op">
            <option v-for="op in COMPARE_OPS" :key="op.id" :value="op.id">{{ op.label }}</option>
          </select>
          <input v-model.number="condition.value" type="number" min="1" aria-label="Required count">
          <button
            type="button"
            class="sm danger-outline"
            @click="awardRequire(award).evidence.splice(conditionIndex, 1)">
            <BuilderBtnIcon name="remove" />
            Remove
          </button>
        </div>
        <button type="button" class="sm add-btn" @click="addEvidenceRequire(award)">
          <BuilderBtnIcon name="add" />
          Add evidence requirement
        </button>
      </fieldset>

      <button type="button" class="sm danger-outline" @click="removeAward(index)">
        <BuilderBtnIcon name="remove" />
        Remove award
      </button>
    </article>
    <button type="button" class="sm add-btn" @click="addAward">
      <BuilderBtnIcon name="add" />
      Add award
    </button>
  </section>
</template>

<style scoped>
.hint {
  margin: 0;
  color: #8f98a6;
  font-size: 0.78rem;
  line-height: 1.4;
}
.rank-labels,
.editor-card {
  display: grid;
  gap: 0.65rem;
}
.editor-card {
  padding: 0.7rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #202733;
}
.wide {
  grid-column: 1 / -1;
}
.require-set {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding: 0.65rem;
  border: 1px solid #3b4557;
  border-radius: 8px;
}
.require-set legend {
  color: #8bc49a;
  padding: 0 0.35rem;
}
.condition-row {
  display: grid;
  grid-template-columns: minmax(8rem, 1.4fr) minmax(6rem, 0.8fr) 5rem auto;
  gap: 0.45rem;
  align-items: end;
}
@media (max-width: 720px) {
  .condition-row {
    grid-template-columns: 1fr;
  }
}
</style>
