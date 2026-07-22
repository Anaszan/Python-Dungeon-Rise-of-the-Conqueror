import { useGameStore } from '../game/store'
import { Mentor } from '../components/Mentor'

const DEFEAT_LINES = [
  'เจ้าล้มลงเสียแล้ว... แต่จงอย่าท้อใจ นักผจญภัยที่แท้จริงย่อมล้มแล้วลุกขึ้นใหม่เสมอ',
  'ข้าจะรอเจ้าอยู่ที่จุดเริ่มต้นของการผจญภัย ไปฝึกฝนแล้วกลับมาปราบเหล่ามอนสเตอร์บั๊กอีกครั้งเถิด',
]

export function GameOverOverlay() {
  const phase = useGameStore((s) => s.phase)
  const restart = useGameStore((s) => s.restart)

  if (phase !== 'gameover') return null

  return (
    <div className="screen-overlay gameover-overlay">
      <div className="story-panel">
        <h1>แพ้</h1>
        <p>คุณพ่ายแพ้ต่อเหล่ามอนสเตอร์บั๊ก ลองอีกครั้งเพื่อกอบกู้อาณาจักรโค้ด</p>
        <Mentor key={phase} lines={DEFEAT_LINES} compact />
        <button onClick={restart}>เริ่มใหม่</button>
      </div>
    </div>
  )
}
