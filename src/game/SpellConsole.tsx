import { useEffect, useState, type KeyboardEvent } from 'react'
import { castSpell, getPyodide } from './pyodideRuntime'
import { pickSkeleton, type LessonData } from './lessons'

type SpellConsoleProps = {
  lesson: LessonData
  monsterId: string
  monsterHp: number
  monsterName: string
  monsterArmor: number
  playerHp: number
  playerAtk: number
  skillCooldown: number
  attackCooldown: number
  onAttack: (amount: number) => void
  onSkillDamage: (amount: number) => void
  // Fired once after any run (from either box) that actually called
  // attack(...) / skill(...), so the caller can start the matching cooldown.
  onAttackCast: () => void
  onSkillCast: () => void
}

function insertTab(code: string, el: HTMLTextAreaElement): { next: string; caret: number } {
  const start = el.selectionStart
  const end = el.selectionEnd
  return { next: code.slice(0, start) + '    ' + code.slice(end), caret: start + 4 }
}

export type BoxState = {
  code: string
  casting: boolean
  log: string[]
  error: string | null
}

// The Python code sandbox that replaced the old placeholder Attack/skill
// buttons — see README "Python combat sandbox". Both the regular attack and
// the special skill are written as real Python here, each in its own box so
// they read as two separate spells rather than one shared script. Both
// boxes share the same battle-state globals and the same attack()/skill()
// bindings — whichever function the code calls is the effect that happens,
// regardless of which box it was typed in.
export function SpellConsole({
  lesson,
  monsterId,
  monsterHp,
  monsterName,
  monsterArmor,
  playerHp,
  playerAtk,
  skillCooldown,
  attackCooldown,
  onAttack,
  onSkillDamage,
  onAttackCast,
  onSkillCast,
}: SpellConsoleProps) {
  const [warming, setWarming] = useState(true)
  const [attackBox, setAttackBox] = useState<BoxState>(() => ({
    code: pickSkeleton(lesson.attackSkeletons, `${monsterId}:atk`),
    casting: false,
    log: [],
    error: null,
  }))
  const [skillBox, setSkillBox] = useState<BoxState>(() => ({
    code: pickSkeleton(lesson.skillSkeletons, `${monsterId}:skill`),
    casting: false,
    log: [],
    error: null,
  }))

  // Reset both editors back to a skeleton whenever the lesson or monster
  // changes — otherwise a previous fight's finished code (or the wrong
  // level's skeleton) would carry over. The seed includes monsterId so
  // level 1's 9 monsters naturally cycle through the "fill a number" vs
  // "fill a variable" variants instead of always showing the same one.
  useEffect(() => {
    setAttackBox({ code: pickSkeleton(lesson.attackSkeletons, `${monsterId}:atk`), casting: false, log: [], error: null })
    setSkillBox({ code: pickSkeleton(lesson.skillSkeletons, `${monsterId}:skill`), casting: false, log: [], error: null })
  }, [lesson, monsterId])

  // Warm the Pyodide runtime the moment the console mounts (first combat of
  // the session) so the multi-second download/boot cost isn't paid on the
  // player's first cast.
  useEffect(() => {
    let cancelled = false
    getPyodide()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setWarming(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function run(box: BoxState, setBox: (b: BoxState) => void) {
    setBox({ ...box, casting: true, log: [], error: null })
    const result = await castSpell(box.code, {
      playerHp,
      playerAtk,
      monsterHp,
      monsterName,
      monsterArmor,
      onAttack,
      onSkill: onSkillDamage,
    })
    setBox({ ...box, casting: false, log: result.log, error: result.ok ? null : result.errorMessage ?? 'คาถาผิดพลาด' })
    if (result.attackUsed) onAttackCast()
    if (result.skillUsed) onSkillCast()
  }

  return (
    <div className="spell-console">
      <CodeBox
        title={`โจมตี — ใส่ ${monsterName}`}
        state={attackBox}
        onChange={(code) => setAttackBox({ ...attackBox, code })}
        onRun={() => run(attackBox, setAttackBox)}
        label={
          warming
            ? 'กำลังเรียกพลังจากอีกมิติ...'
            : attackBox.casting
              ? 'กำลังร่ายคาถา...'
              : attackCooldown > 0
                ? `รอคูลดาวน์ (${Math.ceil(attackCooldown)}s)`
                : 'ร่ายคาถา ⚡'
        }
        disabled={warming || attackBox.casting || attackCooldown > 0}
      />
      <CodeBox
        title="สกิลพิเศษ"
        state={skillBox}
        onChange={(code) => setSkillBox({ ...skillBox, code })}
        onRun={() => run(skillBox, setSkillBox)}
        label={
          warming
            ? 'กำลังเรียกพลังจากอีกมิติ...'
            : skillBox.casting
              ? 'กำลังร่ายคาถา...'
              : skillCooldown > 0
                ? `รอคูลดาวน์ (${Math.ceil(skillCooldown)}s)`
                : 'ร่ายสกิลพิเศษ ✦'
        }
        disabled={warming || skillBox.casting || skillCooldown > 0}
      />
    </div>
  )
}

export function CodeBox({
  title,
  state,
  onChange,
  onRun,
  label,
  disabled,
}: {
  title: string
  state: BoxState
  onChange: (code: string) => void
  onRun: () => void
  label: string
  disabled: boolean
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const el = e.currentTarget
    const { next, caret } = insertTab(state.code, el)
    onChange(next)
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = caret
    })
  }

  return (
    <div className="spell-box">
      <p className="spell-console-label">{title}</p>
      <textarea
        className="spell-textarea"
        value={state.code}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        disabled={state.casting}
        rows={6}
      />
      {(state.log.length > 0 || state.error) && (
        <div className="spell-log">
          {state.log.map((line, i) => (
            <p key={i} className="spell-log-line">
              {line}
            </p>
          ))}
          {state.error && <p className="spell-log-error">{state.error}</p>}
        </div>
      )}
      <button className="spell-run-btn" onClick={onRun} disabled={disabled}>
        {label}
      </button>
    </div>
  )
}
