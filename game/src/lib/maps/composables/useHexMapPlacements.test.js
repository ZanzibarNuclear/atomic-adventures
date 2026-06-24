import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { sortFeatureDrawPieces } from './useHexMapPlacements.js'

const here = dirname(fileURLToPath(import.meta.url))

describe('hex map feature placement', () => {
  it('draws road-like features below fences', () => {
    const pieces = [
      { kind: 'fence', id: 'fence' },
      { kind: 'road', id: 'road' },
      { kind: 'trail', id: 'trail' },
      { kind: 'drive', id: 'drive' },
    ]

    expect(sortFeatureDrawPieces(pieces).map((piece) => piece.kind)).toEqual([
      'road',
      'trail',
      'drive',
      'fence',
    ])
  })

  it('renders route lines below fences and passage markers', () => {
    const source = readFileSync(
      resolve(here, '../components/HexMap.vue'),
      'utf8',
    )

    const routeIndex = source.indexOf('<HexRouteLayer')
    const featureIndex = source.indexOf('<HexFeatureLayer')
    const passageIndex = source.indexOf('<HexPassageLayer')

    expect(routeIndex).toBeGreaterThan(-1)
    expect(featureIndex).toBeGreaterThan(-1)
    expect(passageIndex).toBeGreaterThan(-1)
    expect(routeIndex).toBeLessThan(featureIndex)
    expect(featureIndex).toBeLessThan(passageIndex)
  })
})
