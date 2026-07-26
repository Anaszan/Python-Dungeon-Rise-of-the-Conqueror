import { useEffect } from 'react'
import { startMenuMusic, stopMenuMusic } from './soundEngine'

// Mounted on the landing page, login/register, and every pre-dungeon screen
// (story intro, character pick, chapter briefing) — see App.tsx. Fades in
// the bright menu theme on mount, fades it out on unmount (e.g. entering
// the dungeon, where GameAudio takes over with the dungeon theme instead).
export function MenuAudio() {
  useEffect(() => {
    startMenuMusic()
    return () => stopMenuMusic()
  }, [])

  return null
}
