<script setup>
import { computed } from "vue";

const props = defineProps({
  draft: { type: Object, required: true },
  selection: { type: Object, required: true },
});

const FIXTURE_KINDS = [
  { id: "straight-stairs", label: "Straight stairs" },
  { id: "spiral-stairs", label: "Spiral stairs" },
  { id: "cliff-wall", label: "Cliff / stone wall" },
];

const PROTRUDE_OPTIONS = ["north", "south", "east", "west"];
const RUN_OPTIONS = [
  { id: "horizontal", label: "Horizontal run" },
  { id: "vertical", label: "Vertical run" },
];
const ASCEND_OPTIONS = [
  { id: "end", label: "Ascend toward end" },
  { id: "start", label: "Ascend toward start" },
];

const entity = computed(() => props.selection.entity);
const isWall = computed(() => entity.value?.kind === "cliff-wall");
const isSpiral = computed(() => entity.value?.kind === "spiral-stairs");
const isStraight = computed(() => entity.value?.kind === "straight-stairs");
const isStair = computed(() => isSpiral.value || isStraight.value);

const roomOptions = computed(() =>
  (props.draft.rooms ?? [])
    .filter((room) => room?.id && !room.feature)
    .map((room) => ({
      id: room.id,
      label: room.label ? `${room.label} (${room.id})` : room.id,
    })),
);

const levelOptions = computed(() =>
  (props.draft.levels ?? []).map((level) => ({
    id: level.id,
    label: level.label ? `${level.label} (${level.id})` : level.id,
  })),
);

const connectsText = computed({
  get: () => (entity.value.connects ?? []).join(", "),
  set: (value) => {
    entity.value.connects = String(value ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  },
});

function hasLevel(levelId) {
  return (entity.value.onLevels ?? []).includes(levelId);
}

function toggleLevel(levelId, checked) {
  const current = new Set(entity.value.onLevels ?? []);
  if (checked) current.add(levelId);
  else current.delete(levelId);
  entity.value.onLevels = [...current];
}

function onKindChange(nextKind) {
  const fixture = entity.value;
  const prev = fixture.kind;
  if (nextKind === prev) return;
  fixture.kind = nextKind;

  if (nextKind === "cliff-wall") {
    fixture.visualOnly = true;
    fixture.thicknessFeet ??= 5;
    if (!Array.isArray(fixture.points) || fixture.points.length < 2) {
      fixture.points = [
        { x: Number(fixture.at?.x ?? fixture.rect?.x ?? 0), y: Number(fixture.at?.y ?? fixture.rect?.y ?? 0) },
        {
          x: Number(fixture.at?.x ?? fixture.rect?.x ?? 0) + 2,
          y: Number(fixture.at?.y ?? fixture.rect?.y ?? 0),
        },
      ];
    }
    delete fixture.rect;
    delete fixture.at;
    delete fixture.run;
    delete fixture.ascend;
    delete fixture.radius;
    delete fixture.protrude;
    delete fixture.angleDegrees;
    fixture.connects = [];
    return;
  }

  if (nextKind === "spiral-stairs") {
    fixture.at ??= {
      x: Number(fixture.rect?.x ?? fixture.points?.[0]?.x ?? 1),
      y: Number(fixture.rect?.y ?? fixture.points?.[0]?.y ?? 1),
    };
    fixture.radius ??= 0.66;
    fixture.protrude ??= "west";
    fixture.connects ??= [];
    delete fixture.rect;
    delete fixture.points;
    delete fixture.thicknessFeet;
    delete fixture.run;
    delete fixture.ascend;
    delete fixture.angleDegrees;
    return;
  }

  if (nextKind === "straight-stairs") {
    fixture.rect ??= {
      x: Number(fixture.at?.x ?? fixture.points?.[0]?.x ?? 0.5),
      y: Number(fixture.at?.y ?? fixture.points?.[0]?.y ?? 0.5),
      w: 1.2,
      h: 0.5,
    };
    fixture.run ??= "horizontal";
    fixture.ascend ??= "end";
    fixture.angleDegrees ??= 0;
    fixture.connects ??= [];
    delete fixture.at;
    delete fixture.radius;
    delete fixture.protrude;
    delete fixture.points;
    delete fixture.thicknessFeet;
  }
}

function ensureWallPoints() {
  if (!Array.isArray(entity.value.points) || entity.value.points.length < 2) {
    entity.value.points = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ];
  }
  return entity.value.points;
}

function addWallPoint() {
  const points = ensureWallPoints();
  const last = points[points.length - 1] ?? { x: 0, y: 0 };
  points.push({ x: Number(last.x) + 1, y: Number(last.y) });
}

function removeWallPoint(index) {
  const points = ensureWallPoints();
  if (points.length <= 2) return;
  points.splice(index, 1);
}
</script>

