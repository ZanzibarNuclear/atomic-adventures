<script setup>
import { ref } from "vue";
import PublicImagePicker from "./PublicImagePicker.vue";

defineProps({
  draft: { type: Object, required: true },
  entry: { type: Object, required: true },
  visibilityOptions: { type: Array, required: true },
  setCsv: { type: Function, required: true },
  setJson: { type: Function, required: true },
});

const activeTab = ref("details");
</script>

<template>
  <div class="item-fields">
    <nav class="item-tabs" aria-label="Item editor sections">
      <button
        type="button"
        :class="{ active: activeTab === 'details' }"
        @click="activeTab = 'details'">
        Details
      </button>
      <button
        type="button"
        :class="{ active: activeTab === 'custom' }"
        @click="activeTab = 'custom'">
        Custom
      </button>
    </nav>

    <div v-if="activeTab === 'details'" class="tab-panel">
      <div class="section-heading">
        <h4>Item details</h4>
        <code>{{ entry.id }}</code>
      </div>
      <div class="field-grid">
        <label>Kind<input v-model="entry.kind"></label>
        <label>Group
          <select v-model="entry.group">
            <option :value="null">No group</option>
            <option
              v-for="group in draft.panel.inventoryGroups"
              :key="group.id"
              :value="group.id">{{ group.label }}</option>
          </select>
        </label>
        <label>Carrying
          <select v-model="entry.carrying">
            <option value="unique">Unique</option>
            <option value="stack">Stack</option>
          </select>
        </label>
        <label>Maximum quantity
          <input v-model.number="entry.maxQuantity" type="number" min="1">
        </label>
        <label>Related document
          <select v-model="entry.relatedDocument">
            <option :value="null">None</option>
            <option v-for="document in draft.documents" :key="document.id" :value="document.id">
              {{ document.title }}
            </option>
          </select>
        </label>
        <label>Order<input v-model.number="entry.order" type="number"></label>
        <label>Visibility
          <select v-model="entry.visible">
            <option v-for="visibility in visibilityOptions" :key="visibility">{{ visibility }}</option>
          </select>
        </label>
      </div>

      <PublicImagePicker
        :model-value="entry.icon ?? ''"
        folder="items"
        placeholder="items/..."
        @update:model-value="entry.icon = $event || null" />

      <label>Tags
        <input :value="entry.tags.join(', ')" @input="setCsv(entry, 'tags', $event)">
      </label>
      <label class="check-field"><input v-model="entry.portable" type="checkbox"> Portable</label>
    </div>

    <div v-else class="tab-panel">
      <div class="section-heading">
        <h4>Advanced fields</h4>
        <code>JSON</code>
      </div>
      <p class="custom-intro">
        Advanced JSON fields for containers, scripted actions, and extra properties.
      </p>
      <label>Container (JSON)
        <textarea
          :value="JSON.stringify(entry.container ?? null, null, 2)"
          rows="10"
          @change="setJson(entry, 'container', $event, null)"></textarea>
      </label>
      <label>Properties (JSON)
        <textarea
          :value="JSON.stringify(entry.properties ?? {}, null, 2)"
          rows="8"
          @change="setJson(entry, 'properties', $event, {})"></textarea>
      </label>
      <label>Item actions (JSON)
        <textarea
          :value="JSON.stringify(entry.actions ?? [], null, 2)"
          rows="12"
          @change="setJson(entry, 'actions', $event, [])"></textarea>
      </label>
    </div>
  </div>
</template>

<style scoped>
.item-fields {
  display: grid;
  gap: 0.75rem;
}
.item-tabs {
  display: inline-flex;
  gap: 0.35rem;
  padding: 0.25rem;
  border: 1px solid #343d4d;
  border-radius: 9px;
  background: #171b22;
  width: fit-content;
}
.item-tabs button {
  border-color: transparent;
  border-radius: 7px;
  background: transparent;
  color: #b8c0cc;
}
.item-tabs button.active {
  border-color: #6f9b79;
  background: #49624f;
  color: #eef7ef;
}
.custom-intro {
  margin: 0;
  color: #8f98a6;
  font-size: 0.82rem;
  line-height: 1.45;
}
</style>
