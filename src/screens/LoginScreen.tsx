import { useState, type FormEvent } from 'react'
import { useAuthStore } from '../auth/authStore'
import { PASSWORD_RE, PASSWORD_HINT } from '../auth/passwordRules'
import { EyeIcon, EyeOffIcon, GoogleIcon, LockIcon, MailIcon, SparkIcon } from './AuthIcons'

const REMEMBER_KEY = 'pd-remember-identifier'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginScreen({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBER_KEY) ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(() => Boolean(localStorage.getItem(REMEMBER_KEY)))
  const { signIn, signUp, signInWithGoogle, resetPassword, loading, error, notice } = useAuthStore()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (remember) {
      localStorage.setItem(REMEMBER_KEY, email)
    } else {
      localStorage.removeItem(REMEMBER_KEY)
    }
    if (mode === 'signIn') {
      signIn(email, password)
      return
    }
    if (!PASSWORD_RE.test(password)) {
      useAuthStore.setState({ error: PASSWORD_HINT, notice: null })
      return
    }
    signUp(email, password)
  }

  const handleForgotPassword = () => {
    if (!EMAIL_RE.test(email)) {
      useAuthStore.setState({ error: 'กรอกอีเมลของคุณในช่องด้านบนก่อนเพื่อรีเซ็ตรหัสผ่าน', notice: null })
      return
    }
    resetPassword(email)
  }

  return (
    <div className="screen-overlay">
      <button type="button" className="back-home-btn" onClick={onBack}>
        ← กลับหน้าแรก
      </button>
      <form className="auth-panel" onSubmit={handleSubmit}>
        <div className="auth-icon-badge">
          <SparkIcon />
        </div>
        <h1>{mode === 'signIn' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</h1>
        <p className="auth-subtitle">
          {mode === 'signIn' ? 'ยินดีต้อนรับกลับสู่ Python Dungeon' : 'เข้าร่วมการผจญภัยแห่ง Python'}
        </p>

        <button type="button" className="auth-oauth-btn" onClick={() => signInWithGoogle()} disabled={loading}>
          <GoogleIcon />
          เข้าสู่ระบบด้วย Google
        </button>

        <div className="auth-divider">
          <span>หรือ</span>
        </div>

        <div className="auth-field">
          <label htmlFor="auth-email">อีเมล</label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon">
              <MailIcon />
            </span>
            <input
              id="auth-email"
              type="email"
              placeholder="username@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="auth-password">รหัสผ่าน</label>
          <div className="auth-input-wrapper has-toggle">
            <span className="auth-input-icon">
              <LockIcon />
            </span>
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
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
          {mode === 'signUp' && <p className="auth-password-hint">{PASSWORD_HINT}</p>}
        </div>

        <div className="auth-row">
          <label className="auth-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            จดจำฉันไว้
          </label>
          {mode === 'signIn' && (
            <button type="button" className="auth-forgot" onClick={handleForgotPassword}>
              ลืมรหัสผ่าน?
            </button>
          )}
        </div>

        {error && <p className="auth-error">{error}</p>}
        {notice && <p className="auth-notice">{notice}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'กำลังดำเนินการ...' : mode === 'signIn' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
        </button>
        <button
          type="button"
          className="auth-switch"
          onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
        >
          {mode === 'signIn' ? 'ยังไม่มีบัญชี? สมัครสมาชิก' : 'มีบัญชีแล้ว? เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  )
}
