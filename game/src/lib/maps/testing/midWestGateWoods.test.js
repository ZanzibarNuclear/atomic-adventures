import { describe, it, expect } from 'vitest'
import { mapData } from '../../testing/content.js'
import { buildGameplayWorld, gameplayMoveTo } from './gameplayTravel.js'
import { useOutdoorWorld } from '../composables/useOutdoorWorld.js'

describe('mid-west to gate-woods gameplay', () => {
  it('enters gate-woods from default mid-west stand', () => {
    const { outdoor } = buildGameplayWorld(mapData)
    outdoor.state.currentId = 'mid-west'
    outdoor.state.stand = outdoor.defaultStandForHex('mid-west')
    gameplayMoveTo(outdoor, 'gate-woods')
    expect(outdoor.state.currentId).toBe('gate-woods')
    expect(outdoor.state.stand.y).toBeGreaterThan(-61)
  })

  it('enters gate-woods after ford crossing from west bank column', () => {
    const outdoor = useOutdoorWorld(mapData)
    outdoor.state.currentId = 'upper-gorge'
    outdoor.state.stand = outdoor.defaultStandForHex('upper-gorge')
    outdoor.state.discoveredOpenings = ['mid-west-ford']
    outdoor.crossPassage('upper-gorge-bridge')
    gameplayMoveTo(outdoor, 'lower-gorge')
    gameplayMoveTo(outdoor, 'mid-west')
    expect(outdoor.state.currentId).toBe('mid-west')
    outdoor.crossPassage('mid-west-ford')
    gameplayMoveTo(outdoor, 'gate-woods')
    expect(outdoor.state.currentId).toBe('gate-woods')
    expect(outdoor.state.stand.y).toBeGreaterThan(-61)
  })
})
