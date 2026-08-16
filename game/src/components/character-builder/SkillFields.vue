<script setup>
import { watch } from "vue";
import BuilderBtnIcon from "../builder/BuilderBtnIcon.vue";

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

watch(
  () => props.entry,
  (entry) => {
    entry.practice ??= { evidence: [], awards: [] };
    entry.practice.evidence ??= [];
    entry.practice.awards ??= [];
    entry.rankLabels ??= [];
    if (entry.mode === "ranked") syncRankLabels(entry);
    else entry.maxRank = Math.max(1, Number(entry.maxRank) || 1);
  },
  { immediate: true },
);

watch(
  () => [props.entry.mode, props.entry.maxRank],
  () => {
    if (props.entry.mode === "ranked") syncRankLabels(props.entry);
    else {
      props.entry.maxRank = 1;
      for (const award of props.entry.practice?.awards ?? []) award.rank = 1;
    }
  },
);

function syncRankLabels(entry) {
  const count = Math.max(1, Number(entry.maxRank) || 1);
  entry.maxRank = count;
  const labels = [...(entry.rankLabels ?? [])];
  while (labels.length < count) labels.push("");
  entry.rankLabels = labels.slice(0, count);
}

function addEvidence() {
  const evidence = props.entry.practice.evidence;
  evidence.push({
    id: uniqueId("evidence", evidence),
    label: "",
    target: 1,
  });
}

function removeEvidence(index) {
  props.entry.practice.evidence.splice(index, 1);
}

function addAward() {
  const awards = props.entry.practice.awards;
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
  props.entry.practice.awards.splice(index, 1);
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

function knowledgeSelected(award, id) {
  return awardRequire(award).knowledge.all.includes(id);
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
  const first = props.entry.practice.evidence[0];
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
      <label v-for="(_, index) in entry.rankLabels" :key="index">
        Rank {{ index + 1 }}
        <input v-model="entry.rankLabels[index]" :placeholder="`Rank ${index + 1}`">
      </label>
    </div>
  </section>

  <section class="field-panel">
    <div class="section-heading">
      <h4>Practice evidence</h4>
      <code>{{ entry.practice.evidence.length }}</code>
    </div>
    <p class="hint">
      Optional counters such as operating days. Gameplay effects add to these;
      awards can require a count.
    </p>
    <article
      v-for="(evidence, index) in entry.practice.evidence"
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
      <code>{{ entry.practice.awards.length }}</code>
    </div>
    <p class="hint">
      After an effect list commits, ranks are granted when these requirements
      are already true. Leave this empty to award the skill only with an
      explicit skill.acquire effect.
    </p>
    <article
      v-for="(award, index) in entry.practice.awards"
      :key="index"
      class="editor-card">
      <div class="field-grid">
        <label v-if="entry.mode === 'ranked'">Rank
          <input v-model.number="award.rank" type="number" min="1" :max="entry.maxRank">
        </label>
        <label class="wide">Earned text
          <input v-model="award.earnedText" placeholder="Learned to purify water">
        </label>
        <label class="wide">Badge image
          <input v-model="award.badge" placeholder="optional public path">
        </label>
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
          v-for="(condition, conditionIndex) in awardRequire(award).skills"
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

      <fieldset v-if="entry.practice.evidence.length" class="require-set">
        <legend>Requires evidence</legend>
        <div
          v-for="(condition, conditionIndex) in awardRequire(award).evidence"
          :key="conditionIndex"
          class="condition-row">
          <select v-model="condition.id">
            <option
              v-for="evidence in entry.practice.evidence"
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
