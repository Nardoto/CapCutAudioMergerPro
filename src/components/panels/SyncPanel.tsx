import { useState } from 'react'
import { Zap, Music, FileText, Sparkles, Subtitles } from 'lucide-react'
import type { TrackInfo, LogEntry } from '../../types'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

interface SyncPanelProps {
  tracks: TrackInfo[]
  audioTracks: TrackInfo[]
  selectedAudioTrack: number
  onSelectAudioTrack: (index: number) => void
  onLog: (type: LogEntry['type'], message: string) => void
  draftPath: string | null
  onReanalyze?: () => void
}

export default function SyncPanel({
  tracks,
  audioTracks,
  selectedAudioTrack,
  onSelectAudioTrack,
  onLog,
  draftPath,
  onReanalyze,
}: SyncPanelProps) {
  const [mode, setMode] = useState<'audio' | 'subtitle'>('audio')
  const [applyAnimations, setApplyAnimations] = useState(true)
  const [syncSubtitles, setSyncSubtitles] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSync = async () => {
    if (!draftPath) {
      onLog('warning', 'Selecione e analise um projeto primeiro!')
      return
    }

    if (!ipcRenderer) {
      onLog('error', 'Electron IPC not available')
      return
    }

    setIsProcessing(true)
    onLog('info', 'Iniciando sincronização...')

    try {
      const result = await ipcRenderer.invoke('sync-project', {
        draftPath,
        audioTrackIndex: selectedAudioTrack,
        mode,
        syncSubtitles,
        applyAnimations,
      })

      if (result.error) {
        onLog('error', result.error)
      } else {
        result.logs?.forEach((log) => onLog('info', log))
        onLog('success', 'Sincronização concluída! ' + result.stats.gapsRemoved + ' gaps removidos, ' + result.stats.mediaModified + ' mídias ajustadas')
        // Save backup description
        await ipcRenderer.invoke('save-backup-description', { draftPath, description: 'Sync realizado' })
        onReanalyze?.()
      }
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }

    setIsProcessing(false)
  }

  const hasProject = tracks.length > 0

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/30 to-green-500/10 flex items-center justify-center">
          <Zap className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Sincronização</h2>
          <p className="text-sm text-text-secondary">Remove gaps e sincroniza mídia com áudio</p>
        </div>
      </div>

      {/* Audio Reference Selection */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <Music className="w-4 h-4" />
          ÁUDIO DE REFERÊNCIA
        </label>
        <select
          value={selectedAudioTrack}
          onChange={(e) => onSelectAudioTrack(Number(e.target.value))}
          disabled={audioTracks.length === 0}
          className="input w-full"
        >
          {audioTracks.length === 0 ? (
            <option>Nenhuma track de áudio encontrada</option>
          ) : (
            audioTracks.map((track) => (
              <option key={track.index} value={track.index}>
                Track {track.index}: {track.name || 'Sem nome'} ({track.segments} segs)
              </option>
            ))
          )}
        </select>
        <p className="text-xs text-text-muted">
          Esta track será usada como referência para sincronizar as mídias
        </p>
      </div>

      {/* Sync Mode */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <FileText className="w-4 h-4" />
          MODO DE SINCRONIZAÇÃO
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode('audio')}
            className={`p-4 rounded-xl border transition-all ${
              mode === 'audio'
                ? 'border-primary bg-primary/10 text-white'
                : 'border-border-light bg-transparent text-text-secondary hover:border-border-lighter'
            }`}
          >
            <Music className="w-5 h-5 mx-auto mb-2" />
            <span className="text-sm font-medium">Por Áudio</span>
            <p className="text-xs text-text-muted mt-1">Sincroniza pela duração do áudio</p>
          </button>
          <button
            onClick={() => setMode('subtitle')}
            className={`p-4 rounded-xl border transition-all ${
              mode === 'subtitle'
                ? 'border-primary bg-primary/10 text-white'
                : 'border-border-light bg-transparent text-text-secondary hover:border-border-lighter'
            }`}
          >
            <Subtitles className="w-5 h-5 mx-auto mb-2" />
            <span className="text-sm font-medium">Por Legenda</span>
            <p className="text-xs text-text-muted mt-1">Sincroniza pela posição das legendas</p>
          </button>
        </div>
      </div>

      {/* Options */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-text-secondary">OPÇÕES</label>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={applyAnimations}
              onChange={(e) => setApplyAnimations(e.target.checked)}
              className="w-4 h-4 rounded border-border-light bg-white/5 text-primary focus:ring-primary focus:ring-offset-0"
            />
            <Sparkles className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors" />
            <span className="text-sm text-text-primary">Aplicar animações</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={syncSubtitles}
              onChange={(e) => setSyncSubtitles(e.target.checked)}
              className="w-4 h-4 rounded border-border-light bg-white/5 text-primary focus:ring-primary focus:ring-offset-0"
            />
            <Subtitles className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors" />
            <span className="text-sm text-text-primary">Sincronizar legendas</span>
          </label>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={handleSync}
        disabled={!hasProject || isProcessing}
        className="btn-primary w-full py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Sincronizando...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Zap className="w-5 h-5" />
            SINCRONIZAR
          </span>
        )}
      </button>
    </div>
  )
}
