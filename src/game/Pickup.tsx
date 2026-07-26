import { useGameStore } from './store'
import type { PickupData } from './pickups'

const COLORS = { heal: '#4fd67a', attack: '#f2b544' } as const

export function Pickup({ data }: { data: PickupData }) {
  const collected = useGameStore((s) => s.collectedPickupIds.has(data.id))
  if (collected) return null

  const color = COLORS[data.kind]

  return (
    <mesh castShadow position={data.position}>
      <octahedronGeometry args={[0.4, 0]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
    </mesh>
  )
}
