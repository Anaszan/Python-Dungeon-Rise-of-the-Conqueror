import { supabase } from '../lib/supabase'
import { PLAYER_MAX_HP, BASE_ATTACK_POWER } from './constants'
import type { CharacterClass } from '../character/characterOptions'
import { DEFAULT_SKIN_COLOR } from '../character/characterOptions'

export type SaveData = {
  defeatedMonsterIds: string[]
  playerHp: number
  attackPower: number
  collectedPickupIds: string[]
  currentLevel: number
  skillCooldown: number
  characterClass: CharacterClass | null
  skinColor: string
}

export async function loadSave(userId: string): Promise<SaveData> {
  const { data, error } = await supabase
    .from('game_saves')
    .select(
      'defeated_monster_ids, player_hp, attack_power, collected_pickup_ids, current_level, skill_cooldown, character_class, skin_color',
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (error) console.error('Failed to load save:', error.message)

  return {
    defeatedMonsterIds: data?.defeated_monster_ids ?? [],
    playerHp: data?.player_hp ?? PLAYER_MAX_HP,
    attackPower: data?.attack_power ?? BASE_ATTACK_POWER,
    collectedPickupIds: data?.collected_pickup_ids ?? [],
    currentLevel: data?.current_level ?? 1,
    skillCooldown: data?.skill_cooldown ?? 0,
    characterClass: (data?.character_class as CharacterClass | null) ?? null,
    skinColor: data?.skin_color ?? DEFAULT_SKIN_COLOR,
  }
}

export async function saveProgress(userId: string, save: SaveData) {
  const { error } = await supabase.from('game_saves').upsert({
    user_id: userId,
    defeated_monster_ids: save.defeatedMonsterIds,
    player_hp: save.playerHp,
    attack_power: save.attackPower,
    collected_pickup_ids: save.collectedPickupIds,
    current_level: save.currentLevel,
    skill_cooldown: save.skillCooldown,
    character_class: save.characterClass,
    skin_color: save.skinColor,
    updated_at: new Date().toISOString(),
  })

  if (error) console.error('Failed to save progress:', error.message)
}

export async function submitScore(userId: string, monstersDefeated: number) {
  const { error } = await supabase
    .from('scores')
    .insert({ user_id: userId, monsters_defeated: monstersDefeated })

  if (error) console.error('Failed to submit score:', error.message)
}
