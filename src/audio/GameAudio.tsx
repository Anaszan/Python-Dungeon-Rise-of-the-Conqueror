import { useEffect } from 'react'
import { startDungeonMusic, stopDungeonMusic } from './soundEngine'
import { useGameStore } from '../game/store'

// Mounted only while the dungeon (app-root) is on screen — see App.tsx.
// Starts that level's theme on mount (each of the 6 levels has its own —
// see DUNGEON_THEMES in soundEngine.ts) and fades it out on unmount (leaving
// the dungeon for a story/teaching screen, or game over). Re-triggers if the
// level changes while mounted, so the theme always matches the current level.
export function GameAudio() {
  const level = useGameStore((s) => s.currentLevel)

  useEffect(() => {
    startDungeonMusic(level)
    return () => stopDungeonMusic()
  }, [level])

  return null
}
