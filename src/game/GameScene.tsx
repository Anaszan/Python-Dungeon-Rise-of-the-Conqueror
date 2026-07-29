import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { Ground } from './Ground'
import { Player } from './Player'
import { IsoCamera } from './IsoCamera'
import { Monster } from './Monster'
import { Pickup } from './Pickup'
import { CombatTicker } from './CombatTicker'
import { Torch, Statue, TreasureChest } from './DungeonProps'
import { LEVELS } from './levels'
import { useGameStore } from './store'
import { COMBAT_TRIGGER_DISTANCE, FLEE_CLEAR_DISTANCE, PICKUP_TRIGGER_DISTANCE } from './constants'

export function GameScene() {
  const playerPos = useRef(new THREE.Vector3(0, 0.6, 0))
  const phase = useGameStore((s) => s.phase)
  const currentLevel = useGameStore((s) => s.currentLevel)
  const levelData = LEVELS[currentLevel - 1]
  const prevPhase = useRef(phase)
  const prevLevel = useRef(currentLevel)

  useFrame(() => {
    const state = useGameStore.getState()
    if (state.paused) return

    // Reposition the player back to the level's spawn point the instant a
    // restart or level-advance is observed, right here in the frame loop —
    // not in a React effect. GameScene renders through R3F's own reconciler,
    // which commits independently of react-dom's synchronous discrete-event
    // flush, so an effect reacting to the state change can lose the race to
    // this very useFrame callback on the next rAF tick. Since the player is
    // always standing right next to whatever just killed them, a stale
    // position here would immediately re-trigger combat with that same
    // monster before any effect-based reset ever got a chance to run.
    const restarted = prevPhase.current === 'gameover' && state.phase === 'exploring'
    const levelChanged = prevLevel.current !== state.currentLevel
    if (restarted || levelChanged) {
      playerPos.current.set(...LEVELS[state.currentLevel - 1].spawnPosition)
    }
    prevPhase.current = state.phase
    prevLevel.current = state.currentLevel

    if (state.phase !== 'exploring') return

    const frameLevelData = LEVELS[state.currentLevel - 1]

    let enteredCombat = false
    for (const monster of frameLevelData.monsters) {
      if (state.defeatedIds.has(monster.id)) continue
      const dx = playerPos.current.x - monster.position[0]
      const dz = playerPos.current.z - monster.position[2]
      const distSq = dx * dx + dz * dz

      if (monster.id === state.fledMonsterId) {
        // Don't re-trigger the monster we just fled until we've stepped away
        // from it — otherwise Flee immediately re-enters the same fight.
        if (distSq > FLEE_CLEAR_DISTANCE * FLEE_CLEAR_DISTANCE) state.clearFledMonster()
        continue
      }

      if (distSq < COMBAT_TRIGGER_DISTANCE * COMBAT_TRIGGER_DISTANCE) {
        state.enterCombat(monster)
        enteredCombat = true
        break
      }
    }
    if (enteredCombat) return

    for (const pickup of frameLevelData.pickups) {
      if (state.collectedPickupIds.has(pickup.id)) continue
      const dx = playerPos.current.x - pickup.position[0]
      const dz = playerPos.current.z - pickup.position[2]
      if (dx * dx + dz * dz < PICKUP_TRIGGER_DISTANCE * PICKUP_TRIGGER_DISTANCE) {
        state.collectPickup(pickup.id)
        if (pickup.kind === 'heal') state.healPlayer(pickup.amount)
        else state.increaseAttackPower(pickup.amount)
      }
    }
  })

  return (
    <>
      <IsoCamera target={playerPos} />
      <fog attach="fog" args={['#140d08', 12, 55]} />
      <ambientLight intensity={0.5} color="#5a4630" />
      <hemisphereLight args={['#8a6a3a', '#140d08', 0.55]} />
      <directionalLight position={[8, 15, 6]} intensity={1.4} color="#ffcf8a" castShadow />
      <Sparkles count={60} scale={[16, 4, 40]} size={2} speed={0.3} opacity={0.4} color="#ffd27a" />
      <Ground
        regions={levelData.regions}
        walls={levelData.walls}
        floorTextureUrl={levelData.floorTextureUrl}
        wallTextureUrl={levelData.wallTextureUrl}
      />
      <Player positionRef={playerPos} regions={levelData.regions} />
      <CombatTicker />
      {levelData.monsters.map((monster) => (
        <Monster key={monster.id} data={monster} />
      ))}
      {levelData.pickups.map((pickup) => (
        <Pickup key={pickup.id} data={pickup} />
      ))}
      {levelData.decorations?.map((deco, i) => {
        if (deco.kind === 'torch') return <Torch key={i} position={deco.position} />
        if (deco.kind === 'statue') return <Statue key={i} position={deco.position} />
        return <TreasureChest key={i} position={deco.position} />
      })}
    </>
  )
}
