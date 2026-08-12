import { Component, Suspense, useMemo, type ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
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

// Every class model comes from one CC0 pack ("Ultimate Modular Women Pack"
// by Quaternius, CC0 1.0, see public/models/female/License.txt): rigged .glb
// meshes with flat-colored materials and no texture pages. Both genders wear
// these outfits — the male characters are the same meshes on a heavier frame
// with every bare surface covered, see MALE_BUILD.
//
// Only three meshes cover four classes: the witch dresses both caster
// classes, recolored white/gold for the cleric so the two never look like the
// same character. `weapon` fills in what the outfit doesn't ship — only the
// hooded adventurer comes with a blade in hand.
type ClassAsset = {
  glb: string
  // Material name (from the .glb) -> replacement color. 'Skin' is handled
  // separately since it follows the player's chosen skin color.
  recolor?: Record<string, string>
  // Material carrying the outfit's main color, used to paint over the skin
  // on the male build (see outfitColor). Picked per asset as the largest
  // non-skin material on its body mesh.
  outfitMaterial: string
  weapon?: 'dagger' | 'staff'
  staffOrbColor?: string
}

const CLASS_ASSETS: Record<CharacterClass, ClassAsset> = {
  warrior: { glb: '/models/female/HoodedAdventurer.glb', outfitMaterial: 'DarkBrown' },
  rogue: { glb: '/models/female/Adventurer.glb', outfitMaterial: 'LightGreen', weapon: 'dagger' },
  wizard: {
    glb: '/models/female/Witch.glb',
    outfitMaterial: 'Purple',
    weapon: 'staff',
    staffOrbColor: '#8be3ff',
  },
  cleric: {
    glb: '/models/female/Witch.glb',
    recolor: {
      Purple: '#e9e1cd',
      Gold: '#c9a227',
      Brown2: '#7c6a48',
      Hair_Black: '#7a5230',
      Brown: '#4a3b2a',
    },
    outfitMaterial: 'Purple',
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

// How the male characters differ from the women the pack was modelled as:
// taller, broader and thicker-necked, wearing the outfit over everything the
// female version leaves bare.
//
// Only bone *translations* are edited. Moving a joint drags the skinned mesh
// with it, which is what reshapes the silhouette; a non-uniform bone scale
// would instead shear its way down the rotated arm bones and stretch the
// arms. Everything else is a plain scale of the whole fitted model, which
// can't skew anything.
const MALE_BUILD = {
  height: 1.08, // relative to MODEL_HEIGHT, which the women keep
  width: 1.16, // broader head-on...
  depth: 1.12, // ...and side-on
  shoulderSpread: 1.8, // multiplies the shoulders' sideways offset from the chest
  neckLength: 0.7, // head sits lower, so the neck reads short and thick
}

// The rig names these `Shoulder.L` / `Shoulder.R` / `Neck`; GLTFLoader strips
// the dots, same as GRIP_BONE above.
const SHOULDER_BONES = ['ShoulderL', 'ShoulderR']
const NECK_BONE = 'Neck'

function applyMaleBuild(root: THREE.Object3D) {
  for (const name of SHOULDER_BONES) {
    // Both shoulders hang off the chest at ±x, so scaling that offset pushes
    // the pair of them — and the arms below them — straight outwards.
    const shoulder = root.getObjectByName(name)
    if (shoulder) shoulder.position.x *= MALE_BUILD.shoulderSpread
  }
  const neck = root.getObjectByName(NECK_BONE)
  if (neck) neck.position.y *= MALE_BUILD.neckLength
}

// The color the male build paints over every skin-colored surface, so he
// reads as covered head to toe in his own kit rather than as a recolored
// woman. Read off the loaded material instead of hard-coded, so a class
// wearing a recolored outfit (the cleric's cream/gold witch robe) matches
// what it is actually wearing.
function outfitColor(root: THREE.Object3D, asset: ClassAsset): THREE.Color {
  const override = asset.recolor?.[asset.outfitMaterial]
  if (override) return new THREE.Color(override)

  // Collected into an array because TypeScript can't see through the
  // traverse callback that a plain `let` was ever assigned.
  const found: THREE.Color[] = []
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const material = child.material as THREE.MeshStandardMaterial
    if (material.name === asset.outfitMaterial) found.push(material.color)
  })
  return found[0] ?? new THREE.Color(ROBE_COLOR)
}

// Kept for the procedural fallback only: if a real model fails to load there
// is no .glb mesh left to reshape, so that placeholder is reshaped instead.
const GENDER_PROPORTIONS: Record<CharacterGender, { width: number; height: number }> = {
  male: { width: 1.1, height: 1.05 },
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
// low-poly humanoid with just the head/hands tinted (by skinColor, or by the
// robe color on the male build).
function ProceduralCharacterModel({ skinColor, gender }: { skinColor: string; gender: CharacterGender }) {
  const { width, height } = GENDER_PROPORTIONS[gender]
  // Same rule as the real models: the male build covers what the female one
  // leaves bare, in the outfit's own color.
  const bare = gender === 'male' ? ROBE_COLOR : skinColor
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
            <meshStandardMaterial color={bare} />
          </mesh>
        </group>
      ))}

      <mesh castShadow position={[0, 0.52, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color={bare} />
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

// Weapons for the outfits that ship empty-handed, built in normal
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

// The player's real model: the class's rigged .glb, auto-fit into
// MODEL_HEIGHT/MODEL_FEET_Y so every class drops into the same slot, and
// rendered in its bind pose (the pack's animations go unused) so it just
// stands there. Both genders wear the same mesh — gender only decides the
// build and what the skin-colored surfaces are painted with.
function RiggedCharacterModel({ characterClass, gender, skinColor }: CharacterAppearance) {
  const asset = CLASS_ASSETS[characterClass]
  const { scene } = useGLTF(asset.glb)

  const fitted = useMemo(() => {
    // Skinned meshes can't be shared between canvases (the player, the
    // profile portrait and the combat portrait can all be on screen at
    // once), so this clones the skeleton too rather than the scene graph
    // alone.
    const clone = cloneSkinned(scene)
    const male = gender === 'male'
    // Read before the loop below replaces the materials it looks at.
    const bare = male ? outfitColor(clone, asset) : new THREE.Color(skinColor)

    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      child.castShadow = true
      const source = child.material as THREE.MeshStandardMaterial
      const material = source.clone()
      if (source.name === 'Skin') material.color.copy(bare)
      else if (asset.recolor?.[source.name]) material.color.set(asset.recolor[source.name])
      // The pack's hair is styled long whatever the class; darkening it on
      // the male build keeps it from reading as the mane it was modelled as.
      else if (male && source.name.startsWith('Hair')) material.color.set(HAIR_COLOR)
      child.material = material
    })

    if (male) applyMaleBuild(clone)

    clone.updateMatrixWorld(true)
    const rawBox = new THREE.Box3().setFromObject(clone)
    const rawSize = rawBox.getSize(new THREE.Vector3())
    // Box3 poses a SkinnedMesh before measuring it, so this already accounts
    // for applyMaleBuild: the shortened neck comes back out of rawSize.y and
    // the rest of him scales up to fill MODEL_HEIGHT again, which is what
    // makes the head look sunk into the shoulders rather than the man look
    // short.
    const fit = rawSize.y > 0 ? MODEL_HEIGHT / rawSize.y : 1
    if (male) clone.scale.set(fit * MALE_BUILD.width, fit * MALE_BUILD.height, fit * MALE_BUILD.depth)
    else clone.scale.setScalar(fit)

    clone.updateMatrixWorld(true)
    const scaledBox = new THREE.Box3().setFromObject(clone)
    const center = scaledBox.getCenter(new THREE.Vector3())
    clone.position.set(-center.x, MODEL_FEET_Y - scaledBox.min.y, -center.z)

    if (asset.weapon === 'dagger') attachWeapon(clone, buildDagger(), false)
    if (asset.weapon === 'staff') attachWeapon(clone, buildStaff(asset.staffOrbColor ?? '#8be3ff'), true)

    return clone
  }, [scene, gender, skinColor, asset])

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
        <RiggedCharacterModel
          characterClass={appearance.characterClass}
          gender={gender}
          skinColor={appearance.skinColor ?? SKIN_FALLBACK_COLOR}
        />
      </Suspense>
    </ModelErrorBoundary>
  )
}
