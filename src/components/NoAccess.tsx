import { motion } from 'framer-motion'
import { LogOut, AlertCircle, UserPlus, ExternalLink, MessageCircle } from 'lucide-react'
import type { User } from '../types'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

interface NoAccessProps {
  user: User
  reason: string
  onLogout: () => void
}

export default function NoAccess({ user, reason, onLogout }: NoAccessProps) {
  // Verificar se é usuário novo (sem dados no Firestore)
  const isNewUser = !user.proActivatedBy && !user.proActivatedAt

  const handleRegister = () => {
    // Direcionar para o site de registro
    ipcRenderer?.invoke('open-external', 'https://nardoto-labs.web.app/dashboard.html')
  }

  const handleWhatsApp = () => {
    const phone = '5527999132594'
    const message = encodeURIComponent('Olá! Gostaria de adquirir acesso ao CapCut Sync Pro.')
    ipcRenderer?.invoke('open-external', `https://wa.me/${phone}?text=${message}`)
  }

  return (
    <div className="h-screen w-screen bg-background-dark flex items-center justify-center overflow-hidden relative">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />

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
          className="w-20 h-20 mx-auto mb-6 rounded-full bg-background-elevated border border-primary/30 flex items-center justify-center"
        >
          {isNewUser ? (
            <UserPlus className="w-10 h-10 text-primary" />
          ) : (
            <AlertCircle className="w-10 h-10 text-primary" />
          )}
        </motion.div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-3">
          {isNewUser ? 'Bem-vindo!' : 'Acesso Restrito'}
        </h1>

        <p className="text-text-secondary mb-6">
          {isNewUser
            ? 'Para usar o CapCut Sync Pro, você precisa se registrar no Nardoto Labs.'
            : reason || 'Você não tem acesso ao CapCut Sync Pro.'}
        </p>

        {/* User info */}
        <div className="card p-4 mb-6">
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
              Status: <span className="text-red-400 font-medium">
                {isNewUser ? 'Não registrado' : 'Sem acesso VIP'}
              </span>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {isNewUser ? (
            <button
              onClick={handleRegister}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-5 h-5" />
              Criar Conta no Nardoto Labs
            </button>
          ) : (
            <button
              onClick={handleWhatsApp}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300"
            >
              <MessageCircle className="w-5 h-5" />
              Falar no WhatsApp
            </button>
          )}

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
          {isNewUser ? (
            <>
              Após criar sua conta, faça login novamente aqui.
              <br />
              Novos usuários ganham 10 dias de teste grátis!
            </>
          ) : (
            <>
              Entre em contato para adquirir seu acesso
              <br />
              ou renovar seu período de teste.
            </>
          )}
        </p>

        {/* Credits */}
        <p className="text-text-muted text-[10px] mt-8">
          Desenvolvido por{' '}
          <button
            onClick={() => ipcRenderer?.invoke('open-external', 'https://nardoto.com.br')}
            className="text-primary hover:underline"
          >
            Nardoto
          </button>
        </p>
      </motion.div>
    </div>
  )
}
