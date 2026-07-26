import { useAuthStore } from '../auth/authStore'

export function LogoutButton() {
  const signOut = useAuthStore((s) => s.signOut)

  return (
    <button className="logout-btn" onClick={() => signOut()}>
      🚪 ออกจากระบบ
    </button>
  )
}
