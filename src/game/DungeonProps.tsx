import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { LIGHT_DECAY, TORCH_INTENSITY, TORCH_RADIUS } from './constants'

// Soft radial-gradient glow sprite, drawn once to a canvas — same zero-asset
// approach as the floor/wall textures in Ground.tsx.
function createGlowTexture(color: string) {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, color)
  grad.addColorStop(0.4, color)
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function Torch({ position }: { position: [number, number, number] }) {
  const glowTex = useMemo(() => createGlowTexture('rgba(255, 170, 60, 0.9)'), [])
  const lightRef = useRef<THREE.PointLight>(null!)
  const flameRef = useRef<THREE.Mesh>(null!)

  // The flicker is what sells a torch as a fire rather than a lamp, and in a
  // dark level it moves the edge of the pool of light around with it. Divided
  // out by its own ~1.1 baseline so TORCH_INTENSITY stays the honest average
  // brightness rather than something the flicker quietly scales up.
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const flicker = 1.1 + Math.sin(t * 11) * 0.15 + Math.sin(t * 23) * 0.08
    if (lightRef.current) lightRef.current.intensity = (flicker / 1.1) * TORCH_INTENSITY
    if (flameRef.current) flameRef.current.scale.setScalar(0.9 + flicker * 0.15)
  })

  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 1.1, 6]} />
        <meshStandardMaterial color="#2c2418" />
      </mesh>
      {/* Along with the player's lantern, this is the only thing lighting the
          dungeon — see GameScene. Everything outside TORCH_RADIUS of one of
          these, and outside the player's own pool, stays dark. */}
      <pointLight
        ref={lightRef}
        position={[0, 1.15, 0]}
        color="#ffaa3c"
        intensity={TORCH_INTENSITY}
        distance={TORCH_RADIUS}
        decay={LIGHT_DECAY}
      />
      <Billboard position={[0, 1.15, 0]}>
        <mesh ref={flameRef}>
          <planeGeometry args={[0.5, 0.5]} />
          <meshBasicMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </Billboard>
    </group>
  )
}

export function Statue({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.25, 0]}>
        <boxGeometry args={[0.9, 0.5, 0.9]} />
        <meshStandardMaterial color="#3a3226" />
      </mesh>
      <mesh castShadow position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.28, 0.34, 1.2, 8]} />
        <meshStandardMaterial color="#4a4436" />
      </mesh>
      <mesh castShadow position={[0, 1.85, 0]}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshStandardMaterial color="#4a4436" />
      </mesh>
    </group>
  )
}

export function TreasureChest({ position }: { position: [number, number, number] }) {
  const glowTex = useMemo(() => createGlowTexture('rgba(255, 214, 110, 0.85)'), [])
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.25, 0]}>
        <boxGeometry args={[0.9, 0.5, 0.6]} />
        <meshStandardMaterial color="#4a3320" />
      </mesh>
      <mesh castShadow position={[0, 0.56, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.6, 12, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#5a4028" />
      </mesh>
      <mesh position={[0, 0.5, 0.31]}>
        <boxGeometry args={[0.12, 0.12, 0.05]} />
        <meshStandardMaterial color="#d4af37" emissive="#d4af37" emissiveIntensity={0.6} />
      </mesh>
      <Billboard position={[0, 0.4, 0]}>
        <mesh>
          <planeGeometry args={[1.4, 1.4]} />
          {/* Dimmer than the torch flame on purpose: the chest glimmers in a
              dark room to hint that something is over there, without lighting
              itself up so brightly that it reads as a third light source. */}
          <meshBasicMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.28} />
        </mesh>
      </Billboard>
    </group>
  )
}
