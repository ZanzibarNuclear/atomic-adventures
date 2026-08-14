<script setup>
import { computed, ref, watch } from "vue";
import LocationViewsEditor from "../LocationViewsEditor.vue";

const props = defineProps({
  draft: { type: Object, required: true },
  selection: { type: Object, required: true },
});

const emit = defineEmits(["drill-change", "back-to-room"]);

const viewsDrilled = ref(false);

const roomId = computed(() => props.selection?.id?.split("/")[0] ?? "");
const room = computed(() =>
  props.draft.rooms.find((entry) => entry.id === roomId.value) ?? null,
);

function setViewsDrilled(next) {
  viewsDrilled.value = Boolean(next);
  emit("drill-change", viewsDrilled.value);
}

function setDefaultStand(checked) {
  if (!room.value) return;
  room.value.defaultStand = checked ? props.selection.entity.id : null;
}

watch(
  () => props.selection?.id,
  () => {
    setViewsDrilled(false);
  },
);
</script>

<template>
  <template v-if="!viewsDrilled">
    <div class="stand-toolbar">
      <button
        type="button"
        class="sm muted"
        :disabled="!roomId"
        @click="emit('back-to-room', roomId)"
      >
        <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6 9 12l6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Back to room
      </button>
      <p v-if="room" class="room-context">In room <strong>{{ room.label || roomId }}</strong></p>
    </div>

    <section class="form-section">
      <div class="section-heading">
        <h4>Identity</h4>
        <code>{{ selection.entity.id }}</code>
      </div>
      <label>Label<input v-model="selection.entity.label" /></label>
      <label>Pose<input v-model="selection.entity.pose" placeholder="stand or sit" /></label>
    </section>

    <section class="form-section">
      <div class="section-heading">
        <h4>Position</h4>
      </div>
      <div class="field-grid">
        <label>X<input v-model.number="selection.entity.at.x" type="number" step=".01" /></label>
        <label>Y<input v-model.number="selection.entity.at.y" type="number" step=".01" /></label>
      </div>
    </section>

    <section class="form-section">
      <div class="section-heading">
        <h4>Behavior</h4>
      </div>
      <label>Interaction
        <input v-model="selection.entity.interaction" placeholder="optional semantic ID" />
      </label>
      <label class="check-field">
        <input
          type="checkbox"
          :checked="room?.defaultStand === selection.entity.id"
          @change="setDefaultStand($event.target.checked)"
        />
        Default room stand
      </label>
    </section>
  </template>

  <LocationViewsEditor
    :owner="selection.entity"
    title="Stand views"
    parent-label="stand"
    @drill-change="setViewsDrilled"
  />
</template>

<style scoped>
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; }
.stand-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
  margin-bottom: 0.35rem;
}
.room-context {
  margin: 0;
  color: #aeb5c0;
  font-size: 0.8rem;
}
.check-field { display: flex !important; align-items: center; gap: .45rem; }
.check-field input { width: auto; }
</style>
