import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type AuthState = {
  session: Session | null
  loading: boolean
  error: string | null
  notice: string | null
  signIn: (identifier: string, password: string) => Promise<void>
  signUp: (email: string, password: string, nickname: string, phone: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  loading: true,
  error: null,
  notice: null,

  signIn: async (identifier, password) => {
    set({ error: null, notice: null, loading: true })

    let email = identifier
    if (!EMAIL_RE.test(identifier)) {
      const { data, error: rpcError } = await supabase.rpc('resolve_login_email', {
        identifier,
      })
      if (rpcError || !data) {
        set({ loading: false, error: 'ไม่พบบัญชีผู้ใช้นี้' })
        return
      }
      email = data
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    set({ loading: false, error: error?.message ?? null })
  },

  signUp: async (email, password, nickname, phone) => {
    set({ error: null, notice: null, loading: true })

    const { data: taken, error: takenError } = await supabase.rpc('is_identifier_taken', {
      p_nickname: nickname,
      p_phone: phone,
    })
    if (takenError) {
      set({ loading: false, error: takenError.message })
      return
    }
    const takenRow = taken?.[0]
    if (takenRow?.nickname_taken) {
      set({ loading: false, error: 'ชื่อเล่นนี้ถูกใช้แล้ว' })
      return
    }
    if (takenRow?.phone_taken) {
      set({ loading: false, error: 'เบอร์โทรนี้ถูกใช้แล้ว' })
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nickname, phone } },
    })
    if (error) {
      set({ loading: false, error: error.message })
      return
    }
    set({
      loading: false,
      notice: data.session ? null : 'สมัครสำเร็จ กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ',
    })
  },

  signOut: async () => {
    await supabase.auth.signOut()
  },

  resetPassword: async (email) => {
    set({ error: null, notice: null, loading: true })
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    set({
      loading: false,
      error: error?.message ?? null,
      notice: error ? null : 'ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว',
    })
  },
}))

supabase.auth.getSession().then(({ data }) => {
  useAuthStore.setState({ session: data.session, loading: false })
})

supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.setState({ session })
})
