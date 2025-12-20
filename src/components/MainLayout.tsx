import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, RefreshCw, FileText, HelpCircle, LogOut, FolderOpen, ChevronRight, Minus, Square, X, Download, ExternalLink, User as UserIcon, Crown, Undo2, Search, Clock, ChevronDown, Trash2, History } from 'lucide-react'
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
  const [showProjectPicker, setShowProjectPicker] = useState(false)
  const [capCutProjects, setCapCutProjects] = useState<Array<{ name: string; path: string; draftPath: string; modifiedAt: string }>>([])
  const [showBackupDropdown, setShowBackupDropdown] = useState(false)
  const [backups, setBackups] = useState<Array<{ filename: string; displayDate: string; timestamp: number }>>([])
  const [backupCount, setBackupCount] = useState(0)
  const backupDropdownRef = useRef<HTMLDivElement>(null)
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

  // Load backups when draftPath changes
  useEffect(() => {
    async function loadBackups() {
      if (!ipcRenderer || !draftPath) {
        setCanUndo(false)
        setBackups([])
        setBackupCount(0)
        return
      }
      try {
        const result = await ipcRenderer.invoke('list-backups', draftPath)
        setBackups(result.backups || [])
        setBackupCount(result.count || 0)
        setCanUndo(result.count > 0)
      } catch {
        setCanUndo(false)
        setBackups([])
        setBackupCount(0)
      }
    }
    loadBackups()
  }, [draftPath])

  // Refresh backups list
  const refreshBackups = async () => {
    if (!ipcRenderer || !draftPath) return
    try {
      const result = await ipcRenderer.invoke('list-backups', draftPath)
      setBackups(result.backups || [])
      setBackupCount(result.count || 0)
      setCanUndo(result.count > 0)
    } catch {
      setCanUndo(false)
    }
  }

  // Close backup dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (backupDropdownRef.current && !backupDropdownRef.current.contains(event.target as Node)) {
        setShowBackupDropdown(false)
      }
    }
    if (showBackupDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showBackupDropdown])

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
      // Refresh backup list
      await refreshBackups()
    } catch (error) { addLog('error', 'Erro: ' + error) }
    setIsLoading(false)
  }

  const handleUndo = async (backupFilename?: string) => {
    if (!draftPath || !ipcRenderer || !canUndo) return
    addLog('info', backupFilename ? `Restaurando backup: ${backupFilename}` : 'Desfazendo última modificação...')
    setShowBackupDropdown(false)
    try {
      const result = await ipcRenderer.invoke('undo-changes', draftPath, backupFilename)
      if (result.error) {
        addLog('error', result.error)
      } else {
        addLog('success', `Restaurado: ${result.restored}`)
        await refreshBackups()
        handleReanalyze()
      }
    } catch (error) {
      addLog('error', 'Erro ao desfazer: ' + error)
    }
  }

  const handleDeleteBackup = async (backupFilename: string) => {
    if (!draftPath || !ipcRenderer) return
    try {
      await ipcRenderer.invoke('delete-backup', draftPath, backupFilename)
      addLog('info', `Backup removido: ${backupFilename}`)
      await refreshBackups()
    } catch (error) {
      addLog('error', 'Erro ao remover backup: ' + error)
    }
  }

  const handleDeleteAllBackups = async () => {
    if (!draftPath || !ipcRenderer) return
    try {
      const result = await ipcRenderer.invoke('delete-all-backups', draftPath)
      addLog('success', `${result.deleted} backups removidos`)
      setShowBackupDropdown(false)
      await refreshBackups()
    } catch (error) {
      addLog('error', 'Erro ao remover backups: ' + error)
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

  // Detectar projetos do CapCut automaticamente
  const handleDetectCapCut = async () => {
    if (!ipcRenderer) { addLog('error', 'Electron IPC not available'); return }
    addLog('info', 'Detectando projetos do CapCut...')

    try {
      const result = await ipcRenderer.invoke('detect-capcut-folder')
      if (result.error) {
        addLog('error', result.error)
        return
      }

      if (result.projects.length === 0) {
        addLog('warning', 'Nenhum projeto encontrado na pasta do CapCut')
        return
      }

      setCapCutProjects(result.projects)
      setShowProjectPicker(true)
      addLog('success', `${result.count} projetos encontrados!`)
    } catch (error) {
      addLog('error', 'Erro ao detectar: ' + error)
    }
  }

  // Selecionar projeto da lista
  const handleSelectProject = async (project: { name: string; path: string; draftPath: string }) => {
    setShowProjectPicker(false)
    setProjectPath(project.path)
    setProjectName(project.name)
    setDraftPath(project.draftPath)
    addLog('success', 'Projeto selecionado: ' + project.name)

    // Analisar automaticamente
    setIsLoading(true)
    addLog('info', 'Analisando projeto automaticamente...')
    try {
      const analyzeResult = await ipcRenderer?.invoke('analyze-project', project.draftPath)
      if (analyzeResult.error) {
        addLog('error', analyzeResult.error)
      } else {
        setTracks(analyzeResult.tracks)
        const firstAudioIndex = analyzeResult.tracks.findIndex((t: TrackInfo) => t.type === 'audio')
        if (firstAudioIndex >= 0) setSelectedAudioTrack(firstAudioIndex)
        addLog('success', 'Projeto analisado: ' + analyzeResult.tracks.length + ' tracks encontradas')
      }
    } catch (error) {
      addLog('error', 'Erro: ' + error)
    }
    setIsLoading(false)
  }

  // Formatar data relativa
  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'agora'
    if (diffMins < 60) return `${diffMins}min atrás`
    if (diffHours < 24) return `${diffHours}h atrás`
    if (diffDays < 7) return `${diffDays}d atrás`
    return date.toLocaleDateString('pt-BR')
  }

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
                onClick={handleDetectCapCut}
                disabled={isLoading}
                className="btn-primary py-1.5 px-3 flex items-center gap-1.5 text-xs"
                title="Detectar projetos do CapCut automaticamente"
              >
                <Search className="w-3.5 h-3.5" />
                {isLoading ? 'Analisando...' : 'Detectar CapCut'}
              </button>
              <button
                onClick={handleSelectFolder}
                disabled={isLoading}
                className="btn-secondary py-1.5 px-3 flex items-center gap-1.5 text-xs"
                title="Selecionar pasta manualmente"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Manual
              </button>

              {projectPath && (
                <div className="flex items-center gap-1 text-xs">
                  <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-white font-medium truncate max-w-[200px]">{projectName}</span>
                  <span className="text-text-muted">({tracks.length} tracks)</span>
                </div>
              )}

              {/* Undo dropdown */}
              {canUndo && (
                <div ref={backupDropdownRef} className="ml-auto relative">
                  <button
                    onClick={() => setShowBackupDropdown(!showBackupDropdown)}
                    className="btn-secondary py-1.5 px-3 flex items-center gap-1.5 text-xs text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10"
                    title="Ver histórico de backups"
                  >
                    <History className="w-3.5 h-3.5" />
                    Desfazer ({backupCount})
                    <ChevronDown className={`w-3 h-3 transition-transform ${showBackupDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown */}
                  <AnimatePresence>
                    {showBackupDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute right-0 top-full mt-1 w-72 bg-background-dark border border-border-light rounded-lg shadow-xl z-50 overflow-hidden"
                      >
                        <div className="p-2 border-b border-border-light flex items-center justify-between">
                          <span className="text-xs font-medium text-white">Histórico de Backups</span>
                          <button
                            onClick={handleDeleteAllBackups}
                            className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"
                            title="Limpar todos os backups"
                          >
                            <Trash2 className="w-3 h-3" />
                            Limpar tudo
                          </button>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          {backups.map((backup, idx) => (
                            <div
                              key={backup.filename}
                              className="flex items-center justify-between p-2 hover:bg-white/5 border-b border-border-light last:border-b-0"
                            >
                              <button
                                onClick={() => handleUndo(backup.filename)}
                                className="flex-1 flex items-center gap-2 text-left"
                              >
                                <Undo2 className="w-3.5 h-3.5 text-yellow-400" />
                                <div>
                                  <div className="text-xs text-white">{backup.displayDate}</div>
                                  <div className="text-[10px] text-text-muted">
                                    {idx === 0 ? 'Mais recente' : `Backup ${backupCount - idx}`}
                                  </div>
                                </div>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteBackup(backup.filename); }}
                                className="p-1 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300"
                                title="Remover este backup"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="p-2 border-t border-border-light">
                          <button
                            onClick={() => handleUndo()}
                            className="w-full btn-primary py-1.5 text-xs flex items-center justify-center gap-1.5"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            Restaurar último backup
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Timeline & Panel */}
            <div className="flex-1 flex flex-col overflow-hidden p-2 gap-2 min-h-0">
              {/* Timeline Preview */}
              <div className="card p-2 flex-shrink min-h-[100px] max-h-[35vh] overflow-hidden flex flex-col">
                <h3 className="text-[10px] font-semibold text-text-secondary mb-1 flex-shrink-0">PREVIEW DA TIMELINE (clique para selecionar referência)</h3>
                <div className="overflow-y-auto flex-1 pr-1">
                  <TimelinePreview
                    tracks={tracks}
                    selectedAudioTrack={selectedAudioTrack}
                    onTrackClick={handleTrackClick}
                  />
                </div>
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

      {/* Project Picker Modal */}
      <AnimatePresence>
        {showProjectPicker && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-50"
              onClick={() => setShowProjectPicker(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-20 bottom-20 md:inset-x-20 bg-background-dark border border-border-light rounded-xl z-50 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border-light">
                <div>
                  <h2 className="text-lg font-bold text-white">Projetos do CapCut</h2>
                  <p className="text-xs text-text-muted">{capCutProjects.length} projetos encontrados (ordenados por modificação)</p>
                </div>
                <button
                  onClick={() => setShowProjectPicker(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-text-secondary" />
                </button>
              </div>

              {/* Projects List */}
              <div className="flex-1 overflow-auto p-2">
                <div className="grid gap-2">
                  {capCutProjects.map((project, idx) => (
                    <button
                      key={project.path}
                      onClick={() => handleSelectProject(project)}
                      className="w-full p-3 bg-white/5 hover:bg-white/10 border border-border-light hover:border-primary/50 rounded-lg transition-all text-left group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                            <FolderOpen className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <span className="text-white font-medium group-hover:text-primary transition-colors">
                              {project.name}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-text-muted">
                              <Clock className="w-3 h-3" />
                              <span>{formatRelativeDate(project.modifiedAt)}</span>
                            </div>
                          </div>
                        </div>
                        {idx === 0 && (
                          <span className="text-[9px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                            Mais recente
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-border-light flex justify-between items-center">
                <span className="text-xs text-text-muted">
                  Clique em um projeto para selecioná-lo
                </span>
                <button
                  onClick={() => setShowProjectPicker(false)}
                  className="btn-secondary py-1.5 px-4 text-xs"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
