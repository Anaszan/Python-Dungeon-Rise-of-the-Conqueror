import { Component, Suspense, useMemo, type ReactNode } from 'react'
import { useLoader } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import type { CharacterClass, CharacterGender } from './characterOptions'
import { DEFAULT_GENDER } from './characterOptions'

const SKIN_FALLBACK_COLOR = '#e0b48a'
const ROBE_COLOR = '#4a4030'
const BLADE_COLOR = '#c9ccd6'
const HAIR_COLOR = '#3b2416'

export type CharacterAppearance = {
  characterClass: CharacterClass
  gender: CharacterGender
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

// Female characters use their own CC0 assets ("Ultimate Modular Women Pack"
// by Quaternius, CC0 1.0, see public/models/female/License.txt) — real female
// meshes, not a reshaped male one. They're .glb (rigged, flat-colored
// materials, no textures) rather than the males' .obj, so they load through
// their own component below.
//
// Only three meshes cover four classes: the witch dresses both caster
// classes, recolored white/gold for the cleric so the two never look like the
// same character. `weapon` fills in what the outfit doesn't ship — only the
// hooded adventurer comes with a blade in her hand.
type FemaleAsset = {
  glb: string
  // Material name (from the .glb) -> replacement color. 'Skin' is handled
  // separately since it follows the player's chosen skin color.
  recolor?: Record<string, string>
  weapon?: 'dagger' | 'staff'
  staffOrbColor?: string
}

const FEMALE_ASSETS: Record<CharacterClass, FemaleAsset> = {
  warrior: { glb: '/models/female/HoodedAdventurer.glb' },
  rogue: { glb: '/models/female/Adventurer.glb', weapon: 'dagger' },
  wizard: { glb: '/models/female/Witch.glb', weapon: 'staff', staffOrbColor: '#8be3ff' },
  cleric: {
    glb: '/models/female/Witch.glb',
    recolor: {
      Purple: '#e9e1cd',
      Gold: '#c9a227',
      Brown2: '#7c6a48',
      Hair_Black: '#7a5230',
      Brown: '#4a3b2a',
    },
    weapon: 'staff',
    staffOrbColor: '#ffd98a',
  },
}

// Where a weapon goes in the women pack's rig. The values are the local
// transform of the sword that ships parented to the right hand inside
// HoodedAdventurer.glb — every model in the pack shares one armature, so the
// same grip works on all of them. Note the rig is authored at 1/100 scale
// (its armature node scales by 100), which is why these numbers look tiny;
// the weapon meshes themselves are built in normal model units and scaled by
// the bone's own world scale at attach time.
//
// The bone is named `Middle1.R` in the file; GLTFLoader strips the dot.
const GRIP_BONE = 'Middle1R'
const GRIP_POSITION: [number, number, number] = [-0.0000042, 0.0009108, -0.0002511]
const GRIP_QUATERNION: [number, number, number, number] = [0.0006481, 0, -0.7120197, 0.7021592]

// Kept for the procedural fallback only: if a real model fails to load there
// is no female mesh to fall back to, so that placeholder is reshaped instead.
const GENDER_PROPORTIONS: Record<CharacterGender, { width: number; height: number }> = {
  male: { width: 1, height: 1 },
  female: { width: 0.9, height: 0.95 },
}

// Tied-back hair, added behind the head mesh for female characters. Sized in
// model-height units so it stays proportional whatever the class model
// scaled to.
function Ponytail({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshStandardMaterial color={HAIR_COLOR} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, -0.15, -0.03]} rotation={[-0.22, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.025, 0.28, 8]} />
        <meshStandardMaterial color={HAIR_COLOR} roughness={0.8} />
      </mesh>
    </group>
  )
}

// Guaranteed fallback if a class's real model fails to load: a plain
// low-poly humanoid with just the head/hands tinted by skinColor.
function ProceduralCharacterModel({ skinColor, gender }: { skinColor: string; gender: CharacterGender }) {
  const { width, height } = GENDER_PROPORTIONS[gender]
  return (
    <group scale={[width, height, width]} position={[0, MODEL_FEET_Y * (1 - height), 0]}>
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
      {gender === 'female' && <Ponytail position={[0, 0.58, -0.17]} />}

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
function RealCharacterModel({ characterClass, skinColor }: Omit<CharacterAppearance, 'gender'>) {
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

// Weapons for the female outfits that ship empty-handed, built in normal
// model units (the caller rescales them into the rig's units). The blade
// hangs down -Y from the fist, matching the pack's own sword.
function buildDagger() {
  const group = new THREE.Group()
  const steel = new THREE.MeshStandardMaterial({ color: BLADE_COLOR, metalness: 0.6, roughness: 0.3 })
  const grip = new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 0.9 })

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.02, 0.14, 8), grip)
  handle.position.y = 0.05
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.045), steel)
  guard.position.y = -0.025
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.016), steel)
  blade.position.y = -0.21

  for (const mesh of [handle, guard, blade]) {
    mesh.castShadow = true
    group.add(mesh)
  }
  return group
}

