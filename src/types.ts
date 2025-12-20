// User types
export interface User {
  uid: string
  email: string
  displayName: string | null
  photoURL: string | null
  isPro: boolean
  proActivatedBy?: string
  proActivatedAt?: string
  trialExpiresAt?: string
}

// CapCut Project types
export interface CapCutProject {
  tracks: Track[]
  materials: Materials
  duration: number
}

export interface Track {
  type: TrackType
  segments: Segment[]
}

export type TrackType = 'video' | 'audio' | 'text' | 'subtitle' | 'effect' | 'filter'

export interface Segment {
  id: string
  material_id: string
  target_timerange: TimeRange
  source_timerange?: TimeRange
}

export interface TimeRange {
  start: number
  duration: number
}

export interface Materials {
  videos?: Material[]
  audios?: Material[]
  texts?: Material[]
  effects?: Material[]
  [key: string]: Material[] | undefined
}

export interface Material {
  id: string
  name?: string
  path?: string
  type?: string
}

// Track info for UI
export interface TrackInfo {
  index: number
  type: TrackType
  segments: number
  duration: number
  durationSec: number
  name: string
  segmentsData: Segment[]
}

// App state
export interface ProjectState {
  path: string | null
  name: string | null
  tracks: TrackInfo[]
  isLoaded: boolean
  isLoading: boolean
  error: string | null
}

// Sync options
export interface SyncOptions {
  audioTrackIndex: number
  mode: 'audio' | 'subtitle'
  applyAnimations: boolean
  syncSubtitles: boolean
}

// Loop options
export interface LoopOptions {
  audioTrackIndex: number
  order: 'sequential' | 'random'
}

// Log entry
export interface LogEntry {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  timestamp: Date
}

// IPC channels
export type IpcChannels =
  | 'select-folder'
  | 'analyze-project'
  | 'sync-project'
  | 'loop-media'
  | 'loop-audio'
  | 'check-capcut'
  | 'open-external'