<template>
  <section class="form-section">
    <div class="section-heading">
      <h4>Identity</h4>
      <code>{{ selection.id }}</code>
    </div>
    <p class="help-note">
      Fixtures are authored scenery and circulation pieces: stairs, walls, and future kinds.
      Map handles still move geometry when Edit geometry is on.
    </p>
    <label>Label<input v-model="entity.label" placeholder="Display label" /></label>
    <label>Kind
      <select :value="entity.kind" @change="onKindChange($event.target.value)">
        <option v-for="kind in FIXTURE_KINDS" :key="kind.id" :value="kind.id">
          {{ kind.label }}
        </option>
      </select>
    </label>
    <label class="check-field">
      <input v-model="entity.visualOnly" type="checkbox" />
      Visual only (no traversal / stair travel)
    </label>
  </section>

  <section class="form-section">
    <div class="section-heading">
      <h4>Scope</h4>
    </div>
    <fieldset class="level-fieldset">
      <legend>Levels</legend>
      <label
        v-for="level in levelOptions"
        :key="level.id"
        class="check-field"
      >
        <input
          type="checkbox"
          :checked="hasLevel(level.id)"
          @change="toggleLevel(level.id, $event.target.checked)"
        />
        {{ level.label }}
      </label>
      <p v-if="!levelOptions.length" class="help-note">No levels defined on this building.</p>
    </fieldset>
    <label v-if="isStair">Connects rooms (comma-separated ids)
      <input
        v-model="connectsText"
        list="fixture-room-options"
        placeholder="large-bay, conference"
      />
    </label>
    <datalist id="fixture-room-options">
      <option v-for="room in roomOptions" :key="room.id" :value="room.id">
        {{ room.label }}
      </option>
    </datalist>
    <p v-if="isStair" class="help-note">
      Connecting stairs need a matching feature room whose <code>feature</code> equals this fixture id
      for full vertical travel. Visual-only stairs can omit connects.
    </p>
  </section>

  <section v-if="isStraight" class="form-section">
    <div class="section-heading">
      <h4>Straight stair geometry</h4>
    </div>
    <div class="field-grid">
      <label>X<input v-model.number="entity.rect.x" type="number" step="0.01" /></label>
      <label>Y<input v-model.number="entity.rect.y" type="number" step="0.01" /></label>
      <label>Width<input v-model.number="entity.rect.w" type="number" min="0.1" step="0.01" /></label>
      <label>Height<input v-model.number="entity.rect.h" type="number" min="0.1" step="0.01" /></label>
      <label>Angle °
        <input v-model.number="entity.angleDegrees" type="number" step="0.1" />
      </label>
    </div>
    <label>Run
      <select v-model="entity.run">
        <option v-for="opt in RUN_OPTIONS" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
      </select>
    </label>
    <label>Ascend
      <select v-model="entity.ascend">
        <option v-for="opt in ASCEND_OPTIONS" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
      </select>
    </label>
  </section>

  <section v-else-if="isSpiral" class="form-section">
    <div class="section-heading">
      <h4>Spiral stair geometry</h4>
    </div>
    <div class="field-grid">
      <label>Center X<input v-model.number="entity.at.x" type="number" step="0.01" /></label>
      <label>Center Y<input v-model.number="entity.at.y" type="number" step="0.01" /></label>
      <label>Radius<input v-model.number="entity.radius" type="number" min="0.2" step="0.01" /></label>
    </div>
    <label>Protrude
      <select v-model="entity.protrude">
        <option v-for="side in PROTRUDE_OPTIONS" :key="side" :value="side">{{ side }}</option>
      </select>
    </label>
  </section>

  <section v-else-if="isWall" class="form-section">
    <div class="section-heading">
      <h4>Wall geometry</h4>
    </div>
    <label>Thickness (ft)
      <input v-model.number="entity.thicknessFeet" type="number" min="0.5" step="0.5" />
    </label>
    <p class="help-note">Drag wall points on the map with Edit geometry, or edit coordinates here.</p>
    <div
      v-for="(point, index) in ensureWallPoints()"
      :key="index"
      class="point-row"
    >
      <strong>Point {{ index + 1 }}</strong>
      <div class="field-grid">
        <label>X<input v-model.number="point.x" type="number" step="0.01" /></label>
        <label>Y<input v-model.number="point.y" type="number" step="0.01" /></label>
      </div>
      <button
        type="button"
        class="sm danger-outline"
        :disabled="(entity.points?.length ?? 0) <= 2"
        @click="removeWallPoint(index)"
      >
        Remove point
      </button>
    </div>
    <button type="button" class="sm add-btn" @click="addWallPoint">
      <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
      </svg>
      Add point
    </button>
  </section>
</template>

<style scoped>
.help-note {
  margin: 0;
  color: #8e96a3;
  font-size: 0.78rem;
  line-height: 1.4;
}
.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
}
.check-field {
  display: flex !important;
  align-items: center;
  gap: 0.45rem;
}
.check-field input { width: auto; }
.level-fieldset {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding: 0.55rem 0.65rem;
  border: 1px solid #3a4558;
  border-radius: 8px;
}
.level-fieldset legend {
  padding: 0 0.25rem;
  color: #bdc4ce;
  font-size: 0.78rem;
}
.point-row {
  display: grid;
  gap: 0.4rem;
  padding: 0.55rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #1b2028;
}
</style>
