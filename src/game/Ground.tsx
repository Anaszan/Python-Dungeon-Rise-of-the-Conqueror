import { Suspense, useMemo } from 'react'
import { Grid, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { Region, Wall } from './dungeon'
import { WALL_HEIGHT } from './dungeon'

function TexturedFloorMaterial({ url, width, depth }: { url: string; width: number; depth: number }) {
  const texture = useTexture(url)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(width, depth)
  return <meshStandardMaterial map={texture} />
}

function TexturedWallMaterial({ url, width, height }: { url: string; width: number; height: number }) {
  const texture = useTexture(url)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(width, height)
  return <meshStandardMaterial map={texture} />
}

// Seeded PRNG so texture detail (cracks, moss, speckle) is stable across
// re-renders instead of jittering every time the canvas is redrawn.
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Procedural dungeon-stone floor tile, drawn once to a canvas so the game has
// a real stone-floor look with zero external image assets.
function createStoneFloorTexture() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const rand = mulberry32(1337)

  ctx.fillStyle = '#4b402a'
  ctx.fillRect(0, 0, size, size)

  const tiles = 6
  const tileSize = size / tiles
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const variance = rand() * 14 - 7
      const [r, g, b] = (tx + ty) % 2 === 0 ? [0x5b, 0x4c, 0x30] : [0x51, 0x43, 0x2b]
      const shade = `rgb(${r + variance}, ${g + variance * 0.8}, ${b + variance * 0.5})`
      const px = tx * tileSize
      const py = ty * tileSize

      ctx.fillStyle = shade
      ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4)

      // corner vignette so each slab reads as slightly beveled/carved
      const grad = ctx.createRadialGradient(
        px + tileSize / 2,
        py + tileSize / 2,
        tileSize * 0.15,
        px + tileSize / 2,
        py + tileSize / 2,
        tileSize * 0.7,
      )
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)')
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.22)')
      ctx.fillStyle = grad
      ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4)

      // occasional moss speckle in a corner
      if (rand() < 0.35) {
        const mossX = px + tileSize * (0.2 + rand() * 0.6)
        const mossY = py + tileSize * (0.2 + rand() * 0.6)
        ctx.fillStyle = `rgba(70, 110, 55, ${0.15 + rand() * 0.15})`
        ctx.beginPath()
        ctx.ellipse(mossX, mossY, tileSize * 0.12, tileSize * 0.08, rand() * Math.PI, 0, Math.PI * 2)
        ctx.fill()
      }

      // hairline crack on some tiles
      if (rand() < 0.25) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        let cx = px + tileSize * rand()
        let cy = py + tileSize * rand()
        ctx.moveTo(cx, cy)
        for (let s = 0; s < 3; s++) {
          cx += (rand() - 0.5) * tileSize * 0.4
          cy += (rand() - 0.5) * tileSize * 0.4
          ctx.lineTo(cx, cy)
        }
        ctx.stroke()
      }
    }
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)'
  ctx.lineWidth = 3
  for (let i = 0; i <= tiles; i++) {
    ctx.beginPath()
    ctx.moveTo(i * tileSize, 0)
    ctx.lineTo(i * tileSize, size)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i * tileSize)
    ctx.lineTo(size, i * tileSize)
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

// Procedural stone-brick wall texture, same zero-asset approach as the floor.
function createBrickWallTexture() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const rand = mulberry32(4242)

  ctx.fillStyle = '#352b1b'
  ctx.fillRect(0, 0, size, size)

  const rows = 10
  const rowHeight = size / rows
  for (let row = 0; row < rows; row++) {
    const offset = row % 2 === 0 ? 0 : rowHeight
    const bricksPerRow = 6
    const brickWidth = size / bricksPerRow
    for (let i = -1; i <= bricksPerRow; i++) {
      const x = i * brickWidth + offset
      const variance = rand() * 16 - 8
      const [r, g, b] = (row + i) % 2 === 0 ? [0x72, 0x5e, 0x3d] : [0x67, 0x51, 0x34]
      ctx.fillStyle = `rgb(${r + variance}, ${g + variance * 0.85}, ${b + variance * 0.6})`
      const bx = x + 2
      const by = row * rowHeight + 2
      const bw = brickWidth - 4
      const bh = rowHeight - 4
      ctx.fillRect(bx, by, bw, bh)

      // subtle top-edge highlight, bottom-edge shadow per brick for depth
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
      ctx.fillRect(bx, by, bw, 2)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.fillRect(bx, by + bh - 2, bw, 2)

      if (rand() < 0.2) {
        ctx.fillStyle = `rgba(70, 110, 55, ${0.1 + rand() * 0.15})`
        ctx.beginPath()
        ctx.ellipse(bx + bw * rand(), by + bh * rand(), bw * 0.15, bh * 0.3, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function StoneFloorMaterial({ width, depth }: { width: number; depth: number }) {
  const texture = useMemo(createStoneFloorTexture, [])
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(width, depth)
  return <meshStandardMaterial map={texture} />
}

function BrickWallMaterial({ width, height }: { width: number; height: number }) {
  const texture = useMemo(createBrickWallTexture, [])
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(width, height)
  return <meshStandardMaterial map={texture} />
}

export function Ground({
  regions,
  walls,
  floorTextureUrl,
  wallTextureUrl,
}: {
  regions: Region[]
  walls: Wall[]
  floorTextureUrl?: string
  wallTextureUrl?: string
}) {
  return (
    <group>
      {regions.map((r, i) => {
        const width = r.xMax - r.xMin
        const depth = r.zMax - r.zMin
        const x = (r.xMin + r.xMax) / 2
        const z = (r.zMin + r.zMax) / 2
        return (
          <group key={i}>
            <mesh receiveShadow position={[x, 0, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[width, depth]} />
              {floorTextureUrl ? (
                <Suspense fallback={<StoneFloorMaterial width={width} depth={depth} />}>
                  <TexturedFloorMaterial url={floorTextureUrl} width={width} depth={depth} />
                </Suspense>
              ) : (
                <StoneFloorMaterial width={width} depth={depth} />
              )}
            </mesh>
            {!floorTextureUrl && (
              <Grid
                position={[x, 0.01, z]}
                args={[width, depth]}
                cellSize={1}
                cellThickness={0.3}
                cellColor="#2a2015"
                sectionSize={5}
                sectionColor="#8a6a3a"
                fadeDistance={40}
                infiniteGrid={false}
              />
            )}
          </group>
        )
      })}

      {walls.map((w, i) => (
        <mesh
          key={i}
          castShadow
          receiveShadow
          position={[w.x, WALL_HEIGHT / 2, w.z]}
        >
          <boxGeometry args={[w.width, WALL_HEIGHT, w.depth]} />
          {wallTextureUrl ? (
            <Suspense fallback={<BrickWallMaterial width={w.width} height={WALL_HEIGHT} />}>
              <TexturedWallMaterial url={wallTextureUrl} width={w.width} height={WALL_HEIGHT} />
            </Suspense>
          ) : (
            <BrickWallMaterial width={w.width} height={WALL_HEIGHT} />
          )}
        </mesh>
      ))}
    </group>
  )
}
