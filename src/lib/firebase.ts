import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithCredential, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth'
import { getFirestore, doc, getDoc } from 'firebase/firestore'
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

// Sign in with Google via browser
export async function signInWithGoogle(): Promise<User | null> {
  try {
    // Use browser OAuth flow
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

    // Check if user is PRO
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
    const userData = userDoc.data()

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      isPro: userData?.isPro || false,
      proActivatedBy: userData?.proActivatedBy,
      proActivatedAt: userData?.proActivatedAt,
      trialExpiresAt: userData?.trialExpiresAt,
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

// Check if user has valid PRO access
export function checkProAccess(user: User): { hasAccess: boolean; reason: string } {
  if (!user.isPro) {
    return { hasAccess: false, reason: 'Você não tem acesso PRO ativo.' }
  }

  // Check if trial expired
  if (user.proActivatedBy === 'trial' && user.trialExpiresAt) {
    const expiresAt = new Date(user.trialExpiresAt)
    if (expiresAt < new Date()) {
      return { hasAccess: false, reason: 'Seu período de teste expirou.' }
    }
  }

  return { hasAccess: true, reason: '' }
}

// Subscribe to auth state changes
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
      const userData = userDoc.data()

      callback({
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        isPro: userData?.isPro || false,
        proActivatedBy: userData?.proActivatedBy,
        proActivatedAt: userData?.proActivatedAt,
        trialExpiresAt: userData?.trialExpiresAt,
      })
    } else {
      callback(null)
    }
  })
}
