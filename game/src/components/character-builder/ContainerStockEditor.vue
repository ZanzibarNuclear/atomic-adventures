<script setup>
import { computed, onMounted, ref, watch } from "vue";
import {
  containerHolderId,
  ensureHoldings,
  listHolderContents,
  listItemInstances,
  placeContainerAt,
  removeStartingInstance,
  removeStockRecord,
  setStackQuantity,
  stockIntoHolder,
  ensureContainerHolder,
} from "../../lib/character/holdingsAuthoring.js";
import { useBuildingContent, refreshBuildingContent } from "../../composables/useBuildingContent.js";
import BuilderBtnIcon from "../builder/BuilderBtnIcon.vue";

const props = defineProps({
  draft: { type: Object, required: true },
  entry: { type: Object, required: true },
});

const { buildingData } = useBuildingContent();
const stockError = ref("");
const stockOk = ref("");
const roomId = ref("");
const standId = ref("");
const contentItemId = ref("");
const contentQuantity = ref(14);

const holdings = computed(() => ensureHoldings(props.draft));

const itemsById = computed(() =>
  Object.fromEntries((props.draft.items ?? []).map((item) => [item.id, item])),
);

const rooms = computed(() =>
  [...(buildingData.value?.rooms ?? [])]
    .map((room) => ({
      id: room.id,
      label: room.label || room.id,
      stands: room.stands ?? [],
    }))
    .sort((a, b) => a.label.localeCompare(b.label)),
);

const selectedRoom = computed(() =>
  rooms.value.find((room) => room.id === roomId.value) ?? null,
);

