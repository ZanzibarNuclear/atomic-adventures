<script setup>
const COMPARE_OPS = {
  gte: "at least",
  lte: "at most",
  eq: "exactly",
  gt: "more than",
  lt: "less than",
};
const ACTIVITIES = [
  { id: "resting", label: "Resting" },
  { id: "light", label: "Light" },
  { id: "moderate", label: "Moderate" },
  { id: "strenuous", label: "Strenuous" },
];

const props = defineProps({
  draft: { type: Object, required: true },
  catalog: { type: String, required: true },
  entry: { type: Object, required: true },
});

function groupLabel(kind, id) {
  if (!id) return "None";
  const groups = props.draft.panel?.[kind] ?? [];
  return groups.find((group) => group.id === id)?.label || id;
}

function catalogLabel(kind, id) {
  const list = props.draft[kind] ?? [];
  const match = list.find((item) => item.id === id);
  return match?.label || match?.title || id;
}

function formatNumber(value) {
  if (value == null || value === "") return "none";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return String(Number(number.toFixed(3)));
}

function compareLabel(op) {
  return COMPARE_OPS[op] ?? op;
}

function awardRequirements(award) {
  const require = award.require ?? {};
  const lines = [];
  for (const id of require.knowledge?.all ?? []) {
    lines.push(`Knowledge: ${catalogLabel("knowledge", id)}`);
  }
  for (const condition of require.skills ?? []) {
    lines.push(
      `Skill: ${catalogLabel("skills", condition.id)} ${compareLabel(condition.op)} rank ${condition.rank}`,
    );
  }
  for (const condition of require.evidence ?? []) {
    const evidence = (props.entry.practice?.evidence ?? []).find((item) => item.id === condition.id);
    lines.push(
      `Evidence: ${evidence?.label || condition.id} ${compareLabel(condition.op)} ${condition.value}`,
    );
  }
  return lines;
}

function driftRates(entry) {
  const rates = entry.drift?.perGameHour ?? {};
  return ACTIVITIES
    .map((activity) => {
      const value = rates[activity.id];
      if (value == null || value === "") return null;
      return `${activity.label} ${formatNumber(value)}`;
    })
    .filter(Boolean);
}

function effectSummary(effect) {
  const target = catalogLabel("stats", effect.id);
  if (effect.op === "stat.set") return `set ${target} to ${formatNumber(effect.value)} / hour`;
  return `${target} ${formatNumber(effect.value)} / hour`;
}

function consumptionActions(entry) {
  return (entry.actions ?? []).filter((action) => action.id === "eat" || action.id === "drink" || action.consume);
}
</script>

