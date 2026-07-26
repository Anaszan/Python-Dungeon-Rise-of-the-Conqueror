import { Canvas } from '@react-three/fiber'
import { CharacterModel, type CharacterAppearance } from './CharacterModel'

// Renders the player's actual in-game model (same component Player.tsx uses,
// same class/skin color) as a small bust shot for the combat screen, instead
// of a separate illustration that wouldn't match what they picked/see while
// exploring. Camera sits at chest height so the crop frames head-to-chest.
export function CharacterPortrait({ appearance }: { appearance: CharacterAppearance }) {
  return (
    <Canvas camera={{ position: [0, 0.32, 1.85], fov: 27 }} gl={{ alpha: true }}>
      <ambientLight intensity={1.1} color="#8a7050" />
      <directionalLight position={[1.5, 2, 3]} intensity={1.6} color="#ffcf8a" />
      <directionalLight position={[-1.5, 1, 2]} intensity={0.5} color="#fff3d6" />
      {/* Rotation 0 is the model's front (confirmed empirically); a small
          turn reads as a more natural portrait pose than a flat mugshot. */}
      <group rotation={[0, 0.35, 0]}>
        <CharacterModel appearance={appearance} />
      </group>
    </Canvas>
  )
}
