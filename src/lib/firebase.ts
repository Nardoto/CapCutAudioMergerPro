import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithCredential, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth'
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore'
import type { User } from '../types'

// Firebase config - mesmo projeto do admin de licenças
const firebaseConfig = {
  apiKey: "AIzaSyBQPGu8l-JQqjHRubcAcYeUK7aIgH7vPIE",
  authDomain: "tradutor-profissional-ai.firebaseapp.com",
  projectId: "tradutor-profissional-ai",
  storageBucket: "tradutor-profissional-ai.firebasestorage.app",
  messagingSenderId: "943297790089",
  appId: "1:943297790089:web:75c2fa533bbe1310d2c658"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Electron IPC
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

// Trial duration in days (mesmo que CapCut-Automator)
const TRIAL_DAYS = 10

// Planos que tem acesso (compatível com CapCut-Automator)
const ALLOWED_PLANS = ['basic', 'vip']

/**
 * Extrai timestamp de diferentes formatos do Firestore
 */
function extractTimestamp(value: unknown): number | null {
  if (!value) return null

  // String ISO date
  if (typeof value === 'string') {
    const ts = new Date(value).getTime()
    return isNaN(ts) ? null : ts
  }

  // Number (already timestamp in ms)
  if (typeof value === 'number') {
    return value
  }

  // Firestore Timestamp object
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>

    // Format: { seconds: number } or { _seconds: number }
    if ('seconds' in obj && typeof obj.seconds === 'number') {
      return obj.seconds * 1000
    }
    if ('_seconds' in obj && typeof obj._seconds === 'number') {
      return obj._seconds * 1000
    }

    // Firestore Timestamp with toDate method
    if ('toDate' in obj && typeof obj.toDate === 'function') {
      try {
        return (obj.toDate as () => Date)().getTime()
      } catch {
        return null
      }
    }
  }

  return null
}

/**
 * Calcula status do trial baseado no createdAt (mesmo método do CapCut-Automator)
 */
function calculateTrialStatus(createdAt: unknown): { isActive: boolean; daysRemaining: number } {
  const createdTimestamp = extractTimestamp(createdAt)

  console.log('[TRIAL DEBUG] createdAt raw:', createdAt)
  console.log('[TRIAL DEBUG] createdTimestamp:', createdTimestamp)

  if (!createdTimestamp) {
    console.log('[TRIAL DEBUG] No valid timestamp - trial inactive')
    return { isActive: false, daysRemaining: 0 }
  }

  const now = Date.now()
  const trialDurationMs = TRIAL_DAYS * 24 * 60 * 60 * 1000
  const trialExpiresAt = createdTimestamp + trialDurationMs
  const timeRemaining = trialExpiresAt - now
  const daysRemaining = Math.ceil(timeRemaining / (24 * 60 * 60 * 1000))

  console.log('[TRIAL DEBUG] now:', now, 'expiresAt:', trialExpiresAt)
  console.log('[TRIAL DEBUG] timeRemaining:', timeRemaining, 'daysRemaining:', daysRemaining)
  console.log('[TRIAL DEBUG] isActive:', timeRemaining > 0)

  return {
    isActive: timeRemaining > 0,
    daysRemaining: Math.max(0, daysRemaining)
  }
}

