<script setup>
import { tabOptions } from "../../composables/useCharacterBuilderDraft.js";

defineProps({
  draft: { type: Object, required: true },
  workspaceMode: { type: String, required: true },
  activeCatalogs: { type: Array, required: true },
  selectedCatalog: { type: String, required: true },
  selectedId: { type: String, required: true },
  labelize: { type: Function, required: true },
});

defineEmits(["add-entry", "select-catalog", "select-entry", "toggle-tab"]);
</script>

<template>
  <aside class="catalog-browser panel">
    <section v-if="workspaceMode === 'character'" class="profile-summary">
      <div class="section-heading">
        <div>
          <p class="label">Player profile</p>
          <h3>Profile and panel</h3>
        </div>
      </div>
      <label>Name<input v-model="draft.profile.name"></label>
      <label>
        Portrait asset
        <input v-model="draft.profile.portrait" placeholder="characters/zanzibar/default.webp">
        <small>Place files in game/public; paths resolve from the public root.</small>
      </label>
      <label>Summary<textarea v-model="draft.profile.summary" rows="3"></textarea></label>
      <fieldset>
        <legend>Visible tabs</legend>
        <label v-for="tab in tabOptions" :key="tab" class="check-field">
          <input
            type="checkbox"
            :checked="draft.panel.tabs.includes(tab)"
            @change="$emit('toggle-tab', tab)">
          {{ labelize(tab) }}
        </label>
      </fieldset>
    </section>

    <section v-else class="profile-summary">
      <div class="section-heading">
        <div>
          <p class="label">Catalog</p>
          <h3>Artifacts</h3>
        </div>
      </div>
      <p class="mode-note">
        Define physical and readable things: keys, tools, containers,
        consumables, manuals, cards, and future media records.
      </p>
    </section>

    <nav class="catalog-tabs" :aria-label="`${workspaceMode} catalog`">
      <button
        v-for="catalog in activeCatalogs"
        :key="catalog.id"
        :class="{ active: selectedCatalog === catalog.id }"
        @click="$emit('select-catalog', catalog.id)">
        {{ catalog.label }} <span>{{ draft[catalog.id].length }}</span>
      </button>
    </nav>
    <button class="sm add-entry" @click="$emit('add-entry')">
      + Add {{ selectedCatalog.replace(/s$/, "") }}
    </button>
    <button
      v-for="entry in draft[selectedCatalog]"
      :key="entry.id"
      class="catalog-entry"
      :class="{ active: selectedId === entry.id }"
      @click="$emit('select-entry', entry.id)">
      <strong>{{ entry.label ?? entry.title ?? entry.id }}</strong>
      <span>{{ entry.id }}</span>
    </button>
  </aside>
</template>

<style scoped>
.panel { padding: .85rem; border: 1px solid #343d4d; border-radius: 10px; background: #20252f; }
.catalog-browser { max-height: calc(100vh - 10.7rem); overflow: auto; }
.profile-summary {
  display: grid;
  gap: .65rem;
  padding: .75rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #1b2028;
}
.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: .65rem;
}
.section-heading h3,
.section-heading p { margin: 0; }
.section-heading h3 { color: #eef1f5; font-size: .95rem; }
.mode-note { margin: 0; color: #aeb6c2; font-size: .9rem; line-height: 1.4; }
.catalog-tabs { display: grid; grid-template-columns: repeat(2, 1fr); gap: .35rem; margin-top: .8rem; }
.catalog-tabs button,
.catalog-entry {
  display: flex;
  justify-content: space-between;
  gap: .5rem;
  text-align: left;
  min-width: 0;
}
.catalog-tabs button.active,
.catalog-entry.active { border-color: #6f9b79; background: #49624f; }
.add-entry { width: 100%; margin: .6rem 0; }
.catalog-entry {
  width: 100%;
  margin-top: .35rem;
  padding: .5rem .6rem;
  border-color: #394457;
  border-radius: 7px;
  background: #202733;
}
.catalog-entry strong {
  min-width: 0;
  color: #eef1f5;
  font-size: .82rem;
  overflow-wrap: anywhere;
}
.catalog-entry span { color: #8f98a6; font-size: .78rem; }
label { display: grid; gap: .35rem; color: #bdc4ce; font-size: .8rem; }
input,
textarea,
select {
  width: 100%;
  min-width: 0;
  border: 1px solid #485267;
  border-radius: 7px;
  background: #171b22;
  color: #eef1f5;
  padding: .5rem .6rem;
  font: inherit;
}
input:focus,
textarea:focus,
select:focus {
  outline: 2px solid #6ea57b;
  outline-offset: 1px;
  border-color: #6ea57b;
}
textarea { resize: vertical; line-height: 1.5; }
small {
  color: #8f98a6;
  font-size: .75rem;
  line-height: 1.35;
}
fieldset {
  display: grid;
  gap: .45rem;
  margin: 0;
  padding: .65rem;
  border: 1px solid #3b4557;
  border-radius: 8px;
}
legend { color: #8bc49a; padding: 0 .35rem; }
.check-field { display: flex; align-items: center; gap: .45rem; }
.check-field input { width: auto; }
@media (max-width: 720px) {
  .catalog-browser { max-height: none; }
}
</style>
