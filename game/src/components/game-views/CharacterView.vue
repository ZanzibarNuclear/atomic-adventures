<script setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import {
  acquiredEntries,
  activeQuestSummaries,
  characterTabs,
  formatStatValue,
  questSections,
  visibleCharacterStats,
  visibleInventoryGroups,
} from "../../lib/character/panel.js";
import { formatGameClock } from "../../lib/character/gameTime.js";
import {
  accessibleHolderIds,
  holdingRecords,
} from "../../lib/character/holdings.js";

const props = defineProps({
  character: { type: Object, required: true },
  clock: { type: Object, default: null },
  nearbyHolderIds: { type: Array, default: () => [] },
});

defineEmits(["return-to-map", "use-item", "transfer-item"]);

const tabs = computed(() => characterTabs(props.character.definitions));
const storedTab = readStoredTab();
const selectedTab = ref(
  tabs.value.some((tab) => tab.id === storedTab) ? storedTab : tabs.value[0]?.id ?? "overview",
);
const selectedItemId = ref(null);
const selectedHoldingId = ref(null);
const tabButtons = ref([]);

const stats = computed(() => visibleCharacterStats(props.character));
const inventoryGroups = computed(() => visibleInventoryGroups(props.character));
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
const transferTargets = computed(() => inventoryHolders.value.map((holder) => ({
  id: holder.id,
  label: holder.label ?? holder.id,
})));
const selectedHolding = computed(() =>
  inventoryHolders.value.flatMap((holder) =>
    holder.records.map((record) => ({ ...record, holder })))
    .find((record) => `${record.type}:${record.id}` === selectedHoldingId.value) ?? null,
);
const selectedItem = computed(() => selectedHolding.value);
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

watch(selectedTab, (tab) => {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem("atomic-adventures.character-tab", tab);
  }
});

