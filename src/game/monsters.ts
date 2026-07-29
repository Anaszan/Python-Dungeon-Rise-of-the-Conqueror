export type MonsterData = {
  id: string
  name: string
  maxHp: number
  color: string
  attackDamage: number
  attackInterval: number
  position: [number, number, number]
  // Optional art: drop a (transparent-background) image under public/monsters
  // and point this at its URL (e.g. "/monsters/slime.png") to render the
  // monster as a billboarded sprite instead of the placeholder shape.
  imageUrl?: string
  // Optional alternative to imageUrl: a GLB model under public/monsters,
  // rendered billboarded like the sprite path. Takes precedence over
  // imageUrl when both are set. Assumed to be a flat plane baked from 2D
  // art (Monster.tsx normalizes against a fixed raw height) — a model with
  // real depth will still render, just without billboarding accounted for
  // in its own geometry.
  modelUrl?: string
  // Exposed to the player's Python code as `monster_armor` (see
  // pyodideRuntime.ts). Defaults to a large number when unset so dividing by
  // it never zero-divides — level 6 sets this to 0 on purpose to force the
  // try/except lesson.
  armor?: number
}
