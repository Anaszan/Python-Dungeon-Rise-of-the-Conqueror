import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useGameStore } from '../game/store'
import {
  CHARACTER_CLASS_OPTIONS,
  SKIN_COLOR_OPTIONS,
  DEFAULT_CHARACTER_CLASS,
  DEFAULT_SKIN_COLOR,
} from '../character/characterOptions'
import { CharacterModel } from '../character/CharacterModel'

export function CharacterCustomize() {
  const storeClass = useGameStore((s) => s.characterClass)
  const storeSkinColor = useGameStore((s) => s.skinColor)
  const confirmCharacter = useGameStore((s) => s.confirmCharacter)

  const [characterClass, setCharacterClass] = useState(storeClass ?? DEFAULT_CHARACTER_CLASS)
  const [skinColor, setSkinColor] = useState(storeSkinColor ?? DEFAULT_SKIN_COLOR)

  return (
    <div className="screen-overlay">
      <div className="customize-panel">
        <h1>แต่งตัวตัวละคร</h1>

        <div className="customize-preview">
          <Canvas camera={{ position: [0, 1, 2.5], fov: 40 }}>
            <ambientLight intensity={0.8} />
            <directionalLight position={[2, 3, 2]} intensity={1} />
            <group position={[0, -0.3, 0]}>
              <CharacterModel appearance={{ characterClass, skinColor }} />
            </group>
            <OrbitControls enablePan={false} enableZoom={false} />
          </Canvas>
        </div>

        <div className="customize-section">
          <p>อาชีพ</p>
          <div className="accessory-row">
            {CHARACTER_CLASS_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`accessory-btn ${characterClass === opt.id ? 'accessory-active' : ''}`}
                onClick={() => setCharacterClass(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="customize-section">
          <p>สีผิว</p>
          <div className="swatch-row">
            {SKIN_COLOR_OPTIONS.map((color) => (
              <button
                key={color}
                type="button"
                className={`swatch ${skinColor === color ? 'swatch-active' : ''}`}
                style={{ background: color }}
                aria-label={color}
                onClick={() => setSkinColor(color)}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          className="customize-confirm"
          onClick={() => confirmCharacter(characterClass, skinColor)}
        >
          เริ่มการผจญภัย
        </button>
      </div>
    </div>
  )
}
