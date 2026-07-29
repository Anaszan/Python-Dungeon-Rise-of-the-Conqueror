import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../auth/authStore'

const NAME_MIN_LENGTH = 2
const NAME_MAX_LENGTH = 30

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

export function ProfileEditor() {
  const userId = useAuthStore((s) => s.session?.user.id)
  const [displayName, setDisplayName] = useState('')
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setStatus('loading')
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setDisplayName(data?.display_name ?? '')
        setStatus('idle')
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const trimmed = displayName.trim()
  const isValid = trimmed.length >= NAME_MIN_LENGTH && trimmed.length <= NAME_MAX_LENGTH

  const save = async () => {
    if (!userId || !isValid) return
    setStatus('saving')
    const { error } = await supabase.from('profiles').update({ display_name: trimmed }).eq('id', userId)
    setStatus(error ? 'error' : 'saved')
  }

  return (
    <div className="profile-editor">
      <p className="customize-section-label">ชื่อที่แสดง (โปรไฟล์ / อันดับผู้เล่น)</p>
      <input
        type="text"
        className="customize-name-input"
        value={displayName}
        onChange={(e) => {
          setDisplayName(e.target.value)
          setStatus('idle')
        }}
        maxLength={NAME_MAX_LENGTH}
        disabled={status === 'loading'}
        placeholder="ตั้งชื่อที่แสดง"
      />
      <div className="profile-editor-row">
        <button type="button" className="profile-save-btn" disabled={!isValid || status === 'saving'} onClick={save}>
          บันทึก
        </button>
        {status === 'saving' && <span className="customize-name-status">กำลังบันทึก...</span>}
        {status === 'saved' && <span className="customize-name-status customize-name-ok">บันทึกแล้ว</span>}
        {status === 'error' && <span className="customize-name-status customize-name-error">บันทึกไม่สำเร็จ ลองอีกครั้ง</span>}
        {status === 'idle' && !isValid && trimmed.length > 0 && (
          <span className="customize-name-status customize-name-error">
            ชื่อต้องมีความยาว {NAME_MIN_LENGTH}-{NAME_MAX_LENGTH} ตัวอักษร
          </span>
        )}
      </div>
    </div>
  )
}
