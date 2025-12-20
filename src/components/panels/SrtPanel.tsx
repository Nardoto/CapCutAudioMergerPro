import { useState } from 'react'
import { FileText, FolderOpen, Upload, BookOpen } from 'lucide-react'
import type { LogEntry } from '../../types'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

interface SrtPanelProps {
  onLog: (type: LogEntry['type'], message: string) => void
  draftPath: string | null
  onReanalyze?: () => void
}

export default function SrtPanel({ onLog, draftPath, onReanalyze }: SrtPanelProps) {
  const [srtFolder, setSrtFolder] = useState<string | null>(null)
  const [createTitle, setCreateTitle] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSelectFolder = async () => {
    if (!ipcRenderer) {
      onLog('error', 'Electron IPC não disponível')
      return
    }

    onLog('info', 'Selecionando pasta de legendas...')

    try {
      const result = await ipcRenderer.invoke('select-srt-folder')
      if (!result) {
        onLog('warning', 'Seleção cancelada')
        return
      }
      if (result.error) {
        onLog('error', result.error)
        return
      }
      setSrtFolder(result.path)
      onLog('success', 'Pasta selecionada: ' + result.name + ' (' + result.srtCount + ' arquivos .srt)')
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }
  }

  const handleInsertSubtitles = async () => {
    if (!srtFolder) {
      onLog('warning', 'Selecione a pasta com os arquivos .srt primeiro!')
      return
    }

    if (!draftPath) {
      onLog('warning', 'Selecione e analise um projeto primeiro!')
      return
    }

    if (!ipcRenderer) {
      onLog('error', 'Electron IPC não disponível')
      return
    }

    setIsProcessing(true)
    onLog('info', 'Inserindo legendas na timeline...')

    try {
      const result = await ipcRenderer.invoke('insert-srt', {
        draftPath,
        srtFolder,
        createTitle,
      })

      if (result.error) {
        onLog('error', result.error)
      } else {
        result.logs?.forEach((log: string) => onLog('info', log))
        onLog('success', `Legendas inseridas! ${result.stats.inserted} arquivos processados`)
        onReanalyze?.()
      }
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }

    setIsProcessing(false)
  }

  const hasProject = !!draftPath

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#9c493730' }}>
          <FileText className="w-5 h-5" style={{ color: '#9c4937' }} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Legendas SRT</h2>
          <p className="text-sm text-text-secondary">Insere arquivos .srt na timeline</p>
        </div>
      </div>

      {/* Warning if no project */}
      {!hasProject && (
        <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-400">
          Selecione e analise um projeto primeiro na aba SYNC
        </div>
      )}

      {/* Description */}
      <div className="p-4 rounded-xl bg-white/5 border border-border-light">
        <p className="text-sm text-text-secondary">
          Selecione uma pasta contendo arquivos <code style={{ color: '#9c4937' }}>.srt</code> com o mesmo nome dos áudios.
          As legendas serão inseridas automaticamente na timeline do CapCut.
        </p>
      </div>

      {/* Folder Selection */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <FolderOpen className="w-4 h-4" />
          PASTA DAS LEGENDAS
        </label>

        <div className="flex gap-3">
          <input
            type="text"
            value={srtFolder || ''}
            readOnly
            placeholder="Selecione a pasta com arquivos .srt"
            className="input flex-1"
          />
          <button
            onClick={handleSelectFolder}
            className="btn-secondary px-4"
            title="Selecionar pasta"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Options */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-text-secondary">OPÇÕES</label>
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={createTitle}
            onChange={(e) => setCreateTitle(e.target.checked)}
            className="w-4 h-4 rounded border-border-light bg-white/5 focus:ring-offset-0"
            style={{ accentColor: '#9c4937' }}
          />
          <BookOpen className="w-4 h-4 text-text-muted transition-colors" style={{ '--hover-color': '#9c4937' } as React.CSSProperties} />
          <span className="text-sm text-text-primary">Criar texto de título</span>
        </label>
      </div>

      {/* Instructions */}
      <div className="space-y-2">
        <span className="text-sm font-medium text-text-secondary">COMO FUNCIONA</span>
        <div className="space-y-2 text-sm text-text-muted">
          <div className="flex items-start gap-2">
            <span className="text-primary">1.</span>
            <span>Os arquivos .srt devem ter o mesmo nome dos áudios</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary">2.</span>
            <span>Exemplo: "Psalm_01.mp3" → "Psalm_01.srt"</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary">3.</span>
            <span>As legendas serão sincronizadas com os áudios correspondentes</span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={handleInsertSubtitles}
        disabled={!srtFolder || !hasProject || isProcessing}
        className="w-full py-4 px-4 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:brightness-110"
        style={{ backgroundColor: '#9c4937' }}
      >
        {isProcessing ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Inserindo...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            INSERIR LEGENDAS
          </>
        )}
      </button>
    </div>
  )
}
