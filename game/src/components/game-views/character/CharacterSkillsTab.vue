<script setup>
defineProps({
  publicAssetPath: { type: Function, required: true },
  skills: { type: Array, required: true },
  compact: { type: Boolean, default: false },
});

function skillRankLabel(entry) {
  const rank = Number(entry.state?.rank ?? 0);
  return entry.rankLabels?.[rank - 1] ?? (rank > 0 ? `Rank ${rank}` : "Not acquired");
}

function evidenceValue(entry, evidence) {
  return Number(entry.state?.evidence?.[evidence.id] ?? 0);
}

function earnedAwards(entry) {
  const rank = Number(entry.state?.rank ?? 0);
  if (rank <= 0) return [];
  const authored = [...(entry.practice?.awards ?? [])]
    .filter((award) => Number(award.rank) <= rank)
    .sort((left, right) => Number(left.rank) - Number(right.rank));
  const stateAwards = entry.state?.awards ?? {};
  const ranks = new Set([
    ...authored.map((award) => String(award.rank)),
    ...Object.keys(stateAwards),
  ]);
  return [...ranks]
    .sort((left, right) => Number(left) - Number(right))
    .filter((key) => Number(key) <= rank)
    .map((key) => {
      const authoredAward = authored.find((award) => String(award.rank) === key) ?? {};
      const stateAward = stateAwards[key] ?? {};
      return {
        rank: key,
        badge: stateAward.badge || authoredAward.badge || null,
        earnedText: stateAward.earnedText || authoredAward.earnedText || `Rank ${key} earned`,
      };
    });
}
</script>

<template>
  <ul v-if="skills.length" class="entry-list skill-list" :class="{ compact }">
    <li v-for="skill in skills" :key="skill.id">
      <div class="entry-heading">
        <strong>{{ skill.label }}</strong>
        <span>{{ skillRankLabel(skill) }}</span>
      </div>
      <span v-if="!compact && skill.description">{{ skill.description }}</span>
      <div v-if="skill.practice?.evidence?.length" class="skill-progress" :class="{ compact }">
        <label v-for="evidence in skill.practice.evidence" :key="evidence.id">
          <span>{{ evidence.label }}</span>
          <progress
            :max="evidence.target"
            :value="Math.min(evidenceValue(skill, evidence), evidence.target)">
            {{ evidenceValue(skill, evidence) }} / {{ evidence.target }}
          </progress>
          <small>{{ evidenceValue(skill, evidence) }} / {{ evidence.target }}</small>
        </label>
      </div>
      <ul v-if="earnedAwards(skill).length" class="badge-list" :class="{ compact }">
        <li v-for="award in earnedAwards(skill)" :key="award.rank">
          <img
            v-if="award.badge"
            :src="publicAssetPath(award.badge)"
            :alt="award.earnedText">
          <span>{{ award.earnedText }}</span>
        </li>
      </ul>
    </li>
  </ul>
  <p v-else class="empty-state">No skills acquired yet. Practice meaningful tasks to build competence.</p>
</template>

<style scoped>
.entry-list {
  display: grid;
  gap: 0.65rem;
  padding: 0;
  margin: 0;
  list-style: none;
}
.entry-list li {
  display: grid;
  gap: 0.25rem;
  padding: 0.85rem 1rem;
  border: 1px solid #394454;
  border-radius: 8px;
  background: rgba(24, 29, 37, 0.72);
}
.entry-list.compact {
  gap: 0.45rem;
}
.entry-list.compact li {
  padding: 0.55rem 0.65rem;
  background: rgba(16, 20, 27, 0.55);
}
.entry-list span,
.empty-state {
  color: #8f98a6;
}
.empty-state {
  margin: 0;
}
.entry-heading {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
.entry-heading span {
  color: #8bc49a;
  flex: 0 0 auto;
}
.skill-progress {
  display: grid;
  gap: .65rem;
  margin-top: .5rem;
}
.skill-progress.compact {
  gap: 0.4rem;
  margin-top: 0.35rem;
}
.skill-progress label {
  display: grid;
  grid-template-columns: minmax(6rem, 1fr) minmax(4rem, 2fr) auto;
  align-items: center;
  gap: .5rem;
  font-size: 0.82rem;
}
.skill-progress progress {
  width: 100%;
}
.badge-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.55rem 0 0;
  list-style: none;
}
.badge-list.compact {
  gap: 0.55rem;
  padding-top: 0.4rem;
}
.badge-list li {
  display: grid;
  justify-items: center;
  gap: 0.3rem;
  width: 5.6rem;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: center;
}
.badge-list.compact li {
  width: 4.6rem;
}
.badge-list img {
  width: 4rem;
  height: 4rem;
  object-fit: contain;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.45));
}
.badge-list.compact img {
  width: 3.25rem;
  height: 3.25rem;
}
.badge-list span {
  color: #c8d0db;
  font-size: 0.72rem;
  line-height: 1.25;
}
@media (max-width: 720px) {
  .skill-progress label {
    grid-template-columns: 1fr auto;
  }
  .skill-progress progress {
    grid-column: 1 / -1;
    width: 100%;
  }
}
</style>
