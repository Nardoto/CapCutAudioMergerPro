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
 * Calcula status do trial baseado no createdAt (mesmo método do CapCut-Automator)
 */
function calculateTrialStatus(createdAt: string | { _seconds: number } | number | null): { isActive: boolean; daysRemaining: number } {
  if (!createdAt) {
    return { isActive: false, daysRemaining: 0 }
  }

  let createdTimestamp: number
  if (typeof createdAt === 'string') {
    createdTimestamp = new Date(createdAt).getTime()
  } else if (typeof createdAt === 'object' && '_seconds' in createdAt) {
    createdTimestamp = createdAt._seconds * 1000
  } else {
    createdTimestamp = createdAt as number
  }

  const now = Date.now()
  const trialDurationMs = TRIAL_DAYS * 24 * 60 * 60 * 1000
  const trialExpiresAt = createdTimestamp + trialDurationMs
  const timeRemaining = trialExpiresAt - now
  const daysRemaining = Math.ceil(timeRemaining / (24 * 60 * 60 * 1000))

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
    console.log('Usuário encontrado - verificando acesso')
    try {
      await updateDoc(userRef, {
        lastLoginAt: new Date().toISOString()
      })
    } catch (e) {
      console.warn('Erro ao atualizar lastLoginAt:', e)
    }

    // Calcular acesso baseado nos dados do Firestore
    const plan = userData?.plan || 'free'
    const isPro = userData?.isPro || false
    const features = userData?.features || []
    const createdAt = userData?.createdAt

    // Verificar se tem acesso: plano pago OU isPro OU feature específica OU trial ativo
    const hasPaidPlan = ALLOWED_PLANS.includes(plan)
    const hasFeature = features.includes('capcut-sync-pro') || features.includes('all-features')
    const trialStatus = calculateTrialStatus(createdAt)

    // Determinar acesso
    let hasAccess = false
    let proActivatedBy = ''

    if (hasPaidPlan || isPro || hasFeature) {
      hasAccess = true
      proActivatedBy = 'pro'
    } else if (trialStatus.isActive) {
      hasAccess = true
      proActivatedBy = 'trial'
    }

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      isPro: hasAccess,
      proActivatedBy: proActivatedBy,
      proActivatedAt: createdAt,
      trialExpiresAt: trialStatus.isActive
        ? new Date(new Date(createdAt).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
        : undefined,
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

// Check if user has valid PRO access (compatível com CapCut-Automator)
export function checkProAccess(user: User): { hasAccess: boolean; reason: string; daysRemaining?: number } {
  // Se isPro é true (calculado no login), tem acesso
  if (user.isPro) {
    if (user.proActivatedBy === 'trial' && user.trialExpiresAt) {
      const expiresAt = new Date(user.trialExpiresAt)
      const now = new Date()
      if (expiresAt < now) {
        return { hasAccess: false, reason: 'Seu período de teste de 10 dias expirou. Faça upgrade para BÁSICO ou VIP!' }
      }
      const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      return { hasAccess: true, reason: `Trial: ${daysRemaining} dias restantes`, daysRemaining }
    }
    return { hasAccess: true, reason: 'Acesso PRO ativo' }
  }

  return { hasAccess: false, reason: 'Você não tem acesso. Faça upgrade para BÁSICO ou VIP!' }
}

// Subscribe to auth state changes
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      const userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid))
      const userData = userDocSnap.data()

      if (!userData) {
        // Usuário autenticado mas sem dados no Firestore
        callback({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          isPro: false,
        })
        return
      }

      // Calcular acesso
      const plan = userData.plan || 'free'
      const isPro = userData.isPro || false
      const features = userData.features || []
      const createdAt = userData.createdAt

      const hasPaidPlan = ALLOWED_PLANS.includes(plan)
      const hasFeature = features.includes('capcut-sync-pro') || features.includes('all-features')
      const trialStatus = calculateTrialStatus(createdAt)

      let hasAccess = false
      let proActivatedBy = ''

      if (hasPaidPlan || isPro || hasFeature) {
        hasAccess = true
        proActivatedBy = 'pro'
      } else if (trialStatus.isActive) {
        hasAccess = true
        proActivatedBy = 'trial'
      }

      callback({
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        isPro: hasAccess,
        proActivatedBy: proActivatedBy,
        proActivatedAt: createdAt,
        trialExpiresAt: trialStatus.isActive && createdAt
          ? new Date(new Date(createdAt).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
          : undefined,
      })
    } else {
      callback(null)
    }
  })
}
