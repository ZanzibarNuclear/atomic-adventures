import { describe, expect, it } from 'vitest'
import { axialToPixel, pixelToHex } from './useHexGeometry.js'

describe('hex geometry coordinates', () => {
  it('uses an axial convention where coordinates increase up and to the right', () => {
    const size = 44
    const origin = axialToPixel(0, 0, size)
    const east = axialToPixel(1, 0, size)
    const northeast = axialToPixel(0, 1, size)
    const northwest = axialToPixel(-1, 1, size)

    expect(east.x).toBeGreaterThan(origin.x)
    expect(east.y).toBe(origin.y)
    expect(northeast.x).toBeGreaterThan(origin.x)
    expect(northeast.y).toBeLessThan(origin.y)
    expect(northwest.x).toBeLessThan(origin.x)
    expect(northwest.y).toBeLessThan(origin.y)
  })

  it('round-trips rendered centers through pixel hit testing', () => {
    const size = 44
    const samples = [
      { q: 0, r: 0 },
      { q: 2, r: 0 },
      { q: 0, r: 2 },
      { q: -2, r: 1 },
      { q: 1, r: -2 },
    ]

    for (const sample of samples) {
      const pixel = axialToPixel(sample.q, sample.r, size)
      expect(pixelToHex(pixel.x, pixel.y, size)).toEqual(sample)
    }
  })
})
