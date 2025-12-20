import { useState, useEffect, useCallback } from 'react'
import { signInWithGoogle, logOut, onAuthChange, checkProAccess } from '../lib/firebase'
import type { User } from '../types'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  hasProAccess: boolean
  proAccessReason: string
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    hasProAccess: false,
    proAccessReason: '',
  })

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      if (user) {
        const { hasAccess, reason } = checkProAccess(user)
        setState({
          user,
          isLoading: false,
          isAuthenticated: true,
          hasProAccess: hasAccess,
          proAccessReason: reason,
        })
      } else {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          hasProAccess: false,
          proAccessReason: '',
        })
      }
    })

    return () => unsubscribe()
  }, [])

  const login = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }))
    try {
      const user = await signInWithGoogle()
      if (user) {
        const { hasAccess, reason } = checkProAccess(user)
        setState({
          user,
          isLoading: false,
          isAuthenticated: true,
          hasProAccess: hasAccess,
          proAccessReason: reason,
        })
      } else {
        setState((prev) => ({ ...prev, isLoading: false }))
      }
    } catch (error) {
      console.error('Login error:', error)
      setState((prev) => ({ ...prev, isLoading: false }))
    }
  }, [])

  const logout = useCallback(async () => {
    await logOut()
    setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      hasProAccess: false,
      proAccessReason: '',
    })
  }, [])

  return {
    ...state,
    login,
    logout,
  }
}
