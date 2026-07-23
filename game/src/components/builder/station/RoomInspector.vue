<script setup>
import { computed, ref, watch } from "vue";
import { setRoomLabel } from "../../../lib/maps/composables/useGridBuilder.js";
import { LIGHT_STYLES, normalizeRoomLighting } from "../../../lib/maps/composables/indoor/roomLights.js";
import LocationViewsEditor from "../LocationViewsEditor.vue";

const props = defineProps({
  draft: { type: Object, required: true },
  selection: { type: Object, required: true },
});

const emit = defineEmits(["drill-change"]);

const viewsDrilled = ref(false);

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

  <LocationViewsEditor
    :owner="selection.entity"
    title="Room views"
    parent-label="room"
    @drill-change="setViewsDrilled"
  />
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
</style>
