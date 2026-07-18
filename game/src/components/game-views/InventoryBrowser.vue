<script setup>
import { computed } from "vue";
import { isActionAllowed } from "../../composables/storyActionAvailability.js";

const props = defineProps({
  holders: { type: Array, required: true },
  selectedHolding: { type: Object, default: null },
  selectedHoldingId: { type: String, default: null },
  transferTargets: { type: Array, required: true },
  publicAssetPath: { type: Function, required: true },
  actionPolicy: { type: Object, default: null },
  actionFeedback: { type: String, default: "" },
});

const emit = defineEmits(["select-holding", "transfer-item", "use-item"]);

const visibleHolders = computed(() =>
  props.holders.filter((holder) => holder.kind !== "container"),
);

const isInsideContainer = computed(() =>
  props.selectedHolding?.holder?.kind === "container",
);

const isHeldDirectly = computed(() =>
  props.selectedHolding?.holder?.kind === "character",
);

const isWithinReach = computed(() =>
  ["fixed", "vehicle", "world"].includes(props.selectedHolding?.holder?.kind),
);

const isContainerItem = computed(() =>
  props.selectedHolding?.type === "instance" &&
  props.holders.some((holder) => holder.id === `container:${props.selectedHolding.id}`),
);

const containerContents = computed(() => {
  const selected = props.selectedHolding;
  if (!selected || selected.type !== "instance" || !isContainerItem.value) return [];
  const containerHolder = props.holders.find((holder) => holder.id === `container:${selected.id}`);
  return containerHolder?.records ?? [];
});

const containerSiblingItems = computed(() => {
  if (!isInsideContainer.value) return [];
  const holder = props.holders.find((entry) => entry.id === props.selectedHolding.holder.id);
  return holder?.records ?? [];
});

const siblingIndex = computed(() =>
  containerSiblingItems.value.findIndex((record) => holdingKey(record) === props.selectedHoldingId),
);

const parentContainerKey = computed(() => {
  if (!isInsideContainer.value) return null;
  const instanceId = props.selectedHolding.holder.id.replace(/^container:/, "");
  return `instance:${instanceId}`;
});

const detailImage = computed(() => {
  const icon = props.selectedHolding?.icon;
  if (icon) return icon;
  if (props.selectedHolding?.item === "field-backpack") return "items/field-backpack.png";
  return null;
});

const visibleActions = computed(() => {
  if (!isHeldDirectly.value) return [];
  return (props.selectedHolding?.actions ?? [])
    .filter((action) =>
      isActionAllowed(`item-action:${props.selectedHolding.item}.${action.id}`, props.actionPolicy, {
        itemId: props.selectedHolding.item,
        actionId: action.id,
      }))
    .flatMap((action) => {
      const options = action.consumeOptions ?? [];
      if (!options.length) return [{ ...action, buttonLabel: action.label }];
      return options.map((option) => ({
        ...action,
        optionId: option.id,
        buttonLabel: option.label || action.label,
      }));
    });
});

const availableTransferTargets = computed(() => {
  const currentHolderId = props.selectedHolding?.holder?.id;
  const selectedId = props.selectedHolding?.id;
  if (!currentHolderId) return [];

  if (isInsideContainer.value) {
    return props.transferTargets
      .filter((target) => target.kind === "character")
      .map((target) => ({ ...target, takeOut: true }));
  }

  const targets = props.transferTargets.filter((target) => target.id !== currentHolderId);
  if (!isHeldDirectly.value) {
    if (!isWithinReach.value) return [];
    return targets
      .filter((target) => target.kind === "character")
      .map((target) => ({ ...target, pickUp: true }));
  }

  const surfaces = targets
    .filter((target) => target.kind === "fixed")
    .filter((target) => acceptsItemKind(target, props.selectedHolding?.kind))
    .map((target) => ({ ...target, putOnSurface: true }));
  const includeFloor = surfaces.length !== 1;
  const ordinaryTargets = targets
    .filter((target) => target.kind !== "fixed")
    .filter((target) => includeFloor || target.kind !== "world")
    .map((target) => {
      if (target.kind === "world") return { ...target, putDown: true };
      return target;
    });
  const containers = props.holders
    .filter((holder) => holder.kind === "container" && holder.instance !== selectedId)
    .map((holder) => ({
      id: holder.id,
      label: containerItemLabel(holder) ?? holder.label ?? holder.id,
      kind: "container",
      putIn: true,
    }));
  return [...surfaces, ...ordinaryTargets, ...containers];
});

function transferLabel(target) {
  if (target.takeOut) return "Take out";
  if (target.pickUp) return "Pick up";
  if (target.putIn) return `Put in ${target.label}`;
  if (target.putOnSurface) return `Put down on ${target.label}`;
  if (target.putDown) return "Put down";
  return `Move to ${target.label}`;
}

function acceptsItemKind(target, itemKind) {
  const kinds = target.accepts?.kinds ?? [];
  return !kinds.length || kinds.includes(itemKind);
}

function containerItemLabel(holder) {
  if (!holder.instance) return null;
  return props.holders
    .flatMap((entry) => entry.records ?? [])
    .find((record) => record.type === "instance" && record.id === holder.instance)
    ?.label ?? null;
}

