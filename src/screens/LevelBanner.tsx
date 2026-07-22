import { useGameStore } from '../game/store'
import { LEVELS } from '../game/levels'

export function LevelBanner() {
  const currentLevel = useGameStore((s) => s.currentLevel)
  const defeatedIds = useGameStore((s) => s.defeatedIds)
  const levelData = LEVELS[currentLevel - 1]
  const total = levelData.monsters.length
  const defeated = levelData.monsters.filter((m) => defeatedIds.has(m.id)).length

  return (
    <div className="level-banner">
      <span className="level-banner-name">ด่าน {currentLevel}: {levelData.name}</span>
      <span className="level-banner-progress">
        {defeated} / {total}
      </span>
    </div>
  )
}
