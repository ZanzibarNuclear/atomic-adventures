<script setup>
import { onBeforeUnmount, ref, watch } from "vue";
import { storyApi } from "../../lib/storyApi.js";

const props = defineProps({
  modelValue: { type: String, default: "" },
  folder: { type: String, default: "items" },
  placeholder: { type: String, default: "items/..." },
  label: { type: String, default: "Image asset" },
});

const emit = defineEmits(["update:modelValue"]);

const images = ref([]);
const loading = ref(false);
const loadError = ref("");
const previewFailed = ref(false);
const pickerOpen = ref(false);
const imagesLoaded = ref(false);

function assetUrl(path) {
  if (!path) return null;
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith("data:")) return path;
  return path.startsWith("/") ? path : `/${path.replace(/^\.?\//, "")}`;
}

function selectImage(path) {
  previewFailed.value = false;
  emit("update:modelValue", path);
  closePicker();
}

function onManualInput(event) {
  previewFailed.value = false;
  emit("update:modelValue", event.target.value);
}

function clearImage() {
  previewFailed.value = false;
  emit("update:modelValue", "");
}

function openPicker() {
  pickerOpen.value = true;
  if (!imagesLoaded.value) void loadImages();
}

function closePicker() {
  pickerOpen.value = false;
}

function onDocumentKeydown(event) {
  if (event.key === "Escape" && pickerOpen.value) {
    event.preventDefault();
    closePicker();
  }
}

async function loadImages() {
  loading.value = true;
  loadError.value = "";
  try {
    const result = await storyApi(
      `/api/character/public-images?folder=${encodeURIComponent(props.folder)}`,
    );
    images.value = result.images ?? [];
    imagesLoaded.value = true;
  } catch (error) {
    loadError.value = error.message;
    images.value = [];
  } finally {
    loading.value = false;
  }
}

watch(pickerOpen, (open) => {
  if (open) document.addEventListener("keydown", onDocumentKeydown);
  else document.removeEventListener("keydown", onDocumentKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onDocumentKeydown);
});

watch(
  () => props.modelValue,
  () => {
    previewFailed.value = false;
  },
);
</script>

<template>
  <div class="image-field">
    <label>{{ label }}
      <input
        :value="modelValue"
        :placeholder="placeholder"
        class="picker-trigger"
        @input="onManualInput"
        @click="openPicker">
      <small>Click the field to browse game/public/{{ folder }}/, or type a path manually.</small>
    </label>

    <button
      type="button"
      class="sm muted clear-btn"
      :disabled="!modelValue"
      @click="clearImage">
      Clear image
    </button>

    <button
      v-if="modelValue && !previewFailed"
      type="button"
      class="image-preview"
      aria-label="Choose a different image"
      @click="openPicker">
      <img
        :src="assetUrl(modelValue)"
        :alt="modelValue"
        @error="previewFailed = true">
    </button>
    <p v-else-if="modelValue && previewFailed" class="image-hint">
      Could not load {{ modelValue }}. Check the path under game/public.
    </p>
    <p v-else class="image-hint">No image set.</p>

    <Teleport to="body">
      <div
        v-if="pickerOpen"
        class="picker-backdrop"
        role="dialog"
        aria-modal="true"
        :aria-label="`Choose image from ${folder}/`"
        @click.self="closePicker">
        <section class="picker-dialog">
          <header class="picker-heading">
            <div>
              <p class="label">Image asset</p>
              <h4>Choose from {{ folder }}/</h4>
            </div>
            <div class="picker-heading-actions">
              <button type="button" class="sm muted" :disabled="loading" @click="loadImages">
                Refresh
              </button>
              <button
                type="button"
                class="icon-btn close-btn"
                aria-label="Close without selecting"
                @click="closePicker">
                ×
              </button>
            </div>
          </header>

          <p v-if="loading" class="image-hint">Loading images…</p>
          <p v-else-if="loadError" class="image-hint">{{ loadError }}</p>
          <p v-else-if="!images.length" class="image-hint">
            No images found in game/public/{{ folder }}/.
          </p>
          <div v-else class="picker-grid">
            <button
              v-for="path in images"
              :key="path"
              type="button"
              class="picker-option"
              :class="{ selected: modelValue === path }"
              :aria-pressed="modelValue === path"
              @click="selectImage(path)">
              <img :src="assetUrl(path)" :alt="path.split('/').pop()">
              <span>{{ path.split("/").pop() }}</span>
            </button>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.image-field {
  display: grid;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #1b2028;
}
label {
  display: grid;
  gap: 0.35rem;
  color: #bdc4ce;
  font-size: 0.8rem;
}
.picker-trigger {
  cursor: pointer;
}
.clear-btn {
  justify-self: start;
}
.image-preview {
  width: min(100%, 10rem);
  padding: 0.65rem;
  border: 1px solid #3a4558;
  border-radius: 8px;
  background: #171b22;
  cursor: pointer;
}
.image-preview img {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
}
.image-hint {
  margin: 0;
  color: #8f98a6;
  font-size: 0.82rem;
  line-height: 1.45;
}
.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(7, 9, 12, 0.72);
}
.picker-dialog {
  width: min(100%, 36rem);
  max-height: min(80vh, 40rem);
  overflow: auto;
  padding: 1rem;
  border: 1px solid #465166;
  border-radius: 10px;
  background: #20252f;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}
.picker-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.picker-heading h4,
.picker-heading .label {
  margin: 0;
}
.picker-heading-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.icon-btn.close-btn {
  width: 1.85rem;
  height: 1.85rem;
  padding: 0;
  border-radius: 6px;
  font-size: 1.2rem;
  line-height: 1;
}
.picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
  gap: 0.55rem;
}
.picker-option {
  display: grid;
  gap: 0.35rem;
  padding: 0.45rem;
  text-align: center;
  border: 1px solid #3a4558;
  border-radius: 8px;
  background: #171b22;
  color: #c5d0e0;
}
.picker-option:hover,
.picker-option.selected {
  border-color: #6f9b79;
  background: #243429;
}
.picker-option img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: contain;
}
.picker-option span {
  font-size: 0.68rem;
  line-height: 1.25;
  word-break: break-word;
}
</style>
