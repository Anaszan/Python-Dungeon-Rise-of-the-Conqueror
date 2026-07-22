import { useEffect, useState } from 'react'
import { isMuted, onMuteChange, toggleMuted } from './soundEngine'

function SpeakerOnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M17 8.5a5 5 0 0 1 0 7" />
      <path d="M19.5 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  )
}

function SpeakerOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="m16 9 5 6M21 9l-5 6" />
    </svg>
  )
}

// Rendered once at the app root (see App.tsx) so it's reachable from every
// screen, since background music and combat SFX can both fire well before
// the player reaches any one specific screen.
export function SoundToggle() {
  const [muted, setMutedState] = useState(isMuted)

  useEffect(() => onMuteChange(setMutedState), [])

  return (
    <button
      type="button"
      className="sound-toggle"
      onClick={toggleMuted}
      aria-label={muted ? 'เปิดเสียง' : 'ปิดเสียง'}
      title={muted ? 'เปิดเสียง' : 'ปิดเสียง'}
    >
      {muted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
    </button>
  )
}
