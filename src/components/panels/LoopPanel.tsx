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
  const [loopType, setLoopType] = useState<'video_image' | 'audio'>('video_image')
  const [order, setOrder] = useState<'sequential' | 'random'>('random')
  const [audioToLoop, setAudioToLoop] = useState<number>(-1)
  const [isProcessingVideo, setIsProcessingVideo] = useState(false)
  const [isProcessingAudio, setIsProcessingAudio] = useState(false)
  const [isRandomizing, setIsRandomizing] = useState(false)

  const hasProject = tracks.length > 0
  const refAudioTrack = audioTracks.find(t => t.index === selectedAudioTrack)

  const handleLoopMedia = async () => {
    if (!hasProject || !draftPath || !ipcRenderer) {
      onLog('warning', 'Selecione e analise um projeto primeiro!')
      return
    }

    setIsProcessingVideo(true)
    onLog('info', `Repetindo midias (ordem: ${order === 'random' ? 'aleatoria' : 'sequencial'})...`)

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
        onLog('success', `Midias repetidas! ${result.stats.newCount} blocos em ${result.stats.cycles} ciclos`)
        onReanalyze?.()
      }
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }
    setIsProcessingVideo(false)
  }

  const handleLoopAudio = async () => {
    if (audioToLoop < 0) {
      onLog('warning', 'Selecione uma track de audio para repetir!')
      return
    }

    if (!draftPath || !ipcRenderer) {
      onLog('error', 'Projeto nao carregado ou IPC nao disponivel')
      return
    }

    const targetDuration = refAudioTrack?.duration || 0
    if (targetDuration === 0) {
      onLog('error', 'Duracao de referencia nao encontrada')
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
        result.logs?.forEach((log: string) => onLog('info', log))
        onLog('success', 'Trilha repetida! ' + result.stats.newCount + ' blocos criados em ' + result.stats.cycles + ' ciclos')
        onReanalyze?.()
      }
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }

    setIsProcessingAudio(false)
  }

  const handleRandomizeMedia = async () => {
    if (!hasProject || !draftPath || !ipcRenderer) {
      onLog('warning', 'Selecione e analise um projeto primeiro!')
      return
    }

    setIsRandomizing(true)
    onLog('info', 'Randomizando ordem das midias existentes...')

    try {
      const result = await ipcRenderer.invoke('run-python', {
        action: 'randomize_media',
        draftPath,
      })

      if (result.error) {
        onLog('error', result.error)
      } else {
        result.logs?.forEach((log: string) => onLog('info', log))
        onLog('success', `Midias randomizadas! ${result.stats?.totalMedia || 0} segmentos reordenados`)
        onReanalyze?.()
      }
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }

    setIsRandomizing(false)
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: loopType === 'video_image' ? '#175d6230' : '#0e305830' }}>
          <RefreshCw className="w-5 h-5" style={{ color: loopType === 'video_image' ? '#175d62' : '#0e3058' }} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Repeticao (Loop)</h2>
          <p className="text-sm text-text-secondary">Repete midias e trilhas musicais</p>
        </div>
      </div>

      {/* Toggle buttons - igual ao MediaPanel */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setLoopType('video_image')}
          className={`py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
            loopType === 'video_image'
              ? 'text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          style={loopType === 'video_image' ? { backgroundColor: '#175d62' } : {}}
        >
          <Film className="w-4 h-4" />
          Video/Imagem
        </button>
        <button
          onClick={() => setLoopType('audio')}
          className={`py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
            loopType === 'audio'
              ? 'text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          style={loopType === 'audio' ? { backgroundColor: '#0e3058' } : {}}
        >
          <Music className="w-4 h-4" />
          Audio
        </button>
      </div>

      {/* Warning about reference */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-yellow-400 font-medium">Limite de referencia</p>
          <p className="text-text-secondary mt-1">
            As repeticoes usam a duracao da track de referencia selecionada na aba SYNC
            {refAudioTrack && (
              <span className="text-white"> ({refAudioTrack.name}: {refAudioTrack.durationSec.toFixed(1)}s)</span>
            )}
          </p>
        </div>
      </div>

      {/* Content based on loopType */}
      {loopType === 'video_image' ? (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Copia as fotos/videos da timeline ate cobrir a duracao do audio de referencia
          </p>

          {/* Order selection */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setOrder('sequential')}
              className={`p-3 rounded-xl border transition-all flex items-center gap-3 ${
                order === 'sequential'
                  ? 'text-white'
                  : 'border-border-light text-text-secondary hover:border-border-lighter'
              }`}
              style={order === 'sequential' ? { borderColor: '#175d62', backgroundColor: '#175d6230' } : {}}
            >
              <ListOrdered className="w-5 h-5" />
              <span className="text-sm font-medium">Sequencial</span>
            </button>
            <button
              onClick={() => setOrder('random')}
              className={`p-3 rounded-xl border transition-all flex items-center gap-3 ${
                order === 'random'
                  ? 'text-white'
                  : 'border-border-light text-text-secondary hover:border-border-lighter'
              }`}
              style={order === 'random' ? { borderColor: '#175d62', backgroundColor: '#175d6230' } : {}}
            >
              <Shuffle className="w-5 h-5" />
              <span className="text-sm font-medium">Aleatorio</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleLoopMedia}
              disabled={!hasProject || isProcessingVideo}
              className="py-3 px-4 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:brightness-110"
              style={{ backgroundColor: '#175d62' }}
            >
              {isProcessingVideo ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Film className="w-4 h-4" />
                  REPETIR MIDIA
                </>
              )}
            </button>

            <button
              onClick={handleRandomizeMedia}
              disabled={!hasProject || isRandomizing}
              className="py-3 px-4 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:brightness-110"
              style={{ backgroundColor: '#e67e22' }}
            >
              {isRandomizing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Randomizando...
                </>
              ) : (
                <>
                  <Shuffle className="w-4 h-4" />
                  RANDOMIZAR
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Track de REFERÊNCIA - azul com brilho */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#0e3058', boxShadow: '0 0 8px #0e3058' }} />
              <span className="text-sm font-semibold text-white">REFERÊNCIA (duração alvo)</span>
            </div>
            {refAudioTrack ? (
              <div
                className="p-3 rounded-xl border-2 transition-all"
                style={{
                  borderColor: '#0e3058',
                  backgroundColor: '#0e305840',
                  boxShadow: '0 0 12px #0e305880'
                }}
              >
                <div className="flex items-center gap-3">
                  <Music className="w-5 h-5" style={{ color: '#0e3058' }} />
                  <div className="flex-1">
                    <p className="text-white font-medium">Track {refAudioTrack.index}: {refAudioTrack.name || 'Sem nome'}</p>
                    <p className="text-xs text-text-secondary">{refAudioTrack.durationSec.toFixed(1)}s • {refAudioTrack.segments} segmentos</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#0e3058', color: '#fff' }}>
                    Referência
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-yellow-400">Selecione uma track de referência na aba SYNC</p>
            )}
          </div>

          {/* Track para COPIAR - laranja quando selecionado */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#e67e22' }} />
              <span className="text-sm font-semibold text-white">COPIAR (será repetida)</span>
            </div>
            <div className="space-y-2">
              {audioTracks.filter(t => t.index !== selectedAudioTrack).length === 0 ? (
                <p className="text-sm text-text-secondary">Nenhuma outra track de áudio disponível</p>
              ) : (
                audioTracks
                  .filter(t => t.index !== selectedAudioTrack)
                  .map((track) => (
                    <button
                      key={track.index}
                      onClick={() => setAudioToLoop(track.index)}
                      className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                        audioToLoop === track.index ? 'text-white' : 'border-border-light hover:border-orange-500/50'
                      }`}
                      style={audioToLoop === track.index ? {
                        borderColor: '#e67e22',
                        backgroundColor: '#e67e2230',
                        boxShadow: '0 0 8px #e67e2260'
                      } : {}}
                    >
                      <div className="flex items-center gap-3">
                        <Music className="w-5 h-5" style={{ color: audioToLoop === track.index ? '#e67e22' : '#666' }} />
                        <div className="flex-1">
                          <p className={audioToLoop === track.index ? 'text-white font-medium' : 'text-text-secondary'}>
                            Track {track.index}: {track.name || 'Sem nome'}
                          </p>
                          <p className="text-xs text-text-muted">{track.durationSec.toFixed(1)}s • {track.segments} segmentos</p>
                        </div>
                        {audioToLoop === track.index && (
                          <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#e67e22', color: '#fff' }}>
                            Copiar
                          </span>
                        )}
                      </div>
                    </button>
                  ))
              )}
            </div>
          </div>

          <button
            onClick={handleLoopAudio}
            disabled={audioToLoop < 0 || isProcessingAudio || !hasProject}
            className="w-full py-3 px-4 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:brightness-110"
            style={{ backgroundColor: '#e67e22' }}
          >
            {isProcessingAudio ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Music className="w-4 h-4" />
                REPETIR TRILHA SELECIONADA
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
