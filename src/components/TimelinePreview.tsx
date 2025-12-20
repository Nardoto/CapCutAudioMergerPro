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

interface EnrichedSegment {
  id?: string
  material_id?: string
  target_timerange?: { start: number; duration: number }
  text?: string
  materialName?: string
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

  // Check if track should show individual segments (text/subtitle tracks)
  const shouldShowSegments = (type: string) => ['text', 'subtitle'].includes(type)

  return (
    <div className="space-y-2">
      {/* Tracks */}
      <div className="space-y-1.5">
        {sortedTracks.map((track) => {
          const isSelected = track.type === 'audio' && track.index === selectedAudioTrack
          const color = trackColors[track.type] || '#666'
          const showSegments = shouldShowSegments(track.type)
          const segments = (track.segmentsData || []) as EnrichedSegment[]

          return (
            <div key={track.index} className="flex items-center gap-3">
              {/* Track label */}
              <div className="w-24 text-right pr-2">
                <span className="text-[10px] text-text-muted truncate block">
                  {track.name || trackLabels[track.type]}
                </span>
              </div>

              {/* Track bar */}
              <div className="flex-1 h-5 bg-white/5 rounded relative overflow-hidden">
                {showSegments && segments.length > 0 ? (
                  // Show individual segments for text/subtitle tracks
                  <div className="absolute inset-0 flex">
                    {segments.map((seg, idx) => {
                      const start = seg.target_timerange?.start || 0
                      const duration = seg.target_timerange?.duration || 0
                      const left = (start / maxDuration) * 100
                      const width = (duration / maxDuration) * 100
                      const displayText = seg.text || seg.materialName || `Seg ${idx + 1}`
                      // Truncate text to fit
                      const truncatedText = displayText.length > 20 ? displayText.substring(0, 17) + '...' : displayText

                      return (
                        <div
                          key={seg.id || idx}
                          className="absolute h-full flex items-center overflow-hidden rounded-sm border-r border-background-dark"
                          style={{
                            left: `${left}%`,
                            width: `${Math.max(width, 0.5)}%`,
                            backgroundColor: color,
                            opacity: 0.85,
                          }}
                          title={displayText}
                        >
                          <span className="text-[8px] text-white px-1 truncate font-medium drop-shadow-sm">
                            {truncatedText}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  // Solid bar for other track types
                  <>
                    <div
                      className={`h-full rounded transition-all duration-300 ${isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background-dark' : ''}`}
                      style={{
                        width: `${(track.duration / maxDuration) * 100}%`,
                        backgroundColor: color,
                        opacity: isSelected ? 1 : 0.7,
                      }}
                    />
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-end pr-2">
                        <span className="text-[9px] font-bold text-white drop-shadow">REF</span>
                      </div>
                    )}
                  </>
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
        <div className="w-24" />
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
