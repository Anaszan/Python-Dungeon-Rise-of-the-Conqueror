import { describe, expect, it } from 'vitest'
import { canStandAt, isWalkable, PLAYER_CLEARANCE } from './dungeon'
import { LEVELS } from './levels'
import { COMBAT_TRIGGER_DISTANCE, PICKUP_TRIGGER_DISTANCE } from './constants'

// canStandAt() keeps the player's whole body out of the walls, which also
// means it narrows every doorway by PLAYER_CLEARANCE on each side. This is
// the guard on that: no level may end up with a doorway too narrow to walk
// through, or with a monster/pickup stranded on the wrong side of one.
//
// Flood-fills the standable space on a 0.1 grid from the spawn point
// (4-neighbour, matching the axis-at-a-time movement in Player.tsx), then
// checks every monster and pickup can be triggered from somewhere in it.
const STEP = 0.1
const key = (ix: number, iz: number) => `${ix},${iz}`

function reachable(level: (typeof LEVELS)[number]) {
  const { regions } = level
  const [sx, , sz] = level.spawnPosition
  const start: [number, number] = [Math.round(sx / STEP), Math.round(sz / STEP)]
  expect(canStandAt(start[0] * STEP, start[1] * STEP, regions), `${level.name}: spawn`).toBe(true)

  const seen = new Set<string>([key(...start)])
  const queue: [number, number][] = [start]
  while (queue.length) {
    const [ix, iz] = queue.pop()!
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = ix + dx
      const nz = iz + dz
      const k = key(nx, nz)
      if (seen.has(k)) continue
      if (!canStandAt(nx * STEP, nz * STEP, regions)) continue
      seen.add(k)
      queue.push([nx, nz])
    }
  }
  return (x: number, z: number, radius: number) => {
    const span = Math.ceil(radius / STEP)
    const cx = Math.round(x / STEP)
    const cz = Math.round(z / STEP)
    for (let ix = cx - span; ix <= cx + span; ix++) {
      for (let iz = cz - span; iz <= cz + span; iz++) {
        const dx = ix * STEP - x
        const dz = iz * STEP - z
        if (dx * dx + dz * dz <= radius * radius && seen.has(key(ix, iz))) return true
      }
    }
    return false
  }
}

it('holds the player off a wall drawn on a region boundary', () => {
  const { regions } = LEVELS[0]
  // Level 1's corridor runs to x = -2 and its west wall is centred there,
  // so the point test alone lets the player stand with half their body
  // inside that wall.
  expect(isWalkable(-2, -20, regions)).toBe(true)
  expect(canStandAt(-2, -20, regions)).toBe(false)
  expect(canStandAt(-2 + PLAYER_CLEARANCE, -20, regions)).toBe(true)
})

describe.each(LEVELS)('level $level ($name)', (level) => {
  const canReach = reachable(level)

  it.each(level.monsters)('can reach $name', (monster) => {
    expect(canReach(monster.position[0], monster.position[2], COMBAT_TRIGGER_DISTANCE)).toBe(true)
  })

  it.each(level.pickups)('can reach $id', (pickup) => {
    expect(canReach(pickup.position[0], pickup.position[2], PICKUP_TRIGGER_DISTANCE)).toBe(true)
  })
})
