<script setup>
import { computed } from "vue";
import { acquiredEntries } from "../../lib/character/panel.js";
import { formatGameClock } from "../../lib/character/gameTime.js";
import CharacterOverviewTab from "./character/CharacterOverviewTab.vue";
import CharacterSkillsTab from "./character/CharacterSkillsTab.vue";
import CharacterEntriesTab from "./character/CharacterEntriesTab.vue";

const props = defineProps({
  character: { type: Object, required: true },
  clock: { type: Object, default: null },
  /** Kept for callers that still pass nearby holders / inventory props. */
  nearbyHolderIds: { type: Array, default: () => [] },
  initialTab: { type: String, default: null },
  actionPolicy: { type: Object, default: null },
  /** False in builder preview where game time cannot advance. */
  wellbeingActionsEnabled: { type: Boolean, default: true },
  wellbeingActionFeedback: { type: String, default: "" },
});

defineEmits(["return-to-map", "use-item", "transfer-item", "wellbeing-action"]);

const portraitSrc = computed(() => publicAssetPath(props.character.definitions.profile?.portrait));
const knowledge = computed(() => acquiredEntries(props.character, "knowledge"));
const skills = computed(() => acquiredEntries(props.character, "skills"));

function publicAssetPath(path) {
  if (!path) return null;
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }
  return path.startsWith("/") ? path : `/${path.replace(/^\.?\//, "")}`;
}
</script>

<template>
  <section class="character-view" aria-labelledby="character-view-title">
    <header class="character-view-header">
      <div class="identity">
        <img
          v-if="portraitSrc"
          class="portrait"
          :src="portraitSrc"
          :alt="`${character.definitions.profile.name} portrait`">
        <div class="portrait-fallback" v-else aria-hidden="true">
          {{ character.definitions.profile?.name?.charAt(0) ?? "Z" }}
        </div>
        <div>
          <h2 id="character-view-title">{{ character.definitions.profile?.name }}</h2>
          <p v-if="character.definitions.profile?.summary" class="summary">
            {{ character.definitions.profile.summary }}
          </p>
        </div>
      </div>
      <button type="button" class="sm brand" @click="$emit('return-to-map')">
        <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5 12.5 9.5 17 19 7.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linecap="round"
            stroke-linejoin="round" />
        </svg>
        Done
      </button>
    </header>

    <p v-if="clock" class="stats-as-of">{{ formatGameClock(clock) }}</p>

    <div class="character-dashboard">
      <CharacterOverviewTab
        :character="character"
        :actions-enabled="wellbeingActionsEnabled"
        :action-feedback="wellbeingActionFeedback"
        @wellbeing-action="$emit('wellbeing-action', $event)" />

      <div class="progression-column">
        <section class="panel-card knowledge-card" aria-labelledby="character-knowledge-heading">
          <h3 id="character-knowledge-heading">Knowledge</h3>
          <CharacterEntriesTab
            :entries="knowledge"
            selected-tab="knowledge"
            compact />
        </section>

        <section class="panel-card skills-card" aria-labelledby="character-skills-heading">
          <h3 id="character-skills-heading">Skills</h3>
          <CharacterSkillsTab
            :skills="skills"
            :public-asset-path="publicAssetPath"
            compact />
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.character-view {
  min-height: var(--map-height);
  margin-top: 1rem;
  padding: clamp(1rem, 2vw, 1.5rem);
  border: 1px solid #3f4c63;
  border-radius: 12px;
  background:
    radial-gradient(circle at top right, rgba(82, 112, 91, 0.16), transparent 32rem),
    #20252e;
}
.character-view-header,
.identity {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}
.character-view-header {
  justify-content: space-between;
}
.identity {
  min-width: 0;
}
.portrait,
.portrait-fallback {
  width: 4rem;
  height: 4rem;
  flex: 0 0 auto;
  border: 1px solid #526174;
  border-radius: 50%;
  object-fit: cover;
}
.portrait-fallback {
  display: grid;
  place-items: center;
  background: #35413b;
  color: #d9eadc;
  font-size: 1.45rem;
}
.character-view h2 {
  margin: 0;
}
.summary {
  max-width: 42rem;
  margin: 0.35rem 0 0;
  color: #aeb5c0;
}
.stats-as-of {
  margin: 1rem 0 0.55rem;
  color: #8bc49a;
  font-size: 0.82rem;
  line-height: 1.3;
}
.character-dashboard {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  align-items: start;
}
.progression-column {
  display: grid;
  gap: 1rem;
  min-width: 0;
  align-content: start;
}
.panel-card {
  min-width: 0;
  padding: 1rem;
  border: 1px solid #394454;
  border-radius: 10px;
  background: rgba(24, 29, 37, 0.72);
}
.panel-card h3 {
  margin: 0 0 0.85rem;
  color: var(--color-cherenkov, #20c8fb);
}
@media (max-width: 960px) {
  .character-dashboard {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 720px) {
  .character-view-header {
    align-items: stretch;
    flex-direction: column;
  }
  .character-view-header > button {
    align-self: flex-start;
  }
}
</style>
