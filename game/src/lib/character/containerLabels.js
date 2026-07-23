/**
 * Player-facing labels for container instances based on what is inside.
 * Same catalog box type + different meal flavors → distinguishable names.
 */

export function containerContentsRecords(holdings, definitions, instanceId) {
  const holderId = `container:${instanceId}`;
  if (!holdings?.holders?.[holderId]) return [];
  const stacks = Object.entries(holdings.stacks ?? {})
    .filter(([, stack]) => stack.holder === holderId)
    .map(([id, stack]) => ({
      type: "stack",
      id,
      item: stack.item,
      quantity: Number(stack.quantity) || 0,
      definition: itemDefinition(definitions, stack.item),
    }));
  const instances = Object.entries(holdings.instances ?? {})
    .filter(([, instance]) => instance.holder === holderId)
    .map(([id, instance]) => ({
      type: "instance",
      id,
      item: instance.item,
      quantity: 1,
      remaining: instance.remaining,
      definition: itemDefinition(definitions, instance.item),
    }));
  return [...stacks, ...instances];
}

/**
 * Short flavor from a meal/item label, e.g.
 * "Tastee Tack: Turkey Cranberry Dinner" → "Turkey Cranberry Dinner"
 */
export function contentFlavorLabel(definitionOrLabel) {
  const label = typeof definitionOrLabel === "string"
    ? definitionOrLabel
    : (definitionOrLabel?.label || definitionOrLabel?.id || "");
  const trimmed = String(label).trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/^Tastee\s+Tack:\s*/i, "")
    .replace(/^Box of\s+/i, "")
    .trim();
}

/**
 * Label for one container instance using its primary contents when distinctive.
 */
export function containerInstanceLabel(holdings, definitions, instanceId, {
  baseLabel = null,
  itemId = null,
} = {}) {
  const definition = itemId ? itemDefinition(definitions, itemId) : null;
  const base = baseLabel
    || definition?.label
    || itemId
    || "Container";
  const contents = containerContentsRecords(holdings, definitions, instanceId);
  if (!contents.length) {
    return emptyContainerLabel(base);
  }

  const byItem = new Map();
  for (const record of contents) {
    const entry = byItem.get(record.item) ?? {
      item: record.item,
      quantity: 0,
      label: record.definition?.label || record.item,
    };
    entry.quantity += Number(record.quantity) || 0;
    byItem.set(record.item, entry);
  }
  const kinds = [...byItem.values()];
  if (kinds.length === 1) {
    return singleContentContainerLabel(base, kinds[0].label, kinds[0].quantity);
  }

  const flavors = kinds.map((entry) => contentFlavorLabel(entry.label)).filter(Boolean);
  if (/tastee\s*tack/i.test(base) || flavors.some((flavor) => /tastee/i.test(flavor))) {
    return `Mixed Tastee Tack box (${flavors.join(", ")})`;
  }
  return `${base} (${flavors.join(", ")})`;
}

function singleContentContainerLabel(base, contentLabel, quantity) {
  const flavor = contentFlavorLabel(contentLabel);
  if (!flavor) return base;
  if (/tastee\s*tack/i.test(base) || /tastee\s*tack/i.test(contentLabel)) {
    return quantity > 1
      ? `Box of Tastee Tack: ${flavor}`
      : `Box of Tastee Tack: ${flavor}`;
  }
  if (/box/i.test(base)) {
    return `${base} — ${flavor}`;
  }
  return `${base} (${flavor})`;
}

function emptyContainerLabel(base) {
  if (/tastee\s*tack/i.test(base)) return "Empty Tastee Tack box";
  if (/^box\b/i.test(base)) return `Empty ${base.charAt(0).toLowerCase()}${base.slice(1)}`;
  return `Empty ${base}`;
}

/**
 * Group label for inspecting several containers of the same catalog item.
 */
export function containerGroupInspectLabel(baseLabel, count) {
  if (/tastee\s*tack/i.test(baseLabel || "")) {
    return count === 1 ? "Inspect the Tastee Tack box" : "Inspect the Tastee Tack boxes";
  }
  if (/box/i.test(baseLabel || "")) {
    return count === 1 ? "Inspect the box" : "Inspect the boxes";
  }
  return count === 1 ? "Inspect the container" : `Inspect the containers (${count})`;
}

/**
 * Discovery copy when several same-type containers differ only by contents.
 */
export function formatContainerGroupDiscovery(baseLabel, flavoredLabels) {
  const count = flavoredLabels.length;
  if (!count) return null;
  if (count === 1) return `There is ${withIndefiniteArticle(flavoredLabels[0])}.`;

  const flavors = flavoredLabels.map((label) => {
    const match = String(label).match(/Tastee Tack:\s*(.+)$/i);
    return match?.[1] || contentFlavorLabel(label) || label;
  });

  if (/tastee\s*tack/i.test(baseLabel || "") || flavoredLabels.some((label) => /tastee/i.test(label))) {
    if (flavors.length === 2) {
      return `There are two boxes of Tastee Tack (${flavors[0]} and ${flavors[1]}).`;
    }
    return `There are ${count} boxes of Tastee Tack (${flavors.slice(0, -1).join(", ")}, and ${flavors.at(-1)}).`;
  }

  return `There are ${count} containers: ${formatList(flavoredLabels)}.`;
}

function formatList(labels) {
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

function withIndefiniteArticle(label) {
  const raw = String(label ?? "").trim();
  if (!raw) return "";
  if (/^(the|a|an)\s/i.test(raw)) return raw;
  if (/^[aeiou]/i.test(raw)) return `an ${raw}`;
  return `a ${raw}`;
}

function itemDefinition(definitions, id) {
  return (definitions?.items ?? []).find((item) => item.id === id) ?? null;
}
