import { useState, type FormEvent } from 'react'
import { useAuthStore } from '../auth/authStore'
import { PASSWORD_RE, PASSWORD_HINT } from '../auth/passwordRules'
import { EyeIcon, EyeOffIcon, LockIcon, SparkIcon } from './AuthIcons'

export function ResetPasswordScreen() {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { updatePassword, loading, error, notice } = useAuthStore()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!PASSWORD_RE.test(password)) {
      useAuthStore.setState({ error: PASSWORD_HINT, notice: null })
      return
    }
    updatePassword(password)
  }

  return (
    <div className="screen-overlay">
      <form className="auth-panel" onSubmit={handleSubmit}>
        <div className="auth-icon-badge">
          <SparkIcon />
        </div>
        <h1>ตั้งรหัสผ่านใหม่</h1>
        <p className="auth-subtitle">กรอกรหัสผ่านใหม่ของคุณเพื่อกู้คืนบัญชี</p>

        <div className="auth-field">
          <label htmlFor="reset-password">รหัสผ่านใหม่</label>
          <div className="auth-input-wrapper has-toggle">
            <span className="auth-input-icon">
              <LockIcon />
            </span>
            <input
              id="reset-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <button
              type="button"
              className="auth-toggle-visibility"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          <p className="auth-password-hint">{PASSWORD_HINT}</p>
        </div>

        {error && <p className="auth-error">{error}</p>}
        {notice && <p className="auth-notice">{notice}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'กำลังดำเนินการ...' : 'บันทึกรหัสผ่านใหม่'}
        </button>
      </form>
    </div>
  )
}