function buildStaff(orbColor: string) {
  const group = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 0.9 })

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 1, 8), wood)
  shaft.position.y = 0.15
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 12, 12),
    new THREE.MeshStandardMaterial({ color: orbColor, emissive: orbColor, emissiveIntensity: 0.6 }),
  )
  orb.position.y = 0.68

  for (const mesh of [shaft, orb]) {
    mesh.castShadow = true
    group.add(mesh)
  }
  return group
}

// `upright` is for staffs: a staff copying the sword's grip would stick
// straight out in front of her, so instead the bone's own world rotation is
// cancelled out, leaving the shaft vertical in model space while still
// starting from her fist.
function attachWeapon(root: THREE.Object3D, weapon: THREE.Group, upright: boolean) {
  const bone = root.getObjectByName(GRIP_BONE)
  if (!bone) return

  root.updateMatrixWorld(true)
  const boneScale = bone.getWorldScale(new THREE.Vector3()).x
  weapon.scale.setScalar(boneScale > 0 ? 1 / boneScale : 1)
  weapon.position.fromArray(GRIP_POSITION)
  if (upright) weapon.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert())
  else weapon.quaternion.fromArray(GRIP_QUATERNION)
  bone.add(weapon)
}

// The female counterpart of RealCharacterModel: same auto-fit into
// MODEL_HEIGHT/MODEL_FEET_Y, but reading a rigged .glb whose materials are
// flat colors instead of an .obj plus texture pages. Rendered in its bind
// pose (the pack's animations go unused) so it stands like the male models.
function FemaleCharacterModel({ characterClass, skinColor }: Omit<CharacterAppearance, 'gender'>) {
  const asset = FEMALE_ASSETS[characterClass]
  const { scene } = useGLTF(asset.glb)

  const fitted = useMemo(() => {
    // Skinned meshes can't be shared between canvases (the player, the
    // profile portrait and the combat portrait can all be on screen at
    // once), so this clones the skeleton too rather than the scene graph
    // alone.
    const clone = cloneSkinned(scene)

    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      child.castShadow = true
      const source = child.material as THREE.MeshStandardMaterial
      const material = source.clone()
      if (source.name === 'Skin') material.color.set(skinColor)
      else if (asset.recolor?.[source.name]) material.color.set(asset.recolor[source.name])
      child.material = material
    })

    clone.updateMatrixWorld(true)
    const rawBox = new THREE.Box3().setFromObject(clone)
    const rawSize = rawBox.getSize(new THREE.Vector3())
    clone.scale.setScalar(rawSize.y > 0 ? MODEL_HEIGHT / rawSize.y : 1)

    clone.updateMatrixWorld(true)
    const scaledBox = new THREE.Box3().setFromObject(clone)
    const center = scaledBox.getCenter(new THREE.Vector3())
    clone.position.set(-center.x, MODEL_FEET_Y - scaledBox.min.y, -center.z)

    if (asset.weapon === 'dagger') attachWeapon(clone, buildDagger(), false)
    if (asset.weapon === 'staff') attachWeapon(clone, buildStaff(asset.staffOrbColor ?? '#8be3ff'), true)

    return clone
  }, [scene, skinColor, asset])

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
  const gender = appearance.gender ?? DEFAULT_GENDER
  const fallback = (
    <ProceduralCharacterModel skinColor={appearance.skinColor ?? SKIN_FALLBACK_COLOR} gender={gender} />
  )
  return (
    <ModelErrorBoundary key={`${appearance.characterClass}-${gender}`} fallback={fallback}>
      <Suspense fallback={fallback}>
        {gender === 'female' ? (
          <FemaleCharacterModel characterClass={appearance.characterClass} skinColor={appearance.skinColor} />
        ) : (
          <RealCharacterModel characterClass={appearance.characterClass} skinColor={appearance.skinColor} />
        )}
      </Suspense>
    </ModelErrorBoundary>
  )
}
