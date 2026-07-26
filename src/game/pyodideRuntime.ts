import type { PyodideInterface } from './pyodide'
import { SKILL_DAMAGE_MULTIPLIER } from './constants'

// Loaded lazily from jsdelivr the first time the player casts a spell, not
// bundled — see pyodide.d.ts for why. Cached as a module-level singleton so
// every subsequent cast in the session reuses the same interpreter instead
// of re-downloading/re-booting Pyodide (~a few MB, a couple of seconds).
const PYODIDE_VERSION = 'v0.28.3'
const PYODIDE_CDN_BASE = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`

let pyodidePromise: Promise<PyodideInterface> | null = null

function loadPyodideScript(): Promise<void> {
  if (window.loadPyodide) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `${PYODIDE_CDN_BASE}pyodide.js`
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('โหลดพลังเวท Pyodide ไม่สำเร็จ ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่'))
    document.head.appendChild(script)
  })
}

export function getPyodide(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    pyodidePromise = loadPyodideScript().then(() => {
      if (!window.loadPyodide) throw new Error('Pyodide script loaded but window.loadPyodide is missing')
      return window.loadPyodide({ indexURL: PYODIDE_CDN_BASE })
    })
  }
  return pyodidePromise
}

export type SpellContext = {
  playerHp: number
  playerAtk: number
  monsterHp: number
  monsterName: string
  monsterArmor: number
  // Called synchronously from inside the Python run whenever the script
  // calls attack(amount) / skill(amount) — wired straight to the game
  // store so damage lands immediately, same as the old buttons did.
  onAttack: (amount: number) => void
  onSkill: (amount: number) => void
}

export type SpellResult = {
  ok: boolean
  log: string[]
  errorMessage?: string
  // True if the code called attack(...) / skill(...) at least once — the
  // caller uses these to decide whether to start the matching cooldown,
  // regardless of which of the two SpellConsole boxes the code was run from.
  attackUsed: boolean
  skillUsed: boolean
}

// Level 3 (loops) is the first place a runaway while/for calling attack()
// or skill() every iteration is one typo away — there's no Web Worker/hard
// timeout yet (see README), so this call-count cap is a cheap backstop for
// the specific failure mode the loop lesson actually invites. It does not
// catch a pure `while True: pass` with no spell calls in it.
const MAX_SPELL_CALLS = 200
const CALL_LIMIT_MARKER = '__SPELL_CALL_LIMIT__'

// Maps a raw Python exception type name to the wizard's in-universe framing
// of it (matches the "คำสาป/กับดัก" language used in the chapter lessons) so
// a stack trace reads like part of the story instead of a raw dev error.
const ERROR_FLAVOR: Record<string, string> = {
  ZeroDivisionError: 'หารด้วยศูนย์ไม่ได้! คำสาปย้อนเข้าตัวเจ้าเอง',
  NameError: 'เจ้าเรียกใช้ตัวแปรที่ยังไม่ได้สร้างขึ้น ตรวจดูว่าตั้งชื่อผิดหรือลืมกำหนดค่าหรือไม่',
  TypeError: 'ชนิดข้อมูลไม่ตรงกัน ตรวจดูว่าใช้ตัวเลขกับตัวเลข ข้อความกับข้อความ',
  ValueError: 'ค่าที่ส่งเข้าคาถาไม่เหมาะสม',
  IndentationError: 'เยื้องบรรทัดผิดจังหวะ คาถาจึงร่ายไม่ออก',
  SyntaxError: 'โครงสร้างคาถาไม่ถูกต้องตามไวยากรณ์ — เจ้าอาจยังไม่ได้เติมช่องว่าง (___) ให้ครบ ตรวจวงเล็บ เครื่องหมาย : และการเยื้องบรรทัดด้วย',
  IndexError: 'เข้าถึงตำแหน่งที่ไม่มีอยู่จริง',
  KeyError: 'ไม่มี key นี้อยู่ในป้ายสถานะ',
  AttributeError: 'สิ่งนี้ไม่มีคุณสมบัติที่เจ้าเรียกใช้',
  FileNotFoundError: 'ไม่พบตำราเล่มนี้ — ลองจารึก (เขียน) ก่อนแล้วค่อยอ่าน',
}

function friendlyError(raw: string): string {
  const lines = raw.trim().split('\n')
  const lastLine = lines[lines.length - 1] ?? raw
  const match = lastLine.match(/^(\w+(?:Error|Warning)):\s*(.*)$/)
  if (!match) return `คาถาผิดพลาด: ${lastLine}`
  const [, type, detail] = match
  const flavor = ERROR_FLAVOR[type] ?? 'คาถาผิดพลาดจากคำสาปที่ไม่รู้จัก'
  return `${flavor} (${type}: ${detail})`
}

export async function castSpell(code: string, ctx: SpellContext): Promise<SpellResult> {
  const pyodide = await getPyodide()
  const log: string[] = []
  let attackUsed = false
  let skillUsed = false
  let callCount = 0

  pyodide.setStdout({ batched: (msg) => log.push(msg) })
  pyodide.setStderr({ batched: () => {} }) // real errors surface through the thrown exception below instead

  // attack() can never exceed the player's own base power; skill() gets a
  // higher ceiling (SKILL_DAMAGE_MULTIPLIER×) since it's meant to hit harder,
  // but both are capped here so no lesson's code (loops, functions, etc.)
  // can compute an unbounded damage number.
  function guardedCall(kind: 'attack' | 'skill', max: number, handler: (amount: number) => void) {
    return (amount: unknown) => {
      callCount += 1
      if (callCount > MAX_SPELL_CALLS) throw new Error(CALL_LIMIT_MARKER)
      const n = Number(amount)
      if (!Number.isFinite(n)) {
        log.push(`⚠ ${kind}() ต้องการตัวเลขเท่านั้น ท่องคาถาไม่สำเร็จ`)
        return
      }
      handler(Math.min(max, Math.max(0, Math.round(n))))
    }
  }

  pyodide.globals.set('hp', ctx.playerHp)
  pyodide.globals.set('atk', ctx.playerAtk)
  pyodide.globals.set('monster_hp', ctx.monsterHp)
  pyodide.globals.set('monster_name', ctx.monsterName)
  pyodide.globals.set('monster_armor', ctx.monsterArmor)
  pyodide.globals.set(
    'attack',
    guardedCall('attack', ctx.playerAtk, (amount) => {
      attackUsed = true
      ctx.onAttack(amount)
    }),
  )
  pyodide.globals.set(
    'skill',
    guardedCall('skill', ctx.playerAtk * SKILL_DAMAGE_MULTIPLIER, (amount) => {
      skillUsed = true
      ctx.onSkill(amount)
    }),
  )

  try {
    pyodide.runPython(code)
    return { ok: true, log, attackUsed, skillUsed }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    const errorMessage = raw.includes(CALL_LIMIT_MARKER)
      ? `คาถาของเจ้าเรียกพลังถี่เกินไป (เกิน ${MAX_SPELL_CALLS} ครั้งในคาถาเดียว) — วนซ้ำไม่รู้จบหรือเปล่า? ข้าตัดพลังงานไว้ก่อนที่จะค้างทั้งดันเจี้ยน`
      : friendlyError(raw)
    return { ok: false, log, attackUsed, skillUsed, errorMessage }
  }
}