<template>
  <div class="entry-summary">
    <p v-if="entry.description" class="lead">{{ entry.description }}</p>

    <dl class="metadata">
      <div v-if="catalog !== 'documents'">
        <dt>Label</dt>
        <dd>{{ entry.label || "—" }}</dd>
      </div>
      <div v-else>
        <dt>Title</dt>
        <dd>{{ entry.title || "—" }}</dd>
      </div>
      <div>
        <dt>Visibility</dt>
        <dd>{{ entry.visible || "—" }}</dd>
      </div>
      <div v-if="'order' in entry">
        <dt>Order</dt>
        <dd>{{ entry.order }}</dd>
      </div>
      <div v-if="catalog === 'stats'">
        <dt>Type</dt>
        <dd>{{ entry.type }}</dd>
      </div>
      <div v-if="catalog === 'stats'">
        <dt>Group</dt>
        <dd>{{ groupLabel("statGroups", entry.group) }}</dd>
      </div>
      <div v-if="catalog === 'stats'">
        <dt>Default</dt>
        <dd>{{ formatNumber(entry.default) }}</dd>
      </div>
      <div v-if="catalog === 'stats' && (entry.min != null || entry.max != null)">
        <dt>Range</dt>
        <dd>{{ formatNumber(entry.min) }} – {{ formatNumber(entry.max) }}</dd>
      </div>
      <div v-if="catalog === 'skills'">
        <dt>Mode</dt>
        <dd>{{ entry.mode === "ranked" ? `Ranked, max ${entry.maxRank}` : "Acquired" }}</dd>
      </div>
      <div v-if="catalog === 'quests'">
        <dt>Group</dt>
        <dd>{{ entry.group || "—" }}</dd>
      </div>
      <div v-if="catalog === 'quests'">
        <dt>Autocomplete</dt>
        <dd>{{ entry.autoComplete ? "When every objective is complete" : "Manual" }}</dd>
      </div>
      <div v-if="catalog === 'knowledge' && entry.sourceLabel">
        <dt>Source</dt>
        <dd>{{ entry.sourceLabel }}</dd>
      </div>
      <div v-if="catalog === 'items'">
        <dt>Kind</dt>
        <dd>{{ entry.kind || "item" }}</dd>
      </div>
      <div v-if="catalog === 'items'">
        <dt>Group</dt>
        <dd>{{ groupLabel("inventoryGroups", entry.group) }}</dd>
      </div>
      <div v-if="catalog === 'items'">
        <dt>Carrying</dt>
        <dd>{{ entry.carrying }}{{ entry.carrying === "stack" ? ` · max ${entry.maxQuantity}` : "" }}</dd>
      </div>
      <div v-if="catalog === 'items'">
        <dt>Portable</dt>
        <dd>{{ entry.portable === false ? "No" : "Yes" }}</dd>
      </div>
    </dl>

    <section v-if="catalog === 'stats' && entry.type === 'meter'" class="summary-section">
      <h4>Meter rules</h4>
      <p class="summary-line">
        <span class="summary-label">Hourly drift</span>
        <span class="summary-detail">{{ driftRates(entry).join(" · ") || "None" }}</span>
      </p>
      <p
        v-for="(state, index) in (entry.displayStates ?? [])"
        :key="`display-${index}`"
        class="summary-line">
        <span class="summary-label">{{ index === 0 ? "Display" : "" }}</span>
        <span class="summary-detail">{{ state.state }} at {{ formatNumber(state.at) }}+ · {{ state.tone }}</span>
      </p>
      <p v-if="!(entry.displayStates ?? []).length" class="summary-line">
        <span class="summary-label">Display</span>
        <span class="summary-detail">No band labels</span>
      </p>
      <p
        v-for="(threshold, index) in (entry.thresholds ?? [])"
        :key="`threshold-${index}`"
        class="summary-line">
        <span class="summary-label">{{ index === 0 ? "Thresholds" : "" }}</span>
        <span class="summary-detail">
          {{ threshold.state }} at {{ formatNumber(threshold.at) }} or below
          <template v-if="(threshold.effectsPerGameHour ?? []).length">
            · {{ threshold.effectsPerGameHour.map(effectSummary).join(", ") }}
          </template>
        </span>
      </p>
      <p v-if="!(entry.thresholds ?? []).length" class="summary-line">
        <span class="summary-label">Thresholds</span>
        <span class="summary-detail">None</span>
      </p>
    </section>

    <section v-if="catalog === 'skills' && (entry.rankLabels ?? []).some(Boolean)" class="summary-section">
      <h4>Ranks</h4>
      <p
        v-for="(label, index) in entry.rankLabels"
        :key="`rank-${index}`"
        class="summary-line">
        <span class="summary-label">Rank {{ index + 1 }}</span>
        <span class="summary-detail">{{ label || "—" }}</span>
      </p>
    </section>

    <section v-if="catalog === 'skills'" class="summary-section">
      <h4>Practice</h4>
      <p
        v-for="evidence in (entry.practice?.evidence ?? [])"
        :key="evidence.id"
        class="summary-line">
        <span class="summary-label">Evidence</span>
        <span class="summary-detail">{{ evidence.label || evidence.id }} · target {{ evidence.target }}</span>
      </p>
      <p v-if="!(entry.practice?.evidence ?? []).length" class="summary-line">
        <span class="summary-label">Evidence</span>
        <span class="summary-detail">None</span>
      </p>
      <article
        v-for="(award, index) in (entry.practice?.awards ?? [])"
        :key="`award-${index}`"
        class="award-card">
        <p class="summary-line">
          <span class="summary-label">{{ entry.mode === "ranked" ? `Rank ${award.rank}` : "Award" }}</span>
          <span class="summary-detail award-copy">
            <img
              v-if="award.badge"
              class="award-badge"
              :src="award.badge.startsWith('/') ? award.badge : `/${award.badge}`"
              :alt="award.earnedText || 'Skill badge'">
            <span>{{ award.earnedText || "No earned text" }}</span>
          </span>
        </p>
        <p
          v-for="(line, lineIndex) in awardRequirements(award)"
          :key="lineIndex"
          class="summary-line nested">
          <span class="summary-label">Requires</span>
          <span class="summary-detail">{{ line }}</span>
        </p>
        <p v-if="!awardRequirements(award).length" class="summary-line nested">
          <span class="summary-label">Requires</span>
          <span class="summary-detail">Explicit skill.acquire only</span>
        </p>
      </article>
      <p v-if="!(entry.practice?.awards ?? []).length" class="summary-line">
        <span class="summary-label">Awards</span>
        <span class="summary-detail">None — grant with skill.acquire</span>
      </p>
    </section>

    <section v-if="catalog === 'quests'" class="summary-section">
      <h4>Objectives</h4>
      <p
        v-for="(objective, index) in (entry.objectives ?? [])"
        :key="objective.id || index"
        class="summary-line">
        <span class="summary-label">{{ index + 1 }}</span>
        <span class="summary-detail">
          {{ objective.label || objective.id }}
          <template v-if="objective.target"> · count {{ objective.target }}</template>
          · {{ objective.visible }}
        </span>
      </p>
      <p v-if="!(entry.objectives ?? []).length" class="empty-note">No objectives yet.</p>
    </section>

    <section v-if="catalog === 'items' && entry.container" class="summary-section">
      <h4>Container</h4>
      <p class="summary-line">
        <span class="summary-label">Capacity</span>
        <span class="summary-detail">
          {{ entry.container.capacity?.slots ?? "—" }} slots
          <template v-if="entry.container.capacity?.massKg">
            · {{ entry.container.capacity.massKg }} kg
          </template>
        </span>
      </p>
      <p class="summary-line">
        <span class="summary-label">Accepts</span>
        <span class="summary-detail">{{ (entry.container.accepts?.kinds ?? []).join(", ") || "Any" }}</span>
      </p>
    </section>

    <section v-if="catalog === 'items' && consumptionActions(entry).length" class="summary-section">
      <h4>Consumption</h4>
      <p
        v-for="action in consumptionActions(entry)"
        :key="action.id"
        class="summary-line">
        <span class="summary-label">{{ action.id }}</span>
        <span class="summary-detail">
          {{ action.label || action.id }}
          <template v-if="action.consumeOptions?.length">
            · {{ action.consumeOptions.length }} portion choices
          </template>
        </span>
      </p>
    </section>
  </div>
