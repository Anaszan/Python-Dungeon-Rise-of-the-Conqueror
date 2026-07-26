import { useState } from 'react'
import { supabase } from '../lib/supabase'

type ScoreRow = {
  monsters_defeated: number
  completed_at: string
  profiles: { display_name: string | null } | null
}

export function Leaderboard() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scores, setScores] = useState<ScoreRow[]>([])

  const toggle = async () => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    setLoading(true)
    const { data, error } = await supabase
      .from('scores')
      .select('monsters_defeated, completed_at, profiles(display_name)')
      .order('monsters_defeated', { ascending: false })
      .order('completed_at', { ascending: true })
      .limit(10)
    if (!error) setScores((data ?? []) as unknown as ScoreRow[])
    setLoading(false)
  }

  return (
    <>
      <button className="leaderboard-toggle" onClick={toggle}>
        🏆 อันดับ
      </button>
      {open && (
        <div className="screen-overlay leaderboard-overlay" onClick={toggle}>
          <div className="auth-panel" onClick={(e) => e.stopPropagation()}>
            <h1>อันดับผู้เล่น</h1>
            {loading ? (
              <p>กำลังโหลด...</p>
            ) : scores.length === 0 ? (
              <p>ยังไม่มีผู้เล่นพิชิตเกมนี้</p>
            ) : (
              <ol className="leaderboard-list">
                {scores.map((s, i) => (
                  <li key={i}>
                    {s.profiles?.display_name ?? 'ผู้เล่นนิรนาม'} — {s.monsters_defeated} ตัว
                  </li>
                ))}
              </ol>
            )}
            <button type="button" onClick={toggle}>
              ปิด
            </button>
          </div>
        </div>
      )}
    </>
  )
}
