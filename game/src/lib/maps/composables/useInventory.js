// Player inventory — keys and other carry items (story engine will share this shape).

import { displayLabel } from '../../displayLabel.js'

export function normalizeItem(raw = {}) {
  if (!raw.id) return null
  return {
    id: raw.id,
    kind: raw.kind ?? 'item',
    label: displayLabel(raw),
    description: raw.description ?? '',
  }
}

export function buildItemCatalog(items = []) {
  const catalog = {}
  for (const raw of items) {
    const item = normalizeItem(raw)
    if (item) catalog[item.id] = item
  }
  return catalog
}

/** Inventory is a Set of item ids the player carries. */
export function createInventory(initialIds = []) {
  return new Set(initialIds.filter(Boolean))
}

export function hasItem(inventory, itemId) {
  return !!itemId && inventory.has(itemId)
}

export function addItem(inventory, itemId) {
  if (!itemId) return false
  inventory.add(itemId)
  return true
}

export function removeItem(inventory, itemId) {
  return inventory.delete(itemId)
}

export function inventoryItems(inventory, catalog = {}) {
  return [...inventory].map((id) => catalog[id] ?? normalizeItem({ id })).filter(Boolean)
}

export function serializeInventory(inventory) {
  return [...inventory]
}

export function deserializeInventory(ids = []) {
  return createInventory(ids)
}
