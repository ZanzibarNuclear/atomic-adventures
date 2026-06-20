<script setup>
defineProps({
  holders: { type: Array, required: true },
  selectedHolding: { type: Object, default: null },
  selectedHoldingId: { type: String, default: null },
  transferTargets: { type: Array, required: true },
  publicAssetPath: { type: Function, required: true },
});

defineEmits(["select-holding", "transfer-item", "use-item"]);
</script>

<template>
  <div class="inventory-layout">
    <div>
      <section v-for="holder in holders" :key="holder.id" class="inventory-group">
        <h3>{{ holder.label ?? holder.id }}</h3>
        <div class="item-grid">
          <button
            v-for="item in holder.records"
            :key="`${item.type}:${item.id}`"
            type="button"
            class="item-card"
            :class="{ selected: selectedHoldingId === `${item.type}:${item.id}` }"
            :aria-pressed="selectedHoldingId === `${item.type}:${item.id}`"
            @click="$emit('select-holding', `${item.type}:${item.id}`)">
            <img v-if="item.icon" :src="publicAssetPath(item.icon)" alt="">
            <span>
              <strong>{{ item.label }}</strong>
              <small v-if="item.quantity !== 1">Quantity {{ item.quantity }}</small>
            </span>
          </button>
        </div>
      </section>
      <p v-if="!holders.some((holder) => holder.records.length)" class="empty-state">
        You are not carrying anything yet.
      </p>
    </div>

    <aside class="item-detail" aria-live="polite">
      <template v-if="selectedHolding">
        <p class="label">{{ selectedHolding.kind }}</p>
        <h3>{{ selectedHolding.label }}</h3>
        <p>{{ selectedHolding.description || "No description has been authored." }}</p>
        <p v-if="selectedHolding.quantity !== 1">Quantity: {{ selectedHolding.quantity }}</p>
        <p class="related-document">Location: {{ selectedHolding.holder.label ?? selectedHolding.holder.id }}</p>
        <p v-if="selectedHolding.relatedDocument" class="related-document">
          Related document: {{ selectedHolding.relatedDocument }}
        </p>
        <div v-if="transferTargets.length > 1" class="item-actions">
          <button
            v-for="target in transferTargets.filter((holder) => holder.id !== selectedHolding.holder.id)"
            :key="target.id"
            type="button"
            class="sm"
            @click="$emit('transfer-item', {
              type: selectedHolding.type,
              recordId: selectedHolding.id,
              itemId: selectedHolding.item,
              quantity: selectedHolding.quantity,
              toHolder: target.id,
            })">
            Move to {{ target.label }}
          </button>
        </div>
        <div v-if="selectedHolding.actions?.length" class="item-actions">
          <button
            v-for="action in selectedHolding.actions"
            :key="action.id"
            type="button"
            class="sm"
            @click="$emit('use-item', { itemId: selectedHolding.item, actionId: action.id })">
            {{ action.label }}
          </button>
        </div>
      </template>
      <p v-else class="empty-state">Select an item to inspect it.</p>
    </aside>
  </div>
</template>

<style scoped>
.inventory-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(15rem, 1fr);
  gap: 1rem;
}
.inventory-group + .inventory-group {
  margin-top: 1.25rem;
}
h3 { margin: 0; }
.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: 0.65rem;
  margin-top: 0.65rem;
}
.item-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 4rem;
  text-align: left;
  background: #282f39;
}
.item-card.selected {
  border-color: #7cad87;
  background: #334238;
}
.item-card img {
  width: 2.4rem;
  height: 2.4rem;
  object-fit: contain;
}
.item-card span {
  display: grid;
  gap: 0.2rem;
}
.item-card small,
.empty-state,
.related-document {
  color: #8f98a6;
}
.item-detail {
  align-self: start;
  min-height: 10rem;
  padding: 1rem;
  border: 1px solid #394454;
  border-radius: 10px;
  background: rgba(24, 29, 37, 0.72);
}
.item-detail h3 {
  margin-top: 0.2rem;
}
.item-actions {
  display: flex;
  flex-wrap: wrap;
  gap: .45rem;
  margin-top: .8rem;
}
@media (max-width: 720px) {
  .inventory-layout {
    grid-template-columns: 1fr;
  }
  .item-detail {
    order: -1;
  }
}
</style>
