import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LEVELS } from './levels'
import { PLAYER_MAX_HP, BASE_ATTACK_POWER } from './constants'
import { DEFAULT_SKIN_COLOR } from '../character/characterOptions'

// The store persists progress to Supabase on nearly every action — none of
// that belongs in a unit test for the state machine, so every module on
// that path is stubbed out.
vi.mock('../audio/soundEngine', () => ({
  playAttackImpact: vi.fn(),
  playPlayerHurt: vi.fn(),
}))
vi.mock('../auth/authStore', () => ({
  useAuthStore: { getState: () => ({ session: null }) },
}))
vi.mock('./persistence', () => ({
  saveProgress: vi.fn(),
  submitScore: vi.fn(),
}))

const { useGameStore } = await import('./store')

function defeatAllMonstersInLevel(levelIndex: number) {
  const ids = LEVELS[levelIndex].monsters.map((m) => m.id)
  useGameStore.setState({ defeatedIds: new Set(ids) })
  return ids
}

describe('useGameStore', () => {
  beforeEach(() => {
    useGameStore.getState().resetSave()
  })

  it('starts with the documented defaults', () => {
    const s = useGameStore.getState()
    expect(s.phase).toBe('exploring')
    expect(s.currentLevel).toBe(1)
    expect(s.playerHp).toBe(PLAYER_MAX_HP)
    expect(s.attackPower).toBe(BASE_ATTACK_POWER)
    expect(s.characterClass).toBeNull()
    expect(s.characterName).toBeNull()
    expect(s.paused).toBe(false)
  })

  it('enterCombat switches to combat and seeds full HP for a new monster', () => {
    useGameStore.getState().enterCombat({ id: 'slime-1', name: 'Slime', maxHp: 30, attackInterval: 10 })
    const s = useGameStore.getState()
    expect(s.phase).toBe('combat')
    expect(s.activeMonsterId).toBe('slime-1')
    expect(s.monsterHp['slime-1']).toBe(30)
  })

  it('damageMonster clamps at 0 and marks the monster defeated', () => {
    useGameStore.getState().enterCombat({ id: 'slime-1', name: 'Slime', maxHp: 30, attackInterval: 10 })
    useGameStore.getState().damageMonster(999)
    const s = useGameStore.getState()
    expect(s.monsterHp['slime-1']).toBe(0)
    expect(s.defeatedIds.has('slime-1')).toBe(true)
  })

  it('damagePlayer clamps at 0 and moves the phase to gameover', () => {
    useGameStore.getState().damagePlayer(PLAYER_MAX_HP + 50)
    const s = useGameStore.getState()
    expect(s.playerHp).toBe(0)
    expect(s.phase).toBe('gameover')
  })

  it('healPlayer clamps at PLAYER_MAX_HP', () => {
    useGameStore.getState().damagePlayer(20)
    useGameStore.getState().healPlayer(999)
    expect(useGameStore.getState().playerHp).toBe(PLAYER_MAX_HP)
  })

  it('exitCombat advances to the next level once every monster in the current level is defeated', () => {
    const ids = defeatAllMonstersInLevel(0)
    useGameStore.setState({ currentLevel: 1, activeMonsterId: ids[ids.length - 1], playerHp: 100 })

    useGameStore.getState().exitCombat()

    const s = useGameStore.getState()
    expect(s.currentLevel).toBe(2)
    expect(s.phase).toBe('exploring')
    expect(s.activeMonsterId).toBeNull()
  })

  it('exitCombat sets phase to victory after the final level is fully cleared', () => {
    const lastLevelIndex = LEVELS.length - 1
    const ids = defeatAllMonstersInLevel(lastLevelIndex)
    useGameStore.setState({ currentLevel: LEVELS.length, activeMonsterId: ids[ids.length - 1], playerHp: 100 })

    useGameStore.getState().exitCombat()

    expect(useGameStore.getState().phase).toBe('victory')
  })

  it('exitCombat treats an undefeated monster as a flee, not a level clear', () => {
    useGameStore.getState().enterCombat({ id: 'slime-1', name: 'Slime', maxHp: 30, attackInterval: 10 })
    useGameStore.setState({ playerHp: 100 })

    useGameStore.getState().exitCombat()

    const s = useGameStore.getState()
    expect(s.phase).toBe('exploring')
    expect(s.currentLevel).toBe(1)
    expect(s.fledMonsterId).toBe('slime-1')
  })

  it('exitCombat is a no-op while the player is already dead', () => {
    useGameStore.setState({ playerHp: 0, activeMonsterId: 'slime-1', phase: 'gameover' })

    useGameStore.getState().exitCombat()

    expect(useGameStore.getState().activeMonsterId).toBe('slime-1')
    expect(useGameStore.getState().phase).toBe('gameover')
  })

  it('confirmCharacter stores the chosen class, skin, and name', () => {
    useGameStore.getState().confirmCharacter('wizard', '#abcdef', 'Gandalf')
    const s = useGameStore.getState()
    expect(s.characterClass).toBe('wizard')
    expect(s.skinColor).toBe('#abcdef')
    expect(s.characterName).toBe('Gandalf')
  })

  it('hydrateSave derives gameover from a save persisted at 0 HP', () => {
    useGameStore.getState().hydrateSave({
      defeatedMonsterIds: ['slime-1'],
      playerHp: 0,
      attackPower: BASE_ATTACK_POWER,
      collectedPickupIds: [],
      currentLevel: 2,
      skillCooldown: 0,
      characterClass: 'rogue',
      skinColor: DEFAULT_SKIN_COLOR,
      characterName: 'Shade',
    })
    const s = useGameStore.getState()
    expect(s.phase).toBe('gameover')
    expect(s.defeatedIds.has('slime-1')).toBe(true)
    expect(s.currentLevel).toBe(2)
  })

  it('hydrateSave derives exploring from a save with HP remaining', () => {
    useGameStore.getState().hydrateSave({
      defeatedMonsterIds: [],
      playerHp: 50,
      attackPower: BASE_ATTACK_POWER,
      collectedPickupIds: [],
      currentLevel: 1,
      skillCooldown: 0,
      characterClass: null,
      skinColor: DEFAULT_SKIN_COLOR,
      characterName: null,
    })
    expect(useGameStore.getState().phase).toBe('exploring')
  })

  it('setPaused toggles the paused flag without touching phase', () => {
    useGameStore.getState().enterCombat({ id: 'slime-1', name: 'Slime', maxHp: 30, attackInterval: 10 })
    useGameStore.getState().setPaused(true)
    expect(useGameStore.getState().paused).toBe(true)
    expect(useGameStore.getState().phase).toBe('combat')
    useGameStore.getState().setPaused(false)
    expect(useGameStore.getState().paused).toBe(false)
  })

  it('restart resets progress but keeps the chosen character, and clears any stuck pause', () => {
    useGameStore.getState().confirmCharacter('cleric', '#111111', 'Elora')
    useGameStore.setState({ currentLevel: 3, playerHp: 10, paused: true })

    useGameStore.getState().restart()

    const s = useGameStore.getState()
    expect(s.currentLevel).toBe(1)
    expect(s.playerHp).toBe(PLAYER_MAX_HP)
    expect(s.paused).toBe(false)
    expect(s.characterClass).toBe('cleric')
    expect(s.characterName).toBe('Elora')
  })

  it('resetSave clears the chosen character and any stuck pause', () => {
    useGameStore.getState().confirmCharacter('cleric', '#111111', 'Elora')
    useGameStore.setState({ paused: true })

    useGameStore.getState().resetSave()

    const s = useGameStore.getState()
    expect(s.characterClass).toBeNull()
    expect(s.characterName).toBeNull()
    expect(s.paused).toBe(false)
  })
})
