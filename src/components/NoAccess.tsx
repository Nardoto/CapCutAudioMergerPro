import { motion } from 'framer-motion'
import { LogOut, ShoppingCart, AlertCircle } from 'lucide-react'
import type { User } from '../types'

interface NoAccessProps {
  user: User
  reason: string
  onLogout: () => void
}

export default function NoAccess({ user, reason, onLogout }: NoAccessProps) {
  const handleBuyAccess = () => {
    // TODO: Open purchase page
    window.open('https://nardoto.com/capcut-sync-pro', '_blank')
  }

  return (
    <div className="h-screen w-screen bg-hero-gradient flex items-center justify-center overflow-hidden relative">
      {/* Background glow effect */}
      <div className="absolute inset-0 bg-warm-glow pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 text-center max-w-md px-6"
      >
        {/* Warning icon */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
          className="w-20 h-20 mx-auto mb-6 rounded-full bg-card-dark border border-primary/30 flex items-center justify-center"
        >
          <AlertCircle className="w-10 h-10 text-primary" />
        </motion.div>

        {/* Title */}
        <h1 className="text-3xl font-heading text-white mb-3">
          Acesso Restrito
        </h1>

        <p className="text-text-secondary mb-6">
          {reason || 'Você não tem acesso ao CapCut Sync Pro.'}
        </p>

        {/* User info */}
        <div className="card mb-6">
          <div className="flex items-center gap-3 mb-4">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-12 h-12 rounded-full"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xl">👤</span>
              </div>
            )}
            <div className="text-left">
              <p className="text-white font-medium">{user.displayName || 'Usuário'}</p>
              <p className="text-text-secondary text-sm">{user.email}</p>
            </div>
          </div>

          <div className="border-t border-border-light pt-4">
            <p className="text-text-muted text-sm">
              Status: <span className="text-red-400 font-medium">Sem acesso PRO</span>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleBuyAccess}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <ShoppingCart className="w-5 h-5" />
            Adquirir Acesso PRO
          </button>

          <button
            onClick={onLogout}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Sair da Conta
          </button>
        </div>

        {/* Help text */}
        <p className="text-text-muted text-xs mt-6">
          Já comprou? Aguarde alguns minutos para a ativação.
          <br />
          Problemas? Entre em contato pelo WhatsApp.
        </p>
      </motion.div>
    </div>
  )
}
