/**
 * Shared vocabulary for item `kind` values.
 * Kind is used for inventory grouping, container acceptance, and builder UX.
 * It does not grant hidden gameplay powers by itself.
 */
export const ITEM_KIND_OPTIONS = [
  { id: "key", label: "Key", description: "Opens locks when a door or action names this item." },
  { id: "tool", label: "Tool", description: "Portable equipment used by actions or simulations." },
  { id: "container", label: "Container", description: "Unique item that can hold other solid items." },
  {
    id: "vessel",
    label: "Vessel",
    description: "Glass, bottle, bowl, or hopper that holds liquid or granular contents by volume.",
  },
  { id: "consumable", label: "Consumable", description: "Food, bulk liquid, medicine, and similar usable goods." },
  { id: "part", label: "Part", description: "Components, wrappers, empties, and salvage." },
  { id: "card", label: "Card", description: "Instruction cards and similar thin documents." },
  { id: "book", label: "Book", description: "Manuals and readable texts." },
  { id: "quest", label: "Quest", description: "Quest-critical props that should stay distinct." },
  { id: "item", label: "Item (generic)", description: "Unclassified portable object." },
];

export const ITEM_KIND_IDS = ITEM_KIND_OPTIONS.map((option) => option.id);

export function isKnownItemKind(kind) {
  return ITEM_KIND_IDS.includes(String(kind ?? "").trim());
}

export function itemKindLabel(kind) {
  return ITEM_KIND_OPTIONS.find((option) => option.id === kind)?.label ?? kind ?? "Item";
}

/** Default container config for newly marked containers. */
export function defaultContainerConfig({ slots = 12, massKg = null, kinds = null } = {}) {
  return {
    capacity: {
      ...(Number.isFinite(Number(slots)) ? { slots: Number(slots) } : {}),
      ...(Number.isFinite(Number(massKg)) && Number(massKg) > 0
        ? { massKg: Number(massKg) }
        : {}),
    },
    accepts: {
      kinds: kinds ?? ITEM_KIND_IDS.filter((id) => id !== "container"),
    },
    nesting: false,
  };
}
