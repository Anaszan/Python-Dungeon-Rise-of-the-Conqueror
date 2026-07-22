import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useKeyboardMap } from './useKeyboardMap'
import { PLAYER_SPEED } from './constants'
import { isWalkable, type Region } from './dungeon'
import { useGameStore } from './store'
import { DEFAULT_CHARACTER_CLASS } from '../character/characterOptions'
import { CharacterModel } from '../character/CharacterModel'

export function Player({
  positionRef,
  regions,
}: {
  positionRef: RefObject<THREE.Vector3>
  regions: Region[]
}) {
  const root = useRef<THREE.Group>(null!)
  const modelGroup = useRef<THREE.Group>(null!)
  const move = useKeyboardMap()
  const facing = useRef(0)
  const dir = useRef(new THREE.Vector3())
  // Walk-cycle accumulator: a fake gait (bob + side-to-side sway) applied to
  // the model only, since the CC0 assets are static OBJ meshes with no
  // skeleton/animation to drive a real one. bobAmount eases toward 0/1 so
  // starting and stopping don't snap.
  const walkPhase = useRef(0)
  const bobAmount = useRef(0)
  const characterClass = useGameStore((s) => s.characterClass) ?? DEFAULT_CHARACTER_CLASS
  const skinColor = useGameStore((s) => s.skinColor)

  useFrame((_, delta) => {
    if (useGameStore.getState().phase !== 'exploring') return

    const m = move.current
    dir.current.set((m.right ? 1 : 0) - (m.left ? 1 : 0), 0, (m.backward ? 1 : 0) - (m.forward ? 1 : 0))
    const moving = dir.current.lengthSq() > 0

    if (moving) {
      dir.current.normalize()
      const pos = positionRef.current
      const nextX = pos.x + dir.current.x * PLAYER_SPEED * delta
      const nextZ = pos.z + dir.current.z * PLAYER_SPEED * delta

      if (isWalkable(nextX, pos.z, regions)) pos.x = nextX
      if (isWalkable(pos.x, nextZ, regions)) pos.z = nextZ

      facing.current = Math.atan2(dir.current.x, dir.current.z)
    }

    root.current.position.set(positionRef.current.x, positionRef.current.y, positionRef.current.z)
    root.current.rotation.y = THREE.MathUtils.lerp(root.current.rotation.y, facing.current, 0.2)

    bobAmount.current = THREE.MathUtils.lerp(bobAmount.current, moving ? 1 : 0, 0.15)
    walkPhase.current += delta * 9
    if (modelGroup.current) {
      modelGroup.current.position.y = Math.abs(Math.sin(walkPhase.current)) * 0.05 * bobAmount.current
      modelGroup.current.rotation.z = Math.sin(walkPhase.current) * 0.06 * bobAmount.current
    }
  })

  return (
    <group ref={root} position={[0, 0.6, 0]}>
      <group ref={modelGroup}>
        <CharacterModel appearance={{ characterClass, skinColor }} />
      </group>
    </group>
  )
}
