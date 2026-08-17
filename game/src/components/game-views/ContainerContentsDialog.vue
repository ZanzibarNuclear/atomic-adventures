<template>
  <Teleport to="body">
    <div
      class="container-modal-backdrop"
      role="presentation"
      @click.self="$emit('close')">
      <section
        class="container-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="container-dialog-title">
        <header class="container-dialog-header">
          <div>
            <p class="label">Looking inside</p>
            <h2 id="container-dialog-title">{{ containerLabel }}</h2>
            <p v-if="locationLabel" class="location-line">{{ locationLabel }}</p>
          </div>
          <button
            type="button"
            class="container-close"
            aria-label="Close"
            title="Close"
            @click="$emit('close')">
            ×
          </button>
        </header>

        <p class="intro">
          Take items out. The container stays where it is.
        </p>

        <div class="container-layout">
          <div class="contents-pane">
            <h3>Contents</h3>
            <p v-if="!contents.length" class="empty-state">Empty.</p>
            <div v-else class="item-grid">
              <button
                v-for="item in contents"
                :key="holdingKey(item)"
                type="button"
                class="item-card"
                :class="{ selected: selectedHoldingId === holdingKey(item) }"
                :aria-pressed="selectedHoldingId === holdingKey(item)"
                @click="$emit('select-holding', holdingKey(item))">
                <img
                  v-if="item.icon"
                  :src="publicAssetPath(item.icon)"
                  alt="">
                <span class="item-card-body">
                  <strong>{{ item.label }}</strong>
                  <small v-if="item.quantity !== 1">× {{ item.quantity }}</small>
                </span>
              </button>
            </div>
          </div>

          <aside class="item-detail" aria-live="polite">
            <template v-if="selectedHolding">
              <p class="label">Item</p>
              <div class="detail-hero">
                <div v-if="selectedHolding.icon" class="detail-image">
                  <img
                    :src="publicAssetPath(selectedHolding.icon)"
                    :alt="selectedHolding.label">
                </div>
                <div class="detail-summary">
                  <h3>{{ selectedHolding.label }}</h3>
                  <p class="detail-description">
                    {{ selectedHolding.description || "No description has been authored." }}
                  </p>
                  <p v-if="selectedHolding.quantity !== 1" class="detail-meta">
                    Quantity: {{ selectedHolding.quantity }}
                  </p>
                </div>
              </div>

              <div v-if="takeActions.length" class="item-actions">
                <button
                  v-for="action in takeActions"
                  :key="action.actionKey"
                  type="button"
                  class="sm transfer-btn take-out"
                  @click="$emit('transfer-item', {
                    type: selectedHolding.type,
                    recordId: selectedHolding.id,
                    itemId: selectedHolding.item,
                    quantity: action.quantity,
                    toHolder: characterHolderId,
                  })">
                  <svg
                    class="transfer-icon"
                    viewBox="0 0 24 24"
                    aria-hidden="true">
                    <path
                      d="M12 21V11m0 0l-3.5 3.5M12 11l3.5 3.5M5 9V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.75"
                      stroke-linecap="round"
                      stroke-linejoin="round" />
                  </svg>
                  {{ action.buttonLabel }}
                </button>
              </div>
              <p v-else class="empty-state">Cannot take this item right now.</p>
            </template>
            <p v-else-if="contents.length" class="empty-state">
              Select an item to take it out.
            </p>
            <p v-else class="empty-state">
              Nothing left inside.
            </p>
          </aside>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  containerLabel: { type: String, required: true },
  locationLabel: { type: String, default: "" },
  contents: { type: Array, required: true },
  selectedHolding: { type: Object, default: null },
  selectedHoldingId: { type: String, default: null },
  characterHolderId: { type: String, required: true },
  publicAssetPath: { type: Function, required: true },
});

defineEmits(["close", "select-holding", "transfer-item"]);