const stands = computed(() =>
  [...(selectedRoom.value?.stands ?? [])]
    .map((stand) => ({
      id: stand.id,
      label: stand.label || stand.id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label)),
);

const stockableItems = computed(() =>
  (props.draft.items ?? []).filter((item) => item.id !== props.entry.id),
);

const defaultContentItemId = computed(() => {
  const consumable = stockableItems.value.find((item) => item.kind === "consumable");
  return consumable?.id ?? stockableItems.value[0]?.id ?? "";
});

const placements = computed(() =>
  listItemInstances(holdings.value, props.entry.id).map((instance) => {
    const holder = holdings.value.holders?.[instance.holder];
    const location = holder?.location ?? {};
    const room = rooms.value.find((entry) => entry.id === location.room);
    const stand = room?.stands?.find((entry) => entry.id === location.stand);
    const where = holder?.kind === "character"
      ? "Player inventory"
      : [
          room?.label || location.room,
          stand?.label || location.stand,
        ].filter(Boolean).join(" · ") || (holder?.label || instance.holder);
    return {
      instanceId: instance.id,
      holderId: instance.holder,
      where,
      contents: listHolderContents(
        holdings.value,
        containerHolderId(instance.id),
        itemsById.value,
      ),
    };
  }),
);

onMounted(() => {
  void refreshBuildingContent();
});

watch(
  () => props.entry.id,
  () => {
    stockError.value = "";
    stockOk.value = "";
    contentItemId.value = defaultContentItemId.value;
    contentQuantity.value = Number(props.entry.container?.capacity?.slots) || 14;
    preferKitchenDefaults();
  },
  { immediate: true },
);

watch(rooms, () => preferKitchenDefaults(), { deep: true });

watch(roomId, () => {
  if (!stands.value.some((stand) => stand.id === standId.value)) {
    standId.value = stands.value[0]?.id ?? "";
  }
});

watch(defaultContentItemId, (id) => {
  if (!contentItemId.value && id) contentItemId.value = id;
});

function preferKitchenDefaults() {
  if (roomId.value && rooms.value.some((room) => room.id === roomId.value)) return;
  const kitchen = rooms.value.find((room) => room.id === "kitchen")
    ?? rooms.value[0];
  roomId.value = kitchen?.id ?? "";
  const cabinets = kitchen?.stands?.find((stand) => stand.id === "cabinets")
    ?? kitchen?.stands?.[0];
  standId.value = cabinets?.id ?? "";
}

function placeHere() {
  stockError.value = "";
  stockOk.value = "";
  try {
    if (!roomId.value) throw new Error("Choose a room.");
    const room = selectedRoom.value;
    const stand = stands.value.find((entry) => entry.id === standId.value);
    const contentItem = contentItemId.value
      ? itemsById.value[contentItemId.value]
      : null;
    if (contentItemId.value && !contentItem) {
      throw new Error("Choose a valid content item, or clear contents.");
    }
    const quantity = contentItem
      ? Math.max(0, Math.floor(Number(contentQuantity.value) || 0))
      : 0;
    placeContainerAt(holdings.value, props.entry, {
      room: roomId.value,
      stand: standId.value || null,
      roomLabel: room?.label,
      standLabel: stand?.label,
      contentItem,
      contentQuantity: quantity,
    });
    const where = [room?.label || roomId.value, stand?.label || standId.value]
      .filter(Boolean)
      .join(" · ");
    stockOk.value = quantity > 0
      ? `Placed one ${props.entry.label || props.entry.id} at ${where} with ${quantity}× ${contentItem.label || contentItem.id}.`
      : `Placed one empty ${props.entry.label || props.entry.id} at ${where}.`;
  } catch (error) {
    stockError.value = error.message;
  }
}

function addMoreContents(instanceId) {
  stockError.value = "";
  stockOk.value = "";
  try {
    const item = itemsById.value[contentItemId.value];
    if (!item) throw new Error("Choose an item to add.");
    const holderId = ensureContainerHolder(holdings.value, instanceId, props.entry);
    stockIntoHolder(holdings.value, item, {
      holderId,
      quantity: Math.max(1, Math.floor(Number(contentQuantity.value) || 1)),
    });
    stockOk.value = `Added more ${item.label || item.id}.`;
  } catch (error) {
    stockError.value = error.message;
  }
}

function updateQuantity(stackId, quantity) {
  stockError.value = "";
  try {
    setStackQuantity(holdings.value, stackId, quantity);
  } catch (error) {
    stockError.value = error.message;
  }
}

function removeContent(type, id) {
  stockError.value = "";
  try {
    removeStockRecord(holdings.value, type, id);
  } catch (error) {
    stockError.value = error.message;
  }
}

function removePlacement(instanceId) {
  stockError.value = "";
  stockOk.value = "";
  try {
    const contents = listHolderContents(holdings.value, containerHolderId(instanceId));
    for (const record of contents) {
      removeStockRecord(holdings.value, record.type, record.id);
    }
    removeStartingInstance(holdings.value, instanceId);
    stockOk.value = "Removed placement.";
  } catch (error) {
    stockError.value = error.message;
  }
}
</script>

<template>
  <section class="stock-editor">
    <div class="section-heading">
      <h4>Place in the station</h4>
      <code>instances</code>
    </div>
    <p class="intro">
      The Details tab defines this <em>kind</em> of box (capacity, what it accepts).
      Here you place <em>copies</em> of it in the utility station and optionally fill them.
      Room and stand come from World Builder geometry — no free-typed IDs.
    </p>

    <p v-if="stockError" class="stock-error">{{ stockError }}</p>
    <p v-if="stockOk" class="stock-ok">{{ stockOk }}</p>

    <div class="place-form">
      <label>Room
        <select v-model="roomId">
          <option value="" disabled>Select room…</option>
          <option v-for="room in rooms" :key="room.id" :value="room.id">
            {{ room.label }} ({{ room.id }})
          </option>
        </select>
      </label>
      <label>Stand
        <select v-model="standId" :disabled="!roomId">
          <option value="">Whole room (no stand)</option>
          <option v-for="stand in stands" :key="stand.id" :value="stand.id">
            {{ stand.label }} ({{ stand.id }})
          </option>
        </select>
      </label>
      <label>Fill with (optional)
        <select v-model="contentItemId">
          <option value="">Empty container</option>
          <option
            v-for="item in stockableItems"
            :key="item.id"
            :value="item.id">
            {{ item.label || item.id }}
          </option>
        </select>
      </label>
      <label v-if="contentItemId">Quantity
        <input v-model.number="contentQuantity" type="number" min="1">
      </label>
      <div class="place-actions">
        <button type="button" class="sm add-btn" :disabled="!roomId" @click="placeHere">
          <BuilderBtnIcon name="add" />
          Place here
        </button>
      </div>
    </div>

    <div class="placements">
      <p class="label">Placements of this container</p>
      <p v-if="!placements.length" class="empty-note">None yet — use Place here.</p>
      <article
        v-for="placement in placements"
        :key="placement.instanceId"
        class="placement-card">
        <div class="section-heading">
          <div>
            <strong>{{ placement.where }}</strong>
            <code>{{ placement.instanceId }}</code>
          </div>
          <button
            type="button"
            class="sm danger-outline"
            @click="removePlacement(placement.instanceId)">
            <BuilderBtnIcon name="remove" />
            Remove
          </button>
        </div>

        <p v-if="!placement.contents.length" class="empty-note">Empty.</p>
        <ul v-else class="content-list">
          <li
            v-for="record in placement.contents"
            :key="`${record.type}:${record.id}`"
            class="content-row">
            <strong>{{ record.label }}</strong>
            <label v-if="record.type === 'stack'" class="qty-field">
              Qty
              <input
                type="number"
                min="1"
                :value="record.quantity"
                @change="updateQuantity(record.id, $event.target.value)">
            </label>
            <span v-else class="qty-static">×1</span>
            <button
              type="button"
              class="sm danger-outline"
              @click="removeContent(record.type, record.id)">
              <BuilderBtnIcon name="remove" />
              Remove
            </button>
          </li>
        </ul>

        <div v-if="contentItemId" class="add-more">
          <button
            type="button"
            class="sm add-btn"
            @click="addMoreContents(placement.instanceId)">
            <BuilderBtnIcon name="add" />
            Add more of selected item
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.stock-editor {
  display: grid;
  gap: 0.75rem;
  padding: 0.8rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #151a22;
}
.intro,
.empty-note {
  margin: 0;
  color: #8f98a6;
  font-size: 0.82rem;
  line-height: 1.45;
}
.stock-error {
  margin: 0;
  color: #e88c8c;
  font-size: 0.85rem;
}
.stock-ok {
  margin: 0;
  color: #bce8c7;
  font-size: 0.85rem;
}
.place-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #1b2028;
}
.place-actions {
  grid-column: 1 / -1;
  display: flex;
  gap: 0.5rem;
}
.placements {
  display: grid;
  gap: 0.55rem;
}
.label {
  margin: 0;
  color: #9da7b5;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.placement-card {
  display: grid;
  gap: 0.55rem;
  padding: 0.75rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #1b2028;
}
.placement-card strong {
  color: #eef1f5;
  font-size: 0.9rem;
}
.placement-card code {
  display: block;
  margin-top: 0.15rem;
  color: #9da7b5;
  font-size: 0.74rem;
}
.content-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.4rem;
}
.content-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 0.45rem;
  align-items: center;
}
.qty-field {
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
}
.qty-field input {
  width: 4.5rem;
}
.qty-static {
  color: #9da7b5;
  font-size: 0.8rem;
}
.danger-outline {
  border-color: #9b5050;
  color: #ffb5b5;
  background: #3d2729;
}
@media (max-width: 900px) {
  .place-form,
  .content-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
