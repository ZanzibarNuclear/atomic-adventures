<script setup>
defineProps({
  publicAssetPath: { type: Function, required: true },
  skills: { type: Array, required: true },
});

function skillRankLabel(entry) {
  const rank = Number(entry.state?.rank ?? 0);
  return entry.rankLabels?.[rank - 1] ?? (rank > 0 ? `Rank ${rank}` : "Not acquired");
}

function evidenceValue(entry, evidence) {
  return Number(entry.state?.evidence?.[evidence.id] ?? 0);
}
</script>

<template>
  <ul v-if="skills.length" class="entry-list skill-list">
    <li v-for="skill in skills" :key="skill.id">
      <div class="entry-heading">
        <strong>{{ skill.label }}</strong>
        <span>{{ skillRankLabel(skill) }}</span>
      </div>
      <span v-if="skill.description">{{ skill.description }}</span>
      <div v-if="skill.practice?.evidence?.length" class="skill-progress">
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
      <ul v-if="Object.keys(skill.state?.awards ?? {}).length" class="badge-list">
        <li v-for="(award, rank) in skill.state.awards" :key="rank">
          <img v-if="award.badge" :src="publicAssetPath(award.badge)" alt="">
          <span>{{ award.earnedText || `Rank ${rank} earned` }}</span>
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
.entry-list span,
.empty-state {
  color: #8f98a6;
}
.entry-heading {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
.entry-heading span {
  color: #8bc49a;
}
.skill-progress {
  display: grid;
  gap: .65rem;
  margin-top: .5rem;
}
.skill-progress label {
  display: grid;
  grid-template-columns: minmax(10rem, 1fr) minmax(8rem, 2fr) auto;
  align-items: center;
  gap: .65rem;
}
.badge-list {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  padding: .5rem 0 0;
  list-style: none;
}
.badge-list li {
  display: flex;
  align-items: center;
  gap: .4rem;
  padding: .4rem .55rem;
  border: 1px solid #526174;
  border-radius: 999px;
}
.badge-list img {
  width: 1.5rem;
  height: 1.5rem;
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
