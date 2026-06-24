import { describe, it, expect } from 'vitest'
import { mapData } from '../../testing/content.js'
import { buildGameplayWorld, gameplayMoveTo } from './gameplayTravel.js'
import { useOutdoorWorld } from '../composables/useOutdoorWorld.js'

describe('the-flats to gate-woods gameplay', () => {
  it('enters gate-woods from default the-flats stand', () => {
    const { outdoor } = buildGameplayWorld(mapData)
    outdoor.state.currentId = 'the-flats'
    outdoor.state.stand = outdoor.defaultStandForHex('the-flats')
    gameplayMoveTo(outdoor, 'gate-woods')
    expect(outdoor.state.currentId).toBe('gate-woods')
    expect(outdoor.state.stand.y).toBeGreaterThan(-61)
  })

  it('enters gate-woods after ford crossing from west bank column', () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'upper-gorge'
    outdoor.state.stand = outdoor.defaultStandForHex('upper-gorge')
    outdoor.state.discoveredOpenings = ['the-flats-ford']
    outdoor.crossPassage('upper-gorge-bridge')
    gameplayMoveTo(outdoor, 'lower-gorge')
    gameplayMoveTo(outdoor, 'the-flats')
    expect(outdoor.state.currentId).toBe('the-flats')
    outdoor.crossPassage('the-flats-ford')
    gameplayMoveTo(outdoor, 'gate-woods')
    expect(outdoor.state.currentId).toBe('gate-woods')
    expect(outdoor.state.stand.y).toBeGreaterThan(-61)
  })
})