</template>

<style scoped>
.entry-summary {
  display: grid;
  gap: 0.85rem;
}
.lead {
  margin: 0;
  color: #c8d0db;
  font-size: 0.92rem;
  line-height: 1.45;
}
.metadata {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
  margin: 0;
}
.metadata div {
  border: 1px solid #343d4d;
  border-radius: 7px;
  padding: 0.7rem;
  background: #202733;
}
.metadata dt {
  color: #8e96a3;
  font-size: 0.75rem;
}
.metadata dd {
  margin: 0.25rem 0 0;
  color: #eef1f5;
}
.summary-section {
  display: grid;
  gap: 0.35rem;
  padding: 0.75rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #1b2028;
}
.summary-section h4 {
  margin: 0 0 0.2rem;
  color: #d7dde6;
  font-size: 0.78rem;
  font-weight: 700;
}
.summary-line {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.55rem;
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.35;
}
.summary-line.nested {
  padding-left: 0.35rem;
}
.summary-label {
  color: #8f98a6;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 0.72rem;
  font-weight: 600;
  min-width: 5.5rem;
}
.summary-detail {
  color: #c8d0db;
  min-width: 0;
  word-break: break-word;
}
.award-card {
  display: grid;
  gap: 0.28rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid #343d4d;
  border-radius: 7px;
  background: #202733;
}
.award-copy {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}
.award-badge {
  width: 2.75rem;
  height: 2.75rem;
  object-fit: contain;
  flex: 0 0 auto;
}
.empty-note {
  margin: 0;
  color: #8f98a6;
  font-size: 0.82rem;
}
@media (max-width: 720px) {
  .metadata {
    grid-template-columns: 1fr;
  }
}
</style>
