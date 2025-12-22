import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Video, Image, Music, FolderOpen, Upload, Check, X, RefreshCw, Film, Clock, Shuffle, ArrowDownAZ, Trash2, Layers, Loader2, Wand2 } from 'lucide-react'
import type { LogEntry } from '../../types'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

interface MediaFile {
  path: string
  name: string
  type: 'video' | 'image' | 'audio'
  duration?: number
  selected: boolean
}

interface MediaPanelProps {
  onLog: (type: LogEntry['type'], message: string) => void
  draftPath: string | null
  onReanalyze?: () => void
  selectedAudioTrack: number
  refTrackName?: string
  videoTrackName?: string
  onMediaModeChange?: (mode: 'video_image' | 'audio') => void
}

export default function MediaPanel({ onLog, draftPath, onReanalyze, selectedAudioTrack, refTrackName, videoTrackName, onMediaModeChange }: MediaPanelProps) {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [imageDuration, setImageDuration] = useState(5) // segundos
  const [mediaType, setMediaType] = useState<'video_image' | 'audio'>('video_image')
  const [useExistingTrack, setUseExistingTrack] = useState(false)
  const [orderMode, setOrderMode] = useState<'alphabetic' | 'random'>('alphabetic')

  // Bulk import state
  const [isImportingFolder, setIsImportingFolder] = useState(false)
  const [showBulkImportOptions, setShowBulkImportOptions] = useState(false)
  const [bulkAddAnimations, setBulkAddAnimations] = useState(true)
  const [bulkSyncToAudio, setBulkSyncToAudio] = useState(true)

  // Notify parent when media mode changes
  const handleMediaTypeChange = (newType: 'video_image' | 'audio') => {
    setMediaType(newType)
    onMediaModeChange?.(newType)
  }

  // Fisher-Yates shuffle
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const applyOrder = (files: MediaFile[]): MediaFile[] => {
    if (orderMode === 'random') {
      return shuffleArray(files)
    }
    return files.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
  }

  const reshuffleFiles = () => {
    if (orderMode === 'random') {
      setMediaFiles(prev => shuffleArray(prev))
    }
  }

  const handleSelectFiles = async () => {
    if (!ipcRenderer) {
      onLog('error', 'Electron IPC não disponível')
      return
    }

    const typeLabel = mediaType === 'video_image' ? 'video/imagem' : 'audio'
    onLog('info', `Selecionando arquivos de ${typeLabel}...`)

    try {
      const filters = mediaType === 'video_image'
        ? [{ name: 'Videos e Imagens', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }]
        : [{ name: 'Audios', extensions: ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac', 'wma'] }]

      const result = await ipcRenderer.invoke('dialog:openFile', {
        properties: ['openFile', 'multiSelections'],
        filters
      })

      if (!result || result.canceled || !result.filePaths?.length) {
        onLog('warning', 'Seleção cancelada')
        return
      }

      const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv']
      const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']

      const files: MediaFile[] = result.filePaths.map((path: string) => {
        const ext = path.split('.').pop()?.toLowerCase() || ''
        let type: 'video' | 'image' | 'audio' = 'audio'
        if (videoExts.includes(ext)) type = 'video'
        else if (imageExts.includes(ext)) type = 'image'
        return { path, name: path.split(/[\\/]/).pop() || path, type, selected: true }
      })

      const orderedFiles = applyOrder(files)
      setMediaFiles(orderedFiles)
      const orderLabel = orderMode === 'random' ? 'aleatória' : 'alfabética'
      onLog('success', `${files.length} arquivos selecionados (ordem ${orderLabel})`)
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }
  }

  const handleSelectFolder = async () => {
    if (!ipcRenderer) {
      onLog('error', 'Electron IPC não disponível')
      return
    }

    const typeLabel = mediaType === 'video_image' ? 'videos/imagens' : 'audios'
    onLog('info', `Selecionando pasta de ${typeLabel}...`)

    try {
      const result = await ipcRenderer.invoke('dialog:openFile', {
        properties: ['openDirectory']
      })

      if (!result || result.canceled || !result.filePaths?.length) {
        onLog('warning', 'Seleção cancelada')
        return
      }

      const folderPath = result.filePaths[0]

      // Listar arquivos da pasta
      const extensions = mediaType === 'video_image'
        ? ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
        : ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac', 'wma']

      const filesResult = await ipcRenderer.invoke('list-files-in-folder', {
        folderPath,
        extensions
      })

      if (!filesResult || !filesResult.files?.length) {
        onLog('warning', 'Nenhum arquivo encontrado na pasta')
        return
      }

      const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv']
      const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']

      const files: MediaFile[] = filesResult.files.map((path: string) => {
        const ext = path.split('.').pop()?.toLowerCase() || ''
        let type: 'video' | 'image' | 'audio' = 'audio'
        if (videoExts.includes(ext)) type = 'video'
        else if (imageExts.includes(ext)) type = 'image'
        return { path, name: path.split(/[\\/]/).pop() || path, type, selected: true }
      })

      const orderedFiles = applyOrder(files)
      setMediaFiles(orderedFiles)
      const orderLabel = orderMode === 'random' ? 'aleatória' : 'alfabética'
      onLog('success', `${files.length} arquivos encontrados (ordem ${orderLabel})`)
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }
  }

  // Bulk import - imports all media types from a folder at once
  const handleBulkImport = async () => {
    if (!draftPath || !ipcRenderer) {
      onLog('error', 'Selecione um projeto primeiro')
      return
    }

    onLog('info', 'Selecionando pasta com todas as mídias...')

    try {
      const result = await ipcRenderer.invoke('dialog:openFile', {
        properties: ['openDirectory']
      })

      if (!result || result.canceled || !result.filePaths?.length) {
        onLog('warning', 'Seleção cancelada')
        return
      }

      const folderPath = result.filePaths[0]

      // Scan folder to show what will be imported
      const scanResult = await ipcRenderer.invoke('scan-media-folder', folderPath)
      if (!scanResult || !scanResult.success) {
        onLog('error', 'Erro ao escanear pasta')
        return
      }

      const totalFiles = scanResult.images.length + scanResult.videos.length + scanResult.audios.length
      if (totalFiles === 0) {
        onLog('warning', 'Nenhuma mídia encontrada na pasta')
        return
      }

      // Log what was found
      onLog('info', `Encontrado: ${scanResult.images.length} img, ${scanResult.videos.length} vid, ${scanResult.audios.length} aud, ${scanResult.subtitles?.length || 0} srt`)

      setIsImportingFolder(true)
      onLog('info', 'Importando todas as mídias...')

      const importResult = await ipcRenderer.invoke('import-media-folder', {
        draftPath,
        folderPath,
        addAnimations: bulkAddAnimations,
        syncToAudio: bulkSyncToAudio
      })

      if (importResult.error) {
        onLog('error', importResult.error)
      } else {
        importResult.logs?.forEach((log: string) => {
          if (log.includes('[+]') || log.includes('inserid')) onLog('success', log)
          else if (log.includes('[SKIP]')) onLog('warning', log)
          else onLog('info', log)
        })
        const stats = importResult.stats || {}
        onLog('success', `Importado: ${stats.imagesInserted || 0} img, ${stats.videosInserted || 0} vid, ${stats.audiosInserted || 0} aud, ${stats.subtitlesInserted || 0} srt`)
        await ipcRenderer.invoke('save-backup-description', { draftPath, description: 'Importação em lote' })
        onReanalyze?.()
      }
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    } finally {
      setIsImportingFolder(false)
    }
  }

  const toggleFileSelection = (index: number) => {
    setMediaFiles(prev => prev.map((f, i) =>
      i === index ? { ...f, selected: !f.selected } : f
    ))
  }

  const selectAll = () => {
    setMediaFiles(prev => prev.map(f => ({ ...f, selected: true })))
  }

  const deselectAll = () => {
    setMediaFiles(prev => prev.map(f => ({ ...f, selected: false })))
  }

  const clearFiles = () => {
    setMediaFiles([])
  }

  const handleInsert = async () => {
    if (!draftPath || !ipcRenderer) {
      onLog('error', 'Selecione um projeto primeiro')
      return
    }

    const selectedFiles = mediaFiles.filter(f => f.selected)
    if (selectedFiles.length === 0) {
      onLog('warning', 'Nenhum arquivo selecionado')
      return
    }

    setIsProcessing(true)
    onLog('info', `Inserindo ${selectedFiles.length} ${mediaType === 'audio' ? 'audios' : 'mídias'} na timeline...`)

    try {
      let result
      if (mediaType === 'audio') {
        result = await ipcRenderer.invoke('run-python', {
          action: 'insert_audio',
          draftPath,
          audioFiles: selectedFiles.map(f => f.path),
          useExistingTrack,
          trackIndex: useExistingTrack ? selectedAudioTrack : null
        })
      } else {
        result = await ipcRenderer.invoke('run-python', {
          action: 'insert_media',
          draftPath,
          mediaFiles: selectedFiles.map(f => f.path),
          imageDuration: imageDuration * 1000000 // converter para microsegundos
        })
      }

      if (result.error) {
        onLog('error', result.error)
      } else {
        result.logs?.forEach((log: string) => {
          if (log.startsWith('[+]')) onLog('success', log)
          else if (log.startsWith('[SKIP]')) onLog('warning', log)
          else onLog('info', log)
        })
        onLog('success', `${result.stats?.totalMedia || selectedFiles.length} mídias inseridas!`)
        // Save backup description
        const desc = mediaType === 'audio' ? 'Áudio inserido' : 'Mídia inserida'
        await ipcRenderer.invoke('save-backup-description', { draftPath, description: desc })
        setMediaFiles([])
        onReanalyze?.()
      }
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    } finally {
      setIsProcessing(false)
    }
  }

  const selectedCount = mediaFiles.filter(f => f.selected).length

  // Get thumbnail for file
  const getThumbnail = (file: MediaFile) => {
    if (file.type === 'image') {
      return `file://${file.path.replace(/\\/g, '/')}`
    }
    return null
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header com tipo de mídia */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleMediaTypeChange('video_image')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
            mediaType === 'video_image'
              ? 'bg-gradient-to-r from-primary to-primary/80 text-white font-medium'
              : 'bg-white/10 text-text-secondary hover:bg-white/20'
          }`}
        >
          <Film className="w-4 h-4" />
          Videos / Imagens
        </button>
        <button
          onClick={() => handleMediaTypeChange('audio')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
            mediaType === 'audio'
              ? 'bg-gradient-to-r from-primary to-primary/80 text-white font-medium'
              : 'bg-white/10 text-text-secondary hover:bg-white/20'
          }`}
        >
          <Music className="w-4 h-4" />
          Audios
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-white/20 mx-1" />

        {/* Bulk Import Button */}
        <button
          onClick={handleBulkImport}
          disabled={isImportingFolder || !draftPath}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all bg-gradient-to-r from-primary to-primary/80 text-white font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isImportingFolder ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Wand2 className="w-4 h-4" />
          )}
          {isImportingFolder ? 'Importando...' : 'Importar Pasta'}
        </button>
      </div>

      {/* Two Column Layout */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* LEFT SIDE - Media List (narrower) */}
        <div className="w-80 flex flex-col min-w-0 bg-white/5 rounded-xl border border-border overflow-hidden flex-shrink-0">
          {/* List Header */}
          <div className="p-3 border-b border-border bg-white/5 flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">
              ARQUIVOS ({mediaFiles.length})
            </span>
            <div className="flex items-center gap-1">
              {mediaFiles.length > 0 && (
                <>
                  <button
                    onClick={selectAll}
                    className="text-[10px] px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-text-muted"
                  >
                    Todos
                  </button>
                  <button
                    onClick={deselectAll}
                    className="text-[10px] px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-text-muted"
                  >
                    Nenhum
                  </button>
                  <button
                    onClick={clearFiles}
                    className="p-1 bg-red-500/20 hover:bg-red-500/30 rounded text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Files List */}
          <div className="flex-1 overflow-y-auto p-2">
            {mediaFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                {mediaType === 'audio' ? (
                  <Music className="w-10 h-10 text-primary mx-auto mb-3 opacity-30" />
                ) : (
                  <Film className="w-10 h-10 text-primary mx-auto mb-3 opacity-30" />
                )}
                <p className="text-xs text-text-muted">Nenhum arquivo selecionado</p>
                <p className="text-[10px] text-text-muted mt-1">
                  Use os botões ao lado para adicionar
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {mediaFiles.map((file, index) => {
                  const thumbnail = getThumbnail(file)
                  return (
                    <button
                      key={file.path}
                      onClick={() => toggleFileSelection(index)}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all text-left group ${
                        file.selected
                          ? 'bg-primary/20 border border-primary/50'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        file.selected
                          ? 'bg-primary border-primary'
                          : 'border-text-muted/50 group-hover:border-primary'
                      }`}>
                        {file.selected && <Check className="w-3 h-3 text-white" />}
                      </div>

                      {/* Thumbnail */}
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-black/30 flex items-center justify-center">
                        {thumbnail ? (
                          <img
                            src={thumbnail}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              target.parentElement!.innerHTML = '<svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>'
                            }}
                          />
                        ) : file.type === 'video' ? (
                          <Video className="w-4 h-4 text-blue-400" />
                        ) : file.type === 'audio' ? (
                          <Music className="w-4 h-4 text-orange-400" />
                        ) : (
                          <Image className="w-4 h-4 text-green-400" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs block truncate ${file.selected ? 'text-primary font-medium' : 'text-white'}`}>
                          {file.name}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-text-muted">
                          <span className="text-text-muted/50">#{index + 1}</span>
                          <span>•</span>
                          {file.type === 'video' && <span className="text-blue-400">Vídeo</span>}
                          {file.type === 'image' && <span className="text-green-400">Imagem</span>}
                          {file.type === 'audio' && <span className="text-orange-400">Áudio</span>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {mediaFiles.length > 0 && (
            <div className="p-2 border-t border-border bg-white/5">
              <span className="text-[10px] text-text-muted flex items-center gap-1 justify-center">
                {orderMode === 'random' ? (
                  <><Shuffle className="w-3 h-3" /> Ordem Aleatória</>
                ) : (
                  <><ArrowDownAZ className="w-3 h-3" /> Ordem A-Z</>
                )}
                <span className="mx-1">•</span>
                {selectedCount} selecionado(s)
              </span>
            </div>
          )}
        </div>

        {/* RIGHT SIDE - Controls (wider) */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Selection buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSelectFiles}
              disabled={isProcessing || !draftPath}
              className="flex-1 py-2.5 px-4 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl flex items-center justify-center gap-2 transition-all text-sm text-white"
            >
              <Upload className="w-4 h-4" />
              Selecionar Arquivos
            </button>
            <button
              onClick={handleSelectFolder}
              disabled={isProcessing || !draftPath}
              className="flex-1 py-2.5 px-4 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl flex items-center justify-center gap-2 transition-all text-sm text-white"
            >
              <FolderOpen className="w-4 h-4" />
              Selecionar Pasta
            </button>
          </div>

          {/* Order toggle */}
          <div className="space-y-2">
            <label className="text-[10px] font-medium text-text-secondary">ORDEM DOS ARQUIVOS</label>
            <div className="flex gap-2">
              <button
                onClick={() => setOrderMode('alphabetic')}
                className={`flex-1 p-2 rounded-lg text-left transition-all border ${
                  orderMode === 'alphabetic'
                    ? 'bg-primary/20 border-primary'
                    : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className={`text-xs font-medium flex items-center gap-1 ${orderMode === 'alphabetic' ? 'text-primary' : 'text-white'}`}>
                  <ArrowDownAZ className="w-3.5 h-3.5" />
                  Alfabética (A-Z)
                </div>
                <div className="text-[9px] text-text-muted mt-0.5">
                  Ordena por nome do arquivo
                </div>
              </button>
              <button
                onClick={() => setOrderMode('random')}
                className={`flex-1 p-2 rounded-lg text-left transition-all border ${
                  orderMode === 'random'
                    ? 'bg-primary/20 border-primary'
                    : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className={`text-xs font-medium flex items-center gap-1 ${orderMode === 'random' ? 'text-primary' : 'text-white'}`}>
                  <Shuffle className="w-3.5 h-3.5" />
                  Aleatória
                </div>
                <div className="text-[9px] text-text-muted mt-0.5">
                  Embaralha os arquivos
                </div>
              </button>
            </div>
            {orderMode === 'random' && mediaFiles.length > 0 && (
              <button
                onClick={reshuffleFiles}
                className="w-full py-1.5 px-3 bg-white/5 hover:bg-primary/20 text-text-muted hover:text-primary rounded-lg text-xs flex items-center justify-center gap-1 transition-all border border-transparent hover:border-primary/30"
              >
                <RefreshCw className="w-3 h-3" />
                Reembaralhar
              </button>
            )}
          </div>

          {/* Duration for images */}
          {mediaType === 'video_image' && (
            <div className="space-y-2">
              <label className="text-[10px] font-medium text-text-secondary">DURAÇÃO POR IMAGEM</label>
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-border">
                <Clock className="w-4 h-4 text-text-muted" />
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={imageDuration}
                  onChange={(e) => setImageDuration(Number(e.target.value))}
                  className="w-16 px-2 py-1 bg-black/30 border border-border rounded text-center text-sm"
                />
                <span className="text-xs text-text-muted">segundos</span>
              </div>
            </div>
          )}

          {/* Audio track options */}
          {mediaType === 'audio' && (
            <div className="space-y-2">
              <label className="text-[10px] font-medium text-text-secondary">DESTINO DO ÁUDIO</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setUseExistingTrack(false)}
                  className={`flex-1 p-2 rounded-lg text-left transition-all border ${
                    !useExistingTrack
                      ? 'bg-primary/20 border-primary'
                      : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className={`text-xs font-medium ${!useExistingTrack ? 'text-primary' : 'text-white'}`}>
                    Nova Track
                  </div>
                  <div className="text-[9px] text-text-muted mt-0.5">
                    Cria uma nova track de áudio
                  </div>
                </button>
                <button
                  onClick={() => setUseExistingTrack(true)}
                  className={`flex-1 p-2 rounded-lg text-left transition-all border ${
                    useExistingTrack
                      ? 'bg-primary/20 border-primary'
                      : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className={`text-xs font-medium ${useExistingTrack ? 'text-primary' : 'text-white'}`}>
                    Track de Referência
                  </div>
                  <div className="text-[9px] text-text-muted mt-0.5">
                    Adiciona na track selecionada
                  </div>
                </button>
              </div>
              {useExistingTrack && refTrackName && (
                <div className="text-xs text-center py-2 px-3 bg-primary/10 rounded-lg text-primary border border-primary/30">
                  Inserir no final de: <span className="font-medium">{refTrackName}</span>
                </div>
              )}
            </div>
          )}

          {/* No project warning */}
          {!draftPath && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center">
              <p className="text-yellow-400 text-xs">Selecione um projeto CapCut primeiro</p>
            </div>
          )}

          {/* Progress bar */}
          {isProcessing && (
            <div className="p-3 bg-white/5 rounded-lg border border-border">
              <div className="flex justify-between text-xs text-text-muted mb-2">
                <span>Inserindo mídias...</span>
                <span>{selectedCount} arquivos</span>
              </div>
              <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: Math.max(1, selectedCount * 0.05), ease: 'linear' }}
                />
              </div>
            </div>
          )}

          {/* Insert Button - moved up, closer to the settings */}
          <button
            onClick={handleInsert}
            disabled={isProcessing || selectedCount === 0 || !draftPath}
            className="w-full py-3 px-4 bg-primary text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:brightness-110 text-sm"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Inserindo...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Inserir na Timeline
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
