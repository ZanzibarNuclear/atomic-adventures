/**
 * Gameplay travel harness — same stack as App.vue (useOutdoorWorld + gameState).
 * Use for smoke tests that must catch locked-gate, moveTo, and UI gating bugs.
 * For pure geometry/barrier checks without game flags, use travelWorld.js.
 */

import utilityData from '../../../../content/world/utility-station.yaml'
import { createGameState } from '../../../composables/useGameState.js'
import { useOutdoorWorld } from '../composables/useOutdoorWorld.js'

export const GATE_FLAG_UNLOCKED = 'compound.gate-unlocked'
export const GATE_FLAG_PASSED = 'compound.gate-passed'
import { hexDistance } from '../composables/useHexGeometry.js'

/**
 * @param {object} mapData — parsed map.yaml
 * @param {{ startHex?: string, flags?: string[] }} [opts]
 */
export function buildGameplayWorld(mapData, opts = {}) {
  const gameState = createGameState({ mapData, buildingData: utilityData })
  if (opts.flags?.length) {
    for (const f of opts.flags) gameState.flags.add(f)
  }
  const outdoor = useOutdoorWorld(mapData, gameState)
  const startHex = opts.startHex ?? mapData.start ?? mapData.journey?.[0]
  outdoor.state.currentId = startHex
  outdoor.state.stand = outdoor.defaultStandForHex(startHex)
  outdoor.state.lastBlocked = null
  outdoor.state.atBarrier = null
  return { outdoor, gameState, mapData }
}

/** Hex ids offered as route or direct moves from the current stand. */
export function offeredDestinations(outdoor) {
  return [
    ...new Set([
      ...(outdoor.moves ?? []).map((m) => m.toHexId),
      ...(outdoor.directMoves ?? []).map((m) => m.toHexId),
    ]),
  ]
}

export function canReachHex(outdoor, hexId) {
  if (typeof outdoor.canReachHex === 'function') return outdoor.canReachHex(hexId)
  return offeredDestinations(outdoor).includes(hexId)
}

/** moveTo; clears traveling guard so back-to-back moves work in tests. */
export function gameplayMoveTo(outdoor, hexId) {
  outdoor.moveTo(hexId)
  outdoor.traveling = false
  return { ...outdoor.state.stand }
}

/** Solve gate puzzle and cross the compound gate (required before heading south). */
export function passCompoundGate(outdoor) {
  outdoor.unlockPassage('compound-gate')
  outdoor.crossPassage('compound-gate')
}

/**
 * Walk consecutive journey legs using moveTo.
 * @param {string[]} hexIds — consecutive hex ids
 */
export function walkGameplayPath(outdoor, hexIds) {
  for (let i = 1; i < hexIds.length; i++) {
    gameplayMoveTo(outdoor, hexIds[i])
  }
}

export function isAdjacent(mapData, aId, bId) {
  const hexById = Object.fromEntries((mapData.hexes ?? []).map((h) => [h.id, h]))
  const a = hexById[aId]
  const b = hexById[bId]
  if (!a || !b) return false
  return hexDistance(a, b) === 1
}
