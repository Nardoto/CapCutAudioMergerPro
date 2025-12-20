import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, FolderOpen, Upload, BookOpen, Check, X, AlertTriangle, Music, Eye, RefreshCw, Plus } from 'lucide-react'
import type { LogEntry } from '../../types'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

interface SrtMatch {
  srtFile: string
  srtPath: string
  audioName?: string
  baseName: string
  subtitleCount: number
  matched: boolean
  selected?: boolean
}

interface SrtPanelProps {
  onLog: (type: LogEntry['type'], message: string) => void
  draftPath: string | null
  onReanalyze?: () => void
}

export default function SrtPanel({ onLog, draftPath, onReanalyze }: SrtPanelProps) {
  const [srtFolder, setSrtFolder] = useState<string | null>(null)
  const [srtFolders, setSrtFolders] = useState<string[]>([])  // All scanned folders
  const [createTitle, setCreateTitle] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [matches, setMatches] = useState<SrtMatch[]>([])
  const [unmatched, setUnmatched] = useState<SrtMatch[]>([])
  const [scanStats, setScanStats] = useState<{ totalSrt: number; totalAudios: number; matchedCount: number } | null>(null)

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
      setSrtFolders([result.path])  // Reset folders list
      onLog('success', `Pasta selecionada: ${result.name} (${result.srtCount} arquivos .srt)`)

      // Auto-scan if project is loaded
      if (draftPath) {
        await scanMatches(result.path)
      }
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }
  }

  // Add another folder without closing preview (accumulates subtitles)
  const handleAddFolder = async () => {
    if (!ipcRenderer) {
      onLog('error', 'Electron IPC não disponível')
      return
    }

    onLog('info', 'Adicionando pasta de legendas...')

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

      // Add to folders list (avoid duplicates)
      setSrtFolders(prev => {
        if (prev.includes(result.path)) return prev
        return [...prev, result.path]
      })
      onLog('info', `Adicionando: ${result.name} (${result.srtCount} arquivos .srt)`)

      // Scan with append mode
      if (draftPath) {
        await scanMatches(result.path, true)
      }
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }
  }

  const scanMatches = async (folder: string, append: boolean = false) => {
    if (!draftPath || !ipcRenderer) return

    setIsScanning(true)
    onLog('info', append ? 'Adicionando legendas...' : 'Escaneando correspondências...')

    try {
      const result = await ipcRenderer.invoke('scan-srt-matches', { srtFolder: folder, draftPath })
      if (result.error) {
        onLog('error', result.error)
        return
      }

      // Mark all matched as selected by default
      const matchedWithSelection = result.matches.map((m: SrtMatch) => ({ ...m, selected: true }))
      const unmatchedWithSelection = result.unmatched.map((m: SrtMatch) => ({ ...m, selected: false }))

      if (append) {
        // Somar às existentes (evitando duplicatas por srtFile)
        setMatches(prev => {
          const existingFiles = new Set(prev.map(p => p.srtFile))
          const newMatches = matchedWithSelection.filter((m: SrtMatch) => !existingFiles.has(m.srtFile))
          return [...prev, ...newMatches]
        })
        setUnmatched(prev => {
          const existingFiles = new Set(prev.map(p => p.srtFile))
          const newUnmatched = unmatchedWithSelection.filter((m: SrtMatch) => !existingFiles.has(m.srtFile))
          return [...prev, ...newUnmatched]
        })
        setScanStats(prev => prev ? {
          totalSrt: prev.totalSrt + result.totalSrt,
          totalAudios: result.totalAudios,
          matchedCount: prev.matchedCount + result.matchedCount
        } : {
          totalSrt: result.totalSrt,
          totalAudios: result.totalAudios,
          matchedCount: result.matchedCount
        })
        onLog('success', `+${result.matchedCount} legendas adicionadas`)
      } else {
        setMatches(matchedWithSelection)
        setUnmatched(unmatchedWithSelection)
        setScanStats({
          totalSrt: result.totalSrt,
          totalAudios: result.totalAudios,
          matchedCount: result.matchedCount
        })
        onLog('success', `${result.matchedCount}/${result.totalSrt} legendas correspondem aos áudios do projeto`)
      }

      setShowPreview(true)
    } catch (error) {
      onLog('error', 'Erro ao escanear: ' + error)
    } finally {
      setIsScanning(false)
    }
  }

  const toggleSelection = (index: number, isMatched: boolean) => {
    if (isMatched) {
      setMatches(prev => prev.map((m, i) => i === index ? { ...m, selected: !m.selected } : m))
    } else {
      setUnmatched(prev => prev.map((m, i) => i === index ? { ...m, selected: !m.selected } : m))
    }
  }

  const selectAll = (isMatched: boolean) => {
    if (isMatched) {
      setMatches(prev => prev.map(m => ({ ...m, selected: true })))
    } else {
      setUnmatched(prev => prev.map(m => ({ ...m, selected: true })))
    }
  }

  const deselectAll = (isMatched: boolean) => {
    if (isMatched) {
      setMatches(prev => prev.map(m => ({ ...m, selected: false })))
    } else {
      setUnmatched(prev => prev.map(m => ({ ...m, selected: false })))
    }
  }

  const selectedCount = matches.filter(m => m.selected).length + unmatched.filter(m => m.selected).length
  const totalSubtitles = [...matches, ...unmatched].filter(m => m.selected).reduce((sum, m) => sum + m.subtitleCount, 0)

  const handleInsertSubtitles = async () => {
    if (srtFolders.length === 0 || !draftPath || !ipcRenderer) return

    const selectedItems = [...matches, ...unmatched].filter(m => m.selected)
    if (selectedItems.length === 0) {
      onLog('warning', 'Selecione pelo menos uma legenda para inserir!')
      return
    }

    // Extrair os caminhos COMPLETOS dos arquivos selecionados
    const selectedFilePaths = selectedItems.map(m => m.srtPath)

    setIsProcessing(true)
    setShowPreview(false)
    onLog('info', `Inserindo ${selectedItems.length} legendas na timeline...`)

    try {
      const result = await ipcRenderer.invoke('insert-srt', {
        draftPath,
        srtFolders,  // Pass all folders
        createTitle,
        selectedFiles: selectedFilePaths,  // Pass full paths
      })

      if (result.error) {
        onLog('error', result.error)
      } else {
        result.logs?.forEach((log: string) => onLog('info', log))
        onLog('success', `Legendas inseridas! ${result.stats.totalSubtitles} segmentos em ${result.stats.tracksCreated} track(s)`)

        // Desmarcar os arquivos que foram inseridos e atualizar a lista
        setMatches(prev => prev.map(m => selectedItems.some(s => s.srtFile === m.srtFile) ? { ...m, selected: false } : m))
        setUnmatched(prev => prev.map(m => selectedItems.some(s => s.srtFile === m.srtFile) ? { ...m, selected: false } : m))

        onReanalyze?.()
      }
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }

    setIsProcessing(false)
  }

  // Rescan para adicionar mais legendas
  const handleRescan = async () => {
    if (srtFolder && draftPath) {
      await scanMatches(srtFolder)
    }
  }

  const hasProject = !!draftPath

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full">
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

      {/* Folder Selection */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <FolderOpen className="w-4 h-4" />
          PASTA DAS LEGENDAS
        </label>

        <div className="flex gap-2">
          <input
            type="text"
            value={srtFolder || ''}
            readOnly
            placeholder="Selecione a pasta com arquivos .srt"
            className="input flex-1 text-xs"
          />
          <button
            onClick={handleSelectFolder}
            disabled={isScanning}
            className="btn-secondary px-3"
            title="Selecionar pasta"
          >
            {isScanning ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <FolderOpen className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Scan Stats */}
      {scanStats && (
        <div className="p-3 rounded-xl bg-white/5 border border-border-light space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <FileText className="w-4 h-4" style={{ color: '#9c4937' }} />
                <span className="text-white font-medium">{scanStats.totalSrt}</span>
                <span className="text-text-muted">SRTs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Music className="w-4 h-4 text-blue-400" />
                <span className="text-white font-medium">{scanStats.totalAudios}</span>
                <span className="text-text-muted">áudios</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-green-400" />
                <span className="text-green-400 font-medium">{scanStats.matchedCount}</span>
                <span className="text-text-muted">matches</span>
              </div>
            </div>
            <button
              onClick={() => setShowPreview(true)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Eye className="w-3 h-3" />
              Ver detalhes
            </button>
          </div>
          {/* Botões de ação */}
          <div className="flex gap-2 pt-1 border-t border-border-light">
            <button
              onClick={handleRescan}
              disabled={isScanning}
              className="flex-1 py-1.5 px-3 text-xs btn-secondary flex items-center justify-center gap-1.5"
              title="Re-escanear a pasta atual"
            >
              <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
              Re-escanear
            </button>
            <button
              onClick={handleSelectFolder}
              disabled={isScanning}
              className="flex-1 py-1.5 px-3 text-xs btn-secondary flex items-center justify-center gap-1.5"
              title="Selecionar outra pasta de legendas"
            >
              <Plus className="w-3 h-3" />
              Outra pasta
            </button>
          </div>
        </div>
      )}

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
          <BookOpen className="w-4 h-4 text-text-muted transition-colors" />
          <span className="text-sm text-text-primary">Criar texto de título</span>
        </label>
      </div>

      {/* Action Button */}
      <button
        onClick={handleInsertSubtitles}
        disabled={!srtFolder || !hasProject || isProcessing || selectedCount === 0}
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
            INSERIR {selectedCount > 0 ? `${selectedCount} LEGENDAS (~${totalSubtitles} segs)` : 'LEGENDAS'}
          </>
        )}
      </button>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-50"
              onClick={() => setShowPreview(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-16 bottom-16 md:inset-x-16 bg-background-dark border border-border-light rounded-xl z-50 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-3 border-b border-border-light flex-shrink-0">
                <div>
                  <h2 className="text-sm font-bold text-white">Prévia das Legendas</h2>
                  <p className="text-[10px] text-text-muted">
                    {selectedCount}/{matches.length + unmatched.length} selecionadas • ~{totalSubtitles} segs
                  </p>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-text-secondary" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-3 space-y-3">
                {/* Matched Section */}
                {matches.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-xs font-semibold text-white">
                          Correspondências ({matches.length})
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => selectAll(true)} className="text-[10px] text-primary hover:underline">
                          Todos
                        </button>
                        <button onClick={() => deselectAll(true)} className="text-[10px] text-text-muted hover:underline">
                          Nenhum
                        </button>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {matches.map((m, i) => (
                        <div
                          key={m.srtPath}
                          onClick={() => toggleSelection(i, true)}
                          className={`py-1 px-2 rounded border cursor-pointer transition-all ${
                            m.selected
                              ? 'bg-green-500/10 border-green-500/30'
                              : 'bg-white/5 border-transparent hover:border-border-light'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={m.selected}
                                onChange={() => {}}
                                className="w-3 h-3"
                                style={{ accentColor: '#22c55e' }}
                              />
                              <span className="text-[11px] text-white truncate max-w-[280px]">{m.baseName}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-text-muted flex-shrink-0">
                              <span>{m.subtitleCount}</span>
                              <Music className="w-2.5 h-2.5 text-green-400" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unmatched Section */}
                {unmatched.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                        <span className="text-xs font-semibold text-white">
                          Sem correspondência ({unmatched.length})
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => selectAll(false)} className="text-[10px] text-primary hover:underline">
                          Todos
                        </button>
                        <button onClick={() => deselectAll(false)} className="text-[10px] text-text-muted hover:underline">
                          Nenhum
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-text-muted">
                      Não correspondem a nenhum áudio do projeto
                    </p>
                    <div className="space-y-0.5">
                      {unmatched.map((m, i) => (
                        <div
                          key={m.srtPath}
                          onClick={() => toggleSelection(i, false)}
                          className={`py-1 px-2 rounded border cursor-pointer transition-all ${
                            m.selected
                              ? 'bg-yellow-500/10 border-yellow-500/30'
                              : 'bg-white/5 border-transparent hover:border-border-light'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={m.selected}
                                onChange={() => {}}
                                className="w-3 h-3"
                                style={{ accentColor: '#eab308' }}
                              />
                              <span className="text-[11px] text-white truncate max-w-[280px]">{m.baseName}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-text-muted flex-shrink-0">
                              <span>{m.subtitleCount}</span>
                              <AlertTriangle className="w-2.5 h-2.5 text-yellow-400" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-border-light flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddFolder}
                    disabled={isScanning}
                    className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                    title="Adicionar legendas de outra pasta"
                  >
                    {isScanning ? (
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    Adicionar pasta
                  </button>
                  <span className="text-[10px] text-text-muted">
                    {selectedCount > 0 ? (
                      <span className="text-green-400">{selectedCount} selecionados • ~{totalSubtitles} segs</span>
                    ) : (
                      <span>Nenhum selecionado</span>
                    )}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPreview(false)}
                    className="btn-secondary py-1.5 px-3 text-xs"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={handleInsertSubtitles}
                    disabled={selectedCount === 0}
                    className="py-1.5 px-4 text-xs text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
                    style={{ backgroundColor: '#9c4937' }}
                  >
                    Inserir {selectedCount}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