watch(inventoryGroups, (groups) => {
  const records = inventoryHolders.value.flatMap((holder) => holder.records);
  if (selectedHoldingId.value && !records.some((record) => `${record.type}:${record.id}` === selectedHoldingId.value)) {
    selectedHoldingId.value = null;
    selectedItemId.value = null;
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

function entryLabel(entry) {
  return entry.label ?? entry.title ?? entry.id;
}

function skillRankLabel(entry) {
  const rank = Number(entry.state?.rank ?? 0);
  return entry.rankLabels?.[rank - 1] ?? (rank > 0 ? `Rank ${rank}` : "Not acquired");
}

function evidenceValue(entry, evidence) {
  return Number(entry.state?.evidence?.[evidence.id] ?? 0);
}
</script>

<template>
  <section class="character-view" aria-labelledby="character-view-title">
    <header class="character-view-header">
      <div class="identity">
        <img
          v-if="character.definitions.profile?.portrait"
          class="portrait"
          :src="character.definitions.profile.portrait"
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
      <button type="button" @click="$emit('return-to-map')">Return to map</button>
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
      <template v-if="selectedTab === 'overview'">
        <div class="overview-grid">
          <section class="panel-card">
            <h3>Status</h3>
            <dl v-if="stats.length" class="stat-list">
              <div v-for="stat in stats" :key="stat.id">
                <dt>{{ stat.label }}</dt>
                <dd>
                  <meter
                    v-if="stat.type === 'meter' && Number.isFinite(Number(stat.min)) && Number.isFinite(Number(stat.max))"
                    :min="stat.min"
                    :max="stat.max"
                    :value="stat.value">
                    {{ formatStatValue(stat) }}
                  </meter>
                  <span>{{ formatStatValue(stat) }}</span>
                </dd>
              </div>
            </dl>
            <p v-else class="empty-state">No character metrics are visible yet.</p>
          </section>

          <section class="panel-card">
            <h3>Active quests</h3>
            <ul v-if="activeQuests.length" class="summary-list">
              <li v-for="quest in activeQuests" :key="quest.id">
                <strong>{{ quest.label }}</strong>
                <span>{{ quest.state.status }}</span>
              </li>
            </ul>
            <p v-else class="empty-state">No active quests.</p>
          </section>
        </div>
      </template>

      <template v-else-if="selectedTab === 'inventory'">
        <div class="inventory-layout">
          <div>
            <section v-for="holder in inventoryHolders" :key="holder.id" class="inventory-group">
              <h3>{{ holder.label ?? holder.id }}</h3>
              <div class="item-grid">
                <button
                  v-for="item in holder.records"
                  :key="`${item.type}:${item.id}`"
                  type="button"
                  class="item-card"
                  :class="{ selected: selectedHoldingId === `${item.type}:${item.id}` }"
                  :aria-pressed="selectedHoldingId === `${item.type}:${item.id}`"
                  @click="selectedHoldingId = `${item.type}:${item.id}`; selectedItemId = item.item">
                  <img v-if="item.icon" :src="item.icon" alt="">
                  <span>
                    <strong>{{ item.label }}</strong>
                    <small v-if="item.quantity !== 1">Quantity {{ item.quantity }}</small>
                  </span>
                </button>
              </div>
            </section>
            <p v-if="!inventoryHolders.some((holder) => holder.records.length)" class="empty-state">
              You are not carrying anything yet.
            </p>
          </div>

          <aside class="item-detail" aria-live="polite">
            <template v-if="selectedItem">
              <p class="label">{{ selectedItem.kind }}</p>
              <h3>{{ selectedItem.label }}</h3>
              <p>{{ selectedItem.description || "No description has been authored." }}</p>
              <p v-if="selectedItem.quantity !== 1">Quantity: {{ selectedItem.quantity }}</p>
              <p class="related-document">Location: {{ selectedItem.holder.label ?? selectedItem.holder.id }}</p>
              <p v-if="selectedItem.relatedDocument" class="related-document">
                Related document: {{ selectedItem.relatedDocument }}
              </p>
              <div v-if="transferTargets.length > 1" class="item-actions">
                <button
                  v-for="target in transferTargets.filter((holder) => holder.id !== selectedItem.holder.id)"
                  :key="target.id"
                  type="button"
                  class="sm"
                  @click="$emit('transfer-item', {
                    type: selectedItem.type,
                    recordId: selectedItem.id,
                    itemId: selectedItem.item,
                    quantity: selectedItem.quantity,
                    toHolder: target.id,
                  })">
                  Move to {{ target.label }}
                </button>
              </div>
              <div v-if="selectedItem.actions?.length" class="item-actions">
                <button
                  v-for="action in selectedItem.actions"
                  :key="action.id"
                  type="button"
                  class="sm"
                  @click="$emit('use-item', { itemId: selectedItem.item, actionId: action.id })">
                  {{ action.label }}
                </button>
              </div>
            </template>
            <p v-else class="empty-state">Select an item to inspect it.</p>
          </aside>
        </div>
      </template>

      <template v-else-if="selectedTab === 'skills'">
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
                <img v-if="award.badge" :src="award.badge" alt="">
                <span>{{ award.earnedText || `Rank ${rank} earned` }}</span>
              </li>
            </ul>
          </li>
        </ul>
        <p v-else class="empty-state">No skills acquired yet. Practice meaningful tasks to build competence.</p>
      </template>

      <template v-else-if="selectedTab === 'documents'">
        <ul v-if="documents.length" class="entry-list document-list">
          <li v-for="document in documents" :key="document.id">
            <strong>{{ document.title }}</strong>
            <span v-if="document.summary">{{ document.summary }}</span>
            <p v-if="document.body">{{ document.body }}</p>
            <small>{{ document.state?.readAt ? "Read" : "Discovered" }}</small>
          </li>
        </ul>
        <p v-else class="empty-state">No documents discovered yet.</p>
      </template>

      <template v-else-if="selectedTab === 'quests'">
        <div v-if="Object.values(questsByStatus).some((entries) => entries.length)" class="quest-sections">
          <section
            v-for="status in ['active', 'available', 'completed', 'failed']"
            v-show="questsByStatus[status].length"
            :key="status">
            <h3>{{ status.charAt(0).toUpperCase() + status.slice(1) }}</h3>
            <ul class="entry-list quest-list">
              <li v-for="quest in questsByStatus[status]" :key="quest.id">
                <strong>{{ quest.label }}</strong>
                <span v-if="quest.description">{{ quest.description }}</span>
                <ul v-if="quest.objectives.length" class="objective-list">
                  <li v-for="objective in quest.objectives" :key="objective.id">
                    <span aria-hidden="true">
                      {{ objective.state.status === "completed" ? "✓" : "○" }}
                    </span>
                    <span>{{ objective.label }}</span>
                    <small v-if="objective.target">
                      {{ objective.state.count ?? 0 }} / {{ objective.target }}
                    </small>
                  </li>
                </ul>
              </li>
            </ul>
          </section>
        </div>
        <p v-else class="empty-state">No quests yet.</p>
      </template>

      <template v-else>
        <ul v-if="currentEntries.length" class="entry-list">
          <li
            v-for="entry in currentEntries"
            :key="entry.id">
            <strong>{{ entryLabel(entry) }}</strong>
            <span v-if="entry.description">{{ entry.description }}</span>
            <small v-if="selectedTab === 'knowledge' && entry.sourceLabel">
              Learned from {{ entry.sourceLabel }}
            </small>
          </li>
        </ul>
        <p v-else class="empty-state">
          {{ selectedTab === "knowledge" ? "No knowledge acquired yet." : "Nothing to show here yet." }}
        </p>
      </template>
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
.character-view h2,
.character-view h3 {
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
.overview-grid,
.inventory-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.panel-card,
.item-detail {
  padding: 1rem;
  border: 1px solid #394454;
  border-radius: 10px;
  background: rgba(24, 29, 37, 0.72);
}
.stat-list {
  display: grid;
  gap: 0.7rem;
  margin: 1rem 0 0;
}
.stat-list div,
.summary-list li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
.stat-list dt {
  color: #aeb5c0;
}
.stat-list dd {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin: 0;
}
.stat-list meter {
  width: min(12rem, 28vw);
}
.summary-list,
.entry-list {
  display: grid;
  gap: 0.65rem;
  padding: 0;
  list-style: none;
}
.summary-list span {
  color: #8bc49a;
  text-transform: capitalize;
}
.inventory-layout {
  grid-template-columns: minmax(0, 1.7fr) minmax(15rem, 1fr);
}
.inventory-group + .inventory-group {
  margin-top: 1.25rem;
}
.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: 0.65rem;
  margin-top: 0.65rem;
}
.item-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 4rem;
  text-align: left;
  background: #282f39;
}
.item-card.selected {
  border-color: #7cad87;
  background: #334238;
}
.item-card img {
  width: 2.4rem;
  height: 2.4rem;
  object-fit: contain;
}
.item-card span {
  display: grid;
  gap: 0.2rem;
}
.item-card small,
.empty-state,
.related-document,
.entry-list span {
  color: #8f98a6;
}
.item-detail {
  align-self: start;
  min-height: 10rem;
}
.item-detail h3 {
  margin-top: 0.2rem;
}
.item-actions {
  display: flex;
  flex-wrap: wrap;
  gap: .45rem;
  margin-top: .8rem;
}
.game-time {
  margin: .35rem 0 0;
  color: #8bc49a;
  font-size: .82rem;
}
.entry-list li {
  display: grid;
  gap: 0.25rem;
  padding: 0.85rem 1rem;
  border: 1px solid #394454;
  border-radius: 8px;
  background: rgba(24, 29, 37, 0.72);
}
.entry-heading {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
.entry-heading span,
.document-list small {
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
.document-list p {
  margin: .45rem 0;
  white-space: pre-line;
}
.quest-sections {
  display: grid;
  gap: 1.25rem;
}
.objective-list {
  display: grid;
  gap: .35rem;
  padding: .45rem 0 0;
  list-style: none;
}
.objective-list li {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: .55rem;
  padding: .3rem 0;
  border: 0;
  background: transparent;
}
@media (max-width: 720px) {
  .character-view-header {
    align-items: stretch;
    flex-direction: column;
  }
  .character-view-header > button {
    align-self: flex-start;
  }
  .overview-grid,
  .inventory-layout {
    grid-template-columns: 1fr;
  }
  .item-detail {
    order: -1;
  }
  .skill-progress label {
    grid-template-columns: 1fr auto;
  }
  .skill-progress progress {
    grid-column: 1 / -1;
    width: 100%;
  }
}
</style>
