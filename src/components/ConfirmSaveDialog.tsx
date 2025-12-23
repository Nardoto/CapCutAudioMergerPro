import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X, ChevronDown, ChevronUp, Check, FileText } from 'lucide-react'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

interface ConfirmSaveDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  summary: string
  details?: string[]
  itemCount?: number
  duration?: string
}

export default function ConfirmSaveDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  summary,
  details,
  itemCount,
  duration
}: ConfirmSaveDialogProps) {
  const [isCapCutRunning, setIsCapCutRunning] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const [confirmCapCut, setConfirmCapCut] = useState(false)

  // Check if CapCut is running when dialog opens
  useEffect(() => {
    if (isOpen && ipcRenderer) {
      setIsChecking(true)
      setConfirmCapCut(false)
      ipcRenderer.invoke('check-capcut-running').then((result: { isRunning: boolean }) => {
        setIsCapCutRunning(result.isRunning)
        setIsChecking(false)
      }).catch(() => {
        setIsCapCutRunning(false)
        setIsChecking(false)
      })
    }
  }, [isOpen])

  const canConfirm = !isChecking && (!isCapCutRunning || confirmCapCut)

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md mx-4 bg-background-dark rounded-xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-background-dark-alt/50">
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <button
              onClick={onCancel}
              className="p-1 rounded hover:bg-white/10 text-text-muted hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Summary */}
            <div className="p-3 rounded-lg bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-white font-medium">{summary}</p>
                  {(itemCount || duration) && (
                    <p className="text-xs text-text-muted">
                      {itemCount && `${itemCount} itens`}
                      {itemCount && duration && ' • '}
                      {duration && `Duração: ${duration}`}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Details (expandable) */}
            {details && details.length > 0 && (
              <div>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center gap-2 text-xs text-text-muted hover:text-white transition-colors"
                >
                  {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showDetails ? 'Ocultar detalhes' : 'Ver detalhes'}
                </button>

                <AnimatePresence>
                  {showDetails && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 p-2 rounded bg-white/5 max-h-40 overflow-y-auto">
                        {details.map((detail, i) => (
                          <div key={i} className="text-xs text-text-muted py-1 border-b border-white/5 last:border-0">
                            <span className="text-white/50 mr-2">{i + 1}.</span>
                            {detail.length > 80 ? detail.substring(0, 80) + '...' : detail}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* CapCut Warning */}
            {isChecking ? (
              <div className="p-3 rounded-lg bg-blue-500/10 flex items-center gap-3">
                <span className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                <span className="text-sm text-blue-400">Verificando CapCut...</span>
              </div>
            ) : isCapCutRunning ? (
              <div className="p-3 rounded-lg bg-red-500/10 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-400 font-medium">CapCut está aberto!</p>
                    <p className="text-xs text-red-400/70 mt-1">
                      Feche o CapCut antes de salvar para evitar perda de dados.
                      As alterações feitas no CapCut podem ser sobrescritas.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmCapCut}
                    onChange={(e) => setConfirmCapCut(e.target.checked)}
                    className="w-4 h-4 rounded accent-red-500"
                  />
                  <span className="text-xs text-red-400">
                    Entendo o risco e quero continuar mesmo assim
                  </span>
                </label>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-green-500/10 flex items-center gap-3">
                <Check className="w-5 h-5 text-green-400" />
                <span className="text-sm text-green-400">CapCut fechado - seguro para salvar</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-4 bg-background-dark-alt/30">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-text-muted hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={!canConfirm}
              className={`
                px-4 py-2 text-sm font-medium rounded-lg transition-all
                ${canConfirm
                  ? 'bg-primary hover:bg-primary/80 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              Confirmar e Salvar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
