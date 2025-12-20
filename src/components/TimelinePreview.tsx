import { useMemo } from 'react'
import type { TrackInfo } from '../types'

interface TimelinePreviewProps {
  tracks: TrackInfo[]
  selectedAudioTrack: number
}

const trackColors: Record<string, string> = {
  filter: '#a855f7',
  effect: '#8b5cf6',
  text: '#ec4899',
  subtitle: '#ec4899',
  video: '#3b82f6',
  audio: '#22c55e',
}

const trackLabels: Record<string, string> = {
  filter: 'Filtro',
  effect: 'Efeito',
  text: 'Texto',
  subtitle: 'Legenda',
  video: 'Vídeo',
  audio: 'Áudio',
}

export default function TimelinePreview({ tracks, selectedAudioTrack }: TimelinePreviewProps) {
  const sortedTracks = useMemo(() => {
    const order = ['filter', 'effect', 'text', 'subtitle', 'video', 'audio']
    return [...tracks].sort((a, b) => {
      const aOrder = order.indexOf(a.type)
      const bOrder = order.indexOf(b.type)
      return aOrder - bOrder
    })
  }, [tracks])

  const maxDuration = useMemo(() => {
    return Math.max(...tracks.map(t => t.duration), 1)
  }, [tracks])

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  if (tracks.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-text-muted text-sm">
        Selecione e analise um projeto para ver a timeline
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Tracks */}
      <div className="space-y-1.5">
        {sortedTracks.map((track) => {
          const width = (track.duration / maxDuration) * 100
          const isSelected = track.type === 'audio' && track.index === selectedAudioTrack
          const color = trackColors[track.type] || '#666'

          return (
            <div key={track.index} className="flex items-center gap-3">
              {/* Track label */}
              <div className="w-20 text-right">
                <span className="text-[10px] text-text-muted truncate">
                  {track.name || trackLabels[track.type]}
                </span>
              </div>

              {/* Track bar */}
              <div className="flex-1 h-4 bg-white/5 rounded relative overflow-hidden">
                <div
                  className={`h-full rounded transition-all duration-300 ${isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background-dark' : ''}`}
                  style={{
                    width: `${width}%`,
                    backgroundColor: color,
                    opacity: isSelected ? 1 : 0.7,
                  }}
                />
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-end pr-2">
                    <span className="text-[9px] font-bold text-white drop-shadow">REF</span>
                  </div>
                )}
              </div>

              {/* Segments count */}
              <div className="w-12 text-right">
                <span className="text-[10px] text-text-muted">{track.segments} seg</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Time ruler */}
      <div className="flex items-center gap-3 pt-2 border-t border-border-light mt-2">
        <div className="w-20" />
        <div className="flex-1 flex justify-between">
          <span className="text-[10px] text-text-muted">0:00</span>
          <span className="text-[10px] text-text-muted">{formatDuration(maxDuration)}</span>
        </div>
        <div className="w-12" />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-2">
        {Object.entries(trackColors).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-text-muted">{trackLabels[type]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