function holdingKey(record) {
  return `${record.type}:${record.id}`;
}

function goToSibling(offset) {
  const nextIndex = siblingIndex.value + offset;
  const nextItem = containerSiblingItems.value[nextIndex];
  if (!nextItem) return;
  emit("select-holding", holdingKey(nextItem));
}

function closeToContainer() {
  if (parentContainerKey.value) emit("select-holding", parentContainerKey.value);
}
</script>

<template>
  <div class="inventory-layout">
    <div class="inventory-list-pane">
      <section v-for="holder in visibleHolders" :key="holder.id" class="inventory-group">
        <h3>{{ holder.label ?? holder.id }}</h3>
        <div class="item-grid">
          <button
            v-for="item in holder.records"
            :key="holdingKey(item)"
            type="button"
            class="item-card"
            :class="{ selected: selectedHoldingId === holdingKey(item) }"
            :aria-pressed="selectedHoldingId === holdingKey(item)"
            @click="$emit('select-holding', holdingKey(item))">
            <img
              v-if="item.icon || item.item === 'field-backpack'"
              :src="publicAssetPath(item.icon || 'items/field-backpack.png')"
              alt="">
            <span class="item-card-body">
              <strong>{{ item.label }}</strong>
              <small v-if="item.quantity !== 1">× {{ item.quantity }}</small>
              <small v-else-if="item.kind === 'container' && holders.some((entry) => entry.id === `container:${item.id}`)">
                {{ holders.find((entry) => entry.id === `container:${item.id}`)?.records.length ?? 0 }} inside
              </small>
            </span>
          </button>
        </div>
      </section>
      <p v-if="!visibleHolders.some((holder) => holder.records.length)" class="empty-state">
        You are not carrying anything yet.
      </p>
    </div>

    <aside class="item-detail" aria-live="polite">
      <p v-if="actionFeedback" class="action-feedback">{{ actionFeedback }}</p>
      <template v-if="selectedHolding">
        <div class="detail-top">
          <p class="label">Item Details</p>
          <div v-if="isInsideContainer" class="content-nav" aria-label="Browse container contents">
            <button
              type="button"
              class="icon-btn"
              :disabled="siblingIndex <= 0"
              aria-label="Previous item"
              @click="goToSibling(-1)">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 5l-6 6h12l-6-6z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              class="icon-btn"
              :disabled="siblingIndex >= containerSiblingItems.length - 1"
              aria-label="Next item"
              @click="goToSibling(1)">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 19l6-6H6l6 6z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              class="icon-btn close-btn"
              aria-label="Back to container"
              @click="closeToContainer">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div class="detail-hero">
          <div v-if="detailImage" class="detail-image">
            <img :src="publicAssetPath(detailImage)" :alt="selectedHolding.label">
          </div>
          <div class="detail-summary">
            <h3>{{ selectedHolding.label }}</h3>
            <p class="detail-description">
              {{ selectedHolding.description || "No description has been authored." }}
            </p>
            <p v-if="selectedHolding.quantity !== 1" class="detail-meta">
              Quantity: {{ selectedHolding.quantity }}
            </p>
            <p v-if="selectedHolding.remaining != null" class="detail-meta">
              Remaining: {{ Math.round(Number(selectedHolding.remaining) * 100) }}%
            </p>
          </div>
        </div>

        <div
          v-if="availableTransferTargets.length || visibleActions.length"
          class="focus-actions"
          :class="{ 'has-contents-below': containerContents.length }">
          <div v-if="availableTransferTargets.length" class="item-actions">
            <button
              v-for="target in availableTransferTargets"
              :key="target.id"
              type="button"
              class="sm transfer-btn"
              :class="{
                'take-out': target.takeOut,
                'put-down': target.putDown,
                'put-in': target.putIn,
              }"
              @click="$emit('transfer-item', {
                type: selectedHolding.type,
                recordId: selectedHolding.id,
                itemId: selectedHolding.item,
                quantity: selectedHolding.quantity,
                toHolder: target.id,
              })">
              <svg
                v-if="target.takeOut"
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
              {{ transferLabel(target) }}
            </button>
          </div>

          <div v-if="visibleActions.length" class="item-actions">
            <button
              v-for="action in visibleActions"
              :key="action.id"
              type="button"
              class="sm"
              @click="$emit('use-item', {
                itemId: selectedHolding.item,
                actionId: action.id,
                optionId: action.optionId ?? null,
                recordId: selectedHolding.id,
                holderId: selectedHolding.holder?.id,
              })">
              {{ action.buttonLabel }}
            </button>
          </div>
        </div>

        <section v-if="containerContents.length" class="container-contents">
          <h4>Inside</h4>
          <ul class="contents-list">
            <li v-for="item in containerContents" :key="holdingKey(item)">
              <button
                type="button"
                class="content-item"
                :class="{ selected: selectedHoldingId === holdingKey(item) }"
                @click="$emit('select-holding', holdingKey(item))">
                <img
                  v-if="item.icon"
                  :src="publicAssetPath(item.icon)"
                  alt="">
                <span>
                  <strong>{{ item.label }}</strong>
                  <small v-if="item.quantity !== 1">× {{ item.quantity }}</small>
                </span>
              </button>
            </li>
          </ul>
        </section>
      </template>
      <p v-else class="empty-state">Select an item to inspect it.</p>
    </aside>
  </div>
