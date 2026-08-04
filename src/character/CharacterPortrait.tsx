import { Canvas } from '@react-three/fiber'
import { CharacterModel, type CharacterAppearance } from './CharacterModel'

export type PortraitView = 'bust' | 'back'

// Rotation 0 is the model's front (confirmed empirically), and R3F's default
// camera looks at the origin — the model's mid-body, since CharacterModel
// centers itself on y=0.
//
// 'bust' is the original head-to-chest mugshot used on the profile screen.
// 'back' is the battle-stage shot: the whole body seen from behind at a
// slight angle, the over-the-shoulder framing a Pokemon-style battle puts
// the player's own side in. The angle is offset from a flat Math.PI so the
// weapon stays visible instead of hiding directly behind the torso.
const VIEWS: Record<PortraitView, { position: [number, number, number]; fov: number; rotationY: number }> = {
  bust: { position: [0, 0.32, 1.85], fov: 27, rotationY: 0.35 },
  back: { position: [0, 0.35, 2.9], fov: 32, rotationY: Math.PI - 0.4 },
}

// Renders the player's actual in-game model (same component Player.tsx uses,
// same class/skin color) rather than a separate illustration that wouldn't
// match what they picked and see while exploring.
export function CharacterPortrait({
  appearance,
  view = 'bust',
}: {
  appearance: CharacterAppearance
  view?: PortraitView
}) {
  const { position, fov, rotationY } = VIEWS[view]
  return (
    <Canvas camera={{ position, fov }} gl={{ alpha: true }}>
      <ambientLight intensity={1.1} color="#8a7050" />
      <directionalLight position={[1.5, 2, 3]} intensity={1.6} color="#ffcf8a" />
      <directionalLight position={[-1.5, 1, 2]} intensity={0.5} color="#fff3d6" />
      <group rotation={[0, rotationY, 0]}>
        <CharacterModel appearance={appearance} />
      </group>
    </Canvas>
  )
}