// Sign in with Google via browser
export async function signInWithGoogle(): Promise<User | null> {
  try {
    if (!ipcRenderer) {
      throw new Error('Not running in Electron')
    }

    console.log('Opening Google login in browser...')
    const result = await ipcRenderer.invoke('google-oauth-browser')
    console.log('OAuth result:', result)

    if (!result.accessToken) {
      throw new Error('No access token received')
    }

    // Create credential and sign in to Firebase
    const credential = GoogleAuthProvider.credential(null, result.accessToken)
    const userCredential = await signInWithCredential(auth, credential)
    const firebaseUser = userCredential.user

    // Check if user exists in Firestore (apenas verificar, não criar)
    const userRef = doc(db, 'users', firebaseUser.uid)
    const userDocSnap = await getDoc(userRef)
    const userData = userDocSnap.data()

    // Se usuário NÃO existe no Firestore, não tem acesso
    if (!userDocSnap.exists()) {
      console.log('Usuário não encontrado no Firestore - sem acesso')
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        isPro: false,
      }
    }

    // Usuário existe - atualizar lastLoginAt
    console.log('[AUTH DEBUG] Usuário encontrado - verificando acesso')
    console.log('[AUTH DEBUG] userData:', JSON.stringify(userData, null, 2))
    try {
      await updateDoc(userRef, {
        lastLoginAt: new Date().toISOString()
      })
    } catch (e) {
      console.warn('Erro ao atualizar lastLoginAt:', e)
    }

    // Calcular acesso baseado nos dados do Firestore
    const plan = userData?.plan || 'free'
    const features = userData?.features || []
    // Usar proActivatedAt para calcular trial (não createdAt)
    const proActivatedAt = userData?.proActivatedAt
    const trialExpiresAt = userData?.trialExpiresAt

    console.log('[AUTH DEBUG] plan:', plan)
    console.log('[AUTH DEBUG] features:', features)
    console.log('[AUTH DEBUG] proActivatedAt:', proActivatedAt)
    console.log('[AUTH DEBUG] trialExpiresAt:', trialExpiresAt)

    // Verificar se tem acesso
    const hasPaidPlan = ALLOWED_PLANS.includes(plan) // basic ou vip
    const hasFeature = features.includes('capcut-sync-pro') || features.includes('all-features')

    // Para trial, calcular baseado em proActivatedAt OU verificar trialExpiresAt diretamente
    let trialStatus = { isActive: false, daysRemaining: 0 }
    if (plan === 'trial') {
      // Se tem trialExpiresAt, usar diretamente
      if (trialExpiresAt) {
        const expiresTimestamp = new Date(trialExpiresAt).getTime()
        const now = Date.now()
        const timeRemaining = expiresTimestamp - now
        trialStatus = {
          isActive: timeRemaining > 0,
          daysRemaining: Math.max(0, Math.ceil(timeRemaining / (24 * 60 * 60 * 1000)))
        }
        console.log('[AUTH DEBUG] Trial calculado via trialExpiresAt:', trialStatus)
      } else if (proActivatedAt) {
        // Fallback: calcular baseado em proActivatedAt
        trialStatus = calculateTrialStatus(proActivatedAt)
        console.log('[AUTH DEBUG] Trial calculado via proActivatedAt:', trialStatus)
      }
    }

    console.log('[AUTH DEBUG] hasPaidPlan:', hasPaidPlan)
    console.log('[AUTH DEBUG] hasFeature:', hasFeature)
    console.log('[AUTH DEBUG] trialStatus:', trialStatus)

    // Determinar acesso - IMPORTANTE: trial expirado NÃO dá acesso!
    let hasAccess = false
    let proActivatedBy = ''

    if (hasPaidPlan || hasFeature) {
      // Plano pago (basic/vip) ou feature específica
      hasAccess = true
      proActivatedBy = plan // 'basic' ou 'vip'
      console.log('[AUTH DEBUG] Acesso concedido via plano pago:', plan)
    } else if (plan === 'trial' && trialStatus.isActive) {
      // Trial ATIVO
      hasAccess = true
      proActivatedBy = 'trial'
      console.log('[AUTH DEBUG] Acesso concedido via TRIAL ativo')
    } else if (plan === 'trial' && !trialStatus.isActive) {
      // Trial EXPIRADO - SEM ACESSO
      hasAccess = false
      proActivatedBy = 'trial_expired'
      console.log('[AUTH DEBUG] SEM ACESSO - trial expirado!')
    } else {
      console.log('[AUTH DEBUG] SEM ACESSO - sem plano válido')
    }

    console.log('[AUTH DEBUG] RESULTADO FINAL: hasAccess=', hasAccess, 'proActivatedBy=', proActivatedBy)

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      isPro: hasAccess,
      plan: plan,
      proActivatedBy: proActivatedBy,
      proActivatedAt: proActivatedAt,
      trialExpiresAt: trialExpiresAt,
      trialDaysRemaining: trialStatus.daysRemaining,
    }
  } catch (error) {
    console.error('Error signing in with Google:', error)
    return null
  }
}

// Sign out
export async function logOut(): Promise<void> {
  await signOut(auth)
}

