<script setup>
import { computed, ref, watch } from "vue";
import { setRoomLabel } from "../../../lib/maps/composables/useGridBuilder.js";
import { LIGHT_STYLES, normalizeRoomLighting } from "../../../lib/maps/composables/indoor/roomLights.js";
import LocationViewsEditor from "../LocationViewsEditor.vue";

const props = defineProps({
  draft: { type: Object, required: true },
  selection: { type: Object, required: true },
});

const emit = defineEmits(["drill-change", "select-stand", "add-stand", "delete-stand"]);

const viewsDrilled = ref(false);

const roomStands = computed(() => props.selection?.entity?.stands ?? []);

const roomDoors = computed(() => {
  const roomId = props.selection?.id;
  if (!roomId) return [];
  const doors = props.draft.doors ?? [];
  const links = props.draft.links ?? [];
  const linkedDoorIds = new Set(
    links
      .filter((link) => link.door && (link.from === roomId || link.to === roomId))
      .map((link) => link.door),
  );
  return doors.filter((door) =>
    door.id
    && (door.room === roomId || linkedDoorIds.has(door.id)),
  );
});

const hasLighting = computed({
  get: () => Boolean(normalizeRoomLighting(props.selection.entity.lighting)),
  set: (enabled) => {
    if (enabled) {
      props.selection.entity.lighting = normalizeRoomLighting({
        style: props.selection.entity.lighting?.style || "recessed",
        label: props.selection.entity.lighting?.label
          || `${props.selection.entity.label || props.selection.id} lights`,
        activeLine: props.selection.entity.lighting?.activeLine || "",
        switchNote: props.selection.entity.lighting?.switchNote || "",
        nearDoor: props.selection.entity.lighting?.nearDoor || "",
      }) ?? {
        enabled: true,
        style: "recessed",
      };
    } else {
      delete props.selection.entity.lighting;
    }
  },
});

function ensureLighting() {
  if (!props.selection.entity.lighting) {
    hasLighting.value = true;
  }
  return props.selection.entity.lighting;
}

function updateLightingField(field, value) {
  const lighting = ensureLighting();
  if (!lighting) return;
  if (value == null || value === "") delete lighting[field];
  else lighting[field] = value;
  props.selection.entity.lighting = normalizeRoomLighting(lighting) ?? lighting;
}

function setViewsDrilled(next) {
  viewsDrilled.value = Boolean(next);
  emit("drill-change", viewsDrilled.value);
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
    <section class="form-section">
      <div class="section-heading">
        <h4>Identity</h4>
        <code>{{ selection.id }}</code>
      </div>
      <label>Label
        <input
          :value="selection.entity.label"
          @input="setRoomLabel(draft, selection.id, $event.target.value)"
        />
      </label>
    </section>

    <section class="form-section">
      <div class="section-heading">
        <h4>Bounds</h4>
      </div>
      <div class="field-grid">
        <label>X<input v-model.number="selection.entity.x" type="number" step=".5" /></label>
        <label>Y<input v-model.number="selection.entity.y" type="number" step=".5" /></label>
        <label>Width<input v-model.number="selection.entity.w" type="number" min=".5" step=".5" /></label>
        <label>Height<input v-model.number="selection.entity.h" type="number" min=".5" step=".5" /></label>
      </div>
    </section>

    <section class="form-section">
      <div class="section-heading">
        <h4>Lighting</h4>
      </div>
      <label class="check-field">
        <input v-model="hasLighting" type="checkbox" />
        Room has lights and a wall switch
      </label>
      <p class="help-note">
        Players can flip the switch from anywhere in the room. Lights only illuminate when
        station power is on and the switch is closed.
      </p>
      <template v-if="hasLighting">
        <label>
          Fixture style
          <select
            :value="selection.entity.lighting?.style || 'recessed'"
            @change="updateLightingField('style', $event.target.value)"
          >
            <option v-for="style in LIGHT_STYLES" :key="style.id" :value="style.id">
              {{ style.label }}
            </option>
          </select>
        </label>
        <label>
          Label
          <input
            :value="selection.entity.lighting?.label || ''"
            placeholder="Conference Room lights"
            @input="updateLightingField('label', $event.target.value)"
          />
        </label>
        <label>
          Status when lit
          <input
            :value="selection.entity.lighting?.activeLine || ''"
            placeholder="The conference room lights are on."
            @input="updateLightingField('activeLine', $event.target.value)"
          />
        </label>
        <label>
          Switch note (optional)
          <input
            :value="selection.entity.lighting?.switchNote || ''"
            placeholder="Wall switch by the kitchen door."
            @input="updateLightingField('switchNote', $event.target.value)"
          />
        </label>
        <label>
          Switch near door (optional)
          <select
            :value="selection.entity.lighting?.nearDoor || ''"
            @change="updateLightingField('nearDoor', $event.target.value)"
          >
            <option value="">None / not specified</option>
            <option v-for="door in roomDoors" :key="door.id" :value="door.id">
              {{ door.label || door.id }}
            </option>
          </select>
        </label>
      </template>
    </section>

  </template>

  <!-- Views, then stands (beats sit on the room overview card in StationInspector). -->
  <LocationViewsEditor
    :owner="selection.entity"
    title="Room views"
    parent-label="room"
    @drill-change="setViewsDrilled"
  />

  <section v-if="!viewsDrilled" class="form-section">
    <div class="section-heading stands-heading">
      <h4>Room stands</h4>
      <button type="button" class="sm add-btn" @click="emit('add-stand', selection.id)">
        <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
        </svg>
        Add stand
      </button>
    </div>
    <p class="help-note">
      Stands belong to this room. Open one to edit pose, views, and default arrival.
    </p>
    <p v-if="!roomStands.length" class="empty-note">No authored stands in this room yet.</p>
    <div v-else class="stand-list">
      <div
        v-for="stand in roomStands"
        :key="stand.id"
        class="stand-row"
      >
        <button
          type="button"
          class="stand-link"
          @click="emit('select-stand', { roomId: selection.id, standId: stand.id })"
        >
          <strong>{{ stand.label || stand.id }}</strong>
          <span>
            {{ stand.id }}
            <template v-if="selection.entity.defaultStand === stand.id"> · default</template>
          </span>
        </button>
        <button
          type="button"
          class="sm edit-btn"
          @click="emit('select-stand', { roomId: selection.id, standId: stand.id })"
        >
          Open
        </button>
        <button
          type="button"
          class="sm danger-outline"
          title="Remove stand"
          @click="emit('delete-stand', { roomId: selection.id, standId: stand.id })"
        >
          <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M8 7l.8 12.2A1.5 1.5 0 0 0 10.3 20.5h3.4a1.5 1.5 0 0 0 1.5-1.3L16 7"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linejoin="round"
            />
          </svg>
          Remove
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; }
.help-note {
  margin: 0;
  color: #8e96a3;
  font-size: .78rem;
  line-height: 1.4;
}
.check-field {
  display: flex !important;
  align-items: center;
  gap: .45rem;
}
.check-field input { width: auto; }
.stands-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.stand-list {
  display: grid;
  gap: 0.35rem;
}
.stand-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.stand-link {
  flex: 1 1 auto;
  display: grid;
  gap: 0.1rem;
  text-align: left;
  background: #252b35;
  border: 1px solid #3a4558;
  border-radius: 7px;
  padding: 0.4rem 0.55rem;
  color: #eef1f5;
}
.stand-link span {
  color: #8e96a3;
  font-size: 0.72rem;
}
.empty-note { color: #939ba7; margin: 0; font-size: 0.82rem; }
</style>
