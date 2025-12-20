import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Video, Image, Music, FolderOpen, Upload, Check, X, RefreshCw, Film, Clock, Shuffle, ArrowDownAZ } from 'lucide-react'
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
}

export default function MediaPanel({ onLog, draftPath, onReanalyze, selectedAudioTrack, refTrackName }: MediaPanelProps) {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [imageDuration, setImageDuration] = useState(5) // segundos
  const [mediaType, setMediaType] = useState<'video_image' | 'audio'>('video_image')
  const [useExistingTrack, setUseExistingTrack] = useState(false)
  const [orderMode, setOrderMode] = useState<'alphabetic' | 'random'>('alphabetic')
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)

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
      onLog('error', 'Electron IPC no disponvel')
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
        onLog('warning', 'Seleo cancelada')
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
      setShowPreview(true)
      const orderLabel = orderMode === 'random' ? 'aleatória' : 'alfabética'
      onLog('success', `${files.length} arquivos selecionados (ordem ${orderLabel})`)
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }
  }

  const handleSelectFolder = async () => {
    if (!ipcRenderer) {
      onLog('error', 'Electron IPC no disponvel')
      return
    }

    const typeLabel = mediaType === 'video_image' ? 'videos/imagens' : 'audios'
    onLog('info', `Selecionando pasta de ${typeLabel}...`)

    try {
      const result = await ipcRenderer.invoke('dialog:openFile', {
        properties: ['openDirectory']
      })

      if (!result || result.canceled || !result.filePaths?.length) {
        onLog('warning', 'Selecao cancelada')
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
      setShowPreview(true)
      const orderLabel = orderMode === 'random' ? 'aleatória' : 'alfabética'
      onLog('success', `${files.length} arquivos encontrados (ordem ${orderLabel})`)
    } catch (error) {
      onLog('error', 'Erro: ' + error)
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
    onLog('info', `Inserindo ${selectedFiles.length} ${mediaType === 'audio' ? 'audios' : 'midias'} na timeline...`)

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
        onLog('success', `${result.stats?.totalMedia || selectedFiles.length} mdias inseridas!`)
        setShowPreview(false)
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

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header com tipo de midia */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMediaType('video_image')}
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
          onClick={() => setMediaType('audio')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
            mediaType === 'audio'
              ? 'bg-gradient-to-r from-primary to-primary/80 text-white font-medium'
              : 'bg-white/10 text-text-secondary hover:bg-white/20'
          }`}
        >
          <Music className="w-4 h-4" />
          Audios
        </button>
      </div>

      {/* Toggle de ordem */}
      <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-border-light">
        <span className="text-xs text-text-muted mr-2">Ordem:</span>
        <button
          onClick={() => setOrderMode('alphabetic')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
            orderMode === 'alphabetic'
              ? 'bg-gradient-to-r from-primary to-primary/80 text-white font-medium'
              : 'bg-white/10 text-text-secondary hover:bg-white/20'
          }`}
        >
          <ArrowDownAZ className="w-3.5 h-3.5" />
          A-Z
        </button>
        <button
          onClick={() => setOrderMode('random')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
            orderMode === 'random'
              ? 'bg-gradient-to-r from-primary to-primary/80 text-white font-medium'
              : 'bg-white/10 text-text-secondary hover:bg-white/20'
          }`}
        >
          <Shuffle className="w-3.5 h-3.5" />
          Aleatória
        </button>
        {orderMode === 'random' && mediaFiles.length > 0 && (
          <button
            onClick={reshuffleFiles}
            className="ml-auto px-2 py-1.5 bg-white/10 hover:bg-primary/20 text-text-secondary hover:text-primary rounded-lg text-xs flex items-center gap-1 transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            Reembaralhar
          </button>
        )}
      </div>

      {/* Duracao para imagens (quando video_image selecionado) */}
      {mediaType === 'video_image' && (
        <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">Duracao por imagem:</span>
          <input
            type="number"
            min="1"
            max="60"
            value={imageDuration}
            onChange={(e) => setImageDuration(Number(e.target.value))}
            className="w-16 px-2 py-1 bg-gray-700 rounded text-center text-sm"
          />
          <span className="text-sm text-gray-400">segundos</span>
        </div>
      )}

      {/* Opcoes de track para audio */}
      {mediaType === 'audio' && (
        <div className="flex flex-col gap-2 p-3 bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUseExistingTrack(false)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
                !useExistingTrack
                  ? 'text-white font-medium'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              style={!useExistingTrack ? { backgroundColor: '#0e3058' } : {}}
            >
              Nova Track
            </button>
            <button
              onClick={() => setUseExistingTrack(true)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
                useExistingTrack
                  ? 'text-white font-medium'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              style={useExistingTrack ? { backgroundColor: '#0e3058' } : {}}
            >
              Track de Referencia
            </button>
          </div>
          {useExistingTrack && refTrackName && (
            <div className="text-xs text-center py-1" style={{ color: '#0e3058' }}>
              Inserir no final de: <span className="font-medium">{refTrackName}</span>
            </div>
          )}
        </div>
      )}

      {/* Botes de seleo */}
      <div className="flex gap-2">
        <button
          onClick={handleSelectFiles}
          disabled={isProcessing || !draftPath}
          className="flex-1 btn-secondary flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Selecionar Arquivos
        </button>
        <button
          onClick={handleSelectFolder}
          disabled={isProcessing || !draftPath}
          className="flex-1 btn-secondary flex items-center justify-center gap-2"
        >
          <FolderOpen className="w-4 h-4" />
          Selecionar Pasta
        </button>
      </div>

      {!draftPath && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center">
          <p className="text-yellow-400 text-sm">Selecione um projeto CapCut primeiro</p>
        </div>
      )}

      {/* Preview dos arquivos */}
      <AnimatePresence>
        {showPreview && mediaFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col bg-gray-800/50 rounded-lg overflow-hidden"
          >
            {/* Header do preview */}
            <div className="p-3 bg-gray-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium">
                  {selectedCount} de {mediaFiles.length} selecionados
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded"
                >
                  Todos
                </button>
                <button
                  onClick={deselectAll}
                  className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded"
                >
                  Nenhum
                </button>
                <button
                  onClick={() => { setShowPreview(false); setMediaFiles([]) }}
                  className="text-xs px-2 py-1 bg-red-600/50 hover:bg-red-600 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Lista de arquivos */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {mediaFiles.map((file, index) => (
                <div
                  key={file.path}
                  onClick={() => toggleFileSelection(index)}
                  className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-all ${
                    file.selected
                      ? 'bg-purple-600/20 border border-purple-500/30'
                      : 'bg-gray-700/30 hover:bg-gray-700/50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center ${
                    file.selected ? 'bg-purple-600' : 'bg-gray-600'
                  }`}>
                    {file.selected && <Check className="w-3 h-3" />}
                  </div>
                  <span className="text-xs text-gray-400 w-6">{index + 1}.</span>
                  {file.type === 'video' && <Video className="w-4 h-4 text-blue-400" />}
                  {file.type === 'image' && <Image className="w-4 h-4 text-green-400" />}
                  {file.type === 'audio' && <Music className="w-4 h-4 text-orange-400" />}
                  <span className="text-sm truncate flex-1">{file.name}</span>
                </div>
              ))}
            </div>

            {/* Footer com boto de inserir */}
            <div className="p-3 bg-gray-700/50 flex flex-col gap-2">
              {/* Barra de progresso */}
              {isProcessing && (
                <div className="w-full">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Inserindo mídias...</span>
                    <span>{selectedCount} arquivos</span>
                  </div>
                  <div className="w-full h-2 bg-gray-600 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: mediaType === 'video_image' ? '#175d62' : '#0e3058' }}
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: Math.max(1, selectedCount * 0.05), ease: 'linear' }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  {orderMode === 'random' ? (
                    <><Shuffle className="w-3 h-3" /> Ordem Aleatória</>
                  ) : (
                    <><ArrowDownAZ className="w-3 h-3" /> Ordem A-Z</>
                  )}
                </span>
                <button
                  onClick={handleInsert}
                  disabled={isProcessing || selectedCount === 0}
                  className="px-4 py-2 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg flex items-center gap-2 transition-all font-medium text-white"
                  style={{ backgroundColor: isProcessing ? undefined : (mediaType === 'video_image' ? '#175d62' : '#0e3058') }}
                >
                  {isProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {isProcessing ? 'Inserindo...' : 'Inserir na Timeline'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info quando nao ha arquivos */}
      {!showPreview && draftPath && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            {mediaType === 'audio' ? (
              <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
            ) : (
              <Film className="w-12 h-12 mx-auto mb-3 opacity-50" />
            )}
            <p className="text-sm">
              Selecione arquivos de {mediaType === 'video_image' ? 'video/imagem' : 'audio'}
            </p>
            <p className="text-xs mt-1">Serao inseridos em ordem alfabetica</p>
          </div>
        </div>
      )}
    </div>
  )
}