const takeActions = computed(() => {
  const holding = props.selectedHolding;
  if (!holding || !props.characterHolderId) return [];
  if (holding.definition?.properties?.bound === true || holding.portable === false) return [];
  const quantity = Math.max(1, Number(holding.quantity) || 1);
  if (holding.type === "stack" && quantity > 1) {
    return [
      { actionKey: "one", quantity: 1, buttonLabel: "Take one" },
      { actionKey: "all", quantity, buttonLabel: `Take all (${quantity})` },
    ];
  }
  return [
    {
      actionKey: "full",
      quantity,
      buttonLabel: quantity > 1 ? `Take (${quantity})` : "Take",
    },
  ];
});

function holdingKey(record) {
  return `${record.type}:${record.id}`;
}
</script>

<style scoped>
.container-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(7, 9, 12, 0.68);
}
.container-dialog {
  width: min(46rem, 100%);
  max-height: min(40rem, calc(100vh - 2rem));
  overflow: auto;
  border: 1px solid rgba(120, 150, 195, 0.34);
  border-radius: 8px;
  background: #171b22;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
  padding: 1rem;
  color: #e8edf5;
}
.container-dialog-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.65rem;
}
.container-dialog-header .label,
.item-detail .label {
  margin: 0;
  color: #8faed6;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.container-dialog-header h2 {
  margin: 0.15rem 0 0;
  font-size: 1.15rem;
  letter-spacing: 0;
}
.location-line,
.intro {
  margin: 0.25rem 0 0;
  color: #93a3bc;
  font-size: 0.85rem;
  line-height: 1.4;
}
.intro {
  margin: 0 0 0.85rem;
  color: #b7d4a8;
}
.container-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  background: transparent;
  color: #e8edf5;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}
.container-close:hover,
.container-close:focus-visible {
  color: #ffffff;
}
.container-layout {
  display: grid;
  grid-template-columns: minmax(12rem, 0.95fr) minmax(14rem, 1.15fr);
  gap: 0.85rem;
  align-items: start;
}
.contents-pane h3 {
  margin: 0 0 0.55rem;
  font-size: 0.85rem;
  color: #c5d0e0;
}
.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
  gap: 0.5rem;
}
.item-card {
  display: grid;
  gap: 0.4rem;
  width: 100%;
  min-height: 5.5rem;
  padding: 0.55rem;
  border: 1px solid rgba(120, 150, 195, 0.28);
  border-radius: 8px;
  background: rgba(28, 36, 52, 0.82);
  color: #e8edf5;
  text-align: left;
  cursor: pointer;
}
.item-card:hover {
  border-color: rgba(140, 175, 220, 0.45);
  background: rgba(34, 44, 64, 0.92);
}
.item-card.selected {
  border-color: #6ea57b;
  box-shadow: 0 0 0 1px #6ea57b;
}
.item-card img {
  width: 2.4rem;
  height: 2.4rem;
  object-fit: contain;
}
.item-card-body {
  display: grid;
  gap: 0.15rem;
}
.item-card strong {
  font-size: 0.88rem;
  font-weight: 600;
}
.item-card small,
.empty-state,
.detail-meta {
  color: #93a3bc;
  font-size: 0.8rem;
}
.item-detail {
  min-height: 10rem;
  padding: 0.9rem 1rem;
  border: 1px solid rgba(120, 150, 195, 0.32);
  border-radius: 12px;
  background: rgba(18, 24, 36, 0.78);
}
.detail-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.75rem;
  margin: 0.55rem 0 0.85rem;
  align-items: start;
}
.detail-image {
  width: 4.5rem;
  height: 4.5rem;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: rgba(28, 36, 52, 0.9);
  border: 1px solid rgba(120, 150, 195, 0.22);
}
.detail-image img {
  max-width: 3.4rem;
  max-height: 3.4rem;
  object-fit: contain;
}
.detail-summary h3 {
  margin: 0 0 0.35rem;
  font-size: 1.05rem;
}
.detail-description {
  margin: 0;
  color: #b8c4d6;
  font-size: 0.88rem;
  line-height: 1.45;
}
.detail-meta {
  margin: 0.4rem 0 0;
}
.item-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.transfer-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.transfer-btn.take-out {
  border-color: #5f8a68;
  background: #2d4334;
  color: #d7f0dc;
}
.transfer-icon {
  width: 1rem;
  height: 1rem;
}
.empty-state {
  margin: 0.35rem 0 0;
}
@media (max-width: 720px) {
  .container-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
