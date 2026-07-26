import { useEffect, useRef, useState } from 'react'
import { useGameStore } from './store'
import { ALL_MONSTERS, LEVELS } from './levels'
import { LESSONS } from './lessons'
import { PLAYER_MAX_HP } from './constants'
import { Mentor } from '../components/Mentor'
import { SpellConsole } from './SpellConsole'
import { DEFAULT_CHARACTER_CLASS } from '../character/characterOptions'
import { CharacterPortrait } from '../character/CharacterPortrait'

export function CombatOverlay() {
  const phase = useGameStore((s) => s.phase)
  const currentLevel = useGameStore((s) => s.currentLevel)
  const activeMonsterId = useGameStore((s) => s.activeMonsterId)
  const monsterHp = useGameStore((s) => s.monsterHp)
  const defeatedIds = useGameStore((s) => s.defeatedIds)
  const playerHp = useGameStore((s) => s.playerHp)
  const attackPower = useGameStore((s) => s.attackPower)
  const skillCooldown = useGameStore((s) => s.skillCooldown)
  const attackCooldown = useGameStore((s) => s.attackCooldown)
  const monsterAttackCountdown = useGameStore((s) => s.monsterAttackCountdown)
  const characterClass = useGameStore((s) => s.characterClass) ?? DEFAULT_CHARACTER_CLASS
  const skinColor = useGameStore((s) => s.skinColor)
  const damageMonster = useGameStore((s) => s.damageMonster)
  const startSkillCooldown = useGameStore((s) => s.startSkillCooldown)
  const startAttackCooldown = useGameStore((s) => s.startAttackCooldown)
  const exitCombat = useGameStore((s) => s.exitCombat)

  const monster = activeMonsterId ? ALL_MONSTERS.find((m) => m.id === activeMonsterId) : undefined
  const hp = monster ? (monsterHp[monster.id] ?? monster.maxHp) : 0

  // Briefly flash the monster portrait / shake the panel whenever a hit
  // actually lands, so damage reads as an event rather than a silent number
  // change. Guarded against firing on the render where the monster itself
  // changes (new fight, HP reset to full).
  const [monsterHit, setMonsterHit] = useState(false)
  const [playerHit, setPlayerHit] = useState(false)
  const prevMonsterId = useRef(activeMonsterId)
  const prevHp = useRef(hp)
  const prevPlayerHp = useRef(playerHp)

  useEffect(() => {
    const monsterChanged = prevMonsterId.current !== activeMonsterId
    prevMonsterId.current = activeMonsterId
    if (monsterChanged) {
      prevHp.current = hp
      return
    }
    if (hp < prevHp.current) {
      setMonsterHit(true)
      const t = setTimeout(() => setMonsterHit(false), 300)
      prevHp.current = hp
      return () => clearTimeout(t)
    }
    prevHp.current = hp
  }, [hp, activeMonsterId])

  useEffect(() => {
    if (playerHp < prevPlayerHp.current) {
      setPlayerHit(true)
      const t = setTimeout(() => setPlayerHit(false), 300)
      prevPlayerHp.current = playerHp
      return () => clearTimeout(t)
    }
    prevPlayerHp.current = playerHp
  }, [playerHp])

  if (phase !== 'combat' || !activeMonsterId) return null
  if (!monster) return null

  const hpPct = Math.max(0, Math.min(100, (hp / monster.maxHp) * 100))
  const defeated = hp <= 0

  const levelData = LEVELS[currentLevel - 1]
  const levelCleared = defeated && levelData.monsters.every((m) => defeatedIds.has(m.id))
  const isLastLevel = currentLevel === LEVELS.length
  const lesson = LESSONS[currentLevel - 1]

  return (
    <div className="combat-overlay">
      <div className={`combat-panel${playerHit ? ' panel-shake' : ''}${!defeated ? ' combat-panel-wide' : ''}`}>
        <div className="versus-row">
          <div className={`player-portrait${playerHit ? ' recoil' : ''}${monsterHit ? ' lunge' : ''}`}>
            <CharacterPortrait appearance={{ characterClass, skinColor }} />
          </div>
          <span className="versus-label">VS</span>
          <div className={`monster-portrait${monsterHit ? ' recoil' : ''}${playerHit ? ' lunge' : ''}`}>
            {monster.imageUrl ? (
              <img src={monster.imageUrl} alt={monster.name} />
            ) : (
              <div className="monster-portrait-fallback" style={{ background: monster.color }} />
            )}
          </div>
        </div>
        <h2>{monster.name}</h2>
        <div className="hp-bar-track">
          <div className="hp-bar-fill" style={{ width: `${hpPct}%` }} />
        </div>
        <p className="hp-label">
          {hp} / {monster.maxHp} HP
        </p>

        <p className="combat-player-hp">
          เลือดคุณ: {playerHp} / {PLAYER_MAX_HP}
        </p>

        {!defeated && (
          <div className="monster-attack-timer">
            <p className="monster-attack-timer-label">
              {monster.name} จะโจมตีในอีก {Math.ceil(monsterAttackCountdown)} วินาที
            </p>
            <div className="monster-attack-timer-track">
              <div
                className="monster-attack-timer-fill"
                style={{ width: `${Math.max(0, Math.min(100, (monsterAttackCountdown / monster.attackInterval) * 100))}%` }}
              />
            </div>
          </div>
        )}

        {defeated ? (
          <>
            <p className="combat-message">
              {levelCleared
                ? isLastLevel
                  ? 'ชนะเกม! คุณกอบกู้อาณาจักรโค้ดสำเร็จ 🎉'
                  : `ด่าน ${currentLevel} ผ่านแล้ว! เตรียมตัวลุยด่านต่อไป`
                : 'Defeated!'}
            </p>
            <button onClick={exitCombat}>{levelCleared && !isLastLevel ? 'ไปด่านต่อไป' : 'Continue'}</button>
          </>
        ) : (
          <>
            <Mentor
              key={activeMonsterId}
              compact
              lines={[
                `เจ้าพบ ${monster.name}! ใช้กล่อง "โจมตี" กับ "สกิลพิเศษ" ด้านล่าง ทั้งสองต้องเขียนโค้ด Python เองทั้งคู่`,
                `ทบทวนบทที่ ${lesson.chapter} (${lesson.chapterTitle}) ได้จากคำใบ้ในโค้ดตั้งต้น หรือย้อนกลับไปฟังคำสอนตอนเข้าด่านนี้ใหม่อีกครั้ง`,
                'ทั้งสองคาถามีช่วงพักพลัง (คูลดาวน์) หลังร่ายทุกครั้ง — โจมตีพักสั้นกว่า สกิลพิเศษพักนานกว่าแต่แรงกว่า',
              ]}
            />
            <SpellConsole
              lesson={lesson}
              monsterId={activeMonsterId}
              monsterHp={hp}
              monsterName={monster.name}
              monsterArmor={monster.armor ?? 999}
              playerHp={playerHp}
              playerAtk={attackPower}
              skillCooldown={skillCooldown}
              attackCooldown={attackCooldown}
              onAttack={damageMonster}
              onSkillDamage={damageMonster}
              onAttackCast={startAttackCooldown}
              onSkillCast={startSkillCooldown}
            />
            <div className="combat-actions combat-actions-secondary">
              <button onClick={exitCombat}>Flee</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
