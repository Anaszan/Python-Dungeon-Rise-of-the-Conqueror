import { Component, Suspense, type ReactNode } from 'react'
import { Billboard, useTexture } from '@react-three/drei'
import { useGameStore } from './store'
import type { MonsterData } from './monsters'

function MonsterShape({ color, scale }: { color: string; scale: number }) {
  return (
    <mesh castShadow scale={scale}>
      <icosahedronGeometry args={[0.6, 0]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

function MonsterSprite({ url, scale }: { url: string; scale: number }) {
  const texture = useTexture(url)
  return (
    <Billboard>
      <mesh scale={scale}>
        <planeGeometry args={[1.4, 1.4]} />
        <meshStandardMaterial map={texture} transparent alphaTest={0.3} />
      </mesh>
    </Billboard>
  )
}

// A bad or unloadable sprite texture throws outside of Suspense's loading
// path, and react-three-fiber mounts each <Canvas> as its own React root —
// so an uncaught error here would silently wipe out the *entire* 3D scene
// (every monster, the player, the ground) rather than just this sprite.
// Falling back to the placeholder shape keeps one broken asset from taking
// the whole dungeon down with it.
class MonsterSpriteBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function Monster({ data }: { data: MonsterData }) {
  const defeated = useGameStore((s) => s.defeatedIds.has(data.id))
  if (defeated) return null

  const scale = data.name === 'Elder Dragon' ? 1.8 : data.name === 'Dragon' ? 1.5 : 1

  return (
    <group position={data.position}>
      {data.imageUrl ? (
        <MonsterSpriteBoundary fallback={<MonsterShape color={data.color} scale={scale} />}>
          <Suspense fallback={<MonsterShape color={data.color} scale={scale} />}>
            <MonsterSprite url={data.imageUrl} scale={scale} />
          </Suspense>
        </MonsterSpriteBoundary>
      ) : (
        <MonsterShape color={data.color} scale={scale} />
      )}
    </group>
  )
}
