import { create } from 'zustand'
import { useAuthStore } from '../auth/authStore'
import { saveProgress, submitScore, type SaveData } from './persistence'
import { LEVELS } from './levels'
import { PLAYER_MAX_HP, BASE_ATTACK_POWER, SKILL_COOLDOWN_SECONDS, ATTACK_COOLDOWN_SECONDS } from './constants'
import { DEFAULT_SKIN_COLOR, type CharacterClass } from '../character/characterOptions'
import { playAttackImpact, playPlayerHurt } from '../audio/soundEngine'

export type CombatMonster = {
  id: string
  name: string
  maxHp: number
  attackInterval: number
}

type GamePhase = 'exploring' | 'combat' | 'gameover'

type GameState = {
  phase: GamePhase
  currentLevel: number
  activeMonsterId: string | null
  monsterHp: Record<string, number>
  defeatedIds: Set<string>
  fledMonsterId: string | null
  playerHp: number
  attackPower: number
  collectedPickupIds: Set<string>
  skillCooldown: number
  // Ephemeral pacing for the regular attack box — unlike skillCooldown this
  // is never persisted to Supabase (see startAttackCooldown), it's short
  // enough that losing it on a page reload isn't worth a DB migration.
  attackCooldown: number
  // Seconds until the current monster's next attack — driven by
  // CombatTicker, displayed as a countdown in CombatOverlay. Never
  // persisted, same reasoning as attackCooldown.
  monsterAttackCountdown: number
  characterClass: CharacterClass | null
  skinColor: string
  saveLoaded: boolean

  enterCombat: (monster: CombatMonster) => void
  damageMonster: (amount: number) => void
  damagePlayer: (amount: number) => void
  healPlayer: (amount: number) => void
  increaseAttackPower: (amount: number) => void
  collectPickup: (id: string) => void
  startSkillCooldown: () => void
  startAttackCooldown: () => void
  tickCooldowns: (delta: number) => void
  setMonsterAttackCountdown: (seconds: number) => void
  exitCombat: () => void
  clearFledMonster: () => void
  confirmCharacter: (characterClass: CharacterClass, skinColor: string) => void
  hydrateSave: (save: SaveData) => void
  resetSave: () => void
  restart: () => void
}

