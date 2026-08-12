import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type AuthState = {
  session: Session | null
  loading: boolean
  error: string | null
  notice: string | null
  // Flipped on by the 'PASSWORD_RECOVERY' auth event fired when the user
  // opens the reset-password link from their email — App.tsx uses this to
  // show the "set a new password" screen instead of the normal flow.
  passwordRecovery: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  loading: true,
  error: null,
  notice: null,
  passwordRecovery: false,

  signIn: async (email, password) => {
    set({ error: null, notice: null, loading: true })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    set({ loading: false, error: error?.message ?? null })
  },

  signUp: async (email, password) => {
    set({ error: null, notice: null, loading: true })
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      set({ loading: false, error: error.message })
      return
    }
    set({
      loading: false,
      notice: data.session ? null : 'สมัครสำเร็จ กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ',
    })
  },

  signInWithGoogle: async () => {
    set({ error: null, notice: null, loading: true })
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        // Without this, Google skips the account-chooser screen and silently
        // signs back in with whichever account the browser already has an
        // active Google session for — forcing it to always prompt.
        queryParams: { prompt: 'select_account' },
      },
    })
    // On success the browser navigates away to Google immediately, so this
    // only ever resolves here when the redirect itself failed to start.
    if (error) set({ loading: false, error: error.message })
  },

  signOut: async () => {
    await supabase.auth.signOut()
  },

  resetPassword: async (email) => {
    set({ error: null, notice: null, loading: true })
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    set({
      loading: false,
      error: error?.message ?? null,
      notice: error ? null : 'ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว',
    })
  },

  updatePassword: async (password) => {
    set({ error: null, notice: null, loading: true })
    const { error } = await supabase.auth.updateUser({ password })
    set({
      loading: false,
      error: error?.message ?? null,
      notice: error ? null : 'เปลี่ยนรหัสผ่านสำเร็จแล้ว',
      passwordRecovery: error ? true : false,
    })
  },
}))

supabase.auth.getSession().then(({ data }) => {
  useAuthStore.setState({ session: data.session, loading: false })
}).catch((err) => {
  useAuthStore.setState({ loading: false, error: err instanceof Error ? err.message : 'เชื่อมต่อระบบยืนยันตัวตนไม่สำเร็จ' })
})

supabase.auth.onAuthStateChange((event, session) => {
  useAuthStore.setState({
    session,
    passwordRecovery: event === 'PASSWORD_RECOVERY' ? true : useAuthStore.getState().passwordRecovery,
  })
})
