import { useState, type FormEvent } from 'react'
import { useAuthStore } from '../auth/authStore'
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon, PhoneIcon, SparkIcon, UserIcon } from './AuthIcons'

const REMEMBER_KEY = 'pd-remember-identifier'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginScreen({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [identifier, setIdentifier] = useState(() => localStorage.getItem(REMEMBER_KEY) ?? '')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(() => Boolean(localStorage.getItem(REMEMBER_KEY)))
  const { signIn, signUp, resetPassword, loading, error, notice } = useAuthStore()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (remember) {
      localStorage.setItem(REMEMBER_KEY, identifier)
    } else {
      localStorage.removeItem(REMEMBER_KEY)
    }
    if (mode === 'signIn') {
      signIn(identifier, password)
    } else {
      signUp(email, password, nickname, phone)
    }
  }

  const handleForgotPassword = () => {
    if (!EMAIL_RE.test(identifier)) {
      useAuthStore.setState({ error: 'กรอกอีเมลของคุณในช่องด้านบนก่อนเพื่อรีเซ็ตรหัสผ่าน', notice: null })
      return
    }
    resetPassword(identifier)
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

        {mode === 'signIn' ? (
          <div className="auth-field">
            <label htmlFor="auth-identifier">อีเมล / เบอร์โทร / ชื่อเล่น</label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <UserIcon />
              </span>
              <input
                id="auth-identifier"
                type="text"
                placeholder="กรอกอีเมล เบอร์โทร หรือชื่อเล่น"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
          </div>
        ) : (
          <>
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
              <label htmlFor="auth-phone">เบอร์โทร</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">
                  <PhoneIcon />
                </span>
                <input
                  id="auth-phone"
                  type="tel"
                  placeholder="08x-xxx-xxxx"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="auth-field">
              <label htmlFor="auth-nickname">ชื่อเล่น</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">
                  <UserIcon />
                </span>
                <input
                  id="auth-nickname"
                  type="text"
                  placeholder="ตั้งชื่อเล่นของเจ้า"
                  autoComplete="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                />
              </div>
            </div>
          </>
        )}

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
              minLength={6}
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
