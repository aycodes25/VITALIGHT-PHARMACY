import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabaseClient } from '../lib/supabaseClient.js'

const AuthContext = createContext(null)

const signedOut = {
  configured: false,
  loading: false,
  session: null,
  user: null,
  recovering: false,
  signIn: async () => { throw new Error('Accounts are not available right now.') },
  signUp: async () => { throw new Error('Accounts are not available right now.') },
  signOut: async () => {},
  sendPasswordReset: async () => { throw new Error('Accounts are not available right now.') },
  updatePassword: async () => { throw new Error('Accounts are not available right now.') },
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(Boolean(supabaseClient))
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    if (!supabaseClient) return undefined
    let active = true
    supabaseClient.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabaseClient.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') setRecovering(false)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => {
    if (!supabaseClient) return signedOut
    const auth = supabaseClient.auth
    return {
      configured: true,
      loading,
      session,
      user: session?.user ?? null,
      recovering,
      async signIn(email, password) {
        const { error } = await auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      // Resolves { needsConfirmation } so the page can tell the customer to check their inbox.
      async signUp({ email, password, name }) {
        const { data, error } = await auth.signUp({
          email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/account` },
        })
        if (error) throw error
        return { needsConfirmation: !data.session }
      },
      async signOut() {
        await auth.signOut()
      },
      async sendPasswordReset(email) {
        const { error } = await auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
        if (error) throw error
      },
      async updatePassword(password) {
        const { error } = await auth.updateUser({ password })
        if (error) throw error
        setRecovering(false)
      },
    }
  }, [session, loading, recovering])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Works without a provider (guest-only) so components and tests render standalone.
export function useAuth() {
  return useContext(AuthContext) ?? signedOut
}
