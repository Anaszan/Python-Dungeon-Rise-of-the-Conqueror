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
