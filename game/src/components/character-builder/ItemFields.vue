<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  draft: { type: Object, required: true },
  entry: { type: Object, required: true },
  visibilityOptions: { type: Array, required: true },
  setCsv: { type: Function, required: true },
  setJson: { type: Function, required: true },
});

const activeTab = ref("details");
const imagePreviewFailed = ref(false);

function assetUrl(path) {
  if (!path) return null;
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith("data:")) return path;
  return path.startsWith("/") ? path : `/${path.replace(/^\.?\//, "")}`;
}

function onIconInput() {
  imagePreviewFailed.value = false;
}

watch(
  () => [props.entry?.id, props.entry?.icon],
  () => {
    imagePreviewFailed.value = false;
  },
);
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

      <div class="image-field">
        <label>Image asset
          <input
            v-model="entry.icon"
            placeholder="items/field-backpack.png"
            @input="onIconInput">
          <small>Reference files already in the deployed game under game/public (e.g. items/field-backpack.png).</small>
        </label>
        <div v-if="entry.icon && !imagePreviewFailed" class="image-preview">
          <img
            :src="assetUrl(entry.icon)"
            :alt="entry.label || entry.id"
            @error="imagePreviewFailed = true">
        </div>
        <p v-else-if="entry.icon && imagePreviewFailed" class="image-hint">
          Could not load {{ entry.icon }}. Check the path under game/public.
        </p>
        <p v-else class="image-hint">No image set.</p>
      </div>

      <label>Tags
        <input :value="entry.tags.join(', ')" @input="setCsv(entry, 'tags', $event)">
      </label>
      <label class="check-field"><input v-model="entry.portable" type="checkbox"> Portable</label>
    </div>

    <div v-else class="tab-panel">
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
  border-radius: 999px;
  background: #161b22;
  width: fit-content;
}
.item-tabs button {
  border-radius: 999px;
  border-color: transparent;
  background: transparent;
  color: #b8c0cc;
}
.item-tabs button.active {
  border-color: #6f9b79;
  background: #49624f;
  color: #eef7ef;
}
.tab-panel {
  display: grid;
  gap: 0.75rem;
}
.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}
label {
  display: grid;
  gap: 0.3rem;
  color: #bdc4ce;
  font-size: 0.82rem;
}
.check-field {
  display: flex;
  align-items: center;
}
.image-field {
  display: grid;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid #343d4d;
  border-radius: 10px;
  background: #181d25;
}
.image-preview {
  width: min(100%, 10rem);
  padding: 0.65rem;
  border: 1px solid #3a4558;
  border-radius: 10px;
  background: #12161d;
}
.image-preview img {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
}
.image-hint,
.custom-intro {
  margin: 0;
  color: #8f98a6;
  font-size: 0.82rem;
  line-height: 1.45;
}
@media (max-width: 720px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
