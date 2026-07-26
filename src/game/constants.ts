export const PLAYER_SPEED = 6

export const ISO_OFFSET = { x: 10, y: 12, z: 10 } as const

export const COMBAT_TRIGGER_DISTANCE = 1.2
export const FLEE_CLEAR_DISTANCE = 2.2
export const PICKUP_TRIGGER_DISTANCE = 1.0

export const PLAYER_MAX_HP = 200
export const BASE_ATTACK_POWER = 20

export const SKILL_COOLDOWN_SECONDS = 8
export const SKILL_DAMAGE_MULTIPLIER = 3

// Regular attack is now also cast by running Python code, so it gets a
// short cooldown too — otherwise there's nothing pacing how fast the
// attack box can be re-run. Shorter than the skill's so it still reads as
// the "everyday" spell next to the rarer, harder-hitting skill.
export const ATTACK_COOLDOWN_SECONDS = 3
