import { describe, it, expect } from 'vitest'
import { mapData } from '../../testing/content.js'
import { utilityData } from '../../testing/content.js'
import { createGameState, captureSnapshot } from '../../../composables/useGameState.js'
import { useOutdoorWorld } from '../composables/useOutdoorWorld.js'
import { useIndoorBuilding } from '../composables/useIndoorBuilding.js'
import { evaluateMapViewport } from '../composables/useHexMapViewport.js'
import { buildGameplayWorld, gameplayMoveTo } from './gameplayTravel.js'

/** Typical play-panel width ÷ height (matches game layout). */
const PANEL_ASPECT = 900 / 380

describe('gameplay viewport at east-pines', () => {
  it('shows in-view discovered hexes when standing on east-pines', () => {
    const { outdoor } = buildGameplayWorld(mapData)
    gameplayMoveTo(outdoor, 'east-pines')

    const vp = evaluateMapViewport({
      allHexes: mapData.hexes,
      currentHexId: outdoor.state.currentId,
      discovered: outdoor.state.discovered,
      mode: 'gameplay',
      size: mapData.size ?? 44,
    })

    expect(vp.visibleHexes.map((h) => h.id).sort()).toEqual([
      'east-pines',
      'origin',
    ])
  })

  it('builds a save snapshot with discovered west hexes on screen at east-pines', () => {
    const place = { value: 'outdoors' }
    const builderView = { value: false }
    const gameState = createGameState({ mapData, buildingData: utilityData })
    const outdoor = useOutdoorWorld(mapData, gameState)
    const indoor = useIndoorBuilding(utilityData, outdoor, {
      place,
      builderView,
      gameState,
    })

    outdoor.state.currentId = 'east-pines'
    outdoor.state.discovered = [
      'origin',
      'east-pines',
      'center-pines',
      'utility-yard',
      'the-flats',
      'west-slope',
    ]
    outdoor.state.stand = outdoor.defaultStandForHex('east-pines')

    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor })
    expect(snapshot.outdoor.currentId).toBe('east-pines')
    expect(snapshot.outdoor.discovered).toContain('utility-yard')

    const vp = evaluateMapViewport({
      allHexes: mapData.hexes,
      currentHexId: snapshot.outdoor.currentId,
      discovered: snapshot.outdoor.discovered,
      mode: 'gameplay',
      size: mapData.size ?? 44,
      panelAspect: PANEL_ASPECT,
    })

    expect(vp.visibleHexes.map((h) => h.id).sort()).toEqual([
      'center-pines',
      'east-pines',
      'origin',
      'the-flats',
      'utility-yard',
      'west-slope',
    ])
  })
})
