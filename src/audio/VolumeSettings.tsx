import { useEffect, useState } from 'react'
import {
  getMusicVolume,
  getSfxVolume,
  setMusicVolume,
  setSfxVolume,
  onVolumeChange,
  isMuted,
  onMuteChange,
  toggleMuted,
} from './soundEngine'

export function VolumeSettings() {
  const [musicVolume, setMusicVolumeState] = useState(getMusicVolume)
  const [sfxVolume, setSfxVolumeState] = useState(getSfxVolume)
  const [muted, setMutedState] = useState(isMuted)

  useEffect(
    () =>
      onVolumeChange(() => {
        setMusicVolumeState(getMusicVolume())
        setSfxVolumeState(getSfxVolume())
      }),
    [],
  )
  useEffect(() => onMuteChange(setMutedState), [])

  return (
    <div className="volume-settings">
      <label className="volume-row">
        <span>เพลงพื้นหลัง</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={musicVolume}
          onChange={(e) => setMusicVolume(Number(e.target.value))}
        />
      </label>
      <label className="volume-row">
        <span>เสียงเอฟเฟกต์</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={sfxVolume}
          onChange={(e) => setSfxVolume(Number(e.target.value))}
        />
      </label>
      <button type="button" className="volume-mute-btn" onClick={toggleMuted}>
        {muted ? '🔇 เปิดเสียงทั้งหมด' : '🔊 ปิดเสียงทั้งหมด'}
      </button>
    </div>
  )
}