// Check if user has valid access
export function checkProAccess(user: User): { hasAccess: boolean; reason: string; daysRemaining?: number } {
  // Se é trial, SEMPRE verificar se expirou (recalcular baseado no proActivatedAt/createdAt)
  if (user.proActivatedBy === 'trial') {
    // Calcular expiração baseado na data de criação
    const createdAt = user.proActivatedAt
    if (createdAt) {
      const trialStatus = calculateTrialStatusFromDate(createdAt)
      if (!trialStatus.isActive) {
        return { hasAccess: false, reason: 'Seu período de teste expirou. Faça upgrade para o plano VIP!' }
      }
      return { hasAccess: true, reason: `Trial: ${trialStatus.daysRemaining} dias restantes`, daysRemaining: trialStatus.daysRemaining }
    }
    // Se não tem data de criação, trial inválido
    return { hasAccess: false, reason: 'Período de teste inválido. Faça upgrade para o plano VIP!' }
  }

  // Se isPro é true e não é trial, tem acesso VIP
  if (user.isPro) {
    return { hasAccess: true, reason: 'Acesso VIP ativo' }
  }

  return { hasAccess: false, reason: 'Você não tem acesso. Faça upgrade para o plano VIP!' }
}

// Helper function to calculate trial status from a date (used by checkProAccess)
function calculateTrialStatusFromDate(createdAt: unknown): { isActive: boolean; daysRemaining: number } {
  // Usa a mesma função de extração para garantir consistência
  return calculateTrialStatus(createdAt)
}

// Subscribe to auth state changes
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      console.log('[AUTH CHANGE] Verificando usuário:', firebaseUser.email)
      const userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid))
      const userData = userDocSnap.data()

      if (!userData) {
        console.log('[AUTH CHANGE] Sem dados no Firestore - sem acesso')
        callback({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          isPro: false,
        })
        return
      }

      // Calcular acesso baseado nos dados do Firestore
      const plan = userData.plan || 'free'
      const features = userData.features || []
      const proActivatedAt = userData.proActivatedAt
      const trialExpiresAt = userData.trialExpiresAt

      console.log('[AUTH CHANGE] userData:', { plan, features, proActivatedAt, trialExpiresAt })

      const hasPaidPlan = ALLOWED_PLANS.includes(plan) // basic ou vip
      const hasFeature = features.includes('capcut-sync-pro') || features.includes('all-features')

      // Para trial, calcular baseado em trialExpiresAt ou proActivatedAt
      let trialStatus = { isActive: false, daysRemaining: 0 }
      if (plan === 'trial') {
        if (trialExpiresAt) {
          const expiresTimestamp = new Date(trialExpiresAt).getTime()
          const now = Date.now()
          const timeRemaining = expiresTimestamp - now
          trialStatus = {
            isActive: timeRemaining > 0,
            daysRemaining: Math.max(0, Math.ceil(timeRemaining / (24 * 60 * 60 * 1000)))
          }
          console.log('[AUTH CHANGE] Trial via trialExpiresAt:', trialStatus)
        } else if (proActivatedAt) {
          trialStatus = calculateTrialStatus(proActivatedAt)
          console.log('[AUTH CHANGE] Trial via proActivatedAt:', trialStatus)
        }
      }

      console.log('[AUTH CHANGE] Checks:', { hasPaidPlan, hasFeature, trialStatus })

      // Determinar acesso - IMPORTANTE: trial expirado NÃO dá acesso!
      let hasAccess = false
      let proActivatedBy = ''

      if (hasPaidPlan || hasFeature) {
        hasAccess = true
        proActivatedBy = plan // 'basic' ou 'vip'
        console.log('[AUTH CHANGE] Acesso via plano pago:', plan)
      } else if (plan === 'trial' && trialStatus.isActive) {
        hasAccess = true
        proActivatedBy = 'trial'
        console.log('[AUTH CHANGE] Acesso via TRIAL ativo')
      } else if (plan === 'trial' && !trialStatus.isActive) {
        hasAccess = false
        proActivatedBy = 'trial_expired'
        console.log('[AUTH CHANGE] SEM ACESSO - trial expirado!')
      } else {
        console.log('[AUTH CHANGE] SEM ACESSO - sem plano válido')
      }

      console.log('[AUTH CHANGE] RESULTADO:', { hasAccess, proActivatedBy })

      callback({
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        isPro: hasAccess,
        plan: plan,
        proActivatedBy: proActivatedBy,
        proActivatedAt: proActivatedAt,
        trialExpiresAt: trialExpiresAt,
        trialDaysRemaining: trialStatus.daysRemaining,
      })
    } else {
      console.log('[AUTH CHANGE] Usuário deslogado')
      callback(null)
    }
  })
}