</template>

<style scoped>
.inventory-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 1rem;
}
.inventory-group + .inventory-group {
  margin-top: 1.25rem;
}
.inventory-group h3 {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #9eb4d4;
}
.item-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.55rem;
  margin-top: 0.65rem;
}
.item-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 3.5rem;
  padding: 0.65rem 0.75rem;
  text-align: left;
  border: 1px solid rgba(120, 150, 195, 0.28);
  border-radius: 10px;
  background: rgba(28, 36, 52, 0.82);
  color: #e8edf5;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.item-card:hover {
  border-color: rgba(140, 175, 220, 0.45);
  background: rgba(34, 44, 64, 0.92);
}
.item-card.selected {
  border-color: #7aa3d4;
  background: rgba(42, 58, 88, 0.95);
  box-shadow: inset 0 0 0 1px rgba(122, 163, 212, 0.25);
}
.item-card img {
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 auto;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35));
}
.item-card-body {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}
.item-card-body strong {
  font-size: 0.95rem;
  font-weight: 600;
}
.item-card small,
.empty-state,
.detail-meta {
  color: #93a3bc;
}
.item-detail {
  align-self: start;
  min-height: 12rem;
  padding: 1.1rem 1.2rem;
  border: 1px solid rgba(120, 150, 195, 0.32);
  border-radius: 12px;
  background: rgba(18, 24, 36, 0.78);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}
.action-feedback {
  margin: 0 0 0.85rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid rgba(128, 190, 154, 0.42);
  border-radius: 8px;
  background: rgba(65, 110, 82, 0.2);
  color: #d8f2df;
  font-size: 0.92rem;
}
.detail-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.item-detail .label {
  margin: 0;
  color: #8faed6;
}
.content-nav {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.icon-btn {
  display: grid;
  place-items: center;
  width: 1.85rem;
  height: 1.85rem;
  padding: 0;
  border: 1px solid rgba(120, 150, 195, 0.28);
  border-radius: 6px;
  background: rgba(28, 36, 52, 0.82);
  color: #c5d0e0;
}
.icon-btn:hover:not(:disabled) {
  border-color: rgba(140, 175, 220, 0.45);
  background: rgba(34, 44, 64, 0.92);
  color: #eef3fb;
}
.icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.icon-btn svg {
  width: 1rem;
  height: 1rem;
}
.icon-btn.close-btn {
  margin-left: 0.15rem;
}
.item-detail h3 {
  margin: 0;
  font-size: 1.25rem;
  color: #eef3fb;
}
.detail-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1rem;
  margin-top: 0.75rem;
  align-items: start;
}
.detail-image {
  width: 7.5rem;
  padding: 0.65rem;
  border-radius: 12px;
  background: rgba(32, 42, 62, 0.85);
  border: 1px solid rgba(120, 150, 195, 0.22);
}
.detail-image img {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35));
}
.detail-summary {
  display: grid;
  gap: 0.55rem;
}
.detail-description {
  margin: 0;
  line-height: 1.55;
  color: #c5d0e0;
}
.focus-actions.has-contents-below {
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(120, 150, 195, 0.2);
}
.focus-actions {
  margin-top: 0.9rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.focus-actions .item-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0;
}
.focus-actions .item-actions + .item-actions {
  margin-top: 0;
}
.container-contents {
  margin-top: 1rem;
  padding-top: 0;
}
.container-contents h4 {
  margin: 0 0 0.55rem;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #9eb4d4;
}
.contents-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.45rem;
}
.content-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  padding: 0.55rem 0.65rem;
  text-align: left;
  border: 1px solid rgba(120, 150, 195, 0.22);
  border-radius: 8px;
  background: rgba(28, 36, 52, 0.65);
  color: #e8edf5;
}
.content-item:hover,
.content-item.selected {
  border-color: rgba(122, 163, 212, 0.55);
  background: rgba(38, 50, 72, 0.85);
}
.content-item img {
  width: 1.75rem;
  height: 1.75rem;
  object-fit: contain;
}
.content-item span {
  display: grid;
  gap: 0.1rem;
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
.transfer-btn.take-out,
.transfer-btn.put-in {
  border-color: rgba(122, 163, 212, 0.45);
  background: rgba(42, 62, 92, 0.75);
}
.transfer-btn.put-down {
  border-color: rgba(150, 165, 190, 0.4);
  background: rgba(36, 44, 58, 0.75);
}
.transfer-icon {
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
}
@media (max-width: 720px) {
  .inventory-layout {
    grid-template-columns: 1fr;
  }
  .item-detail {
    order: -1;
  }
  .detail-hero {
    grid-template-columns: 1fr;
  }
  .detail-image {
    width: min(100%, 8rem);
  }
}
</style>
