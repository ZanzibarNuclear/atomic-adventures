<script setup>
import { ref } from "vue";
import PublicImagePicker from "./PublicImagePicker.vue";

const props = defineProps({
  draft: { type: Object, required: true },
  entry: { type: Object, required: true },
  visibilityOptions: { type: Array, required: true },
  setJson: { type: Function, required: true },
});

const activeTab = ref("details");
const wellbeingStatIds = new Set(["satiety", "hydration", "energy", "composure", "health"]);

function wellbeingStats() {
  return (props.draft.stats ?? []).filter((stat) => wellbeingStatIds.has(stat.id));
}

function consumptionActions(entry) {
  return (entry.actions ?? []).filter((action) =>
    action.consumeOptions?.length || action.effects?.some((effect) => effect.scaleBy === "portion")
  );
}

function ensureConsumptionAction(entry) {
  entry.actions ??= [];
  let action = consumptionActions(entry)[0];
  if (action) return action;
  const water = /water|bottle/i.test(entry.label ?? entry.id);
  action = {
    id: water ? "drink" : "eat",
    label: water ? "Drink" : "Eat",
    consume: 0,
    consumeOptions: [
      { id: "small", label: water ? "Sip" : "Nibble", portion: 0.25 },
      { id: "half", label: water ? "Drink half" : "Eat half", portion: 0.5 },
      { id: "all", label: water ? "Drink all remaining" : "Eat all remaining", remaining: true },
    ],
    depletedItem: null,
    timeMinutes: water ? 2 : 5,
    activity: "resting",
    effects: [{
      op: "stat.add",
      id: water ? "hydration" : "satiety",
      value: water ? 100 : 40,
      scaleBy: "portion",
    }],
    view: null,
  };
  entry.actions.push(action);
  return action;
}

function fullImpact(action, statId) {
  return action.effects?.find((effect) =>
    effect.op === "stat.add" && effect.id === statId && effect.scaleBy === "portion"
  )?.value ?? 0;
}

function setFullImpact(action, statId, value) {
  action.effects ??= [];
  let effect = action.effects.find((candidate) =>
    candidate.op === "stat.add" && candidate.id === statId && candidate.scaleBy === "portion"
  );
  if (!effect) {
    effect = { op: "stat.add", id: statId, value: 0, scaleBy: "portion" };
    action.effects.push(effect);
  }
  effect.value = Number(value);
}

function addConsumeOption(action) {
  action.consumeOptions ??= [];
  action.consumeOptions.push({
    id: `option-${action.consumeOptions.length + 1}`,
    label: "Consume some",
    portion: 0.25,
  });
}

function removeConsumeOption(action, index) {
  action.consumeOptions.splice(index, 1);
}
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

      <label class="check-field"><input v-model="entry.portable" type="checkbox"> Portable</label>

      <section v-if="entry.kind === 'consumable'" class="consumable-panel">
        <div class="section-heading">
          <h4>Consumable tuning</h4>
          <button type="button" class="sm" @click="ensureConsumptionAction(entry)">
            Add consumption action
          </button>
        </div>
        <p class="custom-intro">
          Full-item impact is scaled by the selected portion and the instance remaining amount.
        </p>
        <article
          v-for="action in consumptionActions(entry)"
          :key="action.id"
          class="consume-action">
          <div class="field-grid">
            <label>Action ID<input v-model="action.id"></label>
            <label>Button label<input v-model="action.label"></label>
            <label>Time minutes<input v-model.number="action.timeMinutes" type="number" min="0"></label>
            <label>Activity
              <select v-model="action.activity">
                <option value="resting">Resting</option>
                <option value="light">Light</option>
                <option value="moderate">Moderate</option>
                <option value="strenuous">Strenuous</option>
              </select>
            </label>
            <label>Empty/depleted item
              <select v-model="action.depletedItem">
                <option :value="null">None</option>
                <option v-for="item in draft.items" :key="item.id" :value="item.id">
                  {{ item.label || item.id }}
                </option>
              </select>
            </label>
          </div>

          <div class="field-grid">
            <label
              v-for="stat in wellbeingStats()"
              :key="stat.id">
              Full {{ stat.label || stat.id }} impact
              <input
                type="number"
                :value="fullImpact(action, stat.id)"
                @input="setFullImpact(action, stat.id, $event.target.value)">
            </label>
          </div>

          <div class="consume-options">
            <div class="section-heading">
              <h5>Player portion choices</h5>
              <button type="button" class="sm muted" @click="addConsumeOption(action)">Add choice</button>
            </div>
            <div
              v-for="(option, index) in action.consumeOptions"
              :key="option.id"
              class="consume-option-row">
              <label>ID<input v-model="option.id"></label>
              <label>Label<input v-model="option.label"></label>
              <label class="check-field">
                <input v-model="option.remaining" type="checkbox">
                All remaining
              </label>
              <label v-if="!option.remaining">Portion of full item
                <input v-model.number="option.portion" type="number" min="0.01" max="1" step="0.01">
              </label>
              <button type="button" class="sm muted" @click="removeConsumeOption(action, index)">Remove</button>
            </div>
          </div>
        </article>
      </section>
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
.consumable-panel,
.consume-action {
  display: grid;
  gap: 0.75rem;
  padding: 0.8rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #151a22;
}
.consume-options {
  display: grid;
  gap: 0.55rem;
}
.consume-options h5 {
  margin: 0;
}
.consume-option-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
  gap: 0.5rem;
  align-items: end;
}
@media (max-width: 900px) {
  .consume-option-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
