import { useAuth } from './hooks/useAuth'
import Login from './components/Login'
import NoAccess from './components/NoAccess'
import MainLayout from './components/MainLayout'
import LoadingScreen from './components/LoadingScreen'

export default function App() {
  const { user, isLoading, isAuthenticated, hasProAccess, proAccessReason, login, logout } = useAuth()

  // Loading state
  if (isLoading) {
    return <LoadingScreen />
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return <Login onLogin={login} />
  }

  // Authenticated but no PRO access
  if (!hasProAccess) {
    return <NoAccess user={user!} reason={proAccessReason} onLogout={logout} />
  }

  // Authenticated with PRO access - show main app
  return <MainLayout user={user!} onLogout={logout} />
}
