import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, RefreshCw, FileText, HelpCircle, LogOut, FolderOpen, ChevronRight, Minus, Square, X, Search } from 'lucide-react'
import type { User, TrackInfo, LogEntry } from '../types'
import TimelinePreview from './TimelinePreview'
import SyncPanel from './panels/SyncPanel'
import LoopPanel from './panels/LoopPanel'
import SrtPanel from './panels/SrtPanel'
import LogConsole from './LogConsole'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }
interface MainLayoutProps {
  user: User
  onLogout: () => void
}

type TabType = 'sync' | 'loop' | 'srt'

export default function MainLayout({ user, onLogout }: MainLayoutProps) {
  const [activeTab, setActiveTab] = useState<TabType>('sync')
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [projectName, setProjectName] = useState<string | null>(null)
  const [draftPath, setDraftPath] = useState<string | null>(null)
  const [tracks, setTracks] = useState<TrackInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number>(0)
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: '1', type: 'info', message: 'CapCut Sync Pro iniciado', timestamp: new Date() }
  ])
  const [logCounter, setLogCounter] = useState(1)

  const tabs = [
    { id: 'sync' as const, label: 'SYNC', icon: Zap, color: 'text-green-400' },
    { id: 'loop' as const, label: 'LOOP', icon: RefreshCw, color: 'text-blue-400' },
    { id: 'srt' as const, label: 'SRT', icon: FileText, color: 'text-pink-400' },
  ]

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogCounter(c => c + 1)
    setLogs(prev => [...prev, {
      id: `${Date.now()}-${logCounter}`,
      type,
      message,
      timestamp: new Date()
    }])
  }

  const handleMinimize = () => ipcRenderer?.invoke('window-minimize')
  const handleMaximize = () => ipcRenderer?.invoke('window-maximize')
  const handleClose = () => ipcRenderer?.invoke('window-close')

  const handleSelectFolder = async () => {
    if (!ipcRenderer) { addLog('error', 'Electron IPC not available'); return }
    addLog('info', 'Selecionando pasta do projeto...')
    try {
      const result = await ipcRenderer.invoke('select-folder')
      if (!result) { addLog('warning', 'Seleção cancelada'); return }
      if (result.error) { addLog('error', result.error); return }
      setProjectPath(result.path)
      setProjectName(result.name)
      setDraftPath(result.draftPath)
      addLog('success', 'Pasta selecionada: ' + result.name)
    } catch (error) { addLog('error', 'Erro: ' + error) }
  }

  const handleAnalyze = async () => {
    if (!draftPath || !ipcRenderer) return
    setIsLoading(true)
    addLog("info", "Analisando projeto...")
    try {
      const result = await ipcRenderer.invoke("analyze-project", draftPath)
      if (result.error) { addLog("error", result.error); setIsLoading(false); return }
      setTracks(result.tracks)
      const firstAudioIndex = result.tracks.findIndex((t) => t.type === "audio")
      if (firstAudioIndex >= 0) setSelectedAudioTrack(firstAudioIndex)
      addLog("success", "Projeto analisado: " + result.tracks.length + " tracks encontradas")
    } catch (error) { addLog("error", "Erro: " + error) }
    setIsLoading(false)
  }

  const audioTracks = tracks.filter(t => t.type === 'audio')

  return (
    <div className="h-screen w-screen bg-background-dark flex flex-col overflow-hidden">
      {/* Titlebar */}
      <div className="drag-region h-10 bg-background-dark-alt border-b border-border-light flex items-center justify-between px-4">
        <div className="flex items-center gap-3 no-drag">
          <img src={require('../assets/icon.png')} alt="Logo" className="w-6 h-6 rounded" />
          <span className="text-sm font-medium text-white">CapCut Sync Pro</span>
          <span className="badge text-xs py-0.5 px-2">v1.0.0</span>
        </div>

        <div className="flex items-center gap-2 no-drag">
          <span className="text-text-secondary text-xs mr-2">{user.email}</span>
          <button onClick={onLogout} className="p-1.5 hover:bg-white/10 rounded transition-colors" title="Sair">
            <LogOut className="w-4 h-4 text-text-secondary" />
          </button>
          <div className="flex items-center ml-2 border-l border-border-light pl-2">
            <button onClick={handleMinimize} className="p-2 hover:bg-white/10 rounded transition-colors" title="Minimizar">
              <Minus className="w-4 h-4 text-text-secondary" />
            </button>
            <button onClick={handleMaximize} className="p-2 hover:bg-white/10 rounded transition-colors" title="Maximizar">
              <Square className="w-3.5 h-3.5 text-text-secondary" />
            </button>
            <button onClick={handleClose} className="p-2 hover:bg-red-500/80 rounded transition-colors" title="Fechar">
              <X className="w-4 h-4 text-text-secondary" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-20 bg-background-dark-alt border-r border-border-light flex flex-col items-center py-4 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-primary/20 border border-primary/50'
                  : 'hover:bg-white/5 border border-transparent'
              }`}
            >
              <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? tab.color : 'text-text-secondary'}`} />
              <span className={`text-[10px] font-medium ${activeTab === tab.id ? 'text-white' : 'text-text-muted'}`}>
                {tab.label}
              </span>
            </button>
          ))}

          <div className="flex-1" />

          <button
            onClick={() => ipcRenderer?.invoke('open-external', 'https://github.com/nardoto/capcut-sync-pro')}
            className="w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-white/5 transition-colors"
            title="Ajuda e documentação"
          >
            <HelpCircle className="w-5 h-5 text-text-secondary" />
            <span className="text-[10px] text-text-muted">Ajuda</span>
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Project selector */}
          <div className="p-4 border-b border-border-light">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectFolder}
                className="btn-secondary py-2 px-4 flex items-center gap-2 text-sm"
              >
                <FolderOpen className="w-4 h-4" />
                Selecionar Projeto
              </button>

              {projectPath && (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                    <span className="text-white font-medium">{projectName}</span>
                  </div>
                  <button
                    onClick={handleAnalyze}
                    disabled={isLoading}
                    className="btn-primary py-3 px-6 text-base ml-auto flex items-center gap-2 font-bold"
                  >
                    <Search className="w-5 h-5" />
                    {isLoading ? 'Analisando...' : 'ANALISAR PROJETO'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 flex overflow-hidden">
            {/* Timeline & Panel */}
            <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
              {/* Timeline Preview */}
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-text-secondary mb-3">PREVIEW DA TIMELINE</h3>
                <TimelinePreview
                  tracks={tracks}
                  selectedAudioTrack={selectedAudioTrack}
                />
              </div>

              {/* Panel content */}
              <div className="flex-1 card overflow-auto">
                <AnimatePresence mode="wait">
                  {activeTab === 'sync' && (
                    <motion.div
                      key="sync"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                    >
                      <SyncPanel
                        tracks={tracks}
                        audioTracks={audioTracks}
                        selectedAudioTrack={selectedAudioTrack}
                        onSelectAudioTrack={setSelectedAudioTrack}
                        onLog={addLog}
                        draftPath={draftPath}
                        onReanalyze={handleAnalyze}
                      />
                    </motion.div>
                  )}
                  {activeTab === 'loop' && (
                    <motion.div
                      key="loop"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                    >
                      <LoopPanel
                        tracks={tracks}
                        audioTracks={audioTracks}
                        selectedAudioTrack={selectedAudioTrack}
                        onLog={addLog}
                        draftPath={draftPath}
                        onReanalyze={handleAnalyze}
                      />
                    </motion.div>
                  )}
                  {activeTab === 'srt' && (
                    <motion.div
                      key="srt"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                    >
                      <SrtPanel onLog={addLog} draftPath={draftPath} onReanalyze={handleAnalyze} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Log Console */}
            <div className="w-80 border-l border-border-light">
              <LogConsole logs={logs} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
