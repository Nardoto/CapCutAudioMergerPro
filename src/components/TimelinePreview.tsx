import { useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import type { TrackInfo } from '../types'

interface TimelinePreviewProps {
  tracks: TrackInfo[]
  selectedAudioTrack: number
  onTrackClick?: (trackIndex: number, trackType: string) => void
  onDeleteTrack?: (trackIndex: number) => void
  activeTab?: string
  mediaInsertMode?: 'video_image' | 'audio'
}

// Cores exatas do CapCut (extraídas da interface)
const trackColors: Record<string, string> = {
  video: '#175d62',      // Verde escuro/Teal
  audio: '#0e3058',      // Azul escuro
  text: '#9c4937',       // Marrom/vermelho
  subtitle: '#9c4937',   // Marrom/vermelho (igual texto)
  effect: '#744a82',     // Roxo claro
  filter: '#47418b',     // Roxo escuro
  sticker: '#47418b',    // Roxo escuro
}

const trackLabels: Record<string, string> = {
  video: 'Vídeo',
  audio: 'Áudio',
  text: 'Texto',
  subtitle: 'Legenda',
  effect: 'Efeito',
  filter: 'Filtro',
  sticker: 'Sticker',
}

interface EnrichedSegment {
  id?: string
  material_id?: string
  target_timerange?: { start: number; duration: number }
  text?: string
  materialName?: string
}

export default function TimelinePreview({ tracks, selectedAudioTrack, onTrackClick, onDeleteTrack, activeTab, mediaInsertMode }: TimelinePreviewProps) {

  // Find first video track index for highlighting
  const firstVideoTrackIndex = useMemo(() => {
    const videoTrack = tracks.find(t => t.type === 'video')
    return videoTrack?.index ?? -1
  }, [tracks])

  const sortedTracks = useMemo(() => {
    const order = ['filter', 'effect', 'sticker', 'text', 'subtitle', 'video', 'audio']
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
      <div className="h-24 flex items-center justify-center text-text-muted text-sm">
        Selecione e analise um projeto para ver a timeline
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {/* Tracks */}
      <div className="space-y-1">
        {sortedTracks.map((track) => {
          // Determine if this track should be highlighted
          const isInMediaTab = activeTab === 'media'
          const isVideoMode = mediaInsertMode === 'video_image'
          const isAudioMode = mediaInsertMode === 'audio'

          // Highlight video track when in media tab with video/image mode
          const isVideoHighlighted = isInMediaTab && isVideoMode && track.type === 'video' && track.index === firstVideoTrackIndex
          // Highlight audio track when in media tab with audio mode OR in other tabs (sync, loop)
          const isAudioHighlighted = track.type === 'audio' && track.index === selectedAudioTrack &&
            (!isInMediaTab || (isInMediaTab && isAudioMode))

          const isSelected = isVideoHighlighted || isAudioHighlighted
          const highlightLabel = isVideoHighlighted ? 'VIDEO' : (isAudioHighlighted ? 'REF' : null)

          const color = trackColors[track.type] || '#666'
          const segments = (track.segmentsData || []) as EnrichedSegment[]

          const isClickable = track.type === 'audio' && onTrackClick

          return (
            <div
              key={track.index}
              className={`flex items-center gap-2 py-0.5 rounded-lg transition-all group ${isClickable ? 'cursor-pointer' : ''} hover:bg-white/5`}
              onClick={() => isClickable && onTrackClick(track.index, track.type)}
              title={isClickable ? 'Clique para selecionar como referência' : undefined}
            >
              {/* Track label */}
              <div className="w-20 text-right pr-1 flex-shrink-0 h-4 flex items-center justify-end">
                <span className="text-[9px] text-text-muted truncate block" title={track.name || trackLabels[track.type]}>
                  {(track.name || trackLabels[track.type]).substring(0, 12)}
                </span>
              </div>

              {/* Track bar - show ALL segments for ALL types */}
              <div className={`flex-1 h-4 bg-white/5 rounded relative overflow-hidden group/bar ${isSelected ? 'ring-2 ring-primary shadow-[0_0_12px] shadow-primary/50' : ''}`}>
                {segments.length > 0 ? (
                  <div className="absolute inset-0">
                    {segments.map((seg, idx) => {
                      const start = seg.target_timerange?.start || 0
                      const duration = seg.target_timerange?.duration || 0
                      const left = (start / maxDuration) * 100
                      const width = (duration / maxDuration) * 100

                      // Display text based on track type
                      let displayText = ''
                      if (['text', 'subtitle'].includes(track.type)) {
                        displayText = seg.text || seg.materialName || ''
                      } else {
                        displayText = seg.materialName || ''
                      }

                      // Truncate based on segment width
                      const maxChars = Math.max(3, Math.floor(width * 0.8))
                      const truncatedText = displayText.length > maxChars
                        ? displayText.substring(0, maxChars - 2) + '..'
                        : displayText

                      return (
                        <div
                          key={seg.id || idx}
                          className="absolute h-full flex items-center overflow-hidden"
                          style={{
                            left: `${left}%`,
                            width: `${Math.max(width, 0.3)}%`,
                            backgroundColor: color,
                            opacity: 1,
                            borderRight: '1px solid rgba(0,0,0,0.3)',
                          }}
                          title={displayText || `Segmento ${idx + 1}`}
                        >
                          {width > 2 && (
                            <span className="text-[7px] text-white px-0.5 truncate font-medium drop-shadow-sm">
                              {truncatedText}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  // Fallback: solid bar if no segments data
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${(track.duration / maxDuration) * 100}%`,
                      backgroundColor: color,
                      opacity: 1,
                    }}
                  />
                )}
                {isSelected && highlightLabel && (
                  <div className="absolute inset-0 flex items-center justify-end pr-6 pointer-events-none">
                    <span className={`text-[9px] font-bold text-white px-1.5 py-0.5 rounded shadow-lg border border-white/30 ${
                      highlightLabel === 'VIDEO' ? 'bg-green-600' : 'bg-primary'
                    }`}>{highlightLabel}</span>
                  </div>
                )}
                {/* Delete button on bar */}
                {onDeleteTrack && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteTrack(track.index) }}
                    className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 bg-red-500/80 hover:bg-red-500 rounded text-white transition-all opacity-0 group-hover:opacity-100 z-20"
                    title="Apagar track"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Segments count */}
              <div className="w-10 text-right flex-shrink-0">
                <span className="text-[9px] text-text-muted">{track.segments}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Time ruler */}
      <div className="flex items-center gap-2 pt-1 border-t border-border-light mt-1">
        <div className="w-20" />
        <div className="flex-1 flex justify-between">
          <span className="text-[9px] text-text-muted">0:00</span>
          <span className="text-[9px] text-text-muted">{formatDuration(maxDuration)}</span>
        </div>
        <div className="w-10" />
      </div>

      {/* Legend - compact */}
      <div className="flex flex-wrap gap-2 pt-1">
        {Object.entries(trackColors).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-[8px] text-text-muted">{trackLabels[type]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
