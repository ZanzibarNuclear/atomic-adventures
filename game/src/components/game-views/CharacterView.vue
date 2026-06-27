<script setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import {
  acquiredEntries,
  activeQuestSummaries,
  characterTabs,
  questSections,
  visibleCharacterStats,
} from "../../lib/character/panel.js";
import { formatGameClock } from "../../lib/character/gameTime.js";
import {
  accessibleHolderIds,
  holdingRecords,
} from "../../lib/character/holdings.js";
import CharacterDocumentsTab from "./character/CharacterDocumentsTab.vue";
import CharacterEntriesTab from "./character/CharacterEntriesTab.vue";
import CharacterInventoryTab from "./character/CharacterInventoryTab.vue";
import CharacterOverviewTab from "./character/CharacterOverviewTab.vue";
import CharacterQuestsTab from "./character/CharacterQuestsTab.vue";
import CharacterSkillsTab from "./character/CharacterSkillsTab.vue";

const props = defineProps({
  character: { type: Object, required: true },
  clock: { type: Object, default: null },
  nearbyHolderIds: { type: Array, default: () => [] },
  initialTab: { type: String, default: null },
});

defineEmits(["return-to-map", "use-item", "transfer-item"]);

const tabs = computed(() => characterTabs(props.character.definitions));
const storedTab = readStoredTab();
const selectedTab = ref(
  tabs.value.some((tab) => tab.id === props.initialTab)
    ? props.initialTab
    : tabs.value.some((tab) => tab.id === storedTab) ? storedTab : tabs.value[0]?.id ?? "overview",
);
const selectedHoldingId = ref(null);
const tabButtons = ref([]);

const stats = computed(() => visibleCharacterStats(props.character));
const portraitSrc = computed(() => publicAssetPath(props.character.definitions.profile?.portrait));
const activeQuests = computed(() => activeQuestSummaries(props.character));
const inventoryHolders = computed(() => {
  const ids = [...accessibleHolderIds(
    props.character.holdings,
    "nearby",
    props.nearbyHolderIds,
  )];
  return ids.map((id) => ({
    ...(props.character.holdings.holders[id] ?? { id, label: id, kind: "holder" }),
    records: holdingRecords(
      props.character.holdings,
      props.character.definitions,
      [id],
    ).map((record) => ({
      ...record,
      label: record.definition?.label ?? record.item,
      description: record.definition?.description ?? "",
      kind: record.definition?.kind ?? "item",
      icon: record.definition?.icon ?? null,
      actions: record.definition?.actions ?? [],
      relatedDocument: record.definition?.relatedDocument ?? null,
    })),
  }));
});
const transferTargets = computed(() => inventoryHolders.value
  .filter((holder) => holder.kind !== "container")
  .map((holder) => ({
    id: holder.id,
    label: holder.label ?? holder.id,
    kind: holder.kind,
  })));
const selectedHolding = computed(() =>
  inventoryHolders.value.flatMap((holder) =>
    holder.records.map((record) => ({ ...record, holder })))
    .find((record) => `${record.type}:${record.id}` === selectedHoldingId.value) ?? null,
);
const knowledge = computed(() => acquiredEntries(props.character, "knowledge"));
const skills = computed(() => acquiredEntries(props.character, "skills"));
const quests = computed(() => acquiredEntries(props.character, "quests"));
const documents = computed(() => acquiredEntries(props.character, "documents"));
const questsByStatus = computed(() => questSections(props.character));
const currentEntries = computed(() => ({
  knowledge: knowledge.value,
  skills: skills.value,
  quests: quests.value,
  documents: documents.value,
}[selectedTab.value] ?? []));

watch(tabs, (next) => {
  if (!next.some((tab) => tab.id === selectedTab.value)) {
    selectedTab.value = next[0]?.id ?? "overview";
  }
});

watch(
  () => props.initialTab,
  (tab) => {
    if (tabs.value.some((item) => item.id === tab)) selectTab(tab);
  },
);

watch(selectedTab, (tab) => {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem("atomic-adventures.character-tab", tab);
  }
});

