import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'
import type { User } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!user.value)

  async function login(email: string, password: string) {
    loading.value = true
    error.value = null

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authError) throw authError

      user.value = data.user
      localStorage.setItem('sb-token', data.session?.access_token ?? '')

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      error.value = message
      return { success: false, error: message }
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    user.value = null
    localStorage.removeItem('sb-token')
  }

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      user.value = session.user
      localStorage.setItem('sb-token', session.access_token)
    } else {
      localStorage.removeItem('sb-token')
    }
  }

  return {
    user,
    loading,
    error,
    isAuthenticated,
    login,
    logout,
    checkAuth
  }
})
