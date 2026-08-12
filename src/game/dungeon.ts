export type Region = {
  xMin: number
  xMax: number
  zMin: number
  zMax: number
}

export function isWalkable(x: number, z: number, regions: Region[]): boolean {
  return regions.some((r) => x >= r.xMin && x <= r.xMax && z >= r.zMin && z <= r.zMax)
}

export type Wall = {
  x: number
  z: number
  width: number
  depth: number
}

export const WALL_HEIGHT = 1.6
export const WALL_THICKNESS = 0.3

// How far the player's centre has to stay from the edge of a region: half
// the model's shoulder width (the fitted models measure 0.36-0.58 across,
// widest on the male build), plus the half of a wall that overhangs the
// floor it closes off (walls are boxes centred on the region boundary they
// close, see Ground.tsx). isWalkable() alone only tests a point, so without
// this the player can walk their centre right onto the boundary and stand
// with half their body sunk into the wall.
export const PLAYER_CLEARANCE = WALL_THICKNESS / 2 + 0.25

// Corners of the player's footprint plus its centre, in multiples of
// PLAYER_CLEARANCE.
const FOOTPRINT_SAMPLES: [number, number][] = [
  [0, 0],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]

// Walkable with the player's body taken into account: every corner of that
// footprint has to land on floor. The samples are tested against the union
// of all regions rather than region by region, so a doorway where two rooms
// share a boundary still lets the body straddle the seam — shrinking each
// region individually would seal those doorways shut instead.
export function canStandAt(x: number, z: number, regions: Region[]): boolean {
  return FOOTPRINT_SAMPLES.every(([sx, sz]) =>
    isWalkable(x + sx * PLAYER_CLEARANCE, z + sz * PLAYER_CLEARANCE, regions),
  )
}
