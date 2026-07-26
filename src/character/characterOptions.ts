export type CharacterClass = 'warrior' | 'cleric' | 'wizard' | 'rogue'

export const DEFAULT_CHARACTER_CLASS: CharacterClass = 'warrior'
export const DEFAULT_SKIN_COLOR = '#e0b48a'

export const CHARACTER_CLASS_OPTIONS: { id: CharacterClass; label: string }[] = [
  { id: 'warrior', label: 'นักรบ' },
  { id: 'cleric', label: 'นักบวช' },
  { id: 'wizard', label: 'นักเวท' },
  { id: 'rogue', label: 'โจร' },
]

export const SKIN_COLOR_OPTIONS = ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5a3825']
