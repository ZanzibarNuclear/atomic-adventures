/** Pine-mountainside terrain palette and legend styling for HexMap layers. */
export const TERRAIN_COLORS = {
  forest: '#4f7e57',
  clearing: '#8fae6e',
  rock: '#9a9d94',
  water: '#5f93c4',
}

export const FOG_COLOR = '#222a25'

export const TERRAIN_LABELS = {
  forest: 'Forest',
  clearing: 'Clearing',
  rock: 'Rocks',
  water: 'Water',
}

export const TERRAIN_ORDER = ['forest', 'clearing', 'rock', 'water']

export const LINE_STYLE = {
  river: { label: 'River', stroke: '#4a90d9', width: 4, dash: '' },
  road: { label: 'Road', stroke: '#8a8073', width: 5, dash: '' },
  drive: { label: 'Driveway', stroke: '#9b917f', width: 4, dash: '' },
  fence: { label: 'Fence', stroke: '#c9b89a', width: 3, dash: '2 6' },
  path: { label: 'Trail', stroke: '#7a4f2a', width: 3, dash: '3 4' },
  trail: { label: 'Trail', stroke: '#c9b97e', width: 3, dash: '2 5' },
}

export const LINE_ORDER = ['river', 'road', 'drive', 'fence', 'path', 'trail']

export const PASSAGE_LABELS = {
  gate: 'Gate',
  hole: 'Hole',
  ford: 'Ford',
  bridge: 'Bridge',
}

export const PASSAGE_ORDER = ['gate', 'hole', 'ford', 'bridge']
