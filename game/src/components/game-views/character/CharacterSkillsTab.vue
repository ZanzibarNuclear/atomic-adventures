<script setup>
import { computed } from "vue";

const props = defineProps({
  publicAssetPath: { type: Function, required: true },
  skills: { type: Array, required: true },
  compact: { type: Boolean, default: false },
});

const displayedSkills = computed(() =>
  props.skills.map((skill) => {
    const award = currentAward(skill);
    return {
      id: skill.id,
      label: skill.label,
      badge: award?.badge ? props.publicAssetPath(award.badge) : null,
      earnedText: award?.earnedText || skill.label,
    };
  }),
);

function currentAward(entry) {
  const rank = Number(entry.state?.rank ?? 0);
  if (rank <= 0) return null;
  const authored = [...(entry.practice?.awards ?? [])]
    .filter((award) => Number(award.rank) <= rank)
    .sort((left, right) => Number(right.rank) - Number(left.rank));
  const stateAwards = entry.state?.awards ?? {};
  const authoredAward = authored[0] ?? {};
  const stateAward = stateAwards[String(authoredAward.rank ?? rank)]
    ?? stateAwards[String(rank)]
    ?? {};
  return {
    badge: stateAward.badge || authoredAward.badge || null,
    earnedText: stateAward.earnedText || authoredAward.earnedText || entry.label,
  };
}
</script>

<template>
  <ul v-if="displayedSkills.length" class="skill-badges" :class="{ compact }">
    <li v-for="skill in displayedSkills" :key="skill.id">
      <img v-if="skill.badge" :src="skill.badge" :alt="skill.earnedText">
      <strong>{{ skill.label }}</strong>
    </li>
  </ul>
  <p v-else class="empty-state">No skills acquired yet. Practice meaningful tasks to build competence.</p>
</template>

<style scoped>
.skill-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem 1rem;
  padding: 0;
  margin: 0;
  list-style: none;
}
.skill-badges.compact {
  gap: 0.7rem 0.85rem;
}
.skill-badges li {
  display: grid;
  justify-items: center;
  gap: 0.35rem;
  width: 5.6rem;
  text-align: center;
}
.skill-badges.compact li {
  width: 4.8rem;
}
.skill-badges img {
  width: 4rem;
  height: 4rem;
  object-fit: contain;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.45));
}
.skill-badges.compact img {
  width: 3.4rem;
  height: 3.4rem;
}
.skill-badges strong {
  color: #d7dde6;
  font-size: 0.74rem;
  font-weight: 600;
  line-height: 1.25;
}
.empty-state {
  margin: 0;
  color: #8f98a6;
}
</style>
