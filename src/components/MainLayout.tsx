import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, RefreshCw, FileText, HelpCircle, LogOut, FolderOpen, ChevronRight, Minus, Square, X, Download, ExternalLink, User as UserIcon, Crown, Undo2, Search, Clock, ChevronDown, Trash2, Film, Plus, Pencil, Check, Copy, Cloud, Layers } from 'lucide-react'
import type { User, TrackInfo, LogEntry } from '../types'
import capcutLogo from '../assets/capcut-logo.jpg'
import TimelinePreview from './TimelinePreview'
import SyncPanel from './panels/SyncPanel'
import LoopPanel from './panels/LoopPanel'
import SrtPanel from './panels/SrtPanel'
import MediaPanel from './panels/MediaPanel'
import MergePanel from './panels/MergePanel'
import HelpModal from './HelpModal'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

interface MainLayoutProps {
  user: User
  onLogout: () => void
}

type TabType = 'sync' | 'loop' | 'srt' | 'media' | 'merge'

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
  const [backups, setBackups] = useState<Array<{ filename: string; displayDate: string; timestamp: number; description?: string | null }>>([])
  const [backupCount, setBackupCount] = useState(0)
  const backupDropdownRef = useRef<HTMLDivElement>(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [templateKeepMedia, setTemplateKeepMedia] = useState(true)
  const [templateExpandEffects, setTemplateExpandEffects] = useState(true)
  const [templateNewName, setTemplateNewName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<{ name: string; path: string; modifiedAt: string } | null>(null)
  const [showTrackManager, setShowTrackManager] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showTrackDeleteConfirm, setShowTrackDeleteConfirm] = useState(false)
  const [trackToDelete, setTrackToDelete] = useState<{ index: number; type: string; name?: string } | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<{ name: string; path: string } | null>(null)
  const [showNewDropdown, setShowNewDropdown] = useState(false)
  const newDropdownRef = useRef<HTMLDivElement>(null)
  const [projectToOpen, setProjectToOpen] = useState<{ name: string; path: string; draftPath: string } | null>(null)
  const [projectSource, setProjectSource] = useState<'local' | 'cloud'>('local')
  const [cloudFolderPath, setCloudFolderPath] = useState<string | null>(() => {
    try { return localStorage.getItem('capcut_cloud_folder') } catch { return null }
  })
  const [cloudProjects, setCloudProjects] = useState<Array<{ name: string; path: string; draftPath: string; modifiedAt: string }>>([])
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: '1', type: 'info', message: 'CapCut Sync Pro v2.0 iniciado', timestamp: new Date() }
  ])
  const [logCounter, setLogCounter] = useState(1)
  const [news, setNews] = useState<{ title: string; description: string; badge: string; link?: string | null }>({
    title: 'Sistema de Templates',
    description: 'Crie projetos a partir de templates existentes',
    badge: 'NOVO'
  })

  // Cores - usando laranja como cor principal do app
  const tabs = [
    { id: 'sync' as const, label: 'SYNC', icon: Zap, hexColor: '#E85A2A' },           // Laranja (sincronizar)
    { id: 'loop' as const, label: 'LOOP', icon: RefreshCw, hexColor: '#E85A2A' },     // Laranja (repetir)
    { id: 'srt' as const, label: '+ SRT', icon: FileText, hexColor: '#E85A2A' },      // Laranja (adicionar legenda)
    { id: 'media' as const, label: '+ MÍDIA', icon: Film, hexColor: '#E85A2A' },      // Laranja (adicionar mídia)
    { id: 'merge' as const, label: 'MESCLAR', icon: Layers, hexColor: '#E85A2A' },    // Laranja (mesclar projetos)
  ]

  // Calcular dias restantes de trial
  const trialDaysRemaining = user.proActivatedBy === 'trial' && user.trialExpiresAt
    ? Math.max(0, Math.ceil((new Date(user.trialExpiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : -1

  // Check for updates and fetch news on mount
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

        // Fetch news
        const newsResult = await ipcRenderer.invoke('fetch-news')
        if (newsResult.success && newsResult.news) {
          setNews(newsResult.news)
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

  // Close new dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (newDropdownRef.current && !newDropdownRef.current.contains(event.target as Node)) {
        setShowNewDropdown(false)
      }
    }
    if (showNewDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNewDropdown])

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

  // Abrir projeto do CapCut (detecta e abre picker)
  const handleDetectCapCut = async () => {
    if (!ipcRenderer) { addLog('error', 'Electron IPC not available'); return }
    addLog('info', 'Buscando projetos do CapCut...')

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

  // Apenas atualizar lista de projetos (sem abrir picker)
  const handleRefreshProjects = async () => {
    if (!ipcRenderer) return

    try {
      const result = await ipcRenderer.invoke('detect-capcut-folder')
      if (result.error) return

      setCapCutProjects(result.projects)
      addLog('info', `Lista atualizada: ${result.count} projetos`)
    } catch (error) {
      console.error('Error refreshing projects:', error)
    }
  }

  // Selecionar pasta de nuvem
  const handleSelectCloudFolder = async () => {
    if (!ipcRenderer) return

    try {
      const result = await ipcRenderer.invoke('select-cloud-folder')
      if (result.error) {
        addLog('error', result.error)
        return
      }

      if (result.canceled) return

      const folderPath = result.folderPath
      setCloudFolderPath(folderPath)
      localStorage.setItem('capcut_cloud_folder', folderPath)
      addLog('success', `Pasta de nuvem configurada: ${result.folderName}`)

      // Detectar projetos da pasta de nuvem
      await handleDetectCloudProjects(folderPath)
    } catch (error) {
      addLog('error', 'Erro ao selecionar pasta: ' + error)
    }
  }

  // Detectar projetos da pasta de nuvem
  const handleDetectCloudProjects = async (folderPath?: string) => {
    if (!ipcRenderer) return

    const targetFolder = folderPath || cloudFolderPath
    if (!targetFolder) {
      addLog('warning', 'Selecione uma pasta de nuvem primeiro')
      return
    }

    addLog('info', 'Detectando projetos da nuvem...')

    try {
      const result = await ipcRenderer.invoke('detect-capcut-folder', { customPath: targetFolder })
      if (result.error) {
        addLog('error', result.error)
        return
      }

      if (result.projects.length === 0) {
        addLog('warning', 'Nenhum projeto encontrado na pasta de nuvem')
        setCloudProjects([])
        return
      }

      setCloudProjects(result.projects)
      addLog('success', `${result.count} projetos de nuvem encontrados!`)
    } catch (error) {
      addLog('error', 'Erro ao detectar projetos de nuvem: ' + error)
    }
  }

  // Renomear projeto
  const handleRenameProject = async () => {
    if (!projectPath || !ipcRenderer || !editingName.trim()) {
      setIsEditingName(false)
      return
    }

    const newName = editingName.trim()
    if (newName === projectName) {
      setIsEditingName(false)
      return
    }

    addLog('info', `Renomeando projeto para "${newName}"...`)

    try {
      const result = await ipcRenderer.invoke('rename-project', { projectPath, newName })
      if (result.error) {
        addLog('error', result.error)
      } else {
        setProjectPath(result.newPath)
        setProjectName(result.newName)
        setDraftPath(result.newDraftPath)
        addLog('success', `Projeto renomeado para "${result.newName}"`)
      }
    } catch (error) {
      addLog('error', 'Erro ao renomear: ' + error)
    }

    setIsEditingName(false)
  }

  const startEditingName = () => {
    setEditingName(projectName || '')
    setIsEditingName(true)
  }

  // Abrir template picker
  const handleOpenTemplatePicker = async () => {
    if (!ipcRenderer) { addLog('error', 'Electron IPC not available'); return }
    addLog('info', 'Carregando projetos para usar como template...')

    try {
      const result = await ipcRenderer.invoke('detect-capcut-folder')
      if (result.error) {
        addLog('error', result.error)
        return
      }

      if (result.projects.length === 0) {
        addLog('warning', 'Nenhum projeto encontrado para usar como template')
        return
      }

      setCapCutProjects(result.projects)
      setTemplateNewName('')
      setSelectedTemplate(null)
      setShowTemplatePicker(true)
      addLog('success', `${result.count} projetos disponíveis como template`)
    } catch (error) {
      addLog('error', 'Erro ao carregar templates: ' + error)
    }
  }

  // Criar projeto a partir de template
  const handleCreateFromTemplate = async () => {
    if (!ipcRenderer || !selectedTemplate) return

    const newName = templateNewName.trim() || `${selectedTemplate.name}_copia`
    addLog('info', `Criando projeto a partir de "${selectedTemplate.name}"...`)
    setShowTemplatePicker(false)

    try {
      const result = await ipcRenderer.invoke('create-from-template', {
        templatePath: selectedTemplate.path,
        newName,
        keepMedia: templateKeepMedia,
        expandEffects: templateExpandEffects
      })

      if (result.error) {
        addLog('error', result.error)
        return
      }

      setProjectPath(result.path)
      setProjectName(result.name)
      setDraftPath(result.draftPath)
      setTracks([])
      setSelectedAudioTrack(0)

      addLog('success', `Projeto criado a partir do template "${result.templateName}"`)
      if (!templateKeepMedia) {
        addLog('info', 'Mídias removidas - adicione novas mídias na aba MÍDIA')
      }
      if (templateExpandEffects && templateKeepMedia) {
        addLog('info', 'Efeitos e filtros expandidos para cobrir toda a timeline')
      }

      // Analisar o novo projeto
      const analyzeResult = await ipcRenderer.invoke('analyze-project', result.draftPath)
      if (!analyzeResult.error) {
        setTracks(analyzeResult.tracks)
      }
    } catch (error) {
      addLog('error', 'Erro ao criar projeto: ' + error)
    }
  }

  // Criar novo projeto do zero
  const handleNewProject = async () => {
    if (!ipcRenderer) { addLog('error', 'Electron IPC not available'); return }
    addLog('info', 'Criando novo projeto...')

    try {
      const result = await ipcRenderer.invoke('create-new-project')
      if (result.error) {
        addLog('error', result.error)
        return
      }

      setProjectPath(result.path)
      setProjectName(result.name)
      setDraftPath(result.draftPath)
      setTracks([])
      setSelectedAudioTrack(0)
      addLog('success', `Projeto criado: ${result.name}`)
      addLog('info', 'Agora adicione midias na aba MIDIA')
    } catch (error) {
      addLog('error', 'Erro ao criar projeto: ' + error)
    }
  }

  // Deletar projeto (atual ou da lista)
  const handleDeleteProject = async () => {
    if (!ipcRenderer) return

    // Usa projectToDelete se disponível, senão usa o projeto atual
    const targetPath = projectToDelete?.path || projectPath
    const targetName = projectToDelete?.name || projectName

    if (!targetPath) return

    addLog('info', `Deletando projeto "${targetName}"...`)
    setShowDeleteConfirm(false)

    try {
      const result = await ipcRenderer.invoke('delete-project', { projectPath: targetPath })
      if (result.error) {
        addLog('error', result.error)
        setProjectToDelete(null)
        return
      }

      addLog('success', `Projeto "${result.deletedName}" deletado com sucesso`)

      // Se deletou o projeto atual, limpa o estado
      if (targetPath === projectPath) {
        setProjectPath(null)
        setProjectName(null)
        setDraftPath(null)
        setTracks([])
        setSelectedAudioTrack(0)
      }

      // Remove o projeto da lista
      setCapCutProjects(prev => prev.filter(p => p.path !== targetPath))
      setProjectToDelete(null)
    } catch (error) {
      addLog('error', 'Erro ao deletar projeto: ' + error)
      setProjectToDelete(null)
    }
  }

  // Deletar tracks por tipo
  const handleDeleteTracksByType = async (trackTypes: string[]) => {
    if (!ipcRenderer || !draftPath) return

    const typeNames = trackTypes.map(t => {
      if (t === 'text') return 'legendas'
      if (t === 'effect') return 'efeitos'
      if (t === 'filter') return 'filtros'
      return t
    }).join(', ')

    addLog('info', `Removendo ${typeNames}...`)

    try {
      const result = await ipcRenderer.invoke('delete-tracks-by-type', { draftPath, trackTypes })
      if (result.error) {
        addLog('error', result.error)
        return
      }

      addLog('success', `${result.removedCount} track(s) removida(s)`)

      // Re-analisar o projeto
      const analyzeResult = await ipcRenderer.invoke('analyze-project', draftPath)
      if (!analyzeResult.error) {
        setTracks(analyzeResult.tracks)
      }

      setShowTrackManager(false)
    } catch (error) {
      addLog('error', 'Erro ao remover tracks: ' + error)
    }
  }

  // Mostrar modal de confirmação para deletar track
  const handleDeleteTrack = (trackIndex: number) => {
    const track = tracks.find((_, idx) => idx === trackIndex) || tracks[trackIndex]
    if (track) {
      setTrackToDelete({ index: trackIndex, type: track.type, name: track.name })
      setShowTrackDeleteConfirm(true)
    }
  }

  // Confirmar e deletar track
  const confirmDeleteTrack = async () => {
    if (!ipcRenderer || !draftPath || !trackToDelete) return

    addLog('info', `Removendo track ${trackToDelete.type}...`)
    setShowTrackDeleteConfirm(false)

    try {
      const result = await ipcRenderer.invoke('delete-track', { draftPath, trackIndex: trackToDelete.index })
      if (result.error) {
        addLog('error', result.error)
        setTrackToDelete(null)
        return
      }

      addLog('success', `Track "${result.removedTrack.type}" removida`)

      // Re-analisar o projeto
      const analyzeResult = await ipcRenderer.invoke('analyze-project', draftPath)
      if (!analyzeResult.error) {
        setTracks(analyzeResult.tracks)
      }
    } catch (error) {
      addLog('error', 'Erro ao remover track: ' + error)
    }
    setTrackToDelete(null)
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
      <div className="drag-region h-10 bg-gradient-to-r from-background-dark-alt to-background-dark border-b border-border-light flex items-center justify-between px-3 flex-shrink-0">
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
                borderColor: `${tab.hexColor}80`,
                boxShadow: `0 0 12px ${tab.hexColor}50`
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
            onClick={() => ipcRenderer?.invoke('open-external', 'https://nardoto.com.br')}
            className="w-12 h-10 rounded-lg flex flex-col items-center justify-center hover:bg-white/5 transition-colors"
            title="Desenvolvido por Nardoto"
          >
            <ExternalLink className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-[8px] text-text-muted">nardoto</span>
          </button>

          {/* Help button - opens internal modal */}
          <button
            onClick={() => setShowHelp(true)}
            className="w-12 h-10 rounded-lg flex flex-col items-center justify-center hover:bg-primary/20 transition-colors border border-transparent hover:border-primary/30"
            title="Como usar o CapCut Sync Pro"
          >
            <HelpCircle className="w-4 h-4 text-primary" />
            <span className="text-[8px] text-primary/80">AJUDA</span>
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
                className="py-1.5 px-3 flex items-center gap-1.5 text-xs font-medium rounded-lg transition-all bg-gradient-to-r from-primary to-primary/80 text-white hover:brightness-110 disabled:opacity-50"
                title="Abrir projeto do CapCut"
              >
                <Search className="w-3.5 h-3.5" />
                {isLoading ? 'Analisando...' : 'Abrir Projeto'}
              </button>
              <button
                onClick={handleSelectFolder}
                disabled={isLoading}
                className="py-1.5 px-3 flex items-center gap-1.5 text-xs font-medium rounded-lg transition-all bg-white/10 text-text-secondary hover:bg-white/20 disabled:opacity-50"
                title="Selecionar pasta manualmente"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Manual
              </button>
              {/* Novo button with dropdown */}
              <div ref={newDropdownRef} className="relative">
                <button
                  onClick={() => setShowNewDropdown(!showNewDropdown)}
                  disabled={isLoading}
                  className="py-1.5 px-3 flex items-center gap-1.5 text-xs font-medium rounded-lg transition-all bg-white/10 text-text-secondary hover:bg-white/20 disabled:opacity-50"
                  title="Criar novo projeto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo
                  <ChevronDown className={`w-3 h-3 transition-transform ${showNewDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown */}
                <AnimatePresence>
                  {showNewDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute left-0 top-full mt-1 w-48 bg-[#141414] border border-border-light rounded-lg shadow-xl z-50 overflow-hidden"
                    >
                      <button
                        onClick={() => { setShowNewDropdown(false); handleNewProject(); }}
                        className="w-full p-3 flex items-center gap-3 hover:bg-white/10 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                          <Plus className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <span className="text-xs text-white font-medium block">Novo do zero</span>
                          <span className="text-[10px] text-text-muted">Projeto vazio</span>
                        </div>
                      </button>
                      <button
                        onClick={() => { setShowNewDropdown(false); handleOpenTemplatePicker(); }}
                        className="w-full p-3 flex items-center gap-3 hover:bg-white/10 transition-colors text-left border-t border-border-light"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                          <Copy className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <span className="text-xs text-white font-medium block">A partir de template</span>
                          <span className="text-[10px] text-text-muted">Usa projeto existente</span>
                        </div>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {projectPath && (
                <>
                  <div className="flex items-center gap-1 text-xs">
                    <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
                    {isEditingName ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameProject()
                            if (e.key === 'Escape') setIsEditingName(false)
                          }}
                          className="bg-white/10 border border-primary rounded px-2 py-0.5 text-white text-xs w-48 focus:outline-none focus:ring-1 focus:ring-primary"
                          autoFocus
                        />
                        <button
                          onClick={handleRenameProject}
                          className="p-1 hover:bg-green-500/20 rounded text-green-400"
                          title="Confirmar"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setIsEditingName(false)}
                          className="p-1 hover:bg-red-500/20 rounded text-red-400"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-white font-medium truncate max-w-[200px]">{projectName}</span>
                        <button
                          onClick={startEditingName}
                          className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-white transition-colors"
                          title="Renomear projeto"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setShowTrackManager(true)}
                          className="p-1 hover:bg-orange-500/20 rounded text-text-muted hover:text-orange-400 transition-colors"
                          title="Gerenciar tracks (apagar legendas, efeitos, filtros)"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    <span className="text-text-muted">({tracks.length} tracks)</span>
                  </div>
                  <button
                    onClick={() => ipcRenderer?.invoke('open-folder-in-explorer', projectPath)}
                    className="btn-secondary py-1.5 px-2 text-xs"
                    title="Abrir pasta do projeto no Explorer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      const result = await ipcRenderer?.invoke('open-capcut')
                      if (result?.error) {
                        addLog('error', result.error)
                      } else {
                        addLog('success', 'CapCut aberto!')
                      }
                    }}
                    className="py-1.5 px-3 flex items-center gap-1.5 text-xs font-medium rounded-lg transition-all hover:brightness-110"
                    title="Abrir CapCut"
                    style={{ backgroundColor: '#00d4aa', color: '#000' }}
                  >
                    <img src={capcutLogo} alt="CapCut" className="w-5 h-5 rounded-full object-cover" />
                    Abrir CapCut
                  </button>
                  <button
                    onClick={handleReanalyze}
                    disabled={isLoading}
                    className="btn-secondary py-1.5 px-3 flex items-center gap-1.5 text-xs"
                    title="Analisar projeto novamente"
                  >
                    {isLoading ? (
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    Analisar
                  </button>
                </>
              )}

              {/* Undo/Redo buttons */}
              <div ref={backupDropdownRef} className="ml-auto flex items-center gap-1 relative">
                {/* Undo button */}
                <button
                  onClick={() => canUndo && backups.length > 0 && handleUndo(backups[0].filename)}
                  disabled={!canUndo}
                  className={`p-1.5 rounded-lg transition-all ${canUndo ? 'bg-white/10 hover:bg-primary/20 text-primary' : 'bg-white/5 text-text-muted cursor-not-allowed'}`}
                  title="Desfazer (Ctrl+Z)"
                >
                  <Undo2 className="w-4 h-4" />
                </button>

                {/* Backup history dropdown trigger */}
                <button
                  onClick={() => setShowBackupDropdown(!showBackupDropdown)}
                  className={`p-1.5 rounded-lg transition-all ${canUndo ? 'bg-white/10 hover:bg-white/20 text-text-secondary' : 'bg-white/5 text-text-muted cursor-not-allowed'}`}
                  title="Histórico de backups"
                  disabled={!canUndo}
                >
                  <ChevronDown className={`w-3 h-3 transition-transform ${showBackupDropdown ? 'rotate-180' : ''}`} />
                </button>

                  {/* Dropdown */}
                  <AnimatePresence>
                    {showBackupDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute right-0 top-full mt-1 w-72 bg-[#141414] border border-border-light rounded-lg shadow-xl z-50 overflow-hidden"
                      >
                        <div className="p-2 border-b border-border-light bg-[#1a1a1a] flex items-center justify-between">
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
                                  <div className="text-xs text-white flex items-center gap-2">
                                    {backup.displayDate}
                                    {backup.description && (
                                      <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                                        {backup.description}
                                      </span>
                                    )}
                                  </div>
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
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Timeline & Panel */}
            <div className="flex-1 flex flex-col overflow-hidden p-2 gap-2 min-h-0">
              {/* Timeline Preview */}
              <div className="card p-2 flex-shrink min-h-[100px] max-h-[35vh] overflow-hidden flex flex-col">
                <h3 className="text-[10px] font-semibold text-text-secondary mb-1 flex-shrink-0">
                  PREVIEW DA TIMELINE
                  <span className="text-text-muted font-normal ml-1">(passe o mouse para apagar tracks)</span>
                </h3>
                <div className="overflow-y-auto flex-1 pr-1">
                  <TimelinePreview
                    tracks={tracks}
                    selectedAudioTrack={selectedAudioTrack}
                    onTrackClick={handleTrackClick}
                    onDeleteTrack={handleDeleteTrack}
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
                  {activeTab === 'media' && (
                    <motion.div
                      key="media"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="h-full overflow-auto"
                    >
                      <MediaPanel
                        onLog={addLog}
                        draftPath={draftPath}
                        onReanalyze={handleReanalyze}
                        selectedAudioTrack={selectedAudioTrack}
                        refTrackName={audioTracks.find(t => t.index === selectedAudioTrack)?.name}
                      />
                    </motion.div>
                  )}
                  {activeTab === 'merge' && (
                    <motion.div
                      key="merge"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="h-full overflow-auto"
                    >
                      <MergePanel
                        onLog={addLog}
                        onProjectChange={handleReanalyze}
                        currentProjectPath={projectPath}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Projects Panel */}
            <div className="w-72 border-l border-border-light flex-shrink-0 flex flex-col bg-gradient-to-b from-background-dark to-background-dark-alt">
              {/* Banner de novidades */}
              <div className="p-3 border-b border-border-light">
                <div
                  className={`bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-lg p-3 relative overflow-hidden ${news.link ? 'cursor-pointer hover:from-primary/30 hover:to-primary/10 transition-all' : ''}`}
                  onClick={() => news.link && ipcRenderer?.invoke('open-external', news.link)}
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-2xl -mr-10 -mt-10" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] bg-primary/30 text-primary px-1.5 py-0.5 rounded font-medium">{news.badge}</span>
                      {news.link && <ExternalLink className="w-3 h-3 text-primary/50" />}
                    </div>
                    <p className="text-xs text-white font-medium">{news.title}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">{news.description}</p>
                  </div>
                </div>
              </div>

              {/* Lista de projetos */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Toggle Local / Nuvem */}
                <div className="p-2 border-b border-border-light">
                  <div className="flex rounded-lg bg-white/5 p-0.5">
                    <button
                      onClick={() => setProjectSource('local')}
                      className={`flex-1 py-1.5 px-2 rounded-md text-[10px] font-medium transition-all flex items-center justify-center gap-1 ${
                        projectSource === 'local'
                          ? 'bg-primary text-white'
                          : 'text-text-muted hover:text-white'
                      }`}
                    >
                      <FolderOpen className="w-3 h-3" />
                      Local
                    </button>
                    <button
                      onClick={() => {
                        setProjectSource('cloud')
                        if (cloudFolderPath && cloudProjects.length === 0) {
                          handleDetectCloudProjects()
                        }
                      }}
                      className={`flex-1 py-1.5 px-2 rounded-md text-[10px] font-medium transition-all flex items-center justify-center gap-1 ${
                        projectSource === 'cloud'
                          ? 'bg-primary text-white'
                          : 'text-text-muted hover:text-white'
                      }`}
                    >
                      <Cloud className="w-3 h-3" />
                      Nuvem
                    </button>
                  </div>
                </div>

                {/* Header com botão de atualizar */}
                <div className="p-2 border-b border-border-light flex items-center justify-between">
                  {projectSource === 'local' ? (
                    <>
                      <span className="text-[10px] text-text-muted">Projetos locais</span>
                      <button
                        onClick={handleRefreshProjects}
                        className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Atualizar
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] text-text-muted truncate flex-1" title={cloudFolderPath || undefined}>
                        {cloudFolderPath ? cloudFolderPath.split(/[/\\]/).pop() : 'Nenhuma pasta'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleSelectCloudFolder}
                          className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-1"
                          title="Selecionar pasta"
                        >
                          <FolderOpen className="w-3 h-3" />
                        </button>
                        {cloudFolderPath && (
                          <button
                            onClick={() => handleDetectCloudProjects()}
                            className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Lista de projetos */}
                <div className="flex-1 overflow-y-auto p-2">
                  {projectSource === 'local' ? (
                    // Projetos locais
                    capCutProjects.length === 0 ? (
                      <div className="text-center py-8">
                        <FolderOpen className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-30" />
                        <p className="text-xs text-text-muted">Clique em "Atualizar"</p>
                        <p className="text-[10px] text-text-muted">para carregar projetos</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {capCutProjects.map((project) => (
                          <div
                            key={project.path}
                            className={`w-full p-2 rounded-lg text-left transition-all group ${
                              projectPath === project.path
                                ? 'bg-primary/20 border border-primary/50'
                                : 'bg-white/5 hover:bg-white/10 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  if (projectPath === project.path) return
                                  setProjectToOpen(project)
                                }}
                                className="flex items-center gap-2 flex-1 min-w-0"
                              >
                                <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
                                  projectPath === project.path ? 'bg-primary/30' : 'bg-white/10'
                                }`}>
                                  <Film className="w-3 h-3 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1 text-left">
                                  <span className={`text-xs block truncate ${
                                    projectPath === project.path ? 'text-primary font-medium' : 'text-white'
                                  }`}>
                                    {project.name}
                                  </span>
                                  <span className="text-[9px] text-text-muted flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    {formatRelativeDate(project.modifiedAt)}
                                  </span>
                                </div>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProjectToDelete({ name: project.name, path: project.path });
                                  setShowDeleteConfirm(true);
                                }}
                                className="p-1 hover:bg-red-500/20 rounded text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Deletar projeto"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    // Projetos de nuvem
                    !cloudFolderPath ? (
                      <div className="text-center py-8">
                        <Cloud className="w-8 h-8 text-primary mx-auto mb-2 opacity-30" />
                        <p className="text-xs text-text-muted">Clique na pasta</p>
                        <p className="text-[10px] text-text-muted">para selecionar pasta de nuvem</p>
                        <button
                          onClick={handleSelectCloudFolder}
                          className="mt-3 text-[10px] px-3 py-1.5 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors"
                        >
                          Selecionar pasta
                        </button>
                      </div>
                    ) : cloudProjects.length === 0 ? (
                      <div className="text-center py-8">
                        <Cloud className="w-8 h-8 text-primary mx-auto mb-2 opacity-30" />
                        <p className="text-xs text-text-muted">Nenhum projeto</p>
                        <p className="text-[10px] text-text-muted">encontrado na pasta</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {cloudProjects.map((project) => (
                          <div
                            key={project.path}
                            className={`w-full p-2 rounded-lg text-left transition-all group ${
                              projectPath === project.path
                                ? 'bg-primary/20 border border-primary/50'
                                : 'bg-white/5 hover:bg-white/10 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  if (projectPath === project.path) return
                                  setProjectToOpen(project)
                                }}
                                className="flex items-center gap-2 flex-1 min-w-0"
                              >
                                <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
                                  projectPath === project.path ? 'bg-primary/30' : 'bg-white/10'
                                }`}>
                                  <Cloud className="w-3 h-3 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1 text-left">
                                  <span className={`text-xs block truncate ${
                                    projectPath === project.path ? 'text-primary font-medium' : 'text-white'
                                  }`}>
                                    {project.name}
                                  </span>
                                  <span className="text-[9px] text-text-muted flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    {formatRelativeDate(project.modifiedAt)}
                                  </span>
                                </div>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProjectToDelete({ name: project.name, path: project.path });
                                  setShowDeleteConfirm(true);
                                }}
                                className="p-1 hover:bg-red-500/20 rounded text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Deletar projeto"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="h-5 bg-gradient-to-r from-background-dark-alt to-background-dark border-t border-border-light flex items-center justify-center px-3 flex-shrink-0">
        <span className="text-[9px] text-text-muted">
          Desenvolvido por <button onClick={() => ipcRenderer?.invoke('open-external', 'https://nardoto.com.br')} className="text-primary hover:underline">Nardoto</button>
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
              className="fixed inset-x-4 top-20 bottom-20 md:inset-x-20 bg-[#0f0f0f] border border-border-light rounded-xl z-50 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border-light bg-[#141414]">
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
                    <div
                      key={project.path}
                      className="w-full p-3 bg-white/5 hover:bg-white/10 border border-border-light hover:border-primary/50 rounded-lg transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => handleSelectProject(project)}
                          className="flex-1 flex items-center gap-3 text-left"
                        >
                          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <FolderOpen className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-white font-medium group-hover:text-primary transition-colors block truncate">
                              {project.name}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-text-muted">
                              <Clock className="w-3 h-3 flex-shrink-0" />
                              <span>{formatRelativeDate(project.modifiedAt)}</span>
                            </div>
                            <div className="text-[9px] text-text-muted truncate mt-0.5" title={project.path}>
                              {project.path}
                            </div>
                          </div>
                        </button>
                        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                          {idx === 0 && (
                            <span className="text-[9px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                              Recente
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              ipcRenderer?.invoke('open-folder-in-explorer', project.path)
                            }}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                            title="Abrir pasta no Explorer"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-text-muted hover:text-primary" />
                          </button>
                        </div>
                      </div>
                    </div>
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

      {/* Template Picker Modal */}
      <AnimatePresence>
        {showTemplatePicker && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-50"
              onClick={() => setShowTemplatePicker(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-16 bottom-16 md:inset-x-16 bg-[#0f0f0f] border border-border-light rounded-xl z-50 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border-light bg-[#141414]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/30 to-primary/10">
                    <Copy className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Criar a partir de Template</h2>
                    <p className="text-xs text-text-muted">
                      {selectedTemplate
                        ? `Template selecionado: ${selectedTemplate.name}`
                        : 'Selecione um projeto para usar como base'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTemplatePicker(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-text-secondary" />
                </button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Projects List - Left side */}
                <div className="w-1/2 border-r border-border-light overflow-auto p-2">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2 px-2">Escolha um template</div>
                  <div className="grid gap-1">
                    {capCutProjects.map((project, idx) => (
                      <button
                        key={project.path}
                        onClick={() => setSelectedTemplate(project)}
                        className={`w-full p-3 rounded-lg transition-all text-left ${
                          selectedTemplate?.path === project.path
                            ? 'bg-primary/20 border-2 border-primary'
                            : 'bg-white/5 hover:bg-primary/10 border border-border-light hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            selectedTemplate?.path === project.path ? 'bg-primary/40' : 'bg-primary/20'
                          }`}>
                            <Copy className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className={`font-medium block truncate ${
                              selectedTemplate?.path === project.path ? 'text-primary-light' : 'text-white'
                            }`}>
                              {project.name}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-text-muted">
                              <Clock className="w-3 h-3 flex-shrink-0" />
                              <span>{formatRelativeDate(project.modifiedAt)}</span>
                            </div>
                          </div>
                          {idx === 0 && (
                            <span className="text-[9px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                              Recente
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Options - Right side */}
                <div className="w-1/2 p-4 flex flex-col">
                  {selectedTemplate ? (
                    <>
                      <div className="text-[10px] text-text-muted uppercase tracking-wider mb-3">Configurações do novo projeto</div>

                      {/* Template selecionado info */}
                      <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Copy className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-primary">Template:</span>
                        </div>
                        <span className="text-white font-medium">{selectedTemplate.name}</span>
                        <div className="text-[10px] text-text-muted mt-1">
                          Modificado: {formatRelativeDate(selectedTemplate.modifiedAt)}
                        </div>
                      </div>

                      {/* Nome do novo projeto */}
                      <div className="mb-4">
                        <label className="text-xs text-text-secondary block mb-1.5">Nome do novo projeto:</label>
                        <input
                          type="text"
                          value={templateNewName}
                          onChange={(e) => setTemplateNewName(e.target.value)}
                          placeholder={`${selectedTemplate.name}_copia`}
                          className="w-full bg-white/10 border border-border-light rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      </div>

                      {/* Opções */}
                      <div className="space-y-3">
                        <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-white/5">
                          <input
                            type="checkbox"
                            checked={templateKeepMedia}
                            onChange={(e) => setTemplateKeepMedia(e.target.checked)}
                            className="w-5 h-5 mt-0.5 rounded border-border-light bg-white/10 text-primary focus:ring-primary"
                          />
                          <div>
                            <span className="text-sm text-white block">Manter mídias</span>
                            <span className="text-[11px] text-text-muted">Copia vídeos, áudios e imagens da timeline</span>
                          </div>
                        </label>

                        <label className={`flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-white/5 ${!templateKeepMedia ? 'opacity-40' : ''}`}>
                          <input
                            type="checkbox"
                            checked={templateExpandEffects}
                            onChange={(e) => setTemplateExpandEffects(e.target.checked)}
                            disabled={!templateKeepMedia}
                            className="w-5 h-5 mt-0.5 rounded border-border-light bg-white/10 text-primary focus:ring-primary"
                          />
                          <div>
                            <span className="text-sm text-white block">Expandir efeitos/filtros</span>
                            <span className="text-[11px] text-text-muted">Ajusta efeitos e filtros para cobrir toda a timeline</span>
                          </div>
                        </label>
                      </div>

                      <div className="flex-1" />

                      {/* Resumo */}
                      <div className="bg-white/5 rounded-lg p-3 mt-4 text-xs text-text-muted">
                        {templateKeepMedia
                          ? '✓ O projeto será copiado com todas as mídias e configurações'
                          : '○ Apenas estilos, efeitos e configurações serão copiados (timeline vazia)'}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center">
                      <div>
                        <Copy className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-30" />
                        <p className="text-text-muted text-sm">Selecione um projeto à esquerda</p>
                        <p className="text-text-muted text-xs mt-1">para usar como template</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-border-light flex justify-between items-center">
                <button
                  onClick={() => setShowTemplatePicker(false)}
                  className="btn-secondary py-2 px-4 text-xs"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateFromTemplate}
                  disabled={!selectedTemplate}
                  className={`py-2 px-6 flex items-center gap-2 text-sm font-medium rounded-lg transition-all ${
                    selectedTemplate
                      ? 'bg-primary hover:bg-primary-hover text-white'
                      : 'bg-white/10 text-text-muted cursor-not-allowed'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Criar Projeto
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Track Manager Modal */}
      <AnimatePresence>
        {showTrackManager && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-50"
              onClick={() => setShowTrackManager(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] bg-[#0f0f0f] border border-border-light rounded-2xl z-50 flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Header with gradient */}
              <div className="relative p-5 border-b border-border-light bg-[#141414]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
                <div className="flex items-center justify-between relative">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20">
                      <Trash2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Gerenciar Tracks</h2>
                      <p className="text-xs text-text-muted">Remova elementos indesejados do projeto</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTrackManager(false)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-text-secondary" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 space-y-5">
                {/* Ações rápidas por tipo */}
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-3 font-medium">Apagar por tipo</div>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => handleDeleteTracksByType(['text'])}
                      className="p-4 bg-white/5 border border-border-light rounded-xl hover:bg-primary/10 hover:border-primary/30 transition-all text-center group"
                    >
                      <FileText className="w-6 h-6 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-sm text-white block font-medium">Legendas</span>
                      <span className="text-[10px] text-text-muted">Textos/Subtitles</span>
                    </button>
                    <button
                      onClick={() => handleDeleteTracksByType(['effect'])}
                      className="p-4 bg-white/5 border border-border-light rounded-xl hover:bg-primary/10 hover:border-primary/30 transition-all text-center group"
                    >
                      <Zap className="w-6 h-6 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-sm text-white block font-medium">Efeitos</span>
                      <span className="text-[10px] text-text-muted">Video effects</span>
                    </button>
                    <button
                      onClick={() => handleDeleteTracksByType(['filter'])}
                      className="p-4 bg-white/5 border border-border-light rounded-xl hover:bg-primary/10 hover:border-primary/30 transition-all text-center group"
                    >
                      <Film className="w-6 h-6 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-sm text-white block font-medium">Filtros</span>
                      <span className="text-[10px] text-text-muted">Color filters</span>
                    </button>
                  </div>
                </div>

                {/* Lista de tracks individuais */}
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-3 font-medium flex items-center gap-2">
                    <span>Tracks na timeline</span>
                    <span className="bg-white/10 px-2 py-0.5 rounded-full text-white">{tracks.length}</span>
                  </div>
                  {tracks.length === 0 ? (
                    <div className="text-center py-8 bg-white/5 rounded-xl border border-border-light">
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
                        <Film className="w-6 h-6 text-text-muted" />
                      </div>
                      <span className="text-text-muted text-sm">Nenhuma track encontrada</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[200px] overflow-auto pr-1 scrollbar-thin">
                      {tracks.map((track, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-white/5 border border-border-light rounded-xl hover:bg-white/10 hover:border-white/20 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              track.type === 'video' ? 'bg-gradient-to-br from-green-500/30 to-green-500/10' :
                              track.type === 'audio' ? 'bg-gradient-to-br from-cyan-500/30 to-cyan-500/10' :
                              track.type === 'text' ? 'bg-gradient-to-br from-orange-500/30 to-orange-500/10' :
                              track.type === 'effect' ? 'bg-gradient-to-br from-primary/30 to-primary/10' :
                              track.type === 'filter' ? 'bg-gradient-to-br from-purple-500/30 to-purple-500/10' :
                              'bg-gradient-to-br from-gray-500/30 to-gray-500/10'
                            }`}>
                              {track.type === 'video' && <Film className="w-4 h-4 text-green-400" />}
                              {track.type === 'audio' && <RefreshCw className="w-4 h-4 text-cyan-400" />}
                              {track.type === 'text' && <FileText className="w-4 h-4 text-orange-400" />}
                              {track.type === 'effect' && <Zap className="w-4 h-4 text-primary" />}
                              {track.type === 'filter' && <Film className="w-4 h-4 text-purple-400" />}
                            </div>
                            <div>
                              <span className="text-sm text-white capitalize font-medium">{track.type}</span>
                              <span className="text-[10px] text-text-muted block">
                                {track.segments} segmento{track.segments !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteTrack(idx)}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-all opacity-0 group-hover:opacity-100"
                            title="Apagar esta track"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Deletar projeto */}
                <div className="border-t border-border-light pt-4">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Zona de perigo</div>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full p-3 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-3"
                  >
                    <Trash2 className="w-5 h-5 text-red-400" />
                    <div className="text-left">
                      <span className="text-sm text-red-400 block font-medium">Deletar projeto inteiro</span>
                      <span className="text-[10px] text-text-muted">Remove o projeto "{projectName}" permanentemente</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border-light bg-[#121212]">
                <button
                  onClick={() => setShowTrackManager(false)}
                  className="w-full py-2.5 bg-white/10 hover:bg-white/15 border border-border-light rounded-xl text-sm text-white font-medium transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-[60]"
              onClick={() => { setShowDeleteConfirm(false); setProjectToDelete(null); }}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-[#0f0f0f] border border-red-500/30 rounded-xl z-[60] overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Deletar projeto?</h3>
                <p className="text-sm text-text-muted mb-6">
                  Tem certeza que deseja deletar o projeto <span className="text-red-400 font-medium">"{projectToDelete?.name || projectName}"</span>?
                  <br />Esta ação não pode ser desfeita.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setProjectToDelete(null); }}
                    className="flex-1 btn-secondary py-2.5 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteProject}
                    className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Sim, deletar
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Track Delete Confirm Modal */}
      <AnimatePresence>
        {showTrackDeleteConfirm && trackToDelete && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-[60]"
              onClick={() => { setShowTrackDeleteConfirm(false); setTrackToDelete(null); }}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-[#0f0f0f] border border-red-500/30 rounded-xl z-[60] overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Apagar track?</h3>
                <p className="text-sm text-text-muted mb-6">
                  Tem certeza que deseja apagar a track <span className="text-red-400 font-medium capitalize">"{trackToDelete.type}"</span>
                  {trackToDelete.name && <> ({trackToDelete.name})</>}?
                  <br />Esta ação não pode ser desfeita.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowTrackDeleteConfirm(false); setTrackToDelete(null); }}
                    className="flex-1 btn-secondary py-2.5 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDeleteTrack}
                    className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Sim, apagar
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Open Project Confirm Modal */}
      <AnimatePresence>
        {projectToOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-[60]"
              onClick={() => setProjectToOpen(null)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-[#0f0f0f] border border-primary/30 rounded-xl z-[60] overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <FolderOpen className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Abrir projeto?</h3>
                <p className="text-sm text-text-muted mb-6">
                  Deseja abrir o projeto <span className="text-primary font-medium">"{projectToOpen.name}"</span>?
                  {projectPath && (
                    <><br /><span className="text-yellow-400 text-xs">O projeto atual será fechado.</span></>
                  )}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setProjectToOpen(null)}
                    className="flex-1 btn-secondary py-2.5 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      handleSelectProject(projectToOpen)
                      setProjectToOpen(null)
                    }}
                    className="flex-1 py-2.5 bg-primary hover:brightness-110 text-white text-sm font-medium rounded-lg transition-all"
                  >
                    Sim, abrir
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
