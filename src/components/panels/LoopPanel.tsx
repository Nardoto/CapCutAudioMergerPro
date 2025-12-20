import { useState } from 'react'
import { RefreshCw, Film, Music, Shuffle, ListOrdered, AlertTriangle } from 'lucide-react'
import type { TrackInfo, LogEntry } from '../../types'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

interface LoopPanelProps {
  tracks: TrackInfo[]
  audioTracks: TrackInfo[]
  selectedAudioTrack: number
  onLog: (type: LogEntry['type'], message: string) => void
  draftPath: string | null
  onReanalyze?: () => void
}

export default function LoopPanel({
  tracks,
  audioTracks,
  selectedAudioTrack,
  onLog,
  draftPath,
  onReanalyze,
}: LoopPanelProps) {
  const [order, setOrder] = useState<'sequential' | 'random'>('random')
  const [audioToLoop, setAudioToLoop] = useState<number>(-1)
  const [isProcessingVideo, setIsProcessingVideo] = useState(false)
  const [isProcessingAudio, setIsProcessingAudio] = useState(false)

  const hasProject = tracks.length > 0

  const handleLoopMedia = async () => {
    if (!hasProject || !draftPath || !ipcRenderer) {
      onLog('warning', 'Selecione e analise um projeto primeiro!')
      return
    }

    setIsProcessingVideo(true)
    onLog('info', `Repetindo mídias (ordem: ${order === 'random' ? 'aleatória' : 'sequencial'})...`)

    try {
      const result = await ipcRenderer.invoke('loop-video', {
        draftPath,
        audioTrackIndex: selectedAudioTrack,
        order,
      })
      if (result.error) {
        onLog('error', result.error)
      } else {
        result.logs?.forEach((log: string) => onLog('info', log))
        onLog('success', `Mídias repetidas! ${result.stats.newCount} blocos em ${result.stats.cycles} ciclos`)
        onReanalyze?.()
      }
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }
    setIsProcessingVideo(false)
  }

  const handleLoopAudio = async () => {
    if (audioToLoop < 0) {
      onLog('warning', 'Selecione uma track de áudio para repetir!')
      return
    }

    if (!draftPath || !ipcRenderer) {
      onLog('error', 'Projeto não carregado ou IPC não disponível')
      return
    }

    // Get target duration from reference audio track
    const targetDuration = refAudioTrack?.duration || 0
    if (targetDuration === 0) {
      onLog('error', 'Duração de referência não encontrada')
      return
    }

    setIsProcessingAudio(true)
    onLog('info', 'Repetindo trilha musical...')

    try {
      const result = await ipcRenderer.invoke('loop-audio', {
        draftPath,
        trackIndex: audioToLoop,
        targetDuration,
      })

      if (result.error) {
        onLog('error', result.error)
      } else {
        result.logs?.forEach((log) => onLog('info', log))
        onLog('success', 'Trilha repetida! ' + result.stats.newCount + ' blocos criados em ' + result.stats.cycles + ' ciclos')
        onReanalyze?.()
      }
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }

    setIsProcessingAudio(false)
  }

  // Get the selected reference audio track info
  const refAudioTrack = audioTracks.find(t => t.index === selectedAudioTrack)

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <RefreshCw className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Repetição (Loop)</h2>
          <p className="text-sm text-text-secondary">Repete mídias e trilhas musicais</p>
        </div>
      </div>

      {/* Warning about reference */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-yellow-400 font-medium">Limite de referência</p>
          <p className="text-text-secondary mt-1">
            As repetições usam a duração da track de referência selecionada na aba SYNC
            {refAudioTrack && (
              <span className="text-white"> ({refAudioTrack.name}: {refAudioTrack.durationSec.toFixed(1)}s)</span>
            )}
          </p>
        </div>
      </div>

      {/* Section: Loop Video/Image */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">REPETIR VÍDEO/IMAGEM</span>
        </div>

        <p className="text-sm text-text-secondary">
          Copia as fotos/vídeos da timeline até cobrir a duração do áudio de referência
        </p>

        {/* Order selection */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setOrder('sequential')}
            className={`p-3 rounded-xl border transition-all flex items-center gap-3 ${
              order === 'sequential'
                ? 'border-blue-400 bg-blue-400/10 text-white'
                : 'border-border-light text-text-secondary hover:border-border-lighter'
            }`}
          >
            <ListOrdered className="w-5 h-5" />
            <span className="text-sm font-medium">Sequencial</span>
          </button>
          <button
            onClick={() => setOrder('random')}
            className={`p-3 rounded-xl border transition-all flex items-center gap-3 ${
              order === 'random'
                ? 'border-blue-400 bg-blue-400/10 text-white'
                : 'border-border-light text-text-secondary hover:border-border-lighter'
            }`}
          >
            <Shuffle className="w-5 h-5" />
            <span className="text-sm font-medium">Aleatório</span>
          </button>
        </div>

        <button
          onClick={handleLoopMedia}
          disabled={!hasProject || isProcessingVideo}
          className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessingVideo ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Film className="w-4 h-4" />
              REPETIR MÍDIA
            </>
          )}
        </button>
      </div>

      {/* Divider */}
      <div className="border-t border-border-light" />

      {/* Section: Loop Audio */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-green-400" />
          <span className="text-sm font-semibold text-white">REPETIR TRILHA MUSICAL</span>
        </div>

        <p className="text-sm text-text-secondary">
          Copia a música de fundo até cobrir toda a duração do projeto
        </p>

        {/* Audio track selection */}
        <select
          value={audioToLoop}
          onChange={(e) => setAudioToLoop(Number(e.target.value))}
          disabled={audioTracks.length === 0}
          className="input w-full"
        >
          <option value={-1}>Selecione uma track de áudio</option>
          {audioTracks.map((track) => (
            <option key={track.index} value={track.index}>
              Track {track.index}: {track.name || 'Sem nome'} ({track.segments} segs)
            </option>
          ))}
        </select>

        <button
          onClick={handleLoopAudio}
          disabled={audioToLoop < 0 || isProcessingAudio}
          className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessingAudio ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Music className="w-4 h-4" />
              REPETIR TRILHA
            </>
          )}
        </button>
      </div>
    </div>
  )
}
