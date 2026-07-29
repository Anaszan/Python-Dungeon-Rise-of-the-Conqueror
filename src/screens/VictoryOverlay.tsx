import { useGameStore } from '../game/store'
import { Mentor } from '../components/Mentor'

const VICTORY_LINES = [
  'เจ้าได้กอบกู้อาณาจักรโค้ดจากเหล่ามอนสเตอร์บั๊กจนหมดสิ้นแล้ว!',
  'นักผจญภัยผู้ยิ่งใหญ่ ข้าขอคารวะในความเพียรของเจ้า จะเริ่มการผจญภัยใหม่อีกครั้งก็ได้นะ',
]

export function VictoryOverlay() {
  const phase = useGameStore((s) => s.phase)
  const restart = useGameStore((s) => s.restart)

  if (phase !== 'victory') return null

  return (
    <div className="screen-overlay victory-overlay">
      <div className="story-panel">
        <h1>ชนะเกม!</h1>
        <p>คุณพิชิตดันเจี้ยนทั้ง 6 ด่านและกอบกู้อาณาจักรโค้ดได้สำเร็จ 🎉</p>
        <Mentor key={phase} lines={VICTORY_LINES} compact />
        <button onClick={restart}>เล่นใหม่อีกครั้ง</button>
      </div>
    </div>
  )
}
