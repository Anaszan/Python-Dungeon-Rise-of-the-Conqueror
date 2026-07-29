import { useGameStore } from '../game/store'
import { useAuthStore } from '../auth/authStore'
import { VolumeSettings } from '../audio/VolumeSettings'
import { ProfileEditor } from './ProfileEditor'

export function PauseMenu() {
  const paused = useGameStore((s) => s.paused)
  const setPaused = useGameStore((s) => s.setPaused)
  const signOut = useAuthStore((s) => s.signOut)

  if (!paused) return null

  return (
    <div className="screen-overlay pause-overlay">
      <div className="customize-panel pause-panel">
        <h1>หยุดชั่วคราว</h1>

        <div className="customize-section">
          <p className="customize-section-label">เสียง</p>
          <VolumeSettings />
        </div>

        <div className="customize-section">
          <ProfileEditor />
        </div>

        <button type="button" className="customize-confirm" onClick={() => setPaused(false)}>
          เล่นต่อ
        </button>
        <button type="button" className="pause-logout-btn" onClick={() => signOut()}>
          ออกจากระบบ
        </button>
      </div>
    </div>
  )
}
