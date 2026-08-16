<template>
  <Teleport to="body">
    <div
      class="meal-modal-backdrop"
      role="presentation"
      @click.self="$emit('close')">
      <section
        class="meal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="eat-drink-title">
        <header class="meal-dialog-header">
          <div>
            <p class="label">Until you're satisfied</p>
            <h2 id="eat-drink-title">Eat and drink</h2>
            <p class="intro">Choose what to eat and drink. The rest is taken care of.</p>
          </div>
          <button
            type="button"
            class="meal-close"
            aria-label="Close"
            title="Close"
            @click="$emit('close')">
            ×
          </button>
        </header>

        <fieldset v-if="needFood && food.length" class="choice-set">
          <legend>Eat</legend>
          <label
            v-for="entry in food"
            :key="entry.id"
            class="choice-card"
            :class="{ selected: foodId === entry.id }">
            <input
              v-model="foodId"
              type="radio"
              name="eat-and-drink-food"
              :value="entry.id">
            <span>
              <strong>{{ entry.label }}</strong>
              <small v-if="entry.detail">{{ entry.detail }}</small>
            </span>
          </label>
        </fieldset>

        <fieldset v-if="needDrink && drink.length" class="choice-set">
          <legend>Drink</legend>
          <label
            v-for="entry in drink"
            :key="entry.id"
            class="choice-card"
            :class="{ selected: drinkId === entry.id }">
            <input
              v-model="drinkId"
              type="radio"
              name="eat-and-drink-drink"
              :value="entry.id">
            <span>
              <strong>{{ entry.label }}</strong>
              <small v-if="entry.detail">{{ entry.detail }}</small>
            </span>
          </label>
        </fieldset>

        <footer class="meal-actions">
          <button type="button" class="sm" @click="$emit('close')">Cancel</button>
          <button
            type="button"
            class="sm brand"
            :disabled="!canConfirm"
            @click="confirm">
            Eat and drink
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
  food: { type: Array, default: () => [] },
  drink: { type: Array, default: () => [] },
  needFood: { type: Boolean, default: true },
  needDrink: { type: Boolean, default: true },
});

const emit = defineEmits(["close", "confirm"]);

const foodId = ref(null);
const drinkId = ref(null);

watch(
  () => [props.food, props.drink, props.needFood, props.needDrink],
  () => {
    foodId.value = props.needFood && props.food.length === 1 ? props.food[0].id : null;
    drinkId.value = props.needDrink && props.drink.length === 1 ? props.drink[0].id : null;
  },
  { immediate: true },
);

const canConfirm = computed(() => {
  if (props.needFood && !foodId.value) return false;
  if (props.needDrink && !drinkId.value) return false;
  return true;
});

function confirm() {
  if (!canConfirm.value) return;
  emit("confirm", {
    foodId: props.needFood ? foodId.value : null,
    drinkId: props.needDrink ? drinkId.value : null,
  });
}
</script>

<style scoped>
.meal-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(7, 9, 12, 0.68);
}
.meal-dialog {
  width: min(36rem, 100%);
  max-height: min(40rem, calc(100vh - 2rem));
  overflow: auto;
  border: 1px solid rgba(120, 150, 195, 0.34);
  border-radius: 8px;
  background: #171b22;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
  padding: 1rem;
  color: #e8edf5;
}
.meal-dialog-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
}
.meal-dialog-header .label {
  margin: 0;
  color: #8faed6;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.meal-dialog-header h2 {
  margin: 0.15rem 0 0;
  font-size: 1.12rem;
}
.intro {
  margin: 0.4rem 0 0;
  color: #b7d4a8;
  font-size: 0.88rem;
  line-height: 1.45;
}
.meal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  background: transparent;
  color: #e8edf5;
  font-size: 1.25rem;
  cursor: pointer;
}
.choice-set {
  margin: 0 0 0.85rem;
  padding: 0;
  border: 0;
  display: grid;
  gap: 0.45rem;
}
.choice-set legend {
  padding: 0 0 0.35rem;
  color: #8faed6;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.choice-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.65rem;
  align-items: start;
  padding: 0.7rem 0.75rem;
  border: 1px solid rgba(120, 150, 195, 0.28);
  border-radius: 8px;
  background: rgba(28, 36, 52, 0.82);
  cursor: pointer;
}
.choice-card.selected {
  border-color: rgba(32, 200, 251, 0.55);
  background: rgba(24, 48, 62, 0.9);
}
.choice-card input {
  margin-top: 0.2rem;
}
.choice-card strong {
  display: block;
  font-size: 0.95rem;
}
.choice-card small {
  display: block;
  margin-top: 0.25rem;
  color: #93a3bc;
  font-size: 0.82rem;
}
.meal-actions {
  display: flex;
  justify-content: end;
  gap: 0.5rem;
  margin-top: 0.35rem;
}
</style>