function persist() {
  const userId = useAuthStore.getState().session?.user.id
  if (!userId) return
  const {
    defeatedIds,
    playerHp,
    attackPower,
    collectedPickupIds,
    currentLevel,
    skillCooldown,
    characterClass,
    skinColor,
  } = useGameStore.getState()
  saveProgress(userId, {
    defeatedMonsterIds: [...defeatedIds],
    playerHp,
    attackPower,
    collectedPickupIds: [...collectedPickupIds],
    currentLevel,
    skillCooldown,
    characterClass,
    skinColor,
  })
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'exploring',
  currentLevel: 1,
  activeMonsterId: null,
  monsterHp: {},
  defeatedIds: new Set(),
  fledMonsterId: null,
  playerHp: PLAYER_MAX_HP,
  attackPower: BASE_ATTACK_POWER,
  collectedPickupIds: new Set(),
  skillCooldown: 0,
  attackCooldown: 0,
  monsterAttackCountdown: 0,
  characterClass: null,
  skinColor: DEFAULT_SKIN_COLOR,
  saveLoaded: false,

  enterCombat: (monster) =>
    set((state) => ({
      phase: 'combat',
      activeMonsterId: monster.id,
      monsterHp: {
        ...state.monsterHp,
        [monster.id]: state.monsterHp[monster.id] ?? monster.maxHp,
      },
      monsterAttackCountdown: monster.attackInterval,
    })),

  damageMonster: (amount) => {
    const { activeMonsterId, monsterHp, defeatedIds, currentLevel, characterClass } = get()
    if (!activeMonsterId) return
    if (amount > 0) playAttackImpact(characterClass)
    const wasDefeated = defeatedIds.has(activeMonsterId)
    const nextHp = Math.max(0, (monsterHp[activeMonsterId] ?? 0) - amount)
    const nextDefeated = new Set(defeatedIds)
    if (nextHp <= 0) nextDefeated.add(activeMonsterId)
    set({
      monsterHp: { ...monsterHp, [activeMonsterId]: nextHp },
      defeatedIds: nextDefeated,
    })

    if (!wasDefeated && nextHp <= 0) {
      persist()
      const isLastLevel = currentLevel === LEVELS.length
      const levelCleared = LEVELS[currentLevel - 1].monsters.every((m) => nextDefeated.has(m.id))
      if (isLastLevel && levelCleared) {
        const userId = useAuthStore.getState().session?.user.id
        if (userId) submitScore(userId, nextDefeated.size)
      }
    }
  },

  damagePlayer: (amount) => {
    if (amount > 0) playPlayerHurt()
    set((state) => {
      const nextHp = Math.max(0, state.playerHp - amount)
      return { playerHp: nextHp, phase: nextHp <= 0 ? 'gameover' : state.phase }
    })
    persist()
  },

  healPlayer: (amount) => {
    set((state) => ({ playerHp: Math.min(PLAYER_MAX_HP, state.playerHp + amount) }))
    persist()
  },

  increaseAttackPower: (amount) => {
    set((state) => ({ attackPower: state.attackPower + amount }))
    persist()
  },

  collectPickup: (id) => {
    set((state) => ({ collectedPickupIds: new Set(state.collectedPickupIds).add(id) }))
    persist()
  },

  // The special skill is now cast by writing Python code that calls
  // skill(amount) — see SpellConsole.tsx / pyodideRuntime.ts. That code path
  // deals damage through damageMonster() directly and then calls this to
  // start the cooldown, instead of a single button action owning both.
  startSkillCooldown: () => {
    const { phase } = get()
    if (phase !== 'combat') return
    set({ skillCooldown: SKILL_COOLDOWN_SECONDS })
    persist()
  },

  // Same idea as startSkillCooldown but for the regular attack box — see
  // pyodideRuntime.ts SpellResult.attackUsed. Not persisted: this fires
  // roughly every ATTACK_COOLDOWN_SECONDS during any active fight, so
  // writing it to Supabase every time would be a lot of avoidable traffic
  // for a value that's fine to just reset to 0 on reload.
  startAttackCooldown: () => {
    const { phase } = get()
    if (phase !== 'combat') return
    set({ attackCooldown: ATTACK_COOLDOWN_SECONDS })
  },

  tickCooldowns: (delta) =>
    set((state) => ({
      skillCooldown: state.skillCooldown > 0 ? Math.max(0, state.skillCooldown - delta) : state.skillCooldown,
      attackCooldown: state.attackCooldown > 0 ? Math.max(0, state.attackCooldown - delta) : state.attackCooldown,
    })),

  setMonsterAttackCountdown: (seconds) => set({ monsterAttackCountdown: seconds }),

  exitCombat: () => {
    const { activeMonsterId, defeatedIds, currentLevel, playerHp } = get()
    if (playerHp <= 0) return // already dead — the game-over overlay owns the reset from here
    const levelCleared =
      activeMonsterId != null &&
      defeatedIds.has(activeMonsterId) &&
      LEVELS[currentLevel - 1].monsters.every((m) => defeatedIds.has(m.id))

    if (levelCleared && currentLevel < LEVELS.length) {
      set({
        phase: 'exploring',
        activeMonsterId: null,
        fledMonsterId: null,
        currentLevel: currentLevel + 1,
      })
      persist()
      return
    }

    set((state) => ({
      phase: 'exploring',
      activeMonsterId: null,
      fledMonsterId: state.activeMonsterId,
    }))
  },

  clearFledMonster: () => set({ fledMonsterId: null }),

  confirmCharacter: (characterClass, skinColor) => {
    set({ characterClass, skinColor })
    persist()
  },

  hydrateSave: (save) =>
    set({
      // A save can be persisted mid-death (damagePlayer writes playerHp: 0
      // to Supabase the instant HP hits zero, before the player ever clicks
      // "restart"). Without deriving phase here too, reloading that save
      // would drop the player back into the level they died in — stale
      // defeatedIds, 0 HP, no game-over screen — instead of sending them
      // through the same reset restart() does.
      phase: save.playerHp <= 0 ? 'gameover' : 'exploring',
      defeatedIds: new Set(save.defeatedMonsterIds),
      playerHp: save.playerHp,
      attackPower: save.attackPower,
      collectedPickupIds: new Set(save.collectedPickupIds),
      currentLevel: save.currentLevel,
      skillCooldown: save.skillCooldown,
      characterClass: save.characterClass,
      skinColor: save.skinColor,
      saveLoaded: true,
    }),

  restart: () => {
    set({
      phase: 'exploring',
      currentLevel: 1,
      activeMonsterId: null,
      monsterHp: {},
      defeatedIds: new Set(),
      fledMonsterId: null,
      playerHp: PLAYER_MAX_HP,
      attackPower: BASE_ATTACK_POWER,
      collectedPickupIds: new Set(),
      skillCooldown: 0,
      attackCooldown: 0,
      monsterAttackCountdown: 0,
    })
    persist()
  },

  // Clears out the previous account's data while a different session's save
  // is (re)loading, so switching accounts on the same page never flashes
  // the prior user's character/progress.
  resetSave: () =>
    set({
      phase: 'exploring',
      currentLevel: 1,
      activeMonsterId: null,
      monsterHp: {},
      defeatedIds: new Set(),
      fledMonsterId: null,
      playerHp: PLAYER_MAX_HP,
      attackPower: BASE_ATTACK_POWER,
      collectedPickupIds: new Set(),
      skillCooldown: 0,
      attackCooldown: 0,
      monsterAttackCountdown: 0,
      characterClass: null,
      skinColor: DEFAULT_SKIN_COLOR,
      saveLoaded: false,
    }),
}))
