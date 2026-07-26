import { Component, Suspense, useMemo, type ReactNode } from 'react'
import { useLoader } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import * as THREE from 'three'
import type { CharacterClass } from './characterOptions'

const SKIN_FALLBACK_COLOR = '#e0b48a'
const ROBE_COLOR = '#4a4030'
const BLADE_COLOR = '#c9ccd6'

export type CharacterAppearance = {
  characterClass: CharacterClass
  skinColor: string
}

// Target vertical footprint every player model (procedural or real) fits
// into, matching the old single-capsule model so ground contact / camera
// framing in Player.tsx need no retuning.
const MODEL_HEIGHT = 1.3
const MODEL_FEET_Y = -0.65

// Per-class CC0 assets ("LowPoly RPG Characters" by Quaternius, CC0 1.0, see
// public/models/<class>/License.txt). weaponMatch/skinMatch are substrings
// of each mesh's name (OBJLoader sets Mesh.name from the .obj's `o` lines,
// verified by inspecting the files — every class has a separate head/face
// mesh distinct from the body/armor mesh), used to decide which texture and
// whether to tint that one mesh with skinColor.
const CLASS_ASSETS: Record<
  CharacterClass,
  { obj: string; bodyTex: string; weaponTex: string; weaponMatch: string; skinMatch: string }
> = {
  warrior: {
    obj: '/models/warrior/Warrior.obj',
    bodyTex: '/models/warrior/Warrior_Texture.png',
    weaponTex: '/models/warrior/Warrior_Sword_Texture.png',
    weaponMatch: 'Sword',
    skinMatch: 'Face',
  },
  cleric: {
    obj: '/models/cleric/Cleric.obj',
    bodyTex: '/models/cleric/Cleric_Texture.png',
    weaponTex: '/models/cleric/Cleric_Staff_Texture.png',
    weaponMatch: 'Staff',
    skinMatch: 'Head',
  },
  wizard: {
    obj: '/models/wizard/Wizard.obj',
    bodyTex: '/models/wizard/Wizard_Texture.png',
    weaponTex: '/models/wizard/Wizard_Staff_Texture.png',
    weaponMatch: 'Staff',
    skinMatch: 'Face',
  },
  rogue: {
    obj: '/models/rogue/Rogue.obj',
    bodyTex: '/models/rogue/Rogue_Texture.png',
    weaponTex: '/models/rogue/Rogue_Dagger_Texture.png',
    weaponMatch: 'Dagger',
    skinMatch: 'Face',
  },
}

// Guaranteed fallback if a class's real model fails to load: a plain
// low-poly humanoid with just the head/hands tinted by skinColor.
function ProceduralCharacterModel({ skinColor }: { skinColor: string }) {
  return (
    <group>
      <mesh castShadow position={[-0.12, -0.42, 0]}>
        <boxGeometry args={[0.16, 0.55, 0.18]} />
        <meshStandardMaterial color={ROBE_COLOR} />
      </mesh>
      <mesh castShadow position={[0.12, -0.42, 0]}>
        <boxGeometry args={[0.16, 0.55, 0.18]} />
        <meshStandardMaterial color={ROBE_COLOR} />
      </mesh>

      <mesh castShadow position={[0, 0.08, 0]}>
        <boxGeometry args={[0.5, 0.48, 0.3]} />
        <meshStandardMaterial color={ROBE_COLOR} />
      </mesh>

      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh castShadow position={[side * 0.32, 0.1, 0]}>
            <cylinderGeometry args={[0.08, 0.09, 0.42, 8]} />
            <meshStandardMaterial color={ROBE_COLOR} />
          </mesh>
          <mesh castShadow position={[side * 0.32, -0.14, 0]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color={skinColor} />
          </mesh>
        </group>
      ))}

      <mesh castShadow position={[0, 0.52, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>

      <group position={[0.32, -0.1, 0.16]} rotation={[0, 0, Math.PI * 0.08]}>
        <mesh castShadow position={[0, 0.32, 0]}>
          <boxGeometry args={[0.05, 0.55, 0.03]} />
          <meshStandardMaterial color={BLADE_COLOR} metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}

// Real CC0 low-poly class model, loaded via three's OBJLoader. Auto-fit to
// MODEL_HEIGHT/MODEL_FEET_Y so it drops into the same slot as the
// procedural model. Only the head/face mesh is tinted with skinColor (a
// whole-model tint washed the armor/robe detail out to a dark silhouette in
// earlier testing); the weapon and body meshes keep their own painted
// texture untinted.
function RealCharacterModel({ characterClass, skinColor }: CharacterAppearance) {
  const assets = CLASS_ASSETS[characterClass]
  const obj = useLoader(OBJLoader, assets.obj)
  const bodyTex = useTexture(assets.bodyTex)
  const weaponTex = useTexture(assets.weaponTex)

  const fitted = useMemo(() => {
    bodyTex.colorSpace = THREE.SRGBColorSpace
    weaponTex.colorSpace = THREE.SRGBColorSpace

    const clone = obj.clone(true)
    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      const isWeapon = child.name.includes(assets.weaponMatch)
      const isSkin = child.name.includes(assets.skinMatch)
      child.material = new THREE.MeshStandardMaterial({
        map: isWeapon ? weaponTex : bodyTex,
        color: isSkin ? skinColor : '#ffffff',
      })
      child.castShadow = true
    })

    clone.updateMatrixWorld(true)
    const rawBox = new THREE.Box3().setFromObject(clone)
    const rawSize = rawBox.getSize(new THREE.Vector3())
    const scale = rawSize.y > 0 ? MODEL_HEIGHT / rawSize.y : 1
    clone.scale.setScalar(scale)

    clone.updateMatrixWorld(true)
    const scaledBox = new THREE.Box3().setFromObject(clone)
    const center = scaledBox.getCenter(new THREE.Vector3())
    clone.position.set(-center.x, MODEL_FEET_Y - scaledBox.min.y, -center.z)

    return clone
  }, [obj, bodyTex, weaponTex, assets.weaponMatch, assets.skinMatch, skinColor])

  return <primitive object={fitted} />
}

class ModelErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

// A plain low-poly humanoid stands in as the guaranteed model; the real
// downloaded CC0 class model (loaded async) replaces it once ready, and any
// load/parse failure falls back to the procedural model instead of
// breaking the scene.
export function CharacterModel({ appearance }: { appearance: CharacterAppearance }) {
  const fallback = <ProceduralCharacterModel skinColor={appearance.skinColor ?? SKIN_FALLBACK_COLOR} />
  return (
    <ModelErrorBoundary key={appearance.characterClass} fallback={fallback}>
      <Suspense fallback={fallback}>
        <RealCharacterModel characterClass={appearance.characterClass} skinColor={appearance.skinColor} />
      </Suspense>
    </ModelErrorBoundary>
  )
}
