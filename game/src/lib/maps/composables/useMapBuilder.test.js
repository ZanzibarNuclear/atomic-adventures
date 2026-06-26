import { describe, expect, it } from 'vitest'
import { exportMapYaml } from './useMapBuilder.js'

describe('outdoor map builder export', () => {
  it('serializes all passage kinds without losing movement fields', () => {
    const features = [
      {
        id: 'yard-gate',
        kind: 'gate',
        hex: 'yard',
        visibility: 'obvious',
        at: { x: 10.4, y: 20.6 },
        boothAt: { x: 3, y: 4 },
        label: 'Yard gate',
        require: { all: ['yard.gate-unlocked'] },
        unlock: {
          label: 'Unlock the yard gate',
          status: 'The yard gate is locked.',
          set_flags: ['yard.gate-unlocked'],
        },
        on_cross: { set_flags: ['yard.gate-passed'] },
      },
      {
        id: 'hidden-hole',
        kind: 'hole',
        hex: 'woods',
        visibility: 'hidden',
        at: { hex: 'woods', dx: 0.18, dy: -0.2 },
        radius: 16,
      },
      {
        id: 'gorge-bridge',
        kind: 'bridge',
        hex: 'gorge',
        visibility: 'obvious',
        at: { x: -20, y: -30 },
      },
      {
        id: 'river-ford',
        kind: 'ford',
        hex: 'river',
        visibility: 'hidden',
        at: { hex: 'river', dx: -0.1, dy: 0.25 },
      },
      {
        id: 'cliff-stair',
        kind: 'stair',
        hex: 'cliff',
        visibility: 'obvious',
        at: { x: 7, y: 8 },
        labelAt: { x: 9, y: 10 },
      },
    ]

    const yaml = exportMapYaml([], features, []).features

    expect(yaml).toContain('kind: gate')
    expect(yaml).toContain('boothAt: { x: 3, y: 4 }')
    expect(yaml).toContain('label: "Yard gate"')
    expect(yaml).toContain('require:\n      all: [yard.gate-unlocked]')
    expect(yaml).toContain('unlock:\n      label: "Unlock the yard gate"')
    expect(yaml).toContain('status: "The yard gate is locked."')
    expect(yaml).toContain('set_flags: [yard.gate-unlocked]')
    expect(yaml).toContain('on_cross:\n      set_flags: [yard.gate-passed]')
    expect(yaml).toContain('kind: hole')
    expect(yaml).toContain('visibility: hidden')
    expect(yaml).toContain('at: { hex: woods, dx: 0.18, dy: -0.2 }')
    expect(yaml).toContain('radius: 16')
    expect(yaml).toContain('kind: bridge')
    expect(yaml).toContain('kind: ford')
    expect(yaml).toContain('at: { hex: river, dx: -0.1, dy: 0.25 }')
    expect(yaml).toContain('kind: stair')
    expect(yaml).toContain('labelAt: { x: 9, y: 10 }')
  })

  it('serializes river cascades on the river instead of the hex', () => {
    const features = [
      {
        id: 'mountain-river',
        kind: 'river',
        smooth: true,
        points: [
          { hex: 'upper-gorge', dx: 0.1, dy: 0.2 },
          { hex: 'utility-yard', dx: -0.3, dy: 0.4 },
        ],
        cascades: [{ id: 'utility-falls', from: 0.55, to: 0.82 }],
      },
    ]
    const hexes = [
      {
        id: 'utility-yard',
        q: -2,
        r: 1,
        terrain: 'clearing',
        landmark: { building: 'utility-station' },
      },
    ]

    const yaml = exportMapYaml([], features, hexes)

    expect(yaml.features).toContain('cascades:\n      - { id: utility-falls, from: 0.55, to: 0.82 }')
    expect(yaml.hexes).not.toContain('area:')
    expect(yaml.hexes).not.toContain('cascade:')
  })
})
