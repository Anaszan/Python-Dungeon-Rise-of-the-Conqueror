import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useGameStore } from './store'

// Read by Player.tsx and merged with the keyboard's forward/backward/left/right
// flags, so both input methods drive the same movement vector.
export const touchMoveState = { x: 0, z: 0 }

const MAX_RADIUS = 42

export function TouchJoystick() {
  const phase = useGameStore((s) => s.phase)
  const baseRef = useRef<HTMLDivElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })

  // Combat can start mid-drag (stepping onto a monster); the base disappears
  // ('return null' below) without ever seeing a pointerup, so without this the
  // last drag vector would keep driving the player once exploring resumes.
  useEffect(() => {
    return () => {
      touchMoveState.x = 0
      touchMoveState.z = 0
    }
  }, [])

  const updateFromPoint = (clientX: number, clientY: number) => {
    const base = baseRef.current
    if (!base) return
    const rect = base.getBoundingClientRect()
    let dx = clientX - (rect.left + rect.width / 2)
    let dy = clientY - (rect.top + rect.height / 2)
    const dist = Math.hypot(dx, dy)
    if (dist > MAX_RADIUS) {
      dx = (dx / dist) * MAX_RADIUS
      dy = (dy / dist) * MAX_RADIUS
    }
    setKnob({ x: dx, y: dy })
    touchMoveState.x = dx / MAX_RADIUS
    touchMoveState.z = dy / MAX_RADIUS
  }

  const reset = () => {
    pointerIdRef.current = null
    setKnob({ x: 0, y: 0 })
    touchMoveState.x = 0
    touchMoveState.z = 0
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    pointerIdRef.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    updateFromPoint(e.clientX, e.clientY)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return
    updateFromPoint(e.clientX, e.clientY)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return
    reset()
  }

  if (phase !== 'exploring') return null

  return (
    <div
      ref={baseRef}
      className="touch-joystick-base"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="touch-joystick-knob"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  )
}
