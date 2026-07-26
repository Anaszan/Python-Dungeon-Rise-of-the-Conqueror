import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from './store'
import { ALL_MONSTERS } from './levels'

export function CombatTicker() {
  const elapsed = useRef(0)
  // Tracks the last whole-second value pushed to the store, so the UI
  // countdown only re-renders once per second instead of every frame.
  const lastDisplayedSecond = useRef<number | null>(null)

  useFrame((_, delta) => {
    const {
      phase,
      activeMonsterId,
      monsterHp,
      damagePlayer,
      skillCooldown,
      attackCooldown,
      tickCooldowns,
      setMonsterAttackCountdown,
    } = useGameStore.getState()
    if (skillCooldown > 0 || attackCooldown > 0) tickCooldowns(delta)

    if (phase !== 'combat' || !activeMonsterId) {
      elapsed.current = 0
      lastDisplayedSecond.current = null
      return
    }

    const monster = ALL_MONSTERS.find((m) => m.id === activeMonsterId)
    if (!monster) return

    const hp = monsterHp[activeMonsterId] ?? monster.maxHp
    if (hp <= 0) {
      // Monster is defeated and just waiting on the player to hit Continue —
      // a dead monster shouldn't keep landing attacks.
      elapsed.current = 0
      lastDisplayedSecond.current = null
      return
    }

    elapsed.current += delta
    if (elapsed.current >= monster.attackInterval) {
      elapsed.current -= monster.attackInterval
      damagePlayer(monster.attackDamage)
    }

    const remaining = Math.max(0, monster.attackInterval - elapsed.current)
    const remainingSecond = Math.ceil(remaining)
    if (remainingSecond !== lastDisplayedSecond.current) {
      lastDisplayedSecond.current = remainingSecond
      setMonsterAttackCountdown(remaining)
    }
  })

  return null
}
