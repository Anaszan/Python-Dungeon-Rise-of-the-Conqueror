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

// Half the player model's shoulder width — the fitted class models measure
// 0.36-0.58 across, widest on the male build, so this covers the broadest of
// them with a little to spare.
export const PLAYER_RADIUS = 0.3

// How far the player's centre has to stay from the edge of a region, so the
// body never hangs off the floor. isWalkable() alone only tests a point, so
// without this the player can walk their centre right onto a region boundary
// and stand with half of themselves over the void.
//
// This deliberately accounts for the *floor* only. Keeping the body out of
// the walls is hitsWall()'s job below, because a wall is a box centred on the
// boundary it closes (see Ground.tsx) and so reaches half its thickness back
// over the floor — folding that overhang into a single clearance number was
// what let the model's shoulder sink into a wall it was standing against.
export const PLAYER_CLEARANCE = PLAYER_RADIUS

// Corners of the player's footprint plus its centre, in multiples of
// PLAYER_CLEARANCE.
const FOOTPRINT_SAMPLES: [number, number][] = [
  [0, 0],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]

// True when a player standing at (x, z) would overlap a wall box. Expanding
// each box by `margin` and testing the player's centre against it is the
// Minkowski form of "does this square body intersect that wall", which is
// what stops the model from clipping into a wall it walks up against.
//
// `margin` is the player's own half-width in normal play. The stuck-recovery
// path in Player.tsx passes 0 instead, testing the raw box, so a player who
// somehow ends up standing inside a wall can still walk back out of it
// rather than having every direction rejected at once.
export function hitsWall(x: number, z: number, walls: Wall[], margin = PLAYER_RADIUS): boolean {
  return walls.some(
    (w) =>
      x > w.x - w.width / 2 - margin &&
      x < w.x + w.width / 2 + margin &&
      z > w.z - w.depth / 2 - margin &&
      z < w.z + w.depth / 2 + margin,
  )
}

// Walkable with the player's body taken into account: every corner of that
// footprint has to land on floor, and the body may not overlap a wall. The
// footprint samples are tested against the union of all regions rather than
// region by region, so a doorway where two rooms share a boundary still lets
// the body straddle the seam — shrinking each region individually would seal
// those doorways shut instead.
export function canStandAt(x: number, z: number, regions: Region[], walls: Wall[]): boolean {
  if (hitsWall(x, z, walls)) return false
  return FOOTPRINT_SAMPLES.every(([sx, sz]) =>
    isWalkable(x + sx * PLAYER_CLEARANCE, z + sz * PLAYER_CLEARANCE, regions),
  )
}