watch(inventoryHolders, () => {
  const records = inventoryHolders.value.flatMap((holder) => holder.records);
  if (selectedHoldingId.value && !records.some((record) => `${record.type}:${record.id}` === selectedHoldingId.value)) {
    selectedHoldingId.value = null;
  }
});

onMounted(() => {
  nextTick(() => {
    const index = tabs.value.findIndex((tab) => tab.id === selectedTab.value);
    tabButtons.value[index]?.focus();
  });
});

function selectTab(id, focus = false) {
  selectedTab.value = id;
  if (focus) {
    nextTick(() => {
      const index = tabs.value.findIndex((tab) => tab.id === id);
      tabButtons.value[index]?.focus();
    });
  }
}

function handleTabKey(event, index) {
  let next = index;
  if (event.key === "ArrowRight") next = (index + 1) % tabs.value.length;
  else if (event.key === "ArrowLeft") next = (index - 1 + tabs.value.length) % tabs.value.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = tabs.value.length - 1;
  else return;
  event.preventDefault();
  selectTab(tabs.value[next].id, true);
}

function readStoredTab() {
  return typeof sessionStorage === "undefined"
    ? null
    : sessionStorage.getItem("atomic-adventures.character-tab");
}

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
          <p class="label">Character</p>
          <h2 id="character-view-title">{{ character.definitions.profile?.name }}</h2>
          <p v-if="character.definitions.profile?.summary" class="summary">
            {{ character.definitions.profile.summary }}
          </p>
          <p v-if="clock" class="game-time">{{ formatGameClock(clock) }}</p>
        </div>
      </div>
      <button type="button" @click="$emit('return-to-map')">Return</button>
    </header>

    <nav class="character-tabs" role="tablist" aria-label="Character information">
      <button
        v-for="(tab, index) in tabs"
        :id="`character-tab-${tab.id}`"
        :key="tab.id"
        ref="tabButtons"
        type="button"
        role="tab"
        :aria-selected="selectedTab === tab.id"
        :aria-controls="`character-panel-${tab.id}`"
        :tabindex="selectedTab === tab.id ? 0 : -1"
        @click="selectTab(tab.id)"
        @keydown="handleTabKey($event, index)">
        {{ tab.label }}
      </button>
    </nav>

    <section
      :id="`character-panel-${selectedTab}`"
      class="character-panel"
      role="tabpanel"
      tabindex="0"
      :aria-labelledby="`character-tab-${selectedTab}`">
      <CharacterOverviewTab
        v-if="selectedTab === 'overview'"
        :stats="stats"
        :active-quests="activeQuests" />

      <CharacterInventoryTab
        v-else-if="selectedTab === 'inventory'"
        :holders="inventoryHolders"
        :selected-holding="selectedHolding"
        :selected-holding-id="selectedHoldingId"
        :transfer-targets="transferTargets"
        :public-asset-path="publicAssetPath"
        @select-holding="selectedHoldingId = $event"
        @transfer-item="$emit('transfer-item', $event)"
        @use-item="$emit('use-item', $event)" />

      <CharacterSkillsTab
        v-else-if="selectedTab === 'skills'"
        :skills="skills"
        :public-asset-path="publicAssetPath" />

      <CharacterDocumentsTab
        v-else-if="selectedTab === 'documents'"
        :documents="documents" />

      <CharacterQuestsTab
        v-else-if="selectedTab === 'quests'"
        :quests-by-status="questsByStatus" />

      <CharacterEntriesTab
        v-else
        :entries="currentEntries"
        :selected-tab="selectedTab" />
    </section>
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
.character-tabs {
  display: flex;
  gap: 0.35rem;
  margin-top: 1.25rem;
  overflow-x: auto;
  border-bottom: 1px solid #3b4555;
}
.character-tabs button {
  border: 0;
  border-radius: 8px 8px 0 0;
  background: transparent;
  color: #9ea7b4;
  white-space: nowrap;
}
.character-tabs button[aria-selected="true"] {
  background: #334238;
  color: #e7f0e9;
  box-shadow: inset 0 -2px #7cad87;
}
.character-panel {
  min-height: 18rem;
  padding-top: 1.25rem;
  outline: none;
}
.game-time {
  margin: .35rem 0 0;
  color: #8bc49a;
  font-size: .82rem;
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
