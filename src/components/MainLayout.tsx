import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, RefreshCw, FileText, HelpCircle, LogOut, FolderOpen, ChevronRight, Minus, Square, X, Download, ExternalLink, User as UserIcon, Crown, Undo2 } from 'lucide-react'
import type { User, TrackInfo, LogEntry } from '../types'
import TimelinePreview from './TimelinePreview'
import SyncPanel from './panels/SyncPanel'
import LoopPanel from './panels/LoopPanel'
import SrtPanel from './panels/SrtPanel'
import LogConsole from './LogConsole'
import HelpModal from './HelpModal'

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
  const [appVersion, setAppVersion] = useState('2.0.0')
  const [updateAvailable, setUpdateAvailable] = useState<{ version: string; downloadUrl: string } | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: '1', type: 'info', message: 'CapCut Sync Pro v2.0 iniciado', timestamp: new Date() }
  ])
  const [logCounter, setLogCounter] = useState(1)

  // Cores iguais aos elementos do CapCut
  const tabs = [
    { id: 'sync' as const, label: 'SYNC', icon: Zap, hexColor: '#175d62' },      // Verde/Teal (vídeo)
    { id: 'loop' as const, label: 'LOOP', icon: RefreshCw, hexColor: '#0e3058' }, // Azul escuro (áudio)
    { id: 'srt' as const, label: 'SRT', icon: FileText, hexColor: '#9c4937' },    // Marrom (legenda)
  ]

  // Calcular dias restantes de trial
  const trialDaysRemaining = user.proActivatedBy === 'trial' && user.trialExpiresAt
    ? Math.max(0, Math.ceil((new Date(user.trialExpiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : -1

  // Check for updates on mount
  useEffect(() => {
    async function checkUpdates() {
      if (!ipcRenderer) return
      try {
        const version = await ipcRenderer.invoke('get-app-version')
        setAppVersion(version)

        const updateInfo = await ipcRenderer.invoke('check-for-updates')
        if (updateInfo.hasUpdate) {
          setUpdateAvailable({ version: updateInfo.version, downloadUrl: updateInfo.downloadUrl })
          addLog('info', `Nova versão disponível: v${updateInfo.version}`)
        }
      } catch (e) {
        console.error('Error checking updates:', e)
      }
    }
    checkUpdates()
  }, [])

  // Check if can undo when draftPath changes
  useEffect(() => {
    async function checkUndoAvailable() {
      if (!ipcRenderer || !draftPath) {
        setCanUndo(false)
        return
      }
      try {
        const result = await ipcRenderer.invoke('check-backup', draftPath)
        setCanUndo(result.hasBackup)
      } catch {
        setCanUndo(false)
      }
    }
    checkUndoAvailable()
  }, [draftPath])

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

  // Análise automática após selecionar pasta
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

      // Analisar automaticamente
      setIsLoading(true)
      addLog('info', 'Analisando projeto automaticamente...')
      const analyzeResult = await ipcRenderer.invoke('analyze-project', result.draftPath)
      if (analyzeResult.error) {
        addLog('error', analyzeResult.error)
      } else {
        setTracks(analyzeResult.tracks)
        const firstAudioIndex = analyzeResult.tracks.findIndex((t: TrackInfo) => t.type === 'audio')
        if (firstAudioIndex >= 0) setSelectedAudioTrack(firstAudioIndex)
        addLog('success', 'Projeto analisado: ' + analyzeResult.tracks.length + ' tracks encontradas')
      }
      setIsLoading(false)
    } catch (error) {
      addLog('error', 'Erro: ' + error)
      setIsLoading(false)
    }
  }

  const handleReanalyze = async () => {
    if (!draftPath || !ipcRenderer) return
    setIsLoading(true)
    addLog('info', 'Reanalisando projeto...')
    try {
      const result = await ipcRenderer.invoke('analyze-project', draftPath)
      if (result.error) { addLog('error', result.error); setIsLoading(false); return }
      setTracks(result.tracks)
      addLog('success', 'Projeto reanalisado: ' + result.tracks.length + ' tracks')
      // Check if undo is available
      const backupCheck = await ipcRenderer.invoke('check-backup', draftPath)
      setCanUndo(backupCheck.hasBackup)
    } catch (error) { addLog('error', 'Erro: ' + error) }
    setIsLoading(false)
  }

  const handleUndo = async () => {
    if (!draftPath || !ipcRenderer || !canUndo) return
    addLog('info', 'Desfazendo última modificação...')
    try {
      const result = await ipcRenderer.invoke('undo-changes', draftPath)
      if (result.error) {
        addLog('error', result.error)
      } else {
        addLog('success', 'Modificação desfeita com sucesso!')
        setCanUndo(false)
        handleReanalyze()
      }
    } catch (error) {
      addLog('error', 'Erro ao desfazer: ' + error)
    }
  }

  const handleUpdate = async () => {
    if (!updateAvailable || !ipcRenderer) return
    addLog('info', 'Baixando atualização...')
    const result = await ipcRenderer.invoke('download-update', updateAvailable.downloadUrl)
    if (!result.success) {
      addLog('error', 'Erro ao baixar: ' + result.error)
    }
  }

  // Callback para selecionar track clicando no preview
  const handleTrackClick = (trackIndex: number, trackType: string) => {
    if (trackType === 'audio') {
      setSelectedAudioTrack(trackIndex)
      addLog('info', `Áudio de referência alterado para track ${trackIndex}`)
    }
  }

  const audioTracks = tracks.filter(t => t.type === 'audio')

  return (
    <div className="h-screen w-screen bg-background-dark flex flex-col overflow-hidden">
      {/* Titlebar */}
      <div className="drag-region h-10 bg-background-dark-alt border-b border-border-light flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2 no-drag">
          <img src={require('../assets/icon.png')} alt="Logo" className="w-5 h-5 rounded" />
          <span className="text-xs font-medium text-white">CapCut Sync Pro</span>
          <span className="badge text-[10px] py-0.5 px-1.5">v{appVersion}</span>
          {updateAvailable && (
            <button
              onClick={handleUpdate}
              className="flex items-center gap-1 text-[10px] text-green-400 hover:text-green-300 transition-colors"
              title={`Atualizar para v${updateAvailable.version}`}
            >
              <Download className="w-3 h-3" />
              v{updateAvailable.version}
            </button>
          )}
        </div>

        {/* User info */}
        <div className="flex items-center gap-2 no-drag">
          {/* User name and plan */}
          <div className="flex items-center gap-2 mr-2 px-2 py-1 bg-white/5 rounded-lg">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-5 h-5 rounded-full" />
            ) : (
              <UserIcon className="w-4 h-4 text-text-muted" />
            )}
            <div className="flex flex-col">
              <span className="text-[10px] text-white font-medium leading-tight">
                {user.displayName || user.email?.split('@')[0] || 'Usuário'}
              </span>
              <span className="text-[9px] text-text-muted leading-tight flex items-center gap-1">
                {trialDaysRemaining >= 0 ? (
                  <>
                    <span className="text-yellow-400">Trial</span>
                    <span>• {trialDaysRemaining} dias</span>
                  </>
                ) : (
                  <>
                    <Crown className="w-3 h-3 text-primary" />
                    <span className="text-primary">PRO</span>
                  </>
                )}
              </span>
            </div>
          </div>

          <button onClick={onLogout} className="p-1.5 hover:bg-white/10 rounded transition-colors" title="Sair">
            <LogOut className="w-4 h-4 text-text-secondary" />
          </button>
          <div className="flex items-center ml-1 border-l border-border-light pl-1">
            <button onClick={handleMinimize} className="p-1.5 hover:bg-white/10 rounded transition-colors" title="Minimizar">
              <Minus className="w-4 h-4 text-text-secondary" />
            </button>
            <button onClick={handleMaximize} className="p-1.5 hover:bg-white/10 rounded transition-colors" title="Maximizar">
              <Square className="w-3.5 h-3.5 text-text-secondary" />
            </button>
            <button onClick={handleClose} className="p-1.5 hover:bg-red-500/80 rounded transition-colors" title="Fechar">
              <X className="w-4 h-4 text-text-secondary" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Sidebar */}
        <div className="w-16 bg-background-dark-alt border-r border-border-light flex flex-col items-center py-2 gap-1 flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all duration-200 ${
                activeTab === tab.id
                  ? 'border'
                  : 'hover:bg-white/5 border border-transparent'
              }`}
              style={activeTab === tab.id ? {
                backgroundColor: `${tab.hexColor}30`,
                borderColor: `${tab.hexColor}80`
              } : {}}
            >
              <tab.icon
                className="w-4 h-4"
                style={{ color: activeTab === tab.id ? tab.hexColor : '#A3A3A3' }}
              />
              <span className={`text-[9px] font-medium ${activeTab === tab.id ? 'text-white' : 'text-text-muted'}`}>
                {tab.label}
              </span>
            </button>
          ))}

          <div className="flex-1" />

          {/* Credits */}
          <button
            onClick={() => ipcRenderer?.invoke('open-external', 'https://nardoto.com')}
            className="w-12 h-10 rounded-lg flex flex-col items-center justify-center hover:bg-white/5 transition-colors"
            title="Desenvolvido por Nardoto"
          >
            <ExternalLink className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-[8px] text-text-muted">nardoto</span>
          </button>

          {/* Help button - opens internal modal */}
          <button
            onClick={() => setShowHelp(true)}
            className="w-12 h-10 rounded-lg flex flex-col items-center justify-center hover:bg-white/5 transition-colors"
            title="Como usar"
          >
            <HelpCircle className="w-4 h-4 text-text-secondary" />
            <span className="text-[8px] text-text-muted">Ajuda</span>
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Project selector */}
          <div className="p-2 border-b border-border-light flex-shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectFolder}
                disabled={isLoading}
                className="btn-secondary py-1.5 px-3 flex items-center gap-1.5 text-xs"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                {isLoading ? 'Analisando...' : 'Selecionar Projeto'}
              </button>

              {projectPath && (
                <div className="flex items-center gap-1 text-xs">
                  <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-white font-medium truncate max-w-[200px]">{projectName}</span>
                  <span className="text-text-muted">({tracks.length} tracks)</span>
                </div>
              )}

              {/* Undo button */}
              {canUndo && (
                <button
                  onClick={handleUndo}
                  className="ml-auto btn-secondary py-1.5 px-3 flex items-center gap-1.5 text-xs text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10"
                  title="Desfazer última modificação"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  Desfazer
                </button>
              )}
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Timeline & Panel */}
            <div className="flex-1 flex flex-col overflow-hidden p-2 gap-2 min-h-0">
              {/* Timeline Preview */}
              <div className="card p-2 flex-shrink-0">
                <h3 className="text-[10px] font-semibold text-text-secondary mb-1">PREVIEW DA TIMELINE (clique para selecionar referência)</h3>
                <TimelinePreview
                  tracks={tracks}
                  selectedAudioTrack={selectedAudioTrack}
                  onTrackClick={handleTrackClick}
                />
              </div>

              {/* Panel content */}
              <div className="flex-1 card overflow-hidden min-h-0">
                <AnimatePresence mode="wait">
                  {activeTab === 'sync' && (
                    <motion.div
                      key="sync"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="h-full overflow-auto"
                    >
                      <SyncPanel
                        tracks={tracks}
                        audioTracks={audioTracks}
                        selectedAudioTrack={selectedAudioTrack}
                        onSelectAudioTrack={setSelectedAudioTrack}
                        onLog={addLog}
                        draftPath={draftPath}
                        onReanalyze={handleReanalyze}
                      />
                    </motion.div>
                  )}
                  {activeTab === 'loop' && (
                    <motion.div
                      key="loop"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="h-full overflow-auto"
                    >
                      <LoopPanel
                        tracks={tracks}
                        audioTracks={audioTracks}
                        selectedAudioTrack={selectedAudioTrack}
                        onLog={addLog}
                        draftPath={draftPath}
                        onReanalyze={handleReanalyze}
                      />
                    </motion.div>
                  )}
                  {activeTab === 'srt' && (
                    <motion.div
                      key="srt"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="h-full overflow-auto"
                    >
                      <SrtPanel onLog={addLog} draftPath={draftPath} onReanalyze={handleReanalyze} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Log Console */}
            <div className="w-64 border-l border-border-light flex-shrink-0">
              <LogConsole logs={logs} />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="h-5 bg-background-dark-alt border-t border-border-light flex items-center justify-center px-3 flex-shrink-0">
        <span className="text-[9px] text-text-muted">
          Desenvolvido por <button onClick={() => ipcRenderer?.invoke('open-external', 'https://nardoto.com')} className="text-primary hover:underline">Nardoto</button>
        </span>
      </div>

      {/* Help Modal */}
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  )
}
